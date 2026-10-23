import type { Entscheidung } from '../engine/entscheidungen';
import { statusVon } from '../engine/messwert';
import { istNadel, type Bestand } from '../engine/modell';

/**
 * Farbansichten der Flächen: Jede Ebene färbt dieselben Flächen nach einer anderen Frage.
 * Eine gezeichnete Karte kommt erst mit dem amtlichen Luftbild als Hintergrund dazu.
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

export function Legende({ ebene = 'bedarf' }: { ebene?: Ebene }) {
  return (
    <div className="legende">
      {LEGENDE[ebene].map(([f, t]) => <span key={t}><i style={{ background: f }} />{t}</span>)}
      {ebene === 'datenlage' && <span><i style={{ background: 'repeating-linear-gradient(45deg,#E8C76A 0 3px,#9C8540 3px 6px)' }} />schraffiert: reicht nicht für Geldentscheidungen</span>}
    </div>
  );
}
