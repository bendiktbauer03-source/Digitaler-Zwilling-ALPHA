/**
 * Jede Kennzahl im Zwilling trägt fünf Eigenschaften: Wert, Einheit, Quelle,
 * Erhebungszeitpunkt und Unsicherheit. Daraus folgt ihr Datenstatus – und damit,
 * welche Entscheidungen sie tragen darf.
 */

export type Herkunft =
  | 'vor_ort'      // im Bestand gemessen (Winkelzählprobe, Kluppe, Begang)
  | 'angabe'       // vom Eigentümer oder Förster angegeben
  | 'gemessen'     // fernerkundlich direkt gemessen (Laser, Luftbild, Kataster)
  | 'modelliert'   // aus Modellen geschätzt (Ertragstafel, Allometrie)
  | 'abgeleitet'   // aus mehreren Größen kombiniert
  | 'annahme';     // Standardannahme ohne Beleg

export type Datenstatus = 'bestaetigt' | 'geschaetzt' | 'pruefen';

export interface Messwert {
  wert: number;
  einheit: string;
  quelle: string;
  herkunft: Herkunft;
  /** ISO-Datum der Erhebung */
  stand?: string;
  /** Relative Genauigkeit in Prozent (± …), symmetrisch genähert */
  genauigkeitPct?: number;
  /** Absolute Spanne, darf asymmetrisch sein */
  spanne?: [number, number];
}

export const STATUS_TEXT: Record<Datenstatus, string> = {
  bestaetigt: 'Vor Ort bestätigt',
  geschaetzt: 'Modell geschätzt',
  pruefen: 'Noch zu prüfen',
};

/** Ab dieser Genauigkeit gilt ein Wert als belastbar genug für Geldentscheidungen. */
export const GRENZE_BESTAETIGT_PCT = 10;
/** Bis zu dieser Genauigkeit taugt ein Wert zur Orientierung. */
export const GRENZE_GESCHAETZT_PCT = 30;

export function genauigkeit(m: Messwert | undefined): number | undefined {
  if (!m) return undefined;
  if (m.genauigkeitPct != null) return m.genauigkeitPct;
  if (m.spanne && m.wert > 0) {
    const [lo, hi] = m.spanne;
    return Math.round((Math.max(m.wert - lo, hi - m.wert) / m.wert) * 1000) / 10;
  }
  return undefined;
}

export function statusVon(m: Messwert | undefined): Datenstatus {
  if (!m || !Number.isFinite(m.wert)) return 'pruefen';
  if (m.herkunft === 'annahme') return 'pruefen';
  const g = genauigkeit(m);
  if (m.herkunft === 'vor_ort' || m.herkunft === 'angabe') {
    return g == null || g <= GRENZE_BESTAETIGT_PCT ? 'bestaetigt' : 'geschaetzt';
  }
  if (g == null) return m.herkunft === 'gemessen' ? 'bestaetigt' : 'geschaetzt';
  if (g <= GRENZE_BESTAETIGT_PCT) return 'bestaetigt';
  if (g <= GRENZE_GESCHAETZT_PCT) return 'geschaetzt';
  return 'pruefen';
}

/** Der schwächste Status bestimmt, wie belastbar eine kombinierte Aussage ist. */
export function schwaechster(...s: Datenstatus[]): Datenstatus {
  if (s.includes('pruefen')) return 'pruefen';
  if (s.includes('geschaetzt')) return 'geschaetzt';
  return 'bestaetigt';
}

export function spanneVon(m: Messwert): [number, number] {
  if (m.spanne) return m.spanne;
  const g = genauigkeit(m) ?? 0;
  return [m.wert * (1 - g / 100), m.wert * (1 + g / 100)];
}

export function statusLabel(m: Messwert | undefined): string {
  const s = statusVon(m);
  const g = genauigkeit(m);
  const gemessen = m?.herkunft === 'vor_ort' || m?.herkunft === 'angabe';
  if (s === 'geschaetzt' && g != null) return `${gemessen ? 'Gemessen' : 'Modell geschätzt'} ± ${Math.round(g)} %`;
  if (s === 'pruefen' && g != null) return `Noch zu prüfen (± ${Math.round(g)} %)`;
  return STATUS_TEXT[s];
}
