import { useState } from 'react';
import { ha } from '../../engine/format';
import { Icon, useOffen, zurueck } from '../bausteine';
import { EBENE_TEXT, farbeVon, Legende, type Ebene } from '../waldkarte';
import { useZustand } from '../zustand';
import { hauptort, waldbild } from './Uebersicht';

const EBENEN: Ebene[] = ['bedarf', 'baumarten', 'datenlage', 'boden'];

/**
 * Mein Wald: oben ein Bild des Waldorts, darunter ein Blatt mit den Flächen.
 * Eine gezeichnete Karte gibt es erst mit echtem Luftbild – Umrisse ohne Hintergrund wirken unstimmig.
 */
export function Karte({ param }: { param?: string }) {
  const { wald } = useZustand();
  const offen = useOffen();
  const [ebene, setEbene] = useState<Ebene>(EBENEN.includes(param as Ebene) ? (param as Ebene) : 'bedarf');
  const vorschlag = offen.find((e) => e.bestandId)?.bestandId ?? wald.bestaende[0]?.id;
  const [auswahl, setAuswahl] = useState<string | undefined>(vorschlag);
  const b = wald.bestaende.find((x) => x.id === auswahl) ?? wald.bestaende[0];
  const orte = (wald.reviere ?? []).filter((r) => wald.bestaende.some((x) => x.revier === r.name));
  const ort = orte.length ? (b?.revier ?? hauptort(wald)) : undefined;
  const imOrt = ort ? wald.bestaende.filter((x) => x.revier === ort) : wald.bestaende;
  const bild = waldbild(wald, ort);
  const ortWaehlen = (name: string) => setAuswahl([...wald.bestaende].filter((x) => x.revier === name).sort((p, q) => q.ha - p.ha)[0]?.id);
  const hinweise = b ? offen.filter((e) => e.bestandId === b.id) : [];
  const gruppen: [string, string | undefined, typeof wald.bestaende][] = orte.length
    ? orte.map((r) => [`${r.nummer ? `${r.nummer} · ` : ''}${r.name}`, r.kurz, wald.bestaende.filter((x) => x.revier === r.name)] as [string, string | undefined, typeof wald.bestaende])
    : [['Alle Flächen', undefined, wald.bestaende]];
  const ebeneWaehlen = (e: Ebene) => { setEbene(e); history.replaceState(null, '', `#/wald/${e}`); };

  return (
    <main className="app karte-seite">
      <div className="kartenbuehne bildbuehne">
        <img key={bild.src.slice(-40)} src={bild.src} alt={bild.eigen ? `Ihr Foto aus ${ort}` : ''} />
        <span className="schleier" />
        <div className="kartenkopf">
          <button className="rund glas" onClick={() => zurueck('#/')} aria-label="Zurück zur Übersicht"><Icon n="back" /></button>
          <span className="kartenname">{wald.betrieb.langname}</span>
          <a className="rund glas" href="#/planen/frage" aria-label="Frage stellen"><Icon n="frage" /></a>
        </div>
        {orte.length > 1 && (
          <div className="orte" role="group" aria-label="Waldort">
            {orte.map((r) => <button key={r.name} className={ort === r.name ? 'an' : ''} aria-pressed={ort === r.name} onClick={() => ortWaehlen(r.name)}>{r.name}</button>)}
          </div>
        )}
        <div className="ortunten">
          <span className="hinweis-bild">{bild.hinweis}</span>
          <b>{ort ?? 'Mein Wald'}</b>
          <span>{ha(imOrt.reduce((s, x) => s + x.ha, 0))} · {imOrt.length} {imOrt.length === 1 ? 'Fläche' : 'Flächen'}</span>
        </div>
      </div>

      <section className="blatt">
        <span className="griff" aria-hidden="true" />
        {b && (
          <>
            <div className="kopfzeile" style={{ marginBottom: 0, alignItems: 'flex-start' }}>
              <div>
                <span className="unterzeile">Ausgewählt · {b.kennung}</span>
                <h2 className="titel" style={{ fontSize: 34, marginTop: 2 }}>{b.label}</h2>
                <p className="unterzeile" style={{ fontSize: 14.5, marginTop: 4 }}>{[ha(b.ha), b.kahlflaeche ? 'Freifläche' : b.fuehrendText, b.alter?.text].filter(Boolean).join(' · ')}</p>
              </div>
              {hinweise.length > 0 && <span className="status pruefen" style={{ cursor: 'default' }}><i style={{ background: 'var(--amber)', borderColor: 'var(--amber)' }} />{hinweise.length} {hinweise.length === 1 ? 'Hinweis' : 'Hinweise'}</span>}
            </div>
            <a className="aktion dunkel" href={`#/bestand/${b.id}`}>Fläche kennenlernen<span className="pfeil"><Icon n="arrow" /></span></a>
          </>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span className="klein">Flächen nach</span>
          <div className="chips" role="group" aria-label="Flächen färben nach">
            {EBENEN.map((e) => <button key={e} className={`chip ${ebene === e ? 'an' : ''}`} aria-pressed={ebene === e} onClick={() => ebeneWaehlen(e)}>{EBENE_TEXT[e]}</button>)}
          </div>
          <Legende ebene={ebene} />
        </div>

        {gruppen.map(([titel, kurz, liste]) => (
          <div key={titel}>
            <span className="klein">{titel}</span>{kurz && <span className="unterzeile" style={{ marginLeft: 8 }}>{kurz}</span>}
            <div style={{ marginTop: 6 }}>
              {liste.map((x) => (
                <button key={x.id} className={`reihe ${x.id === b?.id ? 'gewaehlt' : ''}`} onClick={() => setAuswahl(x.id)} aria-pressed={x.id === b?.id}>
                  <span className="punkt-st" style={{ width: 14, height: 14, borderRadius: 7, background: farbeVon(x, offen, ebene) }} />
                  <span><b>{x.label}{x.kahlflaeche ? ' · Freifläche' : ''}</b><small>{x.kennung}{x.alter ? ` · ${x.alter.text}` : ''}</small></span>
                  <span className="mono" style={{ fontSize: 13 }}>{ha(x.ha)}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
