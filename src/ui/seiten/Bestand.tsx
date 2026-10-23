import { useState } from 'react';
import { datumKurz, ha, pct, rund, zahl } from '../../engine/format';
import { spanneVon, statusLabel, statusVon } from '../../engine/messwert';
import { ART_TEXT, type Bestand as B } from '../../engine/modell';
import { Icon, Leiste, Status, useOffen } from '../bausteine';
import { Umrisse } from '../waldkarte';
import { useZustand } from '../zustand';
import { ART_FARBE } from './Uebersicht';

/** Eine Fläche in drei Ebenen: das Wichtigste – Baumarten und Standort – für Fachleute. */
export function Bestand({ param }: { param?: string }) {
  const { wald, modus } = useZustand();
  const offen = useOffen();
  const b = wald.bestaende.find((x) => x.id === param) ?? wald.bestaende[0];
  const [stufe, setStufe] = useState(modus === 'pro' ? 3 : 1);
  if (!b) return <main className="app"><Leiste eltern="#/wald" mitte="Mein Wald" /><div className="leer">Diese Fläche gibt es nicht.</div></main>;

  const hinweise = offen.filter((e) => e.bestandId === b.id);
  const verdacht = wald.ereignisse.find((e) => e.bestandId === b.id && !e.erholt);
  const s = statusVon(b.vorrat);
  const arten = b.arten.filter((a) => a.art !== 'sonstiges' && a.pct >= 1);
  const eignungFuehrend = b.eignung.find((e) => e.art.toLowerCase().includes(ART_TEXT[b.fuehrend].toLowerCase()));
  const passen = b.eignung.filter((e) => e.heute === 'gut' && e.entwicklung !== 'schlechter').map((e) => e.art).slice(0, 3);

  const zustand = verdacht && !verdacht.bestaetigt
    ? { text: `Verdacht auf ${zahl(verdacht.ha ?? 0, 1)} ha`, amber: true }
    : b.kahlflaeche ? { text: `Freifläche${verdacht?.jahr ? ` seit ${verdacht.jahr}` : ''}`, amber: false }
      : b.befunde.some((x) => x.dringlichkeit === 'hoch') ? { text: b.befunde.find((x) => x.dringlichkeit === 'hoch')!.befund, amber: true }
        : { text: b.hiebsreife ? 'Gesund, erntereif' : 'Unauffällig', amber: false };

  const holz = (() => {
    if (b.kahlflaeche) return { wert: 'Noch keins', fuss: 'Hier wächst der nächste Wald' };
    if (b.vorrat.herkunft === 'annahme') return { wert: 'Offen', fuss: 'Zeigen wir nach einer Messung' };
    const [lo, hi] = spanneVon(b.vorrat);
    if (s === 'pruefen') return { wert: `${zahl(rund(lo * b.ha))}–${zahl(rund(hi * b.ha))} m³`, fuss: 'noch zu ungenau' };
    return { wert: `≈ ${zahl(rund(b.vorrat.wert * b.ha))} m³`, fuss: statusLabel(b.vorrat).replace('Modell geschätzt', 'geschätzt') };
  })();

  return (
    <main className="app">
      <Leiste eltern="#/wald" mitte="Mein Wald" />

      <div className="bestandbild">
        <img src={b.kahlflaeche ? 'bilder/stamm.webp' : 'bilder/kronendach.webp'} alt="" />
        <span className="schleier" />
        {b.polygon.length > 2 && <Umrisse bestaende={[b]} breite={350} hoehe={220} rand={34} />}
        <span className="hinweis-bild">{wald.quelle === 'beispiel' ? 'STIMMUNGSBILD · BEISPIEL' : 'STIMMUNGSBILD'}</span>
      </div>

      <section>
        <span className="unterzeile">{b.kennung} · {ha(b.ha)}</span>
        <h1 className="titel" style={{ marginTop: 2 }}>{b.label}</h1>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="klein">Das Wichtigste</span>
        <div className="bento">
          <div className="kachel k-salbei"><span className="etikett">Was hier wächst</span><span className="wert text">{wasWaechst(b)}</span></div>
          <div className="kachel"><span className="etikett">Wie alt</span><span className="wert text">{b.alter ? b.alter.text.replace(' Jahre', ' J.') : b.jungbestand ? 'Jung' : '—'}</span></div>
          <div className={`kachel ${zustand.amber ? 'k-amber-hell' : ''}`}><span className="etikett">{zustand.amber && <span className="punkt-st amber" />}Zustand</span><span className="wert text">{zustand.text}</span></div>
          <div className="kachel"><span className="etikett">Holz im Wald</span><span><span className="wert text">{holz.wert}</span><span className="fuss" style={{ display: 'block', marginTop: 6 }}>{holz.fuss}</span></span></div>
        </div>
      </section>

      {hinweise.map((e, i) => i === 0 ? (
        <a key={e.id} className="aktion" href={`#/aufgabe/${e.id}`}>
          <span style={{ display: 'flex', flexDirection: 'column' }}><span>{e.kurz}</span><small style={{ fontSize: 13, fontWeight: 500 }}>Was jetzt sinnvoll ist</small></span>
          <span className="pfeil"><Icon n="arrow" /></span>
        </a>
      ) : (
        <a key={e.id} className="zeilenlink" href={`#/aufgabe/${e.id}`}><span><b>{e.kurz}</b><small>Steht ebenfalls an</small></span><Icon n="arrow" /></a>
      ))}

      {stufe >= 2 && (
        <section className="feld ein">
          <h3>Baumarten und Standort</h3>
          {arten.length > 0 ? (
            <>
              <div className="allok gross" aria-hidden="true">{arten.map((a) => <i key={a.art} style={{ flex: a.pct, background: ART_FARBE[a.art] }} />)}</div>
              <div className="legende" style={{ marginTop: 8 }}>{arten.map((a) => <span key={a.art}><i style={{ background: ART_FARBE[a.art] }} /><b>{pct(a.pct)}</b>&nbsp;{ART_TEXT[a.art]}</span>)}</div>
            </>
          ) : <p className="unterzeile">Noch keine Bäume – {b.verjuengungMoeglich?.length ? `Samenbäume in der Nähe: ${b.verjuengungMoeglich.join(', ')}.` : 'Pflanzung oder Naturverjüngung planen.'}</p>}
          <div className="liste-zeilen" style={{ marginTop: 12 }}>
            {b.hangGrad != null && <div><span>Gelände</span><b>{b.hangGrad < 8 ? 'eben' : b.hangGrad < 20 ? 'leichter Hang' : 'steiler Hang'}{b.exposition ? `, ${b.exposition}` : ''}</b></div>}
            {b.boden?.nfkMm != null && <div><span>Wasserspeicher</span><b>{b.boden.nfkMm >= 160 ? 'hoch' : b.boden.nfkMm >= 100 ? 'mittel' : 'gering'}</b></div>}
            {eignungFuehrend && !b.kahlflaeche && <div><span>{eignungFuehrend.art} hier</span><b>{eignungFuehrend.entwicklung === 'schlechter' ? 'wird schwieriger' : eignungFuehrend.heute === 'gut' ? 'passt gut' : 'geht'}</b></div>}
            {passen.length > 0 && <div><span>Passen gut</span><b>{passen.join(', ')}</b></div>}
          </div>
          {eignungFuehrend?.gruende[0] && !b.kahlflaeche && <p className="unterzeile" style={{ marginTop: 10 }}>{eignungFuehrend.hinweis ?? eignungFuehrend.gruende.join('. ')}.</p>}
        </section>
      )}

      {stufe >= 3 && (
        <section className="feld ein" style={{ background: 'var(--stein)' }}>
          <div className="kopfzeile" style={{ marginBottom: 6 }}><h3 style={{ marginBottom: 0 }}>Für Fachleute</h3>{!b.kahlflaeche && <Status s={s} text={statusLabel(b.vorrat)} />}</div>
          <div className="liste-zeilen fach">
            {!b.kahlflaeche && <div><span>Vorrat</span><b>{zahl(b.vorrat.wert)} Vfm/ha{b.vorrat.spanne ? ` (${zahl(b.vorrat.spanne[0])}–${zahl(b.vorrat.spanne[1])})` : ''}</b></div>}
            {b.zuwachs && <div><span>Zuwachs</span><b>{zahl(b.zuwachs.wert, b.zuwachs.wert < 10 ? 1 : 0)} Vfm/ha/J</b></div>}
            {(b.bhdCm || b.hoeheM) && <div><span>BHD · Höhe</span><b>{b.bhdCm ? `${zahl(b.bhdCm)} cm` : '—'} · {b.hoeheM ? `${zahl(b.hoeheM)} m` : '—'}</b></div>}
            {b.bestockungsgrad != null && <div><span>Bestockungsgrad</span><b>{zahl(b.bestockungsgrad, 2)}</b></div>}
            {b.stammzahlProHa != null && <div><span>Stammzahl</span><b>{zahl(b.stammzahlProHa)} /ha</b></div>}
            {b.hangGrad != null && <div><span>Hang</span><b>{zahl(b.hangGrad)}°{b.exposition ? ` ${b.exposition}` : ''}</b></div>}
            {b.boden?.nfkMm != null && <div><span>nFK</span><b>{zahl(b.boden.nfkMm)} mm</b></div>}
          </div>
          <p className="unterzeile" style={{ marginTop: 10 }}>Quelle: {b.vorrat.quelle}.{b.vorrat.stand ? ` Stand ${datumKurz(b.vorrat.stand)}.` : ''}</p>
        </section>
      )}

      {stufe < 3 && (
        <button className="knopf2" onClick={() => setStufe(stufe + 1)}>
          <Icon n="layers" />{stufe === 1 ? 'Mehr: Baumarten und Standort' : 'Für Fachleute: alle Kennwerte'}
        </button>
      )}

      <div className="zwei halb" style={{ gap: 10 }}>
        {!b.kahlflaeche && <a className="knopf2" href={`#/messen/${b.id}`}><Icon n="ruler" />Genauer messen</a>}
        {!b.kahlflaeche && !b.jungbestand && <a className="knopf2" href={`#/ernte/${b.id}`}><Icon n="axe" />Holz ernten?</a>}
        <a className="knopf2" href={`#/zukunft/${b.id}`}><Icon n="sprout" />Zukunft planen</a>
      </div>
    </main>
  );
}

function wasWaechst(b: B) {
  if (b.kahlflaeche) return 'Noch nichts – Freifläche';
  const a = b.arten.filter((x) => x.art !== 'sonstiges').sort((x, y) => y.pct - x.pct);
  if (!a.length) return b.fuehrendText;
  const [x, y] = a;
  if (!y || y.pct < 8) return `${ART_TEXT[x.art]}`;
  return `${ART_TEXT[x.art]}, ${y.pct < 30 ? 'etwas' : 'mit'} ${ART_TEXT[y.art]}`;
}
