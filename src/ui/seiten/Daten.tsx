import { useRef, useState } from 'react';
import { QUELLEN_ANNAHMEN } from '../../engine/annahmen';
import { datumKurz, ha, pct, zahl } from '../../engine/format';
import { WALDFOEPR_2025 } from '../../engine/foerderung/regelpaket-by-waldfoepr-2025';
import { gesamtHa } from '../../engine/modell';
import { ImportFehler, zwillingImportieren, zwillingTextLesen } from '../../engine/zwilling-import';
import { gehe, Icon, Regler, Werkzeug } from '../bausteine';
import { useZustand } from '../zustand';

export function Daten() {
  const { wald, basis, zwillingSetzen, beispielLaden, annahmen, setAnnahmen, modus, setModus, fortschreibungZuruecksetzen, toast } = useZustand();
  const [ueber, setUeber] = useState(false);
  const [fehler, setFehler] = useState<string>();
  const [laedt, setLaedt] = useState(false);
  const [loeschen, setLoeschen] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const laden = async (datei: File) => {
    setFehler(undefined); setLaedt(true);
    try {
      const w = zwillingImportieren(zwillingTextLesen(await datei.text()));
      await zwillingSetzen(w);
      toast(`${w.betrieb.langname} geladen: ${w.bestaende.length} Bestände.`);
      gehe('#/');
    } catch (e) {
      setFehler(e instanceof ImportFehler ? e.message : `Die Datei ließ sich nicht lesen (${(e as Error).message}).`);
    } finally { setLaedt(false); }
  };

  return (
    <Werkzeug seite="daten" titel={<>Daten, Annahmen <em>und Quellen.</em></>} lead="Was die App weiß, woher sie es weiß und welche Annahmen sie trifft – vollständig offen.">
      <div className="zwei">
        <div>
          <div className="feld">
            <h3>Aktueller Zwilling</h3>
            <h2>{wald.betrieb.langname}</h2>
            <p className="unterzeile">{wald.quelle === 'beispiel' ? 'Fiktive Beispieldaten' : `Erfasst ${datumKurz(wald.stand)}`} · {ha(gesamtHa(basis))} · {wald.bestaende.length} Bestände · {wald.betrieb.bundesland}</p>
            {wald.profil.annahme && <div className="hinweis" style={{ marginTop: 12 }}>Das Eigentümerprofil (Ziele, Kalkulationszins {pct(wald.profil.kalkulationszins * 100, 1)}, Verbiss {wald.profil.verbiss}) ist eine Standardannahme und noch nicht mit dem Eigentümer besprochen.</div>}
            {wald.quelle !== 'beispiel' && <button className="knopf2" onClick={async () => { await beispielLaden(); toast('Beispieldaten geladen.'); }}>Beispieldaten anzeigen</button>}
          </div>
          <div className="feld">
            <h3>Eigenen Zwilling laden</h3>
            <div className={`ablage ${ueber ? 'ueber' : ''}`} onDragOver={(e) => { e.preventDefault(); setUeber(true); }} onDragLeave={() => setUeber(false)} onDrop={(e) => { e.preventDefault(); setUeber(false); const f = e.dataTransfer.files[0]; if (f) laden(f); }}>
              <Icon n="upload" gross />
              <p style={{ marginTop: 8 }}>Zwillings-Datei hierher ziehen<br /><span className="unterzeile">HTML-Export oder JSON der Waldgrafen-Erfassung</span></p>
              <button className="knopf gruen" style={{ maxWidth: 280, margin: '14px auto 0' }} onClick={() => input.current?.click()} disabled={laedt}>{laedt ? 'Wird gelesen …' : 'Datei auswählen'}</button>
              <input ref={input} type="file" accept=".html,.htm,.json,application/json,text/html" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) laden(f); e.target.value = ''; }} />
            </div>
            {fehler && <div className="hinweis warn" style={{ marginTop: 10 }}>{fehler}</div>}
            <p className="unterzeile" style={{ marginTop: 10 }}>Die Datei wird nur in diesem Browser gelesen und gespeichert. Nichts wird hochgeladen. Eigentums- und Betriebsdaten bleiben bei Ihnen.</p>
          </div>
          <div className="feld">
            <h3>Ansicht</h3>
            <div className="chips"><button className={`chip ${modus === 'privat' ? 'an' : ''}`} onClick={() => setModus('privat')}>Waldgrafen Privat</button><button className={`chip ${modus === 'pro' ? 'an' : ''}`} onClick={() => setModus('pro')}>Waldgrafen Pro</button></div>
            <p className="unterzeile" style={{ marginTop: 10 }}>Eine Rechen-Engine, zwei Oberflächen. Privat zeigt Ergebnis und Empfehlung zuerst. Pro zeigt zusätzlich alle Klimapfade, Annahmen, Rechenläufe und die Kapitalpriorisierung.</p>
          </div>
          <div className="feld">
            <h3>Fortschreibung</h3>
            <p className="unterzeile">Messungen, Beschlüsse und Maßnahmen dieses Waldes. Der erfasste Zwilling selbst bleibt unverändert.</p>
            {!loeschen
              ? <button className="knopf2" onClick={() => setLoeschen(true)}>Fortschreibung zurücksetzen</button>
              : <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <button className="knopf2" style={{ borderColor: 'var(--schlecht)', color: 'var(--schlecht)' }} onClick={() => { fortschreibungZuruecksetzen(); setLoeschen(false); toast('Fortschreibung zurückgesetzt.'); }}>Ja, alles löschen</button>
                  <button className="knopf2" onClick={() => setLoeschen(false)}>Abbrechen</button>
                </div>}
          </div>
        </div>

        <div>
          <div className="feld">
            <h3>Wirtschaftliche Annahmen · {annahmen.version}</h3>
            {modus === 'pro' ? (
              <>
                <Regler label="Holzpreisniveau" wert={Math.round(annahmen.preisFaktor * 100)} anzeige={`${Math.round(annahmen.preisFaktor * 100)} %`} min={60} max={140} onChange={(v) => setAnnahmen({ ...annahmen, preisFaktor: v / 100 })} />
                <Regler label="Kostenniveau Ernte und Rückung" wert={Math.round(annahmen.kostenFaktor * 100)} anzeige={`${Math.round(annahmen.kostenFaktor * 100)} %`} min={70} max={150} onChange={(v) => setAnnahmen({ ...annahmen, kostenFaktor: v / 100 })} />
                <div className="tab-wrap" style={{ marginTop: 14 }}><table className="tab">
                  <thead><tr><th>Baumart</th><th className="z">Stammholz €/Efm</th><th className="z">Industrie</th></tr></thead>
                  <tbody>{Object.entries(annahmen.preise).filter(([k]) => k !== 'sonstiges').map(([k, p]) => <tr key={k}><td style={{ textTransform: 'capitalize' }}>{k}</td><td className="z">{Object.entries(p.stamm).map(([kl, v]) => `${kl}: ${v}`).join(' · ')}</td><td className="z">{p.industrie}</td></tr>)}</tbody>
                </table></div>
              </>
            ) : <p className="unterzeile">Im Pro-Modus anpassbar: Preis- und Kostenniveau, vollständige Preistabelle.</p>}
            <ul className="liste ruhig" style={{ marginTop: 12 }}>{QUELLEN_ANNAHMEN.map((q) => <li key={q} style={{ fontSize: 13.5 }}>{q}</li>)}</ul>
          </div>

          <div className="feld">
            <h3>Förder-Regelpaket</h3>
            <h2 style={{ fontSize: 20 }}>{WALDFOEPR_2025.programm}</h2>
            <p className="unterzeile">Version {WALDFOEPR_2025.version} · gültig {datumKurz(WALDFOEPR_2025.gueltigAb)} bis {datumKurz(WALDFOEPR_2025.gueltigBis)}</p>
            <div className="tab-wrap" style={{ marginTop: 12 }}><table className="tab">
              <thead><tr><th>Tatbestand</th><th className="z">Satz</th><th>Stand</th></tr></thead>
              <tbody>{WALDFOEPR_2025.tatbestaende.map((t) => (
                <tr key={t.id}>
                  <td>{t.titel}{t.bagatellgrenze ? <span className="unterzeile"><br />Bagatellgrenze {zahl(t.bagatellgrenze)} €{t.bindefristJahre ? ` · Bindefrist ${t.bindefristJahre} J.` : ''}</span> : null}</td>
                  <td className="z">{t.satz != null ? `${zahl(t.satz, t.satz < 10 ? 2 : 0)} €/${t.einheit === 'stueck' ? 'Stk' : t.einheit}` : t.stufen ? t.stufen.map((s) => `${zahl(s.satz)} €/ha`).join(' · ') : 'nicht hinterlegt'}</td>
                  <td><a href={t.quelle.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline', fontSize: 13 }}>{t.geprueft ? 'amtlich' : 'vor Antrag prüfen'}</a></td>
                </tr>
              ))}</tbody>
            </table></div>
            <ul className="liste" style={{ marginTop: 12 }}>{WALDFOEPR_2025.allgemein.map((x) => <li key={x} style={{ fontSize: 13.5 }}>{x}</li>)}</ul>
          </div>

          {wald.klima && (
            <div className="feld">
              <h3>Klima am Standort</h3>
              <p>{wald.klima.niederschlagMm ? `${zahl(wald.klima.niederschlagMm)} mm Niederschlag` : ''}{wald.klima.temperaturC ? ` · ${zahl(wald.klima.temperaturC, 1)} °C im Mittel` : ''}{wald.klima.verschiebungC ? ` · bereits + ${zahl(wald.klima.verschiebungC, 1)} °C gegenüber 1991–2020` : ''}</p>
              {wald.klima.text && <p className="unterzeile">{wald.klima.text}</p>}
            </div>
          )}
        </div>
      </div>
    </Werkzeug>
  );
}
