import { useRef, useState } from 'react';
import { ALTER_TEXT, waldAusAngaben, ZUSTAND_TEXT, type Altersklasse, type FlaechenAngabe, type Zustand } from '../../engine/angaben';
import { ART_TEXT, type Artgruppe } from '../../engine/modell';
import { AUFNAHME_TEXT, ersteErkenntnis, waldaufnahme, ZIEL_TEXT, type Ziel } from '../../engine/startseite';
import { ImportFehler, zwillingImportieren, zwillingTextLesen } from '../../engine/zwilling-import';
import { gehe, Icon } from '../bausteine';
import { lesen, schreiben } from '../speicher';
import { useZustand } from '../zustand';
import { Portraet } from './Uebersicht';

/**
 * Der Einstieg in vier Schritten: Wald finden → Ziel → erstes Waldporträt → erster Mehrwert
 * (die Übersicht). Es werden keine erfundenen Vorräte oder Werte gezeigt.
 */
function Schritte({ n }: { n: number }) {
  return <div className="schritte" aria-hidden="true">{[1, 2, 3, 4].map((i) => <span key={i} className={i <= n ? 'an' : ''} />)}</div>;
}

function Kopf({ n, zusatz, titel }: { n: number; zusatz?: string; titel: string }) {
  return (
    <>
      <Schritte n={n} />
      <section style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 6 }}>
        <span className="unterzeile">Schritt {n} von 4{zusatz ? ` · ${zusatz}` : ''}</span>
        <h1 className="titel">{titel}</h1>
      </section>
    </>
  );
}

export function Start({ param }: { param?: string }) {
  if (param === 'ziel') return <ZielWahl />;
  if (param === 'portraet') return <ErstesPortraet />;
  if (param === 'beschreiben') return <Beschreiben />;
  if (param === 'flurstueck') return <Flurstueck />;
  return <Finden />;
}

function Finden() {
  const { zwillingSetzen, beispielLaden, toast, setStartGesehen } = useZustand();
  const datei = useRef<HTMLInputElement>(null);
  const [fehler, setFehler] = useState<string>();
  const laden = async (f: File) => {
    setFehler(undefined);
    try {
      const w = zwillingImportieren(zwillingTextLesen(await f.text()));
      await zwillingSetzen(w);
      toast(`${w.betrieb.langname}: ${w.bestaende.length} Flächen übernommen.`);
      gehe('#/start/ziel');
    } catch (e) {
      setFehler(e instanceof ImportFehler ? e.message : `Die Datei ließ sich nicht lesen (${(e as Error).message}).`);
    }
  };
  return (
    <main className="app start">
      <Kopf n={1} titel="Wo liegt Ihr Wald?" />
      <p className="lead">Wählen Sie, wie wir Ihren Wald finden. Alles bleibt auf diesem Gerät, bis Sie es teilen.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <a className="wahl" href="#/start/flurstueck"><span className="wahl-icon"><Icon n="pin" gross /></span><span><b>Flurstück oder Ort eingeben</b><small>Wir erstellen den Zwilling aus Kataster, Luftbild und Laserscan</small></span><Icon n="arrow" /></a>
        <a className="wahl" href="#/start/beschreiben"><span className="wahl-icon"><Icon n="pen" gross /></span><span><b>Selbst beschreiben</b><small>Vier Angaben je Fläche, in zwei Minuten</small></span><Icon n="arrow" /></a>
        <button className="wahl" onClick={() => datei.current?.click()}><span className="wahl-icon"><Icon n="upload" gross /></span><span><b>Digitalen Zwilling übernehmen</b><small>Datei der Waldgrafen (HTML oder JSON)</small></span><Icon n="arrow" /></button>
        <input ref={datei} type="file" accept=".html,.htm,.json" hidden onChange={(e) => e.target.files?.[0] && laden(e.target.files[0])} />
        {fehler && <div className="fehlt">{fehler}</div>}
      </div>
      <button className="mehr" onClick={async () => { await beispielLaden(); setStartGesehen(true); gehe('#/'); }}>Erst umsehen – mit einem Beispielwald</button>
    </main>
  );
}

function Flurstueck() {
  const vorher = lesen<{ ort: string; nr: string }>('wg-flurstueck', { ort: '', nr: '' });
  const [ort, setOrt] = useState(vorher.ort);
  const [nr, setNr] = useState(vorher.nr);
  return (
    <main className="app start">
      <Kopf n={1} titel="Wo liegt Ihr Wald?" />
      <form className="feld" style={{ display: 'flex', flexDirection: 'column', gap: 12 }} onSubmit={(e) => { e.preventDefault(); schreiben('wg-flurstueck', { ort, nr }); gehe('#/start/beschreiben'); }}>
        <label className="formzeile"><span>Ort oder Gemarkung</span><input className="eingabe" value={ort} onChange={(e) => setOrt(e.target.value)} placeholder="z. B. Hirschberg" required /></label>
        <label className="formzeile"><span>Flurstücksnummer (falls bekannt)</span><input className="eingabe" value={nr} onChange={(e) => setNr(e.target.value)} placeholder="z. B. 412/3" inputMode="text" /></label>
        <p className="unterzeile">Den Zwilling mit Grenzen, Baumarten und Holzvorrat erstellen die Waldgrafen aus amtlichen Daten – das dauert einige Tage. Damit Sie heute schon starten können, beschreiben Sie Ihre Fläche kurz selbst.</p>
        <button className="knopf" type="submit">Weiter: Fläche beschreiben <Icon n="arrow" /></button>
      </form>
      <a className="mehr" href="#/start">Anderen Weg wählen</a>
    </main>
  );
}

const ARTEN: Artgruppe[] = ['fichte', 'kiefer', 'tanne', 'buche', 'eiche', 'edellaub', 'douglasie', 'laerche'];
const ALTER: Altersklasse[] = ['jung', 'mittel', 'alt', 'sehr_alt'];
const ZUSTAENDE: Zustand[] = ['gesund', 'schaeden', 'kahl'];

function Beschreiben() {
  const { zwillingSetzen, toast } = useZustand();
  const fs = lesen<{ ort: string; nr: string }>('wg-flurstueck', { ort: '', nr: '' });
  const [name, setName] = useState(fs.ort ? `Wald bei ${fs.ort}` : '');
  const leer = (i: number): FlaechenAngabe => ({ name: i ? `Fläche ${i + 1}` : fs.nr ? `Flurstück ${fs.nr}` : 'Fläche 1', ha: 2, art: 'fichte', alter: 'mittel', zustand: 'gesund' });
  const [flaechen, setFlaechen] = useState<FlaechenAngabe[]>([leer(0)]);
  const setze = (i: number, t: Partial<FlaechenAngabe>) => setFlaechen(flaechen.map((f, j) => (j === i ? { ...f, ...t } : f)));
  const fertig = async () => {
    const w = waldAusAngaben({ name: name || 'Mein Wald', bundesland: 'Bayern', flaechen: flaechen.filter((f) => f.ha > 0) });
    await zwillingSetzen(w);
    toast(`${w.betrieb.langname} angelegt.`);
    gehe('#/start/ziel');
  };
  return (
    <main className="app start">
      <Kopf n={1} zusatz="Selbst beschreiben" titel="Beschreiben Sie Ihren Wald." />
      <label className="formzeile"><span>Wie heißt Ihr Wald?</span><input className="eingabe hell" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Wald am Hirschberg" /></label>
      {flaechen.map((f, i) => (
        <section key={i} className="feld" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="kopfzeile" style={{ marginBottom: 0, alignItems: 'center' }}>
            <input className="eingabe" value={f.name} onChange={(e) => setze(i, { name: e.target.value })} aria-label="Name der Fläche" style={{ fontWeight: 600, flex: 1 }} />
            {flaechen.length > 1 && <button className="rund" onClick={() => setFlaechen(flaechen.filter((_, j) => j !== i))} aria-label="Fläche entfernen"><Icon n="x" /></button>}
          </div>
          <label className="formzeile"><span>Größe in Hektar</span><input className="eingabe" type="number" min={0.1} step={0.1} inputMode="decimal" value={f.ha} onChange={(e) => setze(i, { ha: Number(e.target.value) })} /></label>
          <div className="formzeile"><span>Zustand</span><div className="chips">{ZUSTAENDE.map((z) => <button key={z} className={`chip ${f.zustand === z ? 'an' : ''}`} aria-pressed={f.zustand === z} onClick={() => setze(i, { zustand: z })}>{ZUSTAND_TEXT[z]}</button>)}</div></div>
          {f.zustand !== 'kahl' && (
            <>
              <label className="formzeile"><span>Welche Baumart überwiegt?</span><select value={f.art} onChange={(e) => setze(i, { art: e.target.value as Artgruppe })}>{ARTEN.map((a) => <option key={a} value={a}>{ART_TEXT[a]}</option>)}</select></label>
              <div className="formzeile"><span>Wie alt sind die Bäume ungefähr?</span><div className="chips">{ALTER.map((a) => <button key={a} className={`chip ${f.alter === a ? 'an' : ''}`} aria-pressed={f.alter === a} onClick={() => setze(i, { alter: a })}>{ALTER_TEXT[a]}</button>)}</div></div>
            </>
          )}
        </section>
      ))}
      <button className="knopf2" onClick={() => setFlaechen([...flaechen, leer(flaechen.length)])}><Icon n="plus" />Weitere Fläche</button>
      <p className="unterzeile">Aus diesen Angaben schätzen wir grob. Einen Holzwert zeigen wir erst nach einer Messung – dafür führt Sie die App Schritt für Schritt.</p>
      <button className="knopf" onClick={fertig} disabled={!flaechen.some((f) => f.ha > 0)}>Weiter <Icon n="arrow" /></button>
    </main>
  );
}

const ZIELE: Ziel[] = ['kennenlernen', 'erhalten', 'bewirtschaften', 'entwickeln', 'betrieb'];

function ZielWahl() {
  const { ziele, setZiele } = useZustand();
  const [gewaehlt, setGewaehlt] = useState<Ziel[]>(ziele.length ? ziele : ['kennenlernen']);
  const kipp = (z: Ziel) => setGewaehlt(gewaehlt.includes(z) ? gewaehlt.filter((x) => x !== z) : [...gewaehlt, z]);
  return (
    <main className="app start">
      <Kopf n={2} zusatz="Mehrfachauswahl" titel="Was möchten Sie mit Ihrem Wald erreichen?" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {ZIELE.map((z) => {
          const an = gewaehlt.includes(z);
          return (
            <button key={z} className={`zielwahl ${an ? 'an' : ''}`} aria-pressed={an} onClick={() => kipp(z)}>
              <span><b>{ZIEL_TEXT[z].titel}</b><small>{ZIEL_TEXT[z].text}</small></span>
              <span className="haken"><Icon n="check" /></span>
            </button>
          );
        })}
      </div>
      <p className="unterzeile">Danach richtet sich, was Sie auf der Startseite sehen. Sie können es jederzeit ändern.</p>
      <button className="knopf" onClick={() => { setZiele(gewaehlt); gehe('#/start/portraet'); }}>Weiter <Icon n="arrow" /></button>
    </main>
  );
}

function ErstesPortraet() {
  const { wald, setStartGesehen } = useZustand();
  const a = waldaufnahme(wald);
  const e = ersteErkenntnis(wald);
  const bekannt = a.bereiche.filter((b) => b.status !== 'offen' && b.id !== 'vorrat');
  const fehlt = a.bereiche.filter((b) => b.status === 'offen' || b.status === 'angabe');
  const fertig = () => { setStartGesehen(true); gehe('#/'); };
  return (
    <main className="app start">
      <Kopf n={3} titel="Ihr erstes Waldporträt" />
      <Portraet wald={wald} hoehe={300} />
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="klein">Das wissen wir schon</span>
        <div className="bento">
          {bekannt.map((b) => (
            <div key={b.id} className="kachel" style={{ minHeight: 110 }}>
              <span className="etikett"><span className={`punkt-st ${b.status === 'liegt_vor' ? 'gut' : b.status === 'geschaetzt' ? 'halb' : 'amber'}`} />{b.titel}</span>
              <span className="fuss" style={{ fontSize: 14 }}>{AUFNAHME_TEXT[b.status]} · {b.text}</span>
            </div>
          ))}
        </div>
        <span className="unterzeile">Grüner Punkt: gemessen oder amtlich. Halber Punkt: aus dem Satellitenbild geschätzt. Amber: Ihre Angabe.</span>
      </section>
      {e && (
        <section className="feld" style={{ background: 'var(--salbei)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <b style={{ fontSize: 13 }}>Erste Erkenntnis</b>
          <span className="titel2" style={{ fontSize: 21 }}>{e.satz}</span>
          <span className="unterzeile" style={{ color: 'var(--grau2)' }}>{e.grundlage}</span>
        </section>
      )}
      {fehlt.length > 0 && (
        <section className="feld">
          <h3>Das fehlt noch</h3>
          <div className="liste-zeilen">{fehlt.map((b) => <div key={b.id}><span>{b.titel}</span><b style={{ color: b.id === 'vorrat' ? 'var(--grau)' : 'var(--amber-text)', fontSize: 13 }}>{b.id === 'vorrat' ? 'nach Messung' : b.status === 'angabe' ? 'Ihre Angabe' : 'noch offen'}</b></div>)}</div>
        </section>
      )}
      <button className="knopf" onClick={fertig}>Zur Übersicht <Icon n="arrow" /></button>
    </main>
  );
}
