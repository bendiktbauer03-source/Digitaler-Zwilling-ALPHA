/**
 * Vermögenssicht: stehender Holzwert (Abtriebswert-Näherung ohne Boden) und
 * gebundener Kohlenstoff. Kein Verkehrswertgutachten – das steht überall dabei.
 */
import type { Annahmen } from './annahmen';
import { ernteRechnen, schadrisikoProJahr } from './ernte';
import { schadenBis } from './finanzen';
import { spanneVon, statusVon, type Datenstatus } from './messwert';
import { gesamtHa, type Artgruppe, type Bestand, type Wald } from './modell';

/** Raumdichte (t Trockenmasse je m³) */
const RAUMDICHTE: Record<Artgruppe, number> = {
  fichte: 0.38, tanne: 0.36, kiefer: 0.43, douglasie: 0.41, laerche: 0.49,
  buche: 0.55, eiche: 0.56, edellaub: 0.52, sonstiges: 0.45,
};
/** Derbholz → Gesamtbiomasse inkl. Äste und Wurzeln */
const EXPANSION = 1.35;
const C_ANTEIL = 0.5;
const CO2_JE_C = 44 / 12;

export function co2JeVfm(b: Bestand) {
  const rd = b.arten.reduce((s, a) => s + (RAUMDICHTE[a.art] * a.pct) / 100, 0) || 0.45;
  return rd * EXPANSION * C_ANTEIL * CO2_JE_C;
}

export interface BestandWert {
  bestand: Bestand;
  vorratGesamt: number;
  holzwert: number;
  holzwertSpanne: [number, number];
  nettoJeVfm: number;
  co2t: number;
  co2JahrT: number;
  status: Datenstatus;
}

export function bestandWert(b: Bestand, a: Annahmen): BestandWert {
  const stehend = !b.kahlflaeche && !(b.jungbestand && b.jungbestand.hoeheM < 10) && b.vorrat.wert > 0;
  const voll = stehend ? ernteRechnen({ bestand: b, entnahmeVfmHa: b.vorrat.wert, entnahmeBhdCm: b.bhdCm ?? 30, annahmen: a }) : null;
  const nettoJeVfm = voll && voll.vfm > 0 ? Math.max(0, voll.db / voll.vfm) : 0;
  const [lo, hi] = spanneVon(b.vorrat);
  const vorratGesamt = b.vorrat.wert * b.ha;
  const f = co2JeVfm(b);
  return {
    bestand: b,
    vorratGesamt,
    holzwert: vorratGesamt * nettoJeVfm,
    holzwertSpanne: [lo * b.ha * nettoJeVfm * 0.9, hi * b.ha * nettoJeVfm * 1.1],
    nettoJeVfm,
    co2t: vorratGesamt * f,
    co2JahrT: (b.zuwachs?.wert ?? 0) * b.ha * f,
    status: statusVon(b.vorrat),
  };
}

export function waldVermoegen(w: Wald, a: Annahmen) {
  const werte = w.bestaende.map((b) => bestandWert(b, a));
  const sum = (f: (x: BestandWert) => number) => werte.reduce((s, x) => s + f(x), 0);
  return {
    werte,
    ha: gesamtHa(w),
    vorratGesamt: sum((x) => x.vorratGesamt),
    holzwert: sum((x) => x.holzwert),
    holzwertSpanne: [sum((x) => x.holzwertSpanne[0]), sum((x) => x.holzwertSpanne[1])] as [number, number],
    co2t: sum((x) => x.co2t),
    co2JahrT: sum((x) => x.co2JahrT),
    bestaetigtHa: werte.filter((x) => x.status === 'bestaetigt').reduce((s, x) => s + x.bestand.ha, 0),
  };
}

/** Ein Punkt der Wertentwicklung: erwarteter Holzwert nach t Jahren mit Spanne. */
export interface Wertpunkt { jahr: number; wert: number; lo: number; hi: number }

/**
 * Wertentwicklung ohne Eingriffe: Der Vorrat wächst um den Zuwachs, das Schadrisiko der
 * führenden Baumart mindert den Erwartungswert. Netto-Holzwert je Vfm bleibt real konstant.
 */
export function wertverlauf(w: Wald, a: Annahmen, jahre = 10, start = new Date().getFullYear()): Wertpunkt[] {
  const werte = w.bestaende.map((b) => bestandWert(b, a));
  return Array.from({ length: jahre + 1 }, (_, t) => {
    let wert = 0, lo = 0, hi = 0;
    for (const x of werte) {
      if (x.nettoJeVfm <= 0) continue;
      const b = x.bestand;
      const zu = (b.zuwachs?.wert ?? 0) * t * b.ha * x.nettoJeVfm;
      const risiko = 1 - schadenBis(t, schadrisikoProJahr(b, a)) * a.schadholzAbschlag;
      wert += (x.holzwert + zu) * risiko;
      lo += (x.holzwertSpanne[0] + zu * 0.7) * risiko;
      hi += (x.holzwertSpanne[1] + zu * 1.2) * risiko;
    }
    return { jahr: start + t, wert, lo, hi };
  });
}

/** Wertzuwachs im ersten Jahr (Erwartungswert) – die „Rendite“ des Waldes. */
export function wertzuwachsJahr(w: Wald, a: Annahmen) {
  const [p0, p1] = wertverlauf(w, a, 1);
  const euro = p1.wert - p0.wert;
  return { euro, pct: p0.wert > 0 ? (euro / p0.wert) * 100 : 0 };
}

/** Baumartenanteile am Holzvorrat des ganzen Waldes – die „Allokation“. */
export function allokation(w: Wald): { art: Artgruppe; pct: number }[] {
  const m = new Map<Artgruppe, number>();
  let summe = 0;
  for (const b of w.bestaende) {
    const v = b.vorrat.wert * b.ha;
    for (const x of b.arten) {
      if (x.art === 'sonstiges') continue;
      const anteil = (v * x.pct) / 100;
      m.set(x.art, (m.get(x.art) ?? 0) + anteil);
      summe += anteil;
    }
  }
  return [...m.entries()].map(([art, v]) => ({ art, pct: summe > 0 ? (v / summe) * 100 : 0 })).sort((x, y) => y.pct - x.pct);
}
