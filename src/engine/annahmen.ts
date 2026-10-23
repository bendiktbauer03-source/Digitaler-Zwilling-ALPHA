/**
 * Alle wirtschaftlichen Annahmen an einer Stelle. Sie sind ausdrücklich Annahmen:
 * regional zu prüfen, in Waldgrafen Pro überschreibbar und in jedem Rechenlauf
 * mitgespeichert, damit ein Ergebnis von heute in einem Jahr nachvollziehbar bleibt.
 */
import type { Artgruppe } from './modell';

export type Staerkeklasse = '1a' | '1b' | '2a' | '2b' | '3a' | '3b' | '4' | '5' | '6+';

export interface Annahmen {
  version: string;
  stand: string;
  /** Holzpreise frei Waldstraße, € je Efm o. R. */
  preise: Record<Artgruppe, { stamm: Partial<Record<Staerkeklasse, number>>; industrie: number }>;
  /** Faktoren für Sensitivität (1 = Basis) */
  preisFaktor: number;
  kostenFaktor: number;
  /** Erntekosten-Parameter (an HeProMo/KWF-Größenordnung angelehnt, vereinfacht) */
  ernte: {
    harvesterGrund: number;      // €/Efm
    harvesterStueck: number;     // €/Efm · Efm/Baum (Stückmassegesetz: + b / v)
    forwarderGrund: number;      // €/Efm
    rueckeJe100m: number;        // €/Efm je 100 m Rückeentfernung
    motormanuellGrund: number;
    motormanuellStueck: number;
    seilkranZuschlag: number;    // €/Efm
    verwaltung: number;          // €/Efm (Vermessung, Abrechnung)
    hangBefahrbarBisGrad: number;
  };
  /** Kultur und Schutz */
  kultur: {
    pflanzenpreis: Partial<Record<Artgruppe, number>>;  // €/Stk
    pflanzarbeitStk: number;
    zaunLfm: number;
    einzelschutzStk: number;
    pflegeHaJahr: number;
    pflegeJahre: number;
    nvSicherungHa: number;         // Kosten Sicherung/Pflege NV (ohne Pflanzen)
    jungbestandspflegeHa: number;  // Unternehmerkosten Jungbestandspflege
  };
  /** Ausfallszenarien [gering, mittel, hoch] in Anteilen, nach Verbiss und Schutz */
  ausfall: { geschuetzt: [number, number, number]; ungeschuetzt: Record<'gering' | 'mittel' | 'hoch', [number, number, number]> };
  /** Jährliche Schadwahrscheinlichkeit nach Entwicklung der Baumarteneignung */
  schadrisiko: { stabil: number; schlechter: number; besser: number };
  /** Anteil des Holzwerts, der bei Schadholz verloren geht */
  schadholzAbschlag: number;
  /** Jährlicher Durchmesserzuwachs in cm */
  dZuwachs: Record<'nadel' | 'laub', number>;
}

export const STANDARD_ANNAHMEN: Annahmen = {
  version: 'A-2026.10',
  stand: '2026-10-23',
  preise: {
    fichte:    { stamm: { '1a': 50, '1b': 62, '2a': 82, '2b': 93, '3a': 98, '3b': 98, '4': 95, '5': 88, '6+': 80 }, industrie: 40 },
    tanne:     { stamm: { '1a': 45, '1b': 57, '2a': 77, '2b': 88, '3a': 93, '3b': 93, '4': 90, '5': 83, '6+': 75 }, industrie: 38 },
    douglasie: { stamm: { '2a': 85, '2b': 100, '3a': 110, '3b': 115, '4': 115, '5': 110, '6+': 105 }, industrie: 40 },
    kiefer:    { stamm: { '1b': 50, '2a': 62, '2b': 70, '3a': 75, '3b': 78, '4': 80, '5': 78, '6+': 75 }, industrie: 36 },
    laerche:   { stamm: { '2a': 80, '2b': 95, '3a': 105, '3b': 110, '4': 110, '5': 105, '6+': 100 }, industrie: 40 },
    buche:     { stamm: { '3a': 58, '3b': 60, '4': 64, '5': 68, '6+': 72 }, industrie: 55 },
    eiche:     { stamm: { '3a': 120, '3b': 140, '4': 180, '5': 250, '6+': 320 }, industrie: 60 },
    edellaub:  { stamm: { '3a': 70, '3b': 80, '4': 100, '5': 130, '6+': 150 }, industrie: 55 },
    sonstiges: { stamm: { '3a': 50, '4': 55, '5': 55, '6+': 55 }, industrie: 45 },
  },
  preisFaktor: 1,
  kostenFaktor: 1,
  ernte: {
    harvesterGrund: 8,
    harvesterStueck: 4.2,
    forwarderGrund: 7,
    rueckeJe100m: 1,
    motormanuellGrund: 10,
    motormanuellStueck: 5,
    seilkranZuschlag: 25,
    verwaltung: 2,
    hangBefahrbarBisGrad: 20,
  },
  kultur: {
    pflanzenpreis: { fichte: 0.7, tanne: 1.8, douglasie: 1.5, kiefer: 0.5, laerche: 0.9, buche: 0.9, eiche: 0.8, edellaub: 1.1, sonstiges: 1.2 },
    pflanzarbeitStk: 1.8,
    zaunLfm: 9,
    einzelschutzStk: 2.6,
    pflegeHaJahr: 380,
    pflegeJahre: 3,
    nvSicherungHa: 900,
    jungbestandspflegeHa: 1100,
  },
  ausfall: {
    geschuetzt: [0.08, 0.15, 0.3],
    ungeschuetzt: { gering: [0.1, 0.2, 0.35], mittel: [0.2, 0.35, 0.55], hoch: [0.3, 0.5, 0.75] },
  },
  schadrisiko: { besser: 0.004, stabil: 0.008, schlechter: 0.025 },
  schadholzAbschlag: 0.4,
  dZuwachs: { nadel: 0.4, laub: 0.35 },
};

export const QUELLEN_ANNAHMEN = [
  'Holzpreise: Größenordnung frei Waldstraße Süddeutschland, Stand 10/2026 – Annahme, keine Marktmeldung. Vor Verkauf mit aktuellen Angeboten ersetzen.',
  'Erntekosten: Stückmassegesetz (Kosten sinken mit dem Volumen je Baum), Größenordnung nach KWF-Kalkulationsschema und HeProMo – vereinfacht, nicht kalibriert.',
  'Kultur: Pflanzenpreise und Arbeitskosten als Richtwerte; echte Angebote ersetzen sie.',
  'Ausfall: Szenarien statt Überlebenswahrscheinlichkeit – regional nicht kalibriert.',
];

export function staerkeklasse(mittendurchmesserCm: number): Staerkeklasse {
  const d = mittendurchmesserCm;
  if (d < 15) return '1a';
  if (d < 20) return '1b';
  if (d < 25) return '2a';
  if (d < 30) return '2b';
  if (d < 35) return '3a';
  if (d < 40) return '3b';
  if (d < 50) return '4';
  if (d < 60) return '5';
  return '6+';
}

const KLASSEN: Staerkeklasse[] = ['1a', '1b', '2a', '2b', '3a', '3b', '4', '5', '6+'];

/** Preis einer Klasse; fehlt sie, gilt die nächste vorhandene Klasse darunter, sonst darüber. */
export function stammholzpreis(a: Annahmen, art: Artgruppe, k: Staerkeklasse): number {
  const tab = a.preise[art].stamm;
  const i = KLASSEN.indexOf(k);
  for (let j = i; j >= 0; j--) if (tab[KLASSEN[j]] != null) return tab[KLASSEN[j]]!;
  for (let j = i; j < KLASSEN.length; j++) if (tab[KLASSEN[j]] != null) return tab[KLASSEN[j]]!;
  return a.preise[art].industrie;
}
