import { useEffect, useRef, useState } from 'react';
import { MASSNAHME_STATUS_TEXT, STATUS_FOLGE } from '../../engine/fortschreibung';
import { frageRouten } from '../../engine/startseite';
import { gehe, Icon, Initialen, Ring } from '../bausteine';
import { useZustand } from '../zustand';

const BEISPIELFRAGEN = ['Lohnt sich eine Durchforstung?', 'Was pflanze ich auf der Kahlfläche?', 'Welche Förderung bekomme ich?', 'Wie genau ist mein Vorrat?'];

/** Planen: eine Frage in Alltagssprache oder einer der geführten Abläufe. */
export function Planen({ param }: { param?: string }) {
  const { fortschreibung, toast } = useZustand();
  const [frage, setFrage] = useState('');
  const feld = useRef<HTMLInputElement>(null);
  useEffect(() => { if (param === 'frage') feld.current?.focus(); }, [param]);
  const laufend = fortschreibung.massnahmen.filter((m) => m.status !== 'erledigt').slice(0, 3);

  const fragen = (t: string) => {
    if (!t.trim()) { feld.current?.focus(); return; }
    const r = frageRouten(t);
    toast(`Passender Ablauf: ${r.titel}`);
    gehe(r.ziel);
  };

  return (
    <main className="app">
      <header className="leiste"><h1 className="titel">Planen</h1><Initialen /></header>
      <p className="lead" style={{ marginTop: -10 }}>Was haben Sie mit Ihrem Wald vor?</p>

      <form className="frageform" onSubmit={(e) => { e.preventDefault(); fragen(frage); }}>
        <label htmlFor="frage" className="klein">Frage stellen</label>
        <div className="frage-eingabe">
          <input id="frage" ref={feld} type="text" className="eingabe hell" value={frage} onChange={(e) => setFrage(e.target.value)} placeholder="z. B. Lohnt sich eine Durchforstung?" autoComplete="off" />
          <button type="submit" className="rund dunkel" aria-label="Frage senden"><Icon n="arrow" /></button>
        </div>
        <div className="chips">{BEISPIELFRAGEN.map((f) => <button type="button" key={f} className="chip" onClick={() => fragen(f)}>{f}</button>)}</div>
        <p className="unterzeile">Ihre Frage führt zum passenden Rechner. Antworten kommen aus Ihren Walddaten und offenen Annahmen, nicht aus einem Sprachmodell.</p>
      </form>

      <div className="bento">
        <a className="kachel breit planbild" href="#/zukunft">
          <img src="bilder/stamm.webp" alt="" />
          <span className="schleier" />
          <span className="bildfuss"><b>Mein Wald in 30 Jahren</b><small>Entwicklungswege vergleichen, erst im Bild, dann in Zahlen</small></span>
        </a>
        <a className="kachel k-salbei" href="#/ernte"><Icon n="axe" gross /><span><b className="kt">Holz ernten?</b><small className="ku">Was nach Kosten bleibt</small></span></a>
        <a className="kachel k-rinde" href="#/zukunft"><Icon n="sprout" gross /><span><b className="kt">Pflanzen und umbauen</b><small className="ku">Baumarten, Kosten, Schutz</small></span></a>
        <a className="kachel k-stein" href="#/messen"><Icon n="ruler" gross /><span><b className="kt">Genauer messen</b><small className="ku">Winkelzählprobe mit dem Handy</small></span></a>
        <a className="kachel" href="#/vermoegen"><Icon n="chart" gross /><span><b className="kt">Wert und Vermögen</b><small className="ku">Holzwert, CO₂, Erbe</small></span></a>
      </div>

      <a className="zeilenlink" href="#/zukunft"><span><b>Förderung prüfen</b><small>WALDFÖPR 2025 · Bayern · mit Quelle und Stand</small></span><Icon n="arrow" /></a>

      {laufend.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="klein">{laufend.length === 1 ? 'Laufendes Vorhaben' : 'Laufende Vorhaben'}</span>
          {laufend.map((m) => {
            const i = STATUS_FOLGE.indexOf(m.status);
            const naechster = STATUS_FOLGE[i + 1];
            return (
              <a key={m.id} className="zeilenlink" href="#/aufgaben" style={{ justifyContent: 'flex-start', gap: 14 }}>
                <Ring anteil={(i + 1) / STATUS_FOLGE.length} groesse={56} farbe="var(--amber)" text={`${i + 1}/${STATUS_FOLGE.length}`} label={`Schritt ${i + 1} von ${STATUS_FOLGE.length}`} />
                <span style={{ flex: 1, minWidth: 0 }}><b>{m.titel}</b><small>{m.erstNachBewilligung && m.status === 'geplant' ? 'Nächster Schritt: Förderantrag' : naechster ? `Nächster Schritt: ${MASSNAHME_STATUS_TEXT[naechster]}` : ''}</small></span>
                <Icon n="arrow" />
              </a>
            );
          })}
        </section>
      )}

      <a className="zeilenlink" href="#/daten"><span><b>Daten, Annahmen und Quellen</b><small>Was die App weiß und woher</small></span><Icon n="arrow" /></a>
    </main>
  );
}
