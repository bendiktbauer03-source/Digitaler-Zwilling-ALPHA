import { useEffect, useState } from 'react';
import { ART_LABEL, type Entscheidung, type Option } from '../../engine/entscheidungen';
import { datumKurz } from '../../engine/format';
import { gehe, Icon, Kopf, Status } from '../bausteine';
import { beschlussVon, useZustand } from '../zustand';

export function Entscheidungen({ param }: { param?: string }) {
  const { entscheidungen: liste, fortschreibung, beschliessen, beschlussZuruecknehmen, toast, modus } = useZustand();
  const startIndex = Math.max(0, liste.findIndex((e) => e.id === param || String(liste.indexOf(e) + 1) === param));
  const [akt, setAkt] = useState(startIndex);
  const [wahl, setWahl] = useState<Record<string, number>>({});
  const [schublade, setSchublade] = useState(false);
  useEffect(() => { setAkt(startIndex); }, [startIndex]);

  if (!liste.length) {
    return <section className="buehne"><div className="ui"><Kopf seite="entscheidungen" /><div className="mitte" style={{ marginTop: 60 }}><h1>Gerade steht <em>nichts an.</em></h1></div></div></section>;
  }
  const d: Entscheidung = liste[Math.min(akt, liste.length - 1)];
  const w = wahl[d.id] ?? d.empfohlen;
  const o: Option = d.optionen[w];
  const beschluss = beschlussVon(fortschreibung, d.id);
  const fertig = (i: number) => !!beschlussVon(fortschreibung, liste[i].id);
  const naechste = () => { for (let k = 1; k <= liste.length; k++) { const i = (akt + k) % liste.length; if (!fertig(i)) return i; } return null; };
  const zeige = (i: number) => { setAkt(i); setSchublade(false); history.replaceState(null, '', `#/entscheidungen/${liste[i].id}`); };
  const waehle = (j: number) => {
    const x = d.optionen[j];
    if (x.gesperrt) { toast(x.gesperrt); return; }
    setWahl({ ...wahl, [d.id]: j });
  };
  const entscheiden = () => {
    if (o.gesperrt) { toast(o.gesperrt); return; }
    const m = beschliessen(d, o);
    toast(`${o.name}. ${m ? 'Steht jetzt als Maßnahme in Ihrer Chronik.' : 'Steht jetzt in Ihrer Chronik.'}`);
    if (o.ziel) setTimeout(() => gehe(o.ziel!), 700);
  };
  const cta = w === d.empfohlen ? d.cta : 'Diese Option wählen';
  const stat = (i: number) => (fertig(i) ? 'fertig' : liste[i].status === 'pruefen' && liste[i].art !== 'schaden' ? 'blockiert' : liste[i].dringlichkeit === 'hoch' ? 'hoch' : '');

  const Gruende = (
    <div className="spalten">
      {([['Gründe', d.gruende], ['Risiken', d.risiken], ['Datenlage', d.datenlage]] as [string, string[]][]).map(([t, l]) => (
        <div key={t}><h4>{t}</h4><ul>{l.filter(Boolean).map((x, i) => <li key={i}>{x}</li>)}</ul></div>
      ))}
    </div>
  );

  return (
    <>
      <section className="buehne fest">
        {Array.from(new Set(liste.map((x) => x.bild))).map((b) => <div key={b} className={`bild ${b === d.bild ? 'an' : ''}`} style={{ backgroundImage: `url(${b})` }} />)}
        <div className="schleier" />
        <div className="ui dunkel">
          <Kopf seite="entscheidungen" />
          <div className="raster">
            <aside className="kapitel glas ein" style={{ animationDelay: '.15s' }} aria-label="Anstehende Entscheidungen">
              <div className="kopfz">
                <a href="#/" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'rgba(245,241,234,.6)', marginBottom: 12 }}><Icon n="back" />Mein Wald</a>
                <h2>{zahlwort(liste.length)} {liste.length === 1 ? 'Entscheidung' : 'Entscheidungen'}, <em>nach Dringlichkeit.</em></h2>
                <div className="fortschritt">{liste.map((x, i) => <i key={x.id} className={fertig(i) ? 'fertig' : ''} />)}</div>
              </div>
              {liste.map((x, i) => (
                <button key={x.id} className={`kap ${i === akt ? 'an' : ''}`} onClick={() => zeige(i)} aria-current={i === akt}>
                  <span className="n">{String(i + 1).padStart(2, '0')}</span>
                  <span><b>{x.kurz}</b><small>{fertig(i) ? `Entschieden · ${beschlussVon(fortschreibung, x.id)!.optionName}` : `${ART_LABEL[x.art]} · ${x.ort.split(' · ')[0]}`}</small></span>
                  <span className={`st ${stat(i)}`} />
                </button>
              ))}
            </aside>

            <section className="mitte wechsel" key={d.id}>
              <div className="ort"><i /><span>Entscheidung {String(akt + 1).padStart(2, '0')} von {String(liste.length).padStart(2, '0')} · {d.ort}</span></div>
              <h1>{d.titel[0]}<em>{d.titel[1]}</em>{d.titel[2]}</h1>
              <p className="satz">{d.satz}</p>
              <div className="optionen" style={{ gridTemplateColumns: `repeat(${d.optionen.length},minmax(0,1fr))` }}>
                {d.optionen.map((x, j) => (
                  <button key={x.id} className={`opt glas ${j === w ? 'an' : ''} ${x.gesperrt ? 'gesperrt' : ''}`} onClick={() => waehle(j)} title={x.gesperrt} aria-pressed={j === w}>
                    <span className="ring" /><span className="m">{j === d.empfohlen ? 'Empfohlen' : x.marke}</span><b>{x.name}</b><span className="preis">{x.preis}</span>
                  </button>
                ))}
              </div>
              <div className="wirkung">{o.wirkung.map((x) => <div key={x.label}><span>{x.label}</span><b className={x.ton ?? ''}>{x.wert}</b></div>)}</div>
            </section>

            <aside className="karte ein" style={{ animationDelay: '.35s' }} aria-label="Ihre Entscheidung">
              {!beschluss ? (
                <>
                  <div className="oben"><span className="klein">Ihre Entscheidung</span><Status s={d.status} text={d.statusText} erklaerung={d.statusErklaerung} /></div>
                  <h3>{o.name}</h3>
                  {d.fehlt && <div className="fehlt"><b>Es fehlt:</b><ul>{d.fehlt.map((f) => <li key={f}>{f}</li>)}</ul></div>}
                  {o.gesperrt && <div className="fehlt">{o.gesperrt}</div>}
                  <div className="zeilen">{o.zeilen.map(([a, b]) => <div key={a}><span>{a}</span><b>{b}</b></div>)}</div>
                  <button className="knopf" onClick={entscheiden} disabled={!!o.gesperrt}>{cta} <Icon n="arrow" /></button>
                  {d.rechner && <a className="knopf2" href={d.rechner}><Icon n="chart" />Im Rechner durchspielen</a>}
                  <button className="mehr" onClick={() => setSchublade(true)}><span>Gründe, Risiken und Datenlage</span></button>
                </>
              ) : (
                <div className="erledigt">
                  <div className="haken"><Icon n="check" gross /></div>
                  <h3 style={{ marginTop: 0 }}>{beschluss.optionName}</h3>
                  <p style={{ fontSize: 14, color: 'var(--slate)', marginTop: 6 }}>Entschieden am {datumKurz(beschluss.datum)}. Steht in Ihrer Chronik.</p>
                  {naechste() !== null ? <button className="knopf" onClick={() => zeige(naechste()!)}>Nächste Entscheidung <Icon n="arrow" /></button> : <a className="knopf" href="#/chronik">Zur Chronik <Icon n="arrow" /></a>}
                  <button className="mehr" onClick={() => beschlussZuruecknehmen(d.id)}><span>Rückgängig machen</span></button>
                </div>
              )}
            </aside>
          </div>
        </div>
        <div className="korn" />
      </section>

      {/* Mobil: Bild oben, warmes Blatt darunter */}
      <div className="blatt" key={d.id + 'm'}>
        <div className="chips" style={{ margin: '0 -16px 18px', padding: '0 16px' }}>
          {liste.map((x, i) => <button key={x.id} className={`chip ${i === akt ? 'an' : ''}`} onClick={() => zeige(i)}><span className={`st ${stat(i)}`} />{String(i + 1).padStart(2, '0')}</button>)}
        </div>
        <div className="kopfzeile" style={{ marginBottom: 10 }}><span className="klein" style={{ color: 'var(--amber)' }}>{ART_LABEL[d.art]}</span><Status s={d.status} text={d.statusText} erklaerung={d.statusErklaerung} /></div>
        {d.fehlt && <div className="fehlt" style={{ marginBottom: 12 }}><b>Es fehlt:</b><ul>{d.fehlt.map((f) => <li key={f}>{f}</li>)}</ul></div>}
        <div className="mopt">
          {d.optionen.map((x, j) => (
            <button key={x.id} className={`${j === w ? 'an' : ''} ${x.gesperrt ? 'gesperrt' : ''}`} onClick={() => waehle(j)} aria-pressed={j === w}>
              <span className="r" /><span><small>{j === d.empfohlen ? 'Empfohlen' : x.marke}</small><b>{x.name}</b></span><span className="p">{x.preis}</span>
            </button>
          ))}
        </div>
        <div className="mwirk">{o.wirkung.map((x) => <div key={x.label}><span>{x.label}</span><b className={x.ton ?? ''}>{x.wert}</b></div>)}</div>
        {!beschluss ? (
          <>
            <button className="knopf" onClick={entscheiden} disabled={!!o.gesperrt}>{cta} <Icon n="arrow" /></button>
            {d.rechner && <a className="knopf2" href={d.rechner}>Im Rechner durchspielen</a>}
          </>
        ) : (
          <div className="erledigt"><div className="haken"><Icon n="check" /></div><p className="serif" style={{ fontSize: 20 }}>{beschluss.optionName}</p>{naechste() !== null && <button className="knopf" onClick={() => zeige(naechste()!)}>Nächste Entscheidung <Icon n="arrow" /></button>}</div>
        )}
        <div style={{ marginTop: 22 }}>{Gruende}</div>
        {modus === 'pro' && <p className="lauf">Rechenlauf {d.rechenlauf.eingabenHash} · {d.rechenlauf.modelle.join(' · ')} · Annahmen {d.rechenlauf.annahmen}</p>}
      </div>

      <div className={`schublade ${schublade ? 'auf' : ''}`} role="dialog" aria-label="Gründe, Risiken und Datenlage" aria-hidden={!schublade}>
        <button className="zu" onClick={() => setSchublade(false)} aria-label="Schließen"><Icon n="x" /></button>
        <span className="klein" style={{ color: 'var(--amber)' }}>Eine Ebene tiefer</span>
        <div className="serif" style={{ fontSize: 26, marginTop: 6 }}>{d.kurz}</div>
        {Gruende}
        <p className="lauf">Rechenlauf {d.rechenlauf.eingabenHash} · {d.rechenlauf.modelle.join(' · ')} · Annahmen {d.rechenlauf.annahmen}{d.rechenlauf.regelpaket ? ` · Regelpaket ${d.rechenlauf.regelpaket}` : ''}</p>
      </div>
    </>
  );
}

function zahlwort(n: number) {
  return ['Keine', 'Eine', 'Zwei', 'Drei', 'Vier', 'Fünf', 'Sechs', 'Sieben', 'Acht', 'Neun', 'Zehn', 'Elf', 'Zwölf'][n] ?? String(n);
}
