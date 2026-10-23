import { useState } from 'react';
import { ha } from '../../engine/format';
import { Icon, useOffen, zurueck } from '../bausteine';
import { EBENE_TEXT, farbeVon, Legende, Waldkarte, type Ebene } from '../waldkarte';
import { useZustand } from '../zustand';

const EBENEN: Ebene[] = ['bedarf', 'baumarten', 'datenlage', 'boden'];

/** Mein Wald: die Karte als Bühne, darunter ein Blatt mit der gewählten Fläche. */
export function Karte({ param }: { param?: string }) {
  const { wald } = useZustand();
  const offen = useOffen();
  const [ebene, setEbene] = useState<Ebene>(EBENEN.includes(param as Ebene) ? (param as Ebene) : 'bedarf');
  const vorschlag = offen.find((e) => e.bestandId)?.bestandId ?? wald.bestaende[0]?.id;
  const [auswahl, setAuswahl] = useState<string | undefined>(vorschlag);
  const b = wald.bestaende.find((x) => x.id === auswahl) ?? wald.bestaende[0];
  const mitGrenzen = wald.bestaende.some((x) => x.polygon.length > 2);
  const breite = Math.min(window.innerWidth || 390, 560);
  const hoehe = Math.min((window.innerHeight || 844) * 0.62, 560);
  const hinweise = b ? offen.filter((e) => e.bestandId === b.id) : [];
  const ebeneWaehlen = (e: Ebene) => { setEbene(e); history.replaceState(null, '', `#/wald/${e}`); };

  return (
    <main className="app karte-seite">
      {mitGrenzen ? (
        <div className="kartenbuehne">
          <Waldkarte wald={wald} ents={offen} auswahl={b?.id} onWahl={setAuswahl} ebene={ebene} breite={1000} hoehe={Math.round((1000 * hoehe) / breite)} />
          <div className="kartenkopf">
            <button className="rund glas" onClick={() => zurueck('#/')} aria-label="Zurück zur Übersicht"><Icon n="back" /></button>
            <span className="kartenname">{wald.betrieb.langname}</span>
            <a className="rund glas" href="#/planen/frage" aria-label="Frage stellen"><Icon n="frage" /></a>
          </div>
          <div className="ebenen" role="group" aria-label="Kartenebene">
            {EBENEN.map((e) => <button key={e} className={ebene === e ? 'an' : ''} aria-pressed={ebene === e} onClick={() => ebeneWaehlen(e)}>{EBENE_TEXT[e]}</button>)}
          </div>
        </div>
      ) : (
        <>
          <header className="leiste"><button className="rund" onClick={() => zurueck('#/')} aria-label="Zurück"><Icon n="back" /></button><span className="mitte">{wald.betrieb.langname}</span><span style={{ width: 44 }} /></header>
          <h1 className="titel">Mein Wald</h1>
          <p className="hinweis">Für Ihre Flächen liegen noch keine Grenzen vor. Mit dem Digitalen Zwilling aus Kataster, Luftbild und Laserscan erscheint hier Ihre Karte.</p>
        </>
      )}

      <section className={mitGrenzen ? 'blatt' : 'feld'} style={mitGrenzen ? undefined : { display: 'flex', flexDirection: 'column', gap: 16 }}>
        {mitGrenzen && <span className="griff" aria-hidden="true" />}
        {mitGrenzen && <Legende ebene={ebene} />}
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
        <div>
          <span className="klein">Alle Flächen</span>
          <div style={{ marginTop: 6 }}>
            {wald.bestaende.map((x) => (
              <button key={x.id} className={`reihe ${x.id === b?.id ? 'gewaehlt' : ''}`} onClick={() => (mitGrenzen ? setAuswahl(x.id) : (location.hash = `#/bestand/${x.id}`))} aria-pressed={x.id === b?.id}>
                <span className="punkt-st" style={{ width: 14, height: 14, borderRadius: 7, background: farbeVon(x, offen, ebene) }} />
                <span><b>{x.label}{x.kahlflaeche ? ' · Freifläche' : ''}</b><small>{x.kennung}{x.alter ? ` · ${x.alter.text}` : ''}</small></span>
                <span className="mono" style={{ fontSize: 13 }}>{ha(x.ha)}</span>
              </button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
