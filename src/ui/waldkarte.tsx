import { useMemo } from 'react';
import type { Entscheidung } from '../engine/entscheidungen';
import { statusVon } from '../engine/messwert';
import type { Bestand, Wald } from '../engine/modell';

/**
 * Die Waldkarte zeichnet die echten Polygone (lon/lat) der Bestände, flächentreu genug
 * für die Orientierung, ohne externe Kacheln: funktioniert offline und auf jedem Gerät.
 * Farbe = Handlungsbedarf, Schraffur = Datenstatus „noch zu prüfen“.
 */
export const FARBE = { hoch: '#d97706', mittel: '#e8c76a', ruhig: '#3f8f6d', frei: '#a7b8a2' };

export function farbeVon(b: Bestand, ents: Entscheidung[]) {
  if (b.kahlflaeche) return FARBE.frei;
  const e = ents.filter((x) => x.bestandId === b.id);
  if (e.some((x) => x.dringlichkeit === 'hoch')) return FARBE.hoch;
  if (e.some((x) => x.dringlichkeit === 'mittel')) return FARBE.mittel;
  return FARBE.ruhig;
}

export function Waldkarte({ wald, ents, auswahl, onWahl, hoehe = 420 }: { wald: Wald; ents: Entscheidung[]; auswahl?: string; onWahl?: (id: string) => void; hoehe?: number }) {
  const geo = useMemo(() => {
    const pkt = wald.bestaende.flatMap((b) => b.polygon);
    if (!pkt.length) return null;
    const lat0 = pkt.reduce((s, p) => s + p[1], 0) / pkt.length;
    const kx = Math.cos((lat0 * Math.PI) / 180);
    const xs = pkt.map((p) => p[0] * kx), ys = pkt.map((p) => p[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    const breite = 1000, rand = 60;
    const s = Math.min((breite - 2 * rand) / (x1 - x0 || 1e-6), (hoehe - 2 * rand) / (y1 - y0 || 1e-6));
    const ox = (breite - (x1 - x0) * s) / 2, oy = (hoehe - (y1 - y0) * s) / 2;
    const proj = (p: [number, number]) => [ox + (p[0] * kx - x0) * s, oy + (y1 - p[1]) * s] as const;
    const meterJePx = 1 / (s / 111_320);
    return { proj, breite, meterJePx };
  }, [wald, hoehe]);

  if (!geo) return <div className="leer">Für diesen Wald liegen keine Flächengeometrien vor.</div>;
  const pfad = (poly: [number, number][]) => poly.map((p, i) => `${i ? 'L' : 'M'}${geo.proj(p).join(',')}`).join('') + 'Z';
  const massstab = [50, 100, 200, 500, 1000].find((m) => m / geo.meterJePx > 80) ?? 1000;

  return (
    <svg className="waldkarte" viewBox={`0 0 ${geo.breite} ${hoehe}`} role="img" aria-label={`Karte von ${wald.betrieb.langname} mit ${wald.bestaende.length} Beständen`}>
      <defs>
        <pattern id="hoehenlinien" width="46" height="46" patternUnits="userSpaceOnUse" patternTransform="rotate(-18)">
          <path d="M0 23 Q 11.5 15 23 23 T 46 23" fill="none" stroke="rgba(255,255,255,.05)" strokeWidth="1" />
        </pattern>
        <pattern id="pruefen" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="8" stroke="rgba(2,22,16,.35)" strokeWidth="3" />
        </pattern>
        <radialGradient id="licht" cx="30%" cy="20%" r="90%"><stop offset="0" stopColor="#0f4a37" /><stop offset="1" stopColor="#022c22" /></radialGradient>
      </defs>
      <rect width={geo.breite} height={hoehe} fill="url(#licht)" />
      <rect width={geo.breite} height={hoehe} fill="url(#hoehenlinien)" />
      {wald.bestaende.map((b) => {
        const d = pfad(b.polygon);
        const an = auswahl === b.id;
        const unsicher = !b.kahlflaeche && statusVon(b.vorrat) === 'pruefen';
        return (
          <g key={b.id} className="bst" onClick={() => onWahl?.(b.id)} role="button" tabIndex={0} aria-label={`${b.label}, ${b.ha.toLocaleString('de-DE')} Hektar`} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && onWahl?.(b.id)}>
            <path d={d} fill={farbeVon(b, ents)} fillOpacity={an ? 0.95 : 0.7} stroke={an ? '#f5f1ea' : 'rgba(245,241,234,.55)'} strokeWidth={an ? 3 : 1.2} />
            {unsicher && <path d={d} fill="url(#pruefen)" />}
          </g>
        );
      })}
      {wald.ereignisse.filter((e) => e.polygon && !e.erholt).map((e, i) => (
        <path key={i} d={pfad(e.polygon!)} fill="none" stroke={e.bestaetigt ? '#fdba74' : '#fbd38d'} strokeWidth={2} strokeDasharray="6 5" />
      ))}
      {wald.bestaende.map((b) => {
        const [x, y] = geo.proj([b.mitte.lon, b.mitte.lat]);
        return (
          <g key={b.id + 't'} transform={`translate(${x},${y})`}>
            <text textAnchor="middle" y={-4} fontSize={15} fontWeight={600} fill="#fff" stroke="rgba(2,22,16,.7)" strokeWidth={3} paintOrder="stroke">{b.label}</text>
            <text textAnchor="middle" y={14} fontSize={12} fill="rgba(255,255,255,.9)" stroke="rgba(2,22,16,.7)" strokeWidth={3} paintOrder="stroke">{b.ha.toLocaleString('de-DE', { maximumFractionDigits: 2 })} ha</text>
          </g>
        );
      })}
      <g transform={`translate(24,${hoehe - 26})`} fill="rgba(245,241,234,.8)" fontSize={11}>
        <rect width={massstab / geo.meterJePx} height={4} y={4} fill="rgba(245,241,234,.8)" />
        <text y={-2}>{massstab} m</text>
      </g>
      <text x={geo.breite - 16} y={hoehe - 14} textAnchor="end" fontSize={10.5} fill="rgba(245,241,234,.55)">{wald.quelle === 'beispiel' ? 'Fiktive Beispielflächen' : (wald.attribution ?? 'Geometrie: Zwilling')}</text>
    </svg>
  );
}

export function Legende() {
  return (
    <div className="legende">
      <span><i style={{ background: FARBE.hoch }} />Dringend</span>
      <span><i style={{ background: FARBE.mittel }} />Entscheidung steht an</span>
      <span><i style={{ background: FARBE.ruhig }} />Ruhig</span>
      <span><i style={{ background: FARBE.frei }} />Freifläche</span>
      <span><i style={{ background: 'repeating-linear-gradient(45deg,#3f8f6d 0 3px,#22513f 3px 6px)' }} />Daten noch zu prüfen</span>
    </div>
  );
}
