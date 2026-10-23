import { ART_LABEL, type Entscheidung } from '../../engine/entscheidungen';
import { datumKurz, rund, zahl } from '../../engine/format';
import { Icon, Initialen, useOffen } from '../bausteine';
import { MassnahmeKarte } from '../massnahmen';
import { useZustand } from '../zustand';

export function euroKurz(n: number) {
  const r = rund(Math.abs(n));
  return r >= 10_000 ? `${zahl(r / 1000)} T€` : `${zahl(r)} €`;
}

const FARBE: Record<string, string> = { hoch: 'k-amber', mittel: 'k-rinde', gering: 'k-salbei', keine: 'k-stein' };

export function AufgabeKachel({ e, klein }: { e: Entscheidung; klein?: boolean }) {
  const farbe = e.art === 'messen' ? 'k-stein' : FARBE[e.dringlichkeit];
  return (
    <a className={`aufgabe-kachel ${farbe} ${klein ? 'kompakt' : ''}`} href={`#/aufgabe/${e.id}`}>
      <span className="links">
        <small style={{ fontWeight: 700 }}>{ART_LABEL[e.art]}{e.dringlichkeit === 'hoch' ? ' · dringend' : ''}</small>
        <b>{e.kurz}</b>
        <small>{e.ort.split(' · ')[0]}</small>
      </span>
      <span className="rechts">
        {e.wertEuro > 0 && <><small>Es geht um</small><span>{euroKurz(e.wertEuro)}</span></>}
      </span>
    </a>
  );
}

/** Aufgaben: was zu entscheiden ist, was beschlossen ist, was gerade umgesetzt wird. */
export function Aufgaben() {
  const { fortschreibung, beschlussZuruecknehmen } = useZustand();
  const offen = useOffen();
  const laufend = fortschreibung.massnahmen.filter((m) => m.status !== 'erledigt');
  const erledigt = fortschreibung.massnahmen.filter((m) => m.status === 'erledigt');
  const ohneMassnahme = fortschreibung.beschluesse.filter((b) => !fortschreibung.massnahmen.some((m) => m.entscheidungId === b.entscheidungId));

  return (
    <main className="app">
      <header className="leiste"><h1 className="titel">Aufgaben</h1><Initialen /></header>
      <p className="lead" style={{ marginTop: -10 }}>{offen.length ? `${offen.length} ${offen.length === 1 ? 'Entscheidung steht' : 'Entscheidungen stehen'} an – das Dringendste zuerst.` : 'Gerade steht keine Entscheidung an.'}</p>

      {offen.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="klein">Zu entscheiden</span>
          {offen.map((e, i) => <AufgabeKachel key={e.id} e={e} klein={i > 0} />)}
        </section>
      )}

      {laufend.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="klein">In Umsetzung</span>
          {laufend.map((m) => <MassnahmeKarte key={m.id} m={m} />)}
        </section>
      )}

      {ohneMassnahme.length > 0 && (
        <section className="feld">
          <h3>Entschieden</h3>
          {ohneMassnahme.map((b) => (
            <div key={b.entscheidungId} className="reihe">
              <span className="punkt-st gut" style={{ width: 12, height: 12, borderRadius: 6 }} />
              <span><b>{b.kurz}</b><small>{b.optionName} · {datumKurz(b.datum)}</small></span>
              <button className="chip" onClick={() => beschlussZuruecknehmen(b.entscheidungId)}>Zurücknehmen</button>
            </div>
          ))}
        </section>
      )}

      {erledigt.length > 0 && (
        <section className="feld">
          <h3>Erledigt</h3>
          {erledigt.map((m) => (
            <div key={m.id} className="reihe">
              <span className="rund" style={{ width: 32, height: 32, background: 'var(--gut-hell)', color: 'var(--gut)' }}><Icon n="check" /></span>
              <span><b>{m.titel}</b><small>{m.ergebnis ? datumKurz(m.ergebnis.datum) : ''} · fließt in den Zwilling zurück</small></span>
              <span />
            </div>
          ))}
        </section>
      )}

      <a className="zeilenlink" href="#/chronik"><span><b>Chronik des Waldes</b><small>Alles Belegte, Maßnahmen als Liste kopieren</small></span><Icon n="arrow" /></a>
    </main>
  );
}
