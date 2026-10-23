import { useState } from 'react';
import { ART_LABEL, type Entscheidung } from '../../engine/entscheidungen';
import { datumKurz } from '../../engine/format';
import type { Datenstatus } from '../../engine/messwert';
import { gehe, Icon, Leiste, Status, useOffen } from '../bausteine';
import { beschlussVon, useZustand } from '../zustand';

const STUFE: Record<Datenstatus, number> = { pruefen: 1, geschaetzt: 2, bestaetigt: 3 };

function Sicherheit({ s }: { s: Datenstatus }) {
  const n = STUFE[s];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div className="sicherheit" aria-hidden="true">{[1, 2, 3].map((i) => <span key={i} className={i <= n ? 'an' : ''} />)}</div>
      <div className="sicherheit-text">{['Noch zu prüfen', 'Modell geschätzt', 'Vor Ort bestätigt'].map((t, i) => <span key={t} className={i + 1 === n ? 'an' : ''}>{t}</span>)}</div>
    </div>
  );
}

function finden(liste: Entscheidung[], id?: string) {
  return liste.find((e) => e.id === id) ?? liste[Number(id) - 1];
}

/** Eine Aufgabe: Empfehlung zuerst, die anderen Wege darunter, ein Knopf zum Entscheiden. */
export function Aufgabe({ param }: { param?: string }) {
  const { entscheidungen, fortschreibung, beschliessen, beschlussZuruecknehmen, toast } = useZustand();
  const offen = useOffen();
  const d = finden(entscheidungen, param);
  const [wahl, setWahl] = useState<number | undefined>();
  if (!d) return <main className="app"><Leiste eltern="#/aufgaben" /><div className="leer">Diese Aufgabe ist erledigt oder gibt es nicht mehr.<br /><a className="knopf" href="#/aufgaben" style={{ marginTop: 16 }}>Zu den Aufgaben</a></div></main>;

  const w = wahl ?? d.empfohlen;
  const o = d.optionen[w];
  const beschluss = beschlussVon(fortschreibung, d.id);
  const naechste = offen.find((e) => e.id !== d.id);

  const entscheiden = () => {
    if (o.gesperrt) { toast(o.gesperrt); return; }
    const m = beschliessen(d, o);
    toast(m ? `${o.name}. Steht jetzt unter „In Umsetzung“.` : `${o.name}. Ist vermerkt.`);
    if (o.ziel) setTimeout(() => gehe(o.ziel!), 700);
  };

  return (
    <main className="app">
      <Leiste eltern="#/aufgaben" mitte={ART_LABEL[d.art]} />
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="unterzeile">{d.ort}</span>
        <h1 className="titel">{d.titel.join('')}</h1>
        <p className="lead">{d.satz}</p>
        <span><Status s={d.status} text={d.statusText} erklaerung={d.statusErklaerung} /></span>
      </section>

      {beschluss ? (
        <section className="wichtig ein">
          <span className="rund" style={{ background: 'var(--gut-hell)', color: 'var(--gut)' }}><Icon n="check" gross /></span>
          <h2 className="titel2">{beschluss.optionName}</h2>
          <p className="satz">Entschieden am {datumKurz(beschluss.datum)}. {fortschreibung.massnahmen.some((m) => m.entscheidungId === d.id) ? 'Die Maßnahme steht unter „In Umsetzung“.' : ''}</p>
          {naechste ? <a className="aktion" href={`#/aufgabe/${naechste.id}`}>Nächste Aufgabe: {naechste.kurz}<span className="pfeil"><Icon n="arrow" /></span></a> : <a className="aktion dunkel" href="#/aufgaben">Zu den Aufgaben<span className="pfeil"><Icon n="arrow" /></span></a>}
          <button className="mehr" onClick={() => beschlussZuruecknehmen(d.id)}>Rückgängig machen</button>
        </section>
      ) : (
        <>
          {d.fehlt && (
            <div className="warnung"><Icon n="ruler" /><span><b>Dafür fehlt noch:</b> {d.fehlt.join(' · ')}</span></div>
          )}

          <section className="empfehlung ein" key={o.id}>
            <span className="marke-e">{w === d.empfohlen ? 'Unsere Empfehlung' : o.marke}</span>
            <span className="name">{o.name}</span>
            <span style={{ fontSize: 14.5, color: 'rgba(246,245,241,.8)' }}>{o.preis}</span>
            {o.wirkung.length > 0 && (
              <div className="drei-zahlen">
                {o.wirkung.slice(0, 3).map((x) => <div key={x.label}><span>{x.label}</span><b className={x.ton ?? ''}>{x.wert}</b></div>)}
              </div>
            )}
            {o.gesperrt && <div className="warnung" style={{ color: 'var(--tinte)' }}>{o.gesperrt}</div>}
          </section>

          {d.optionen.length > 1 && (
            <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="klein">{w === d.empfohlen ? 'Andere Wege' : 'Alle Wege'}</span>
              {d.optionen.map((x, j) => j === w ? null : (
                <button key={x.id} className={`zeilenlink ${x.gesperrt ? 'gesperrt' : ''}`} onClick={() => setWahl(j)}>
                  <span><b>{x.name}{j === d.empfohlen ? ' · empfohlen' : ''}</b><small>{x.gesperrt ? 'Erst nach einer Messung möglich' : x.preis}</small></span>
                  <span className="mono" style={{ fontSize: 13, color: 'var(--grau)' }}>{x.wirkung[0]?.wert}</span>
                </button>
              ))}
            </section>
          )}

          <a className="zeilenlink" href={`#/pruefen/${d.id}`}>
            <span style={{ flex: 1 }}><b>Wie sicher ist das?</b><small>Gründe, Risiken, Datenlage und Rechnung</small></span>
            <span style={{ width: 84 }}><span className="sicherheit" aria-hidden="true">{[1, 2, 3].map((i) => <span key={i} className={i <= STUFE[d.status] ? 'an' : ''} />)}</span></span>
            <Icon n="arrow" />
          </a>

          <div className="unten-fest">
            <button className="knopf amber" onClick={entscheiden} disabled={!!o.gesperrt}>{w === d.empfohlen ? d.cta : 'Diesen Weg wählen'} <Icon n="arrow" /></button>
            {d.rechner && <a className="mehr" href={d.rechner}>Im Rechner selbst durchspielen</a>}
          </div>
        </>
      )}
    </main>
  );
}

/** Eine Ebene tiefer: worauf die Empfehlung beruht. */
export function Pruefen({ param }: { param?: string }) {
  const { entscheidungen, modus } = useZustand();
  const d = finden(entscheidungen, param);
  if (!d) return <main className="app"><Leiste eltern="#/aufgaben" /><div className="leer">Diese Aufgabe gibt es nicht mehr.</div></main>;
  const o = d.optionen[d.empfohlen];
  const labels = [...new Set(d.optionen.flatMap((x) => x.wirkung.map((w) => w.label)))];

  return (
    <main className="app">
      <Leiste eltern={`#/aufgabe/${d.id}`} mitte={d.kurz} />
      <h1 className="titel">Wie sicher ist das?</h1>
      <section className="feld" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Sicherheit s={d.status} />
        <p style={{ fontSize: 15, lineHeight: 1.5 }}>{d.statusErklaerung}</p>
        {d.status !== 'bestaetigt' && d.art !== 'messen' && <a className="knopf2" href="#/messen" style={{ background: 'var(--grund)' }}><Icon n="ruler" />Genauer werden: selbst messen</a>}
      </section>

      {([['Worauf die Zahlen beruhen', d.datenlage, 'ruhig'], ['Warum wir das empfehlen', d.gruende, ''], ['Was schiefgehen kann', d.risiken, '']] as [string, string[], string][]).map(([t, l, k]) => l.filter(Boolean).length > 0 && (
        <section key={t} className="feld">
          <h3>{t}</h3>
          <ul className={`liste ${k}`}>{l.filter(Boolean).map((x, i) => <li key={i}>{x}</li>)}</ul>
        </section>
      ))}

      {d.optionen.length > 1 && labels.length > 0 && (
        <section className="feld">
          <h3>Die Wege im Vergleich</h3>
          <div className="tab-wrap">
            <table className="tab">
              <thead><tr><th />{d.optionen.map((x, j) => <th key={x.id} className="z">{j === d.empfohlen ? '★ ' : ''}{x.name}</th>)}</tr></thead>
              <tbody>{labels.map((l) => <tr key={l}><td>{l}</td>{d.optionen.map((x) => <td key={x.id} className="z">{x.wirkung.find((w) => w.label === l)?.wert ?? '—'}</td>)}</tr>)}</tbody>
            </table>
          </div>
        </section>
      )}

      {o.zeilen.length > 0 && (
        <section className="feld">
          <h3>Die Rechnung · {o.name}</h3>
          <div className="liste-zeilen">{o.zeilen.map(([a, b]) => <div key={a}><span>{a}</span><b>{b}</b></div>)}</div>
        </section>
      )}

      <section className="feld" style={{ background: 'var(--stein)' }}>
        <h3>Rechenlauf</h3>
        <p className="lauf">Eingaben {d.rechenlauf.eingabenHash}<br />Modelle: {d.rechenlauf.modelle.join(' · ')}<br />Annahmen {d.rechenlauf.annahmen}{d.rechenlauf.regelpaket ? <><br />Regelpaket {d.rechenlauf.regelpaket}</> : null}</p>
        <p className="unterzeile" style={{ marginTop: 8 }}>Jede Entscheidung wird mit diesem Rechenlauf gespeichert. Spätere Neuberechnungen überschreiben ihn nicht.</p>
        {modus === 'privat' && <a className="mehr" href="#/daten" style={{ justifyContent: 'flex-start' }}>Alle Annahmen und Quellen</a>}
      </section>

      <div className="zwei halb" style={{ gap: 10 }}>
        <a className="knopf" href={`#/aufgabe/${d.id}`}>Zur Entscheidung</a>
        {d.rechner && <a className="knopf2" href={d.rechner}><Icon n="chart" />Im Rechner</a>}
      </div>
    </main>
  );
}
