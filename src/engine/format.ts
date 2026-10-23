/** Zahlen so zeigen, wie genau sie sind: Schätzungen gerundet, Messungen genauer. */

const de = (n: number, d = 0) => n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });

/** Auf zwei bis drei signifikante Stellen runden – Schätzungen nicht scheinpräzise zeigen. */
export function rund(n: number) {
  const a = Math.abs(n);
  if (a < 100) return Math.round(n);
  if (a < 10_000) return Math.round(n / 10) * 10;
  if (a < 100_000) return Math.round(n / 100) * 100;
  return Math.round(n / 1000) * 1000;
}

export function euro(n: number, ca = true) {
  const r = rund(n);
  if (Math.abs(r) >= 1_000_000) return `${ca ? '≈ ' : ''}${de(r / 1_000_000, 2)} Mio. €`;
  return `${ca ? '≈ ' : ''}${r < 0 ? '− ' : ''}${de(Math.abs(r))} €`;
}

export function euroSpanne(a: number, b: number) {
  const lo = Math.min(a, b), hi = Math.max(a, b);
  if (Math.abs(hi) >= 10_000) return `${de(rund(lo) / 1000)}–${de(rund(hi) / 1000)} T€`;
  return `${de(rund(lo))}–${de(rund(hi))} €`;
}

export function zahl(n: number, d = 0) { return de(n, d); }
export function pct(n: number, d = 0) { return `${de(n, d)} %`; }
export function ha(n: number) { return `${de(n, n < 10 ? 2 : 1)} ha`; }

export function datumKurz(iso: string) {
  if (/^\d{4}$/.test(iso)) return iso;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function heuteIso(d = new Date()) { return d.toISOString().slice(0, 10); }
