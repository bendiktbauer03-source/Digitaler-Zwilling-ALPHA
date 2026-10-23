/**
 * Holzernte-Optimierer (vereinfachtes, transparentes Modell).
 *
 * Deckungsbeitrag = Holzerlös − Ernte und Rückung − sonstige variable Kosten
 *
 * Wenn die Pipeline für einen Bestand bereits eine Route mit SorSim/HeProMo gerechnet hat,
 * gilt deren Ergebnis vorrangig. Dieses Modell schließt die Lücke für alle übrigen Bestände
 * und rechnet Sensitivitäten. Es ist kein Ersatz für eine kalibrierte Sortiments- und
 * Kostensimulation – das steht in jedem Ergebnis.
 */
import { stammholzpreis, staerkeklasse, type Annahmen } from './annahmen';
import { abzinsen, schadenBis } from './finanzen';
import { ART_TEXT, istNadel, type Artgruppe, type Bestand } from './modell';
import { spanneVon } from './messwert';

export type Verfahren = 'harvester' | 'motormanuell' | 'seilkran';

export const VERFAHREN_TEXT: Record<Verfahren, string> = {
  harvester: 'Harvester und Forwarder (vollmechanisiert)',
  motormanuell: 'Motorsäge und Rückung (motormanuell)',
  seilkran: 'Seilkran (Hanglage, nicht befahrbar)',
};

export interface ErnteEingabe {
  bestand: Bestand;
  entnahmeVfmHa: number;
  /** BHD der entnommenen Bäume; Standard abhängig von Eingriffsart */
  entnahmeBhdCm?: number;
  rueckeM?: number;
  verfahren?: Verfahren | 'auto';
  annahmen: Annahmen;
}

export interface Sortiment { art: string; sorte: string; efm: number; preis: number; erloes: number }

export interface ErnteErgebnis {
  vfm: number;
  efm: number;
  erloes: number;
  kosten: number;
  db: number;
  dbProHa: number;
  dbJeEfm: number;
  dbSpanne: [number, number];
  kostenJeEfm: number;
  stueckmasseEfm: number;
  verfahren: Verfahren;
  sortimente: Sortiment[];
  hinweise: string[];
  modell: string;
}

const VFM_ZU_EFM = { nadel: 0.8, laub: 0.75 };
const FORMZAHL = 0.5;

/** Volumen eines Baums (Vfm) aus BHD und Höhe, Formzahl-Näherung. */
export function baumvolumen(bhdCm: number, hoeheM: number) {
  const d = bhdCm / 100;
  return (Math.PI / 4) * d * d * hoeheM * FORMZAHL;
}

export function verfahrenWaehlen(b: Bestand, bhdCm: number, a: Annahmen): Verfahren {
  if ((b.hangGrad ?? 0) > a.ernte.hangBefahrbarBisGrad) return 'seilkran';
  if (!istNadel(b.fuehrend) && bhdCm >= 40) return 'motormanuell';
  return 'harvester';
}

function stammholzAnteil(art: Artgruppe, bhd: number) {
  const k = (x: number) => Math.max(0, Math.min(1, x));
  return istNadel(art) ? k((bhd - 12) / 30) * 0.85 : k((bhd - 25) / 45) * 0.6;
}

export function standardEntnahmeBhd(b: Bestand): number {
  const bhd = b.bhdCm ?? 30;
  // Durchforstung nimmt eher schwächere, Zielstärkennutzung eher stärkere Bäume
  return b.hiebsreife?.toLowerCase().includes('zielstärke') ? Math.round(bhd * 1.25) : Math.round(bhd * 0.9);
}

export function ernteRechnen(e: ErnteEingabe): ErnteErgebnis {
  const { bestand: b, annahmen: a } = e;
  const bhd = e.entnahmeBhdCm ?? standardEntnahmeBhd(b);
  const h = b.hoeheM ?? 25;
  const verfahren = !e.verfahren || e.verfahren === 'auto' ? verfahrenWaehlen(b, bhd, a) : e.verfahren;
  const vfm = Math.max(0, e.entnahmeVfmHa) * b.ha;
  const hinweise: string[] = [];

  const sortimente: Sortiment[] = [];
  let efm = 0;
  for (const { art, pct } of b.arten) {
    if (pct <= 0) continue;
    const artVfm = (vfm * pct) / 100;
    const artEfm = artVfm * (istNadel(art) ? VFM_ZU_EFM.nadel : VFM_ZU_EFM.laub);
    efm += artEfm;
    const anteil = stammholzAnteil(art, bhd);
    const klasse = staerkeklasse(bhd * 0.85);
    const stammEfm = artEfm * anteil;
    const indEfm = artEfm - stammEfm;
    if (stammEfm > 0.05) {
      const preis = stammholzpreis(a, art, klasse) * a.preisFaktor;
      sortimente.push({ art: ART_TEXT[art], sorte: `Stammholz ${klasse}`, efm: stammEfm, preis, erloes: stammEfm * preis });
    }
    if (indEfm > 0.05) {
      const preis = a.preise[art].industrie * a.preisFaktor;
      sortimente.push({ art: ART_TEXT[art], sorte: istNadel(art) ? 'Industrieholz' : 'Industrie-/Brennholz', efm: indEfm, preis, erloes: indEfm * preis });
    }
  }

  const v = Math.max(0.05, baumvolumen(bhd, h) * (istNadel(b.fuehrend) ? VFM_ZU_EFM.nadel : VFM_ZU_EFM.laub));
  const E = a.ernte;
  const ruecken = E.forwarderGrund + (E.rueckeJe100m * (e.rueckeM ?? 250)) / 100;
  let kostenJeEfm =
    verfahren === 'harvester'
      ? E.harvesterGrund + E.harvesterStueck / v + ruecken
      : E.motormanuellGrund + E.motormanuellStueck / v + ruecken + (verfahren === 'seilkran' ? E.seilkranZuschlag : 0);
  kostenJeEfm = (kostenJeEfm + E.verwaltung) * a.kostenFaktor;

  const erloes = sortimente.reduce((s, x) => s + x.erloes, 0);
  const kosten = efm * kostenJeEfm;
  const db = erloes - kosten;
  const dbSpanne: [number, number] = [erloes * 0.88 - kosten * 1.1, erloes * 1.12 - kosten * 0.9];

  const [vLo] = spanneVon(b.vorrat);
  if (e.entnahmeVfmHa > 0.3 * vLo) hinweise.push('Starker Eingriff: mehr als 30 % des vorsichtig geschätzten Vorrats. Stabilität und Bodenschutz vorher prüfen.');
  if (verfahren === 'seilkran') hinweise.push(`Hangneigung ${Math.round(b.hangGrad ?? 0)}° – nicht befahrbar, Seilkran nötig. Kosten deutlich höher.`);
  if (v < 0.15) hinweise.push('Sehr geringe Stückmasse: Die Erntekosten je Festmeter sind hoch, der Eingriff ist eher Pflege als Einnahme.');
  if (db < 0) hinweise.push('Unter diesen Annahmen deckt der Erlös die Kosten nicht. Als Pflegeeingriff kann er trotzdem sinnvoll sein.');

  return {
    vfm, efm, erloes, kosten, db,
    dbProHa: b.ha > 0 ? db / b.ha : 0,
    dbJeEfm: efm > 0 ? db / efm : 0,
    dbSpanne, kostenJeEfm, stueckmasseEfm: v, verfahren,
    sortimente: sortimente.sort((x, y) => y.erloes - x.erloes),
    hinweise,
    modell: 'Waldgrafen-Erntemodell v1 (Stückmassegesetz, Sortierung nach BHD, Preise frei Waldstraße)',
  };
}

export interface Zeitpunkt { inJahren: number; ergebnis: ErnteErgebnis; schadenWahrscheinlichkeit: number; erwarteterDb: number; kapitalwert: number }

/** Jährliche Schadwahrscheinlichkeit aus der Eignungsentwicklung der führenden Baumart. */
export function schadrisikoProJahr(b: Bestand, a: Annahmen) {
  const e = b.eignung.find((x) => x.art.toLowerCase().includes(b.fuehrendText.toLowerCase().slice(0, 5)));
  const ent = e?.entwicklung === 'schlechter' ? 'schlechter' : e?.entwicklung === 'besser' ? 'besser' : 'stabil';
  return a.schadrisiko[ent];
}

/** Jetzt ernten oder später? Gleiche Eingriffsstärke (Anteil am Vorrat), wachsender Bestand, Risiko und Abzinsung. */
export function zeitpunkteVergleichen(e: ErnteEingabe, zins: number, jahre = [0, 5, 10]): Zeitpunkt[] {
  const b = e.bestand;
  const anteil = b.vorrat.wert > 0 ? e.entnahmeVfmHa / b.vorrat.wert : 0;
  const zuwachs = b.zuwachs?.wert ?? (istNadel(b.fuehrend) ? 9 : 7);
  const dZ = e.annahmen.dZuwachs[istNadel(b.fuehrend) ? 'nadel' : 'laub'];
  const p = schadrisikoProJahr(b, e.annahmen);
  const bhd0 = e.entnahmeBhdCm ?? standardEntnahmeBhd(b);
  return jahre.map((t) => {
    const vorratT = b.vorrat.wert + zuwachs * t;
    const ergebnis = ernteRechnen({
      ...e,
      bestand: { ...b, hoeheM: (b.hoeheM ?? 25) + 0.2 * t, vorrat: { ...b.vorrat, wert: vorratT } },
      entnahmeVfmHa: anteil * vorratT,
      entnahmeBhdCm: bhd0 + dZ * t,
    });
    const ps = schadenBis(t, p);
    const erwarteterDb = ergebnis.db * (1 - ps * e.annahmen.schadholzAbschlag);
    return { inJahren: t, ergebnis, schadenWahrscheinlichkeit: ps, erwarteterDb, kapitalwert: abzinsen(erwarteterDb, t, zins) };
  });
}

/** Vorschlag für die Entnahmemenge, wenn nichts vorgegeben ist. */
export function standardEntnahme(b: Bestand): number {
  const v = b.vorrat.wert;
  const ziel = b.hiebsreife?.toLowerCase().includes('zielstärke');
  const anteil = ziel ? 0.15 : istNadel(b.fuehrend) ? 0.14 : 0.12;
  return Math.round(Math.min(90, v * anteil));
}
