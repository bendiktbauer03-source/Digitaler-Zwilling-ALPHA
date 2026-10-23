import { WALDFOEPR_2025, tatbestand, type Foerdertatbestand } from './regelpaket-by-waldfoepr-2025';

export type Foerderstatus =
  | 'voraussichtlich'       // Satz belegt, Bagatellgrenze erreicht – vorbehaltlich Bewilligung
  | 'zu_pruefen'            // Satz belegt, aber Quelle noch gegen amtliche Anlage zu prüfen
  | 'unter_bagatellgrenze'
  | 'nicht_hinterlegt'      // kein belegter Satz – keine Zahl
  | 'nicht_im_land';        // für dieses Bundesland kein Regelpaket

export interface Foerderposten {
  tatbestandId: string;
  titel: string;
  menge: number;
  einheit: string;
  satz: number | null;
  betrag: number;
}

export interface Foerderergebnis {
  status: Foerderstatus;
  betrag: number;
  posten: Foerderposten[];
  hinweise: string[];
  bindefristJahre?: number;
  quellen: { titel: string; url: string; abgerufen: string }[];
  regelpaket: string;
}

export interface Foerderanfrage {
  bundesland: string;
  /** Pflanzen gesamt (Baumschulware) */
  pflanzen?: number;
  /** davon seltene Baumarten/Sträucher */
  pflanzenSelten?: number;
  /** Naturverjüngung sichern/pflegen, ha */
  naturverjuengungHa?: number;
  /** Jungbestandspflege */
  jungbestand?: { ha: number; hoeheM: number };
  /** Voranbau unter Schirm, Pflanzen */
  voranbauPflanzen?: number;
  /** Zaun oder Einzelschutz geplant */
  schutz?: boolean;
}

const einheitText = { stueck: 'Stk.', ha: 'ha', massnahme: 'Maßn.' } as const;

function posten(t: Foerdertatbestand, menge: number, satz: number | null, titel = t.titel): Foerderposten {
  return { tatbestandId: t.id, titel, menge, einheit: einheitText[t.einheit], satz, betrag: satz == null ? 0 : Math.round(menge * satz) };
}

export function foerderungPruefen(a: Foerderanfrage): Foerderergebnis {
  const paket = WALDFOEPR_2025;
  const leer: Foerderergebnis = { status: 'nicht_im_land', betrag: 0, posten: [], hinweise: [], quellen: [], regelpaket: '' };
  if (!/bay/i.test(a.bundesland)) {
    return { ...leer, hinweise: [`Für ${a.bundesland || 'dieses Bundesland'} ist noch kein geprüftes Regelpaket hinterlegt. Wir rechnen ohne Förderung und prüfen sie gesondert.`] };
  }
  const p: Foerderposten[] = [];
  const hinweise: string[] = [];
  const genutzt = new Set<Foerdertatbestand>();
  let bindefrist = 0;

  if (a.pflanzen && a.pflanzen > 0) {
    const t = tatbestand('pflanzung');
    const selten = Math.min(a.pflanzenSelten ?? 0, a.pflanzen);
    const normal = a.pflanzen - selten;
    if (normal > 0) p.push(posten(t, normal, t.satz));
    if (selten > 0) p.push(posten(t, selten, t.zuschlaege![0].satzProEinheit, 'Pflanzung · seltene Baumarten/Sträucher'));
    genutzt.add(t);
    bindefrist = Math.max(bindefrist, t.bindefristJahre ?? 0);
  }
  if (a.voranbauPflanzen && a.voranbauPflanzen > 0) {
    const t = tatbestand('voranbau');
    p.push(posten(t, a.voranbauPflanzen, t.satz));
    genutzt.add(t);
  }
  if (a.naturverjuengungHa && a.naturverjuengungHa > 0) {
    const t = tatbestand('naturverjuengung');
    p.push(posten(t, a.naturverjuengungHa, t.satz));
    genutzt.add(t);
    hinweise.push(...(t.ausschluesse ?? []));
  }
  if (a.jungbestand && a.jungbestand.ha > 0) {
    const t = tatbestand('jungbestandspflege');
    const stufe = t.stufen!.find((s) => a.jungbestand!.hoeheM <= s.bis);
    if (stufe) p.push(posten(t, a.jungbestand.ha, stufe.satz, `Jungbestandspflege · ${stufe.text}`));
    else hinweise.push('Jungbestandspflege ist nur bis 15 m mittlerer Bestandeshöhe förderfähig.');
    genutzt.add(t);
  }
  if (a.schutz) {
    const t = tatbestand('schutz');
    p.push(posten(t, 1, null));
    genutzt.add(t);
  }

  // Bagatellgrenzen je Tatbestand
  for (const t of genutzt) {
    if (!t.bagatellgrenze) continue;
    const summe = p.filter((x) => x.tatbestandId === t.id).reduce((s, x) => s + x.betrag, 0);
    if (summe > 0 && summe < t.bagatellgrenze) {
      hinweise.push(`${t.titel}: ${summe.toLocaleString('de-DE')} € liegen unter der Bagatellgrenze von ${t.bagatellgrenze.toLocaleString('de-DE')} € – so nicht förderfähig.`);
      for (const x of p) if (x.tatbestandId === t.id) x.betrag = 0;
    }
  }

  const betrag = p.reduce((s, x) => s + x.betrag, 0);
  const offen = p.filter((x) => x.satz == null);
  for (const x of offen) hinweise.push(`${x.titel}: Satz nicht hinterlegt – wird vor dem Antrag mit dem AELF geprüft, nicht geschätzt.`);
  hinweise.push(paket.allgemein[0]);
  if (bindefrist > 0) hinweise.push(`Bindefrist ${bindefrist} Jahre: Die geförderte Kultur muss so lange erhalten bleiben.`);

  const ungeprueft = [...genutzt].some((t) => !t.geprueft && (t.satz != null || !!t.stufen));
  let status: Foerderstatus;
  if (p.length === 0) status = 'nicht_hinterlegt';
  else if (betrag === 0 && offen.length === p.length) status = 'nicht_hinterlegt';
  else if (betrag === 0) status = 'unter_bagatellgrenze';
  else status = ungeprueft ? 'zu_pruefen' : 'voraussichtlich';

  return {
    status,
    betrag,
    posten: p,
    hinweise,
    bindefristJahre: bindefrist || undefined,
    quellen: [...genutzt].map((t) => t.quelle),
    regelpaket: `${paket.programm} · Regelpaket ${paket.version}`,
  };
}

export const FOERDERSTATUS_TEXT: Record<Foerderstatus, string> = {
  voraussichtlich: 'voraussichtlich förderfähig',
  zu_pruefen: 'förderfähig, Satz vor Antrag prüfen',
  unter_bagatellgrenze: 'unter Bagatellgrenze',
  nicht_hinterlegt: 'Satz nicht hinterlegt',
  nicht_im_land: 'kein Regelpaket für dieses Land',
};
