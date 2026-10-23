import { useMemo } from 'react';
import type { Entscheidung } from '../engine/entscheidungen';
import { statusVon } from '../engine/messwert';
import { istNadel, type Bestand, type Wald } from '../engine/modell';

/**
 * Die Waldkarte zeichnet die echten Polygone (lon/lat) der Bestände, flächentreu genug
 * für die Orientierung, ohne externe Kacheln: funktioniert offline und auf jedem Gerät.
 * Jede Ebene färbt dieselben Flächen nach einer anderen Frage.
 */
export type Ebene = 'bedarf' | 'baumarten' | 'datenlage' | 'boden';

export const EBENE_TEXT: Record<Ebene, string> = { bedarf: 'Handlungsbedarf', baumarten: 'Baumarten', datenlage: 'Datenlage', boden: 'Boden' };

export const FARBE = { hoch: '#D97706', mittel: '#E8C76A', ruhig: '#6F8F5E', frei: '#A9B9A1' };

const LEGENDE: Record<Ebene, [string, string][]> = {
  bedarf: [[FARBE.hoch, 'Dringend'], [FARBE.mittel, 'Entscheidung steht an'], [FARBE.ruhig, 'Ruhig'], [FARBE.frei, 'Freifläche']],
  baumarten: [['#6F8F5E', 'Nadelholz'], ['#C8D2BF', 'Laubholz'], ['#A9B9A1', 'Gemischt'], ['#D6B9AC', 'Freifläche']],
  datenlage: [['#7FB08A', 'Vor Ort bestätigt'], ['#A9B9A1', 'Modell geschätzt'], ['#E8C76A', 'Noch zu prüfen']],
  boden: [['#3E6E8E', 'Speichert viel Wasser'], ['#8FB3C4', 'Mittel'], ['#E8C76A', 'Wenig'], ['#A9B9A1', 'Keine Angabe']],
};

export function farbeVon(b: Bestand, ents: Entscheidung[], ebene: Ebene = 'bedarf') {
  if (ebene === 'baumarten') {
    if (b.kahlflaeche) return '#D6B9AC';
    const nadel = b.arten.filter((a) => istNadel(a.art)).reduce((s, a) => s + a.pct, 0);
    return nadel >= 70 ? '#6F8F5E' : nadel <= 30 ? '#C8D2BF' : '#A9B9A1';
  }
  if (ebene === 'datenlage') {
    if (b.kahlflaeche) return '#A9B9A1';
    const s = statusVon(b.vorrat);
    return s === 'bestaetigt' ? '#7FB08A' : s === 'geschaetzt' ? '#A9B9A1' : '#E8C76A';
  }
  if (ebene === 'boden') {
    const n = b.boden?.nfkMm;
    if (n == null) return '#A9B9A1';
    return n >= 160 ? '#3E6E8E' : n >= 100 ? '#8FB3C4' : '#E8C76A';
  }
  if (b.kahlflaeche) return FARBE.frei;
  const e = ents.filter((x) => x.bestandId === b.id);
  if (e.some((x) => x.dringlichkeit === 'hoch')) return FARBE.hoch;
  if (e.some((x) => x.dringlichkeit === 'mittel')) return FARBE.mittel;
  return FARBE.ruhig;
}

/** Projiziert lon/lat in eine Zeichenfläche (gleichabständig genug für Waldflächen). */
export function projektion(bestaende: Bestand[], breite: number, hoehe: number, rand: number) {
  const pkt = bestaende.flatMap((b) => b.polygon);
  if (!pkt.length) return null;
  const lat0 = pkt.reduce((s, p) => s + p[1], 0) / pkt.length;
  const kx = Math.cos((lat0 * Math.PI) / 180);
  const xs = pkt.map((p) => p[0] * kx), ys = pkt.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const s = Math.min((breite - 2 * rand) / (x1 - x0 || 1e-6), (hoehe - 2 * rand) / (y1 - y0 || 1e-6));
  const ox = (breite - (x1 - x0) * s) / 2, oy = (hoehe - (y1 - y0) * s) / 2;
  const proj = (p: [number, number]) => [ox + (p[0] * kx - x0) * s, oy + (y1 - p[1]) * s] as const;
  const pfad = (poly: [number, number][]) => poly.map((p, i) => `${i ? 'L' : 'M'}${proj(p).map((v) => v.toFixed(1)).join(',')}`).join('') + 'Z';
  return { proj, pfad, meterJePx: 1 / (s / 111_320) };
}

/** Nur die Umrisse – für Porträt, Kacheln und Bestandsbild. */
export function Umrisse({ bestaende, breite, hoehe, rand = 40, hervor, verdacht, farbig }: { bestaende: Bestand[]; breite: number; hoehe: number; rand?: number; hervor?: string; verdacht?: Set<string>; farbig?: (b: Bestand) => string }) {
  const geo = useMemo(() => projektion(bestaende, breite, hoehe, rand), [bestaende, breite, hoehe, rand]);
  if (!geo) return null;
  return (
    <svg className="grenzen" viewBox={`0 0 ${breite} ${hoehe}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {bestaende.map((b) => {
        const v = verdacht?.has(b.id);
        const an = hervor === b.id;
        return (
          <path key={b.id} d={geo.pfad(b.polygon)} strokeLinejoin="round"
            fill={farbig ? farbig(b) : v ? 'rgba(217,119,6,.25)' : an ? 'rgba(246,245,241,.28)' : 'rgba(246,245,241,.12)'}
            stroke={farbig ? '#F6F5F1' : v ? '#D97706' : '#F6F5F1'} strokeWidth={an ? 3 : v ? 2.5 : farbig ? 1.5 : 2} strokeDasharray={v ? '6 5' : undefined}
            opacity={hervor && !an && !farbig ? 0.55 : 1} />
        );
      })}
    </svg>
  );
}

export function Waldkarte({ wald, ents, auswahl, onWahl, ebene = 'bedarf', breite = 1000, hoehe = 420 }: { wald: Wald; ents: Entscheidung[]; auswahl?: string; onWahl?: (id: string) => void; ebene?: Ebene; breite?: number; hoehe?: number }) {
  const geo = useMemo(() => projektion(wald.bestaende, breite, hoehe, Math.min(breite, hoehe) * 0.16), [wald, breite, hoehe]);
  if (!geo) return <div className="leer">Für diesen Wald liegen noch keine Flächengrenzen vor.</div>;
  const massstab = [50, 100, 200, 500, 1000].find((m) => m / geo.meterJePx > breite * 0.12) ?? 1000;
  const fs = breite / 26;

  return (
    <svg className="waldkarte" viewBox={`0 0 ${breite} ${hoehe}`} role="img" aria-label={`Karte von ${wald.betrieb.langname} mit ${wald.bestaende.length} Flächen, gefärbt nach ${EBENE_TEXT[ebene]}`}>
      <defs>
        <pattern id="hoehenlinien" width="46" height="46" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">
          <path d="M0 23 Q 11.5 15 23 23 T 46 23" fill="none" stroke="rgba(246,245,241,.06)" strokeWidth="1" />
        </pattern>
        <pattern id="pruefen" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(11,35,28,.35)" strokeWidth="3" />
        </pattern>
      </defs>
      <rect width={breite} height={hoehe} fill="#0D2E24" />
      <rect width={breite} height={hoehe} fill="url(#hoehenlinien)" />
      {wald.bestaende.map((b) => {
        const d = geo.pfad(b.polygon);
        const an = auswahl === b.id;
        const unsicher = ebene === 'datenlage' && !b.kahlflaeche && statusVon(b.vorrat) === 'pruefen';
        return (
          <g key={b.id} className="bst" onClick={() => onWahl?.(b.id)} role="button" tabIndex={0} aria-pressed={an} aria-label={`${b.label}, ${b.ha.toLocaleString('de-DE')} Hektar`} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onWahl?.(b.id)}>
            <path d={d} fill={farbeVon(b, ents, ebene)} fillOpacity={an ? 1 : 0.82} stroke="#F6F5F1" strokeWidth={an ? 5 : 1.6} strokeLinejoin="round" />
            {unsicher && <path d={d} fill="url(#pruefen)" />}
          </g>
        );
      })}
      {ebene === 'bedarf' && wald.ereignisse.filter((e) => e.polygon && !e.erholt).map((e, i) => (
        <path key={i} d={geo.pfad(e.polygon!)} fill="none" stroke="#F6E1C2" strokeWidth={3} strokeDasharray="8 6" pointerEvents="none" />
      ))}
      {wald.bestaende.map((b) => {
        const [x, y] = geo.proj([b.mitte.lon, b.mitte.lat]);
        return (
          <g key={b.id + 't'} transform={`translate(${x},${y})`} pointerEvents="none">
            <text textAnchor="middle" y={-fs * 0.2} fontSize={fs} fontWeight={700} fill="#F6F5F1" stroke="rgba(11,35,28,.75)" strokeWidth={fs / 4.5} paintOrder="stroke" fontFamily="Inter, sans-serif">{b.label}</text>
            <text textAnchor="middle" y={fs * 0.95} fontSize={fs * 0.8} fill="rgba(246,245,241,.92)" stroke="rgba(11,35,28,.75)" strokeWidth={fs / 4.5} paintOrder="stroke" fontFamily="Inter, sans-serif">{b.ha.toLocaleString('de-DE', { maximumFractionDigits: 1 })} ha</text>
          </g>
        );
      })}
      <g transform={`translate(${breite * 0.05},${hoehe - fs * 1.6})`} fill="rgba(246,245,241,.8)" fontSize={fs * 0.7} fontFamily="Inter, sans-serif">
        <rect width={massstab / geo.meterJePx} height={fs * 0.22} y={fs * 0.25} />
        <text y={-fs * 0.15}>{massstab} m</text>
      </g>
      <text x={breite * 0.95} y={hoehe - fs * 0.8} textAnchor="end" fontSize={fs * 0.62} fill="rgba(246,245,241,.55)" fontFamily="Inter, sans-serif">{wald.quelle === 'beispiel' ? 'Fiktive Beispielflächen' : (wald.attribution ?? 'Geometrie: Zwilling')}</text>
    </svg>
  );
}

export function Legende({ ebene = 'bedarf' }: { ebene?: Ebene }) {
  return (
    <div className="legende">
      {LEGENDE[ebene].map(([f, t]) => <span key={t}><i style={{ background: f }} />{t}</span>)}
      {ebene === 'datenlage' && <span><i style={{ background: 'repeating-linear-gradient(45deg,#E8C76A 0 3px,#9C8540 3px 6px)' }} />schraffiert: reicht nicht für Geldentscheidungen</span>}
    </div>
  );
}
