import { datumKurz } from '../../engine/format';
import { MASSNAHME_STATUS_TEXT, STATUS_FOLGE } from '../../engine/fortschreibung';
import { Icon, Werkzeug } from '../bausteine';
import { MassnahmeKarte } from '../massnahmen';
import { useZustand } from '../zustand';

export function Chronik() {
  const { wald, fortschreibung, toast } = useZustand();
  const ms = fortschreibung.massnahmen;
  const name = (id?: string) => wald.bestaende.find((b) => b.id === id)?.label;

  // Kopieren statt Herunterladen: funktioniert auch dort, wo Downloads gesperrt sind.
  const kopieren = async (inhalt: string, was: string) => {
    try { await navigator.clipboard.writeText(inhalt); toast(`${was} kopiert.`); } catch { toast('Kopieren wurde vom Browser abgelehnt.'); }
  };
  const csv = () => kopieren(['Titel;Bestand;Art;Status;Erstellt;Kostenrahmen;Förderung', ...ms.map((m) => [m.titel, name(m.bestandId) ?? '', m.art, MASSNAHME_STATUS_TEXT[m.status], m.erstellt, m.kostenRahmen ?? '', m.foerderung ?? ''].join(';'))].join('\n'), 'Maßnahmenliste (CSV)');

  return (
    <Werkzeug seite="chronik" bild="bilder/stamm.webp" titel={<>Was war, <em>was getan wird.</em></>} lead="Jede Entscheidung wird zur Maßnahme, jede erledigte Maßnahme fließt in den Zwilling zurück. So wird aus Planung Bewirtschaftung.">
      <section>
        <div className="kopfzeile"><h2 className="titel2">Maßnahmen</h2>
          {ms.length > 0 && <div style={{ display: 'flex', gap: 8 }}><button className="chip" onClick={csv}><Icon n="copy" />CSV kopieren</button><button className="chip" onClick={() => kopieren(JSON.stringify(fortschreibung, null, 2), 'Rechenläufe (JSON)')}><Icon n="copy" />Rechenläufe kopieren</button></div>}
        </div>
        {ms.length === 0 ? (
          <div className="feld leer">Noch keine Maßnahmen. Sie entstehen, wenn Sie eine Entscheidung treffen.<br /><a className="knopf" href="#/aufgaben" style={{ maxWidth: 320, margin: '18px auto 0' }}>Zu den Aufgaben <Icon n="arrow" /></a></div>
        ) : (
          <div className="drei" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))' }}>
            {STATUS_FOLGE.map((s) => (
              <div key={s} className="spalte">
                <span className="klein" style={{ color: 'var(--grau)' }}>{MASSNAHME_STATUS_TEXT[s]} · {ms.filter((m) => m.status === s).length}</span>
                {ms.filter((m) => m.status === s).map((m) => <MassnahmeKarte key={m.id} m={m} />)}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="abschnitt">
        <span className="klein">Chronik des Waldes</span>
        <h2>Belegt, <em>nicht behauptet.</em></h2>
        <ul className="chronik">
          {wald.tagebuch.map((t, i) => (
            <li key={i} className={t.sicherheit}>
              <span className="d">{datumKurz(t.datum)}{t.bestand ? ` · ${t.bestand}` : ''}{t.sicherheit === 'zu_pruefen' ? ' · noch zu prüfen' : ''}</span>
              <b>{t.titel}</b>
              {t.text && <p>{t.text}</p>}
              {t.quelle && <p className="mono" style={{ fontSize: 11.5 }}>{t.quelle}</p>}
            </li>
          ))}
        </ul>
      </section>
    </Werkzeug>
  );
}
