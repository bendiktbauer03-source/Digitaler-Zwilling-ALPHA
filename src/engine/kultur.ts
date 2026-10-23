/**
 * Zukunftswald- und Waldumbau-Rechner.
 *
 * Drei Wege für eine zu verjüngende Fläche: Naturverjüngung fördern, standortgerechter
 * Mischwald durch Pflanzung, oder die Kombination. Ausfälle werden als drei Szenarien
 * gerechnet – nicht als scheinpräzise Überlebenswahrscheinlichkeit.
 */
import type { Annahmen } from './annahmen';
import { kapitalwert, type Zahlung } from './finanzen';
import { foerderungPruefen, type Foerderergebnis } from './foerderung/pruefen';
import { ART_TEXT, type Artgruppe, type Belastung } from './modell';

export type Strategie = 'naturverjuengung' | 'pflanzung' | 'kombination';
export type Schutz = 'zaun' | 'einzelschutz' | 'keiner';

export interface Mischungsanteil { art: Artgruppe; anteil: number; stkProHa: number; selten?: boolean }

export interface KulturEingabe {
  ha: number;
  bundesland: string;
  verbiss: Belastung;
  schutz: Schutz;
  mischung: Mischungsanteil[];
  /** Naturverjüngung trägt (Samenbäume, Vorausverjüngung)? */
  nvMoeglich: boolean;
  /** Flächenanteil Naturverjüngung bei der Kombination */
  nvAnteil?: number;
  /** Voranbau unter Schirm wird als eigener Tatbestand geprüft */
  voranbau?: boolean;
  zins: number;
  annahmen: Annahmen;
}

export type Drei = [number, number, number];

export interface KulturErgebnis {
  strategie: Strategie;
  titel: string;
  kurz: string;
  pflanzen: number;
  investition: number;
  schutzkosten: number;
  pflegekosten: number;
  nachbesserung: Drei;
  kosten: Drei;
  foerderung: Foerderergebnis;
  eigenanteil: Drei;
  ausfall: Drei;
  zahlungen: Zahlung[];
  kapitalwert: number;
  gesperrt?: string;
  vorteile: string[];
  risiken: string[];
}

export const STRATEGIE_TEXT: Record<Strategie, { titel: string; kurz: string }> = {
  naturverjuengung: { titel: 'Naturverjüngung fördern', kurz: 'Investitionsarm · abhängig von Samenbäumen und Verbiss' },
  pflanzung: { titel: 'Standortgerechter Mischwald durch Pflanzung', kurz: 'Höhere Anfangsinvestition · gezielte Baumartenwahl' },
  kombination: { titel: 'Naturverjüngung plus Ergänzungspflanzung', kurz: 'Teilflächenweise · flexible Investitionshöhe' },
};

/** Verbissgefährdete Arten, die bei Einzelschutz geschützt werden. */
const VERBISSGEFAEHRDET: Artgruppe[] = ['tanne', 'eiche', 'edellaub', 'douglasie'];

function zaunLfm(ha: number) {
  return 4 * Math.sqrt(ha * 10000) * 1.15;
}

function mal(d: Drei, f: number): Drei { return [d[0] * f, d[1] * f, d[2] * f]; }
function plus(d: Drei, x: number): Drei { return [d[0] + x, d[1] + x, d[2] + x]; }

function pflanzteil(ha: number, e: KulturEingabe) {
  const a = e.annahmen;
  const summeAnteil = e.mischung.reduce((s, m) => s + m.anteil, 0) || 1;
  let pflanzen = 0, selten = 0, pflanzkosten = 0, geschuetzt = 0;
  for (const m of e.mischung) {
    const n = Math.round(ha * m.stkProHa * (m.anteil / summeAnteil));
    pflanzen += n;
    if (m.selten) selten += n;
    if (VERBISSGEFAEHRDET.includes(m.art)) geschuetzt += n;
    pflanzkosten += n * ((a.kultur.pflanzenpreis[m.art] ?? 1.2) + a.kultur.pflanzarbeitStk);
  }
  const schutz =
    e.schutz === 'zaun' ? zaunLfm(ha) * a.kultur.zaunLfm :
    e.schutz === 'einzelschutz' ? geschuetzt * a.kultur.einzelschutzStk : 0;
  // Ausfall: Zaun schützt alles, Einzelschutz nur die gefährdeten Arten
  const ungesch = a.ausfall.ungeschuetzt[e.verbiss];
  const gesch = a.ausfall.geschuetzt;
  const quoteGeschuetzt = e.schutz === 'zaun' ? 1 : e.schutz === 'einzelschutz' && pflanzen > 0 ? geschuetzt / pflanzen : 0;
  const ausfall: Drei = [0, 1, 2].map((i) => gesch[i] * quoteGeschuetzt + ungesch[i] * (1 - quoteGeschuetzt)) as Drei;
  const stueckkosten = pflanzen > 0 ? pflanzkosten / pflanzen : 0;
  const nachbesserung = mal(ausfall, pflanzen * stueckkosten);
  return { pflanzen, selten, pflanzkosten, schutz, ausfall, nachbesserung };
}

/** NV-Fehlschlag: Anteil der Fläche, der später doch bepflanzt werden muss. */
function nvFehlschlag(e: KulturEingabe): Drei {
  if (e.schutz === 'zaun') return [0.05, 0.15, 0.3];
  return { gering: [0.05, 0.15, 0.3], mittel: [0.1, 0.3, 0.5], hoch: [0.25, 0.5, 0.8] }[e.verbiss] as Drei;
}

export function kulturRechnen(strategie: Strategie, e: KulturEingabe): KulturErgebnis {
  const a = e.annahmen;
  const { titel, kurz } = STRATEGIE_TEXT[strategie];
  const nvHa = strategie === 'naturverjuengung' ? e.ha : strategie === 'kombination' ? e.ha * (e.nvAnteil ?? 0.5) : 0;
  const pflanzHa = e.ha - nvHa;
  const vorteile: string[] = [];
  const risiken: string[] = [];

  const p = pflanzHa > 0 ? pflanzteil(pflanzHa, e) : { pflanzen: 0, selten: 0, pflanzkosten: 0, schutz: 0, ausfall: [0, 0, 0] as Drei, nachbesserung: [0, 0, 0] as Drei };
  const nvSchutz = nvHa > 0 && e.schutz === 'zaun' ? zaunLfm(nvHa) * a.kultur.zaunLfm : 0;
  const nvKosten = nvHa * a.kultur.nvSicherungHa;
  // Fällt die NV aus, wird nachgepflanzt – zum Stückpreis einer Mischkultur
  const mischStk = e.mischung.reduce((s, m) => s + m.stkProHa * m.anteil, 0) / (e.mischung.reduce((s, m) => s + m.anteil, 0) || 1);
  const ergStkKosten = 1.1 + a.kultur.pflanzarbeitStk;
  const nvNachpflanzung = mal(nvFehlschlag(e), nvHa * mischStk * ergStkKosten);

  const schutzkosten = p.schutz + nvSchutz;
  const investition = p.pflanzkosten + schutzkosten + nvKosten;
  const pflegekosten = a.kultur.pflegeHaJahr * a.kultur.pflegeJahre * (pflanzHa + nvHa * 0.5);
  const nachbesserung: Drei = [0, 1, 2].map((i) => p.nachbesserung[i] + nvNachpflanzung[i]) as Drei;
  const kosten = plus(nachbesserung, investition + pflegekosten);

  const foerderung = foerderungPruefen({
    bundesland: e.bundesland,
    pflanzen: e.voranbau ? 0 : p.pflanzen,
    pflanzenSelten: e.voranbau ? 0 : p.selten,
    voranbauPflanzen: e.voranbau ? p.pflanzen : undefined,
    naturverjuengungHa: nvHa > 0 ? nvHa : undefined,
    schutz: e.schutz !== 'keiner',
  });
  // Eine Zuwendung deckt höchstens die Ausgaben, für die sie gewährt wird.
  const foerderfaehig = investition + pflegekosten;
  if (foerderung.betrag > foerderfaehig) {
    foerderung.hinweise.unshift(`Förderung auf die geplanten Ausgaben von ${Math.round(foerderfaehig).toLocaleString('de-DE')} € begrenzt – echte Angebote bestimmen den Betrag.`);
    foerderung.betrag = Math.round(foerderfaehig);
  }
  const eigenanteil = plus(kosten, -foerderung.betrag);

  const zahlungen: Zahlung[] = [
    { jahr: 0, betrag: -investition, text: 'Pflanzen, Pflanzung, Schutz, Sicherung' },
    ...(foerderung.betrag > 0 ? [{ jahr: 1, betrag: foerderung.betrag, text: 'Förderung nach Verwendungsnachweis' }] : []),
    ...Array.from({ length: a.kultur.pflegeJahre }, (_, i) => ({ jahr: i + 1, betrag: -pflegekosten / a.kultur.pflegeJahre, text: 'Kulturpflege' })),
    { jahr: 2, betrag: -nachbesserung[1], text: 'Nachbesserung (mittleres Szenario)' },
  ];

  let gesperrt: string | undefined;
  if (nvHa > 0 && !e.nvMoeglich) gesperrt = 'Ohne Samenbäume oder Vorausverjüngung trägt Naturverjüngung hier nicht.';

  if (strategie === 'naturverjuengung') {
    vorteile.push('Geringste Anfangsinvestition', 'Heimische, angepasste Herkünfte aus dem eigenen Bestand');
    risiken.push('Baumartenwahl folgt den vorhandenen Samenbäumen, nicht dem Ziel', `Bei ${e.verbiss}em Verbiss fallen ohne Schutz Mischbaumarten aus`);
  } else if (strategie === 'pflanzung') {
    vorteile.push(`Zielmischung gesichert: ${e.mischung.map((m) => ART_TEXT[m.art]).join(', ')}`, 'Planbarer Zeitpunkt, Förderung je Pflanze');
    risiken.push('Höchste Anfangsinvestition', 'Trockenjahre nach der Pflanzung erhöhen den Ausfall');
  } else {
    vorteile.push('Nutzt vorhandene Verjüngung, ergänzt nur, was fehlt', 'Investition nach Teilfläche steuerbar');
    risiken.push('Erfordert eine gute Ansprache der Teilflächen vor Ort');
  }
  if (e.schutz === 'keiner' && e.verbiss !== 'gering') risiken.push('Ohne Schutz und Jagd ist der Verbiss der größte Kostentreiber.');
  if (foerderung.betrag > 0) vorteile.push(`Förderung ≈ ${Math.round(foerderung.betrag).toLocaleString('de-DE')} €, vorbehaltlich Bewilligung`);

  return {
    strategie, titel, kurz,
    pflanzen: p.pflanzen,
    investition, schutzkosten, pflegekosten, nachbesserung, kosten, foerderung, eigenanteil,
    ausfall: p.pflanzen > 0 ? p.ausfall : nvFehlschlag(e),
    zahlungen,
    kapitalwert: kapitalwert(zahlungen, e.zins),
    gesperrt, vorteile, risiken,
  };
}

/** Eine standortgerechte Ausgangsmischung aus der Eignungsansprache. */
export function standardMischung(geeignet: string[]): Mischungsanteil[] {
  const tab: Record<string, Mischungsanteil> = {
    tanne: { art: 'tanne', anteil: 30, stkProHa: 3000 },
    buche: { art: 'buche', anteil: 35, stkProHa: 5000 },
    eiche: { art: 'eiche', anteil: 30, stkProHa: 6000 },
    edellaub: { art: 'edellaub', anteil: 15, stkProHa: 2500 },
    douglasie: { art: 'douglasie', anteil: 20, stkProHa: 2000 },
    kiefer: { art: 'kiefer', anteil: 20, stkProHa: 5000 },
    laerche: { art: 'laerche', anteil: 10, stkProHa: 2500 },
    fichte: { art: 'fichte', anteil: 10, stkProHa: 2500 },
  };
  const out: Mischungsanteil[] = [];
  for (const g of geeignet) {
    const s = g.toLowerCase();
    const key = Object.keys(tab).find((k) => s.includes(k === 'edellaub' ? 'ahorn' : k));
    if (key && !out.some((m) => m.art === tab[key].art)) out.push({ ...tab[key] });
    if (out.length >= 3) break;
  }
  return out.length ? out : [tab.buche, tab.tanne, tab.edellaub].map((m) => ({ ...m }));
}
