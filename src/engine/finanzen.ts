/** Kapitalwert und Zahlungsströme. KW = Σ (E_t − A_t) / (1 + r)^t */

export interface Zahlung { jahr: number; betrag: number; text?: string }

export function abzinsen(betrag: number, jahre: number, zins: number) {
  return betrag / Math.pow(1 + zins, jahre);
}

export function kapitalwert(zahlungen: Zahlung[], zins: number) {
  return zahlungen.reduce((s, z) => s + abzinsen(z.betrag, z.jahr, zins), 0);
}

/** Gleichbleibender jährlicher Betrag mit demselben Kapitalwert über n Jahre. */
export function annuitaet(kw: number, zins: number, jahre: number) {
  if (jahre <= 0) return kw;
  if (zins === 0) return kw / jahre;
  const q = Math.pow(1 + zins, jahre);
  return (kw * zins * q) / (q - 1);
}

/** Summen je Jahr, sortiert – für Liquiditätsansichten. */
export function jahresreihe(zahlungen: Zahlung[]) {
  const m = new Map<number, number>();
  for (const z of zahlungen) m.set(z.jahr, (m.get(z.jahr) ?? 0) + z.betrag);
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([jahr, betrag]) => ({ jahr, betrag }));
}

/** Wahrscheinlichkeit, dass innerhalb von n Jahren mindestens ein Schaden eintritt. */
export function schadenBis(jahre: number, proJahr: number) {
  return 1 - Math.pow(1 - proJahr, Math.max(0, jahre));
}
