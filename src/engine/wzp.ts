/**
 * Winkelzählprobe nach Bitterlich.
 *
 *   G = k · n        (Grundfläche m²/ha, Zählfaktor k, gezählte Bäume n; Grenzbäume zählen halb)
 *
 * Am Hang ohne automatische Neigungskorrektur wird durch cos(α) geteilt.
 * Aus mehreren Punkten folgen Mittelwert und Stichprobenfehler (t-Verteilung, 95 %).
 * Vorrat = G · Höhe · Formzahl. Die Grundfläche allein ist noch kein Vorrat – Höhe und
 * Formzahl gehen mit eigener Unsicherheit in die Fehlerangabe ein.
 */
import type { Artgruppe } from './modell';
import type { Messwert } from './messwert';

export interface WzpPunkt { gezaehlt: number; grenzbaeume: number; hangGrad?: number }

export const ZAEHLFAKTOREN = [1, 2, 4] as const;

const T95 = [NaN, 12.71, 4.30, 3.18, 2.78, 2.57, 2.45, 2.36, 2.31, 2.26, 2.23, 2.20, 2.18, 2.16, 2.14, 2.13, 2.12, 2.11, 2.10, 2.09, 2.09];
const t95 = (df: number) => (df < T95.length ? T95[df] : 1.96);

/** Derbholzformzahl (mit Rinde), Näherung je Baumartengruppe */
export const FORMZAHL: Record<Artgruppe, number> = {
  fichte: 0.47, tanne: 0.48, kiefer: 0.45, douglasie: 0.45, laerche: 0.45,
  buche: 0.49, eiche: 0.48, edellaub: 0.48, sonstiges: 0.47,
};

/** Unsicherheit aus Höhe und Formzahl, wenn die Höhe fernerkundlich gemessen ist (±%) */
const FEHLER_HOEHE_FORM_PCT = 6;
/** Annahme, solange weniger als drei Punkte vorliegen (±%) */
const FEHLER_OHNE_STATISTIK_PCT = 30;

export function grundflaecheAmPunkt(p: WzpPunkt, k: number) {
  const n = p.gezaehlt + 0.5 * p.grenzbaeume;
  const cos = Math.cos(((p.hangGrad ?? 0) * Math.PI) / 180);
  return (k * n) / (cos > 0.2 ? cos : 1);
}

export interface WzpErgebnis {
  punkte: number;
  gProPunkt: number[];
  gMittel: number;
  /** Relativer Stichprobenfehler der Grundfläche, 95 %, in % */
  fehlerGPct: number | null;
  vorratVfmHa: number;
  genauigkeitPct: number;
  spanne: [number, number];
  hinweis: string;
}

export function wzpAuswerten(punkte: WzpPunkt[], k: number, hoeheM: number, art: Artgruppe): WzpErgebnis {
  const g = punkte.map((p) => grundflaecheAmPunkt(p, k));
  const n = g.length;
  const mittel = n ? g.reduce((s, x) => s + x, 0) / n : 0;
  let fehlerG: number | null = null;
  if (n >= 3 && mittel > 0) {
    const sd = Math.sqrt(g.reduce((s, x) => s + (x - mittel) ** 2, 0) / (n - 1));
    fehlerG = ((t95(n - 1) * sd) / Math.sqrt(n) / mittel) * 100;
  }
  const vorrat = mittel * hoeheM * FORMZAHL[art];
  const fehlerGesamt = Math.sqrt((fehlerG ?? FEHLER_OHNE_STATISTIK_PCT) ** 2 + FEHLER_HOEHE_FORM_PCT ** 2);
  const genau = Math.round(fehlerGesamt * 10) / 10;
  return {
    punkte: n,
    gProPunkt: g,
    gMittel: mittel,
    fehlerGPct: fehlerG,
    vorratVfmHa: vorrat,
    genauigkeitPct: genau,
    spanne: [vorrat * (1 - genau / 100), vorrat * (1 + genau / 100)],
    hinweis: n < 3
      ? 'Mindestens drei Punkte, gleichmäßig über den Bestand verteilt, ergeben erst eine echte Fehlerangabe.'
      : fehlerG! > 15
        ? 'Die Punkte streuen stark. Zwei bis drei weitere Punkte verengen die Spanne deutlich.'
        : 'Gute Aufnahme. Die Spanne ist jetzt eng genug für eine Holzverkaufsentscheidung.',
  };
}

export function wzpAlsMesswert(e: WzpErgebnis, datum: string, k: number): Messwert {
  return {
    wert: Math.round(e.vorratVfmHa),
    einheit: 'Vfm/ha',
    quelle: `Winkelzählprobe, ${e.punkte} Punkte, Zählfaktor ${k} · Höhe aus Fernerkundung`,
    herkunft: 'vor_ort',
    stand: datum,
    genauigkeitPct: e.genauigkeitPct,
    spanne: [Math.round(e.spanne[0]), Math.round(e.spanne[1])],
  };
}
