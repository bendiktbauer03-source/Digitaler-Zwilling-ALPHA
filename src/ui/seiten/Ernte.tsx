import { useRef, useState } from 'react';
import { QUELLEN_ANNAHMEN } from '../../engine/annahmen';
import { ernteRechnen, standardEntnahme, standardEntnahmeBhd, VERFAHREN_TEXT, zeitpunkteVergleichen, type Verfahren } from '../../engine/ernte';
import { euro, euroSpanne, ha, pct, zahl } from '../../engine/format';
import { genauigkeit, statusLabel, statusVon } from '../../engine/messwert';
import { Icon, Regler, Status, Werkzeug } from '../bausteine';
import { useZustand } from '../zustand';

export function Ernte({ param }: { param?: string }) {
  const { wald, annahmen, modus, massnahmeAnlegen, toast } = useZustand();
  const kandidaten = wald.bestaende.filter((b) => !b.kahlflaeche && !b.jungbestand && b.vorrat.wert > 100);
  const [id, setId] = useState(param && kandidaten.some((b) => b.id === param) ? param : kandidaten[0]?.id);
  const b = kandidaten.find((x) => x.id === id);
  const [eingriff, setEingriff] = useState<Record<string, { vfm: number; bhd: number; ruecke: number; verfahren: Verfahren | 'auto' }>>({});
  const [preis, setPreis] = useState(0);
  const [kosten, setKosten] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);

  const e = b ? eingriff[b.id] ?? { vfm: standardEntnahme(b), bhd: standardEntnahmeBhd(b), ruecke: 250, verfahren: 'auto' as const } : undefined;
  const setE = (p: Partial<NonNullable<typeof e>>) => b && e && setEingriff({ ...eingriff, [b.id]: { ...e, ...p } });
  const a = { ...annahmen, preisFaktor: annahmen.preisFaktor * (1 + preis / 100), kostenFaktor: annahmen.kostenFaktor * (1 + kosten / 100) };

  // Die Rechnung ist billig – bei jeder Änderung vollständig neu, damit nichts veraltet.
  const r = b && e ? ernteRechnen({ bestand: b, entnahmeVfmHa: e.vfm, entnahmeBhdCm: e.bhd, rueckeM: e.ruecke, verfahren: e.verfahren, annahmen: a }) : null;
  const zp = b && e ? zeitpunkteVergleichen({ bestand: b, entnahmeVfmHa: e.vfm, entnahmeBhdCm: e.bhd, rueckeM: e.ruecke, verfahren: e.verfahren, annahmen: a }, wald.profil.kalkulationszins, [0, 5, 10]) : [];

  if (!b || !e || !r) {
    return <Werkzeug seite="ernte" titel={<>Lohnt sich die <em>Holzernte?</em></>}><div className="leer">In diesem Wald gibt es noch keinen erntefähigen Bestand.</div></Werkzeug>;
  }
  const status = statusVon(b.vorrat);
  const maxKw = Math.max(...zp.map((z) => z.kapitalwert), 1);
  const route = b.waldweg?.eingriffe.find((x) => x.vfmProHa > 0);
  const anfrage = [
    `Anfrage Holzernte – ${wald.betrieb.langname}`,
    '',
    `Bestand: ${b.label} (${b.kennung}), ${ha(b.ha)}`,
    `Lage: ${b.mitte.lat.toFixed(5)}, ${b.mitte.lon.toFixed(5)} · Hang ${zahl(b.hangGrad ?? 0)}° ${b.exposition ?? ''}`,
    `Baumarten: ${b.arten.map((x) => `${x.art} ${x.pct} %`).join(', ')}`,
    `Geplante Entnahme: ${zahl(e.vfm)} Vfm/ha, gesamt ≈ ${zahl(r.efm)} Efm, mittlerer BHD der Entnahme ≈ ${zahl(e.bhd)} cm`,
    `Verfahren (Vorschlag): ${VERFAHREN_TEXT[r.verfahren]}, Rückeentfernung ≈ ${zahl(e.ruecke)} m`,
    `Zeitraum: kommender Winter`,
    '',
    `Datenlage Vorrat: ${statusLabel(b.vorrat)} (${b.vorrat.quelle})`,
    '',
    'Bitte um ein Angebot für Ernte und Rückung (€/Efm) sowie eine Einschätzung der Sortimente.',
  ].join('\n');

  return (
    <Werkzeug seite="ernte" bild="bilder/waldweg.webp" titel={<>Lohnt sich die <em>Holzernte?</em></>} lead="Bestand wählen, Eingriff festlegen, Erlöse und Kosten vergleichen. Alle Zahlen aus Ihrem Zwilling, alle Annahmen offen.">
      <div className="chips" role="group" aria-label="Bestand">
        {kandidaten.map((x) => <button key={x.id} className={`chip ${x.id === b.id ? 'an' : ''}`} onClick={() => setId(x.id)} aria-pressed={x.id === b.id}>{x.label} <span className="mono" style={{ fontSize: 12 }}>{ha(x.ha)}</span></button>)}
      </div>

      <div className="zwei" style={{ marginTop: 20 }}>
        <div>
          <div className="feld">
            <div className="kopfzeile"><h2>{b.label}</h2><Status s={status} text={statusLabel(b.vorrat)} erklaerung={b.vorrat.quelle} /></div>
            <p className="unterzeile">{b.fuehrendText} · {zahl(b.vorrat.wert)} Vfm/ha{b.vorrat.spanne ? ` (${zahl(b.vorrat.spanne[0])}–${zahl(b.vorrat.spanne[1])})` : ''} · BHD {zahl(b.bhdCm ?? 0)} cm · {b.hiebsreife ?? b.alter?.text ?? ''}</p>
            {route && <div className="hinweis" style={{ marginTop: 12 }}>Für diesen Bestand liegt eine gerechnete Route vor ({b.waldweg!.modell}): {route.jahr} · {route.art}, {zahl(route.vfmProHa)} Vfm/ha, Deckungsbeitrag {euro(route.deckungsbeitragGesamt)}. Dieser Rechner dient dem Durchspielen von Varianten.</div>}
            <Regler label="Entnahme" wert={e.vfm} anzeige={`${zahl(e.vfm)} Vfm/ha · ${pct((e.vfm / Math.max(1, b.vorrat.wert)) * 100)} des Vorrats`} min={10} max={Math.max(120, Math.round(b.vorrat.wert * 0.4))} onChange={(v) => setE({ vfm: v })} />
            <Regler label="Mittlerer BHD der entnommenen Bäume" wert={e.bhd} anzeige={`${zahl(e.bhd)} cm`} min={12} max={80} onChange={(v) => setE({ bhd: v })} />
            <Regler label="Rückeentfernung" wert={e.ruecke} anzeige={`${zahl(e.ruecke)} m`} min={50} max={1000} schritt={50} onChange={(v) => setE({ ruecke: v })} />
            <div className="regler"><label htmlFor="verfahren"><span>Verfahren</span></label>
              <select id="verfahren" value={e.verfahren} onChange={(x) => setE({ verfahren: x.target.value as Verfahren | 'auto' })}>
                <option value="auto">Automatisch nach Gelände und Baumart</option>
                {Object.entries(VERFAHREN_TEXT).map(([k, t]) => <option key={k} value={k}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="feld">
            <h3>Was, wenn …</h3>
            <Regler label="Holzpreise" wert={preis} anzeige={`${preis > 0 ? '+' : ''}${preis} %`} min={-30} max={30} onChange={setPreis} />
            <Regler label="Lohn- und Maschinenkosten" wert={kosten} anzeige={`${kosten > 0 ? '+' : ''}${kosten} %`} min={-20} max={40} onChange={setKosten} />
          </div>
        </div>

        <div>
          <div className="feld">
            <h3>Deckungsbeitrag dieses Eingriffs</h3>
            <div className={`gross ${r.db < 0 ? 'schlecht' : ''}`}>{euro(r.db)}</div>
            <p className="unterzeile">Spanne {euroSpanne(...r.dbSpanne)} bei ± 12 % Preis und ± 10 % Kosten · {euro(r.dbProHa)} je ha · {zahl(r.dbJeEfm, 1)} € je Efm</p>
            <div className="drei" style={{ marginTop: 18 }}>
              <div><span className="unterzeile">Holzerlös</span><div className="serif" style={{ fontSize: 26 }}>{euro(r.erloes)}</div></div>
              <div><span className="unterzeile">Ernte und Rückung</span><div className="serif" style={{ fontSize: 26 }}>{euro(r.kosten)}</div><span className="unterzeile">{zahl(r.kostenJeEfm, 1)} €/Efm</span></div>
              <div><span className="unterzeile">Holzmenge</span><div className="serif" style={{ fontSize: 26 }}>{zahl(r.efm)} Efm</div><span className="unterzeile">{zahl(r.stueckmasseEfm, 2)} Efm je Baum</span></div>
            </div>
            {status !== 'bestaetigt' && <div className={`hinweis ${status === 'pruefen' ? 'warn' : ''}`} style={{ marginTop: 16 }}>Der Vorrat ist {statusLabel(b.vorrat).toLowerCase()}. Für einen Verkauf vorher messen: <a href={`#/messen/${b.id}`} style={{ textDecoration: 'underline' }}>Winkelzählprobe starten</a> – aus ± {Math.round(genauigkeit(b.vorrat) ?? 30)} % werden etwa ± 9 %.</div>}
            {r.hinweise.map((h) => <div key={h} className="hinweis" style={{ marginTop: 10 }}>{h}</div>)}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
              <button className="knopf" onClick={() => dialog.current?.showModal()} disabled={status === 'pruefen'} title={status === 'pruefen' ? 'Erst messen, dann anfragen' : undefined}>Angebot anfordern <Icon n="arrow" /></button>
              <button className="knopf2" style={{ marginTop: 18 }} onClick={() => { massnahmeAnlegen({ art: 'ernte', bestandId: b.id, titel: `Holzernte ${zahl(e.vfm)} Vfm/ha · ${b.label}`, kostenRahmen: -r.db, vfmProHa: e.vfm }); toast('Als Maßnahme in der Chronik vorgemerkt.'); }}>Vormerken</button>
            </div>
          </div>

          <div className="feld">
            <h3>Jetzt oder später?</h3>
            <div className="balken">
              {zp.map((z) => (
                <div className="z" key={z.inJahren}>
                  <span>{z.inJahren === 0 ? 'Jetzt' : `In ${z.inJahren} Jahren`}</span>
                  <span className="spur"><i className={z.kapitalwert === maxKw ? 'amber' : ''} style={{ width: `${Math.max(2, (z.kapitalwert / maxKw) * 100)}%` }} /></span>
                  <b>{euro(z.kapitalwert)}</b>
                </div>
              ))}
            </div>
            <p className="unterzeile" style={{ marginTop: 12 }}>Heute bewertet mit {pct(wald.profil.kalkulationszins * 100, 1)} Kalkulationszins. Warten heißt: dickere Bäume, bessere Sortimente – aber {pct(zp[2]?.schadenWahrscheinlichkeit * 100)} Schadrisiko in zehn Jahren, bei dem {pct(annahmen.schadholzAbschlag * 100)} des Holzwerts verloren gehen.</p>
          </div>

          <div className="feld">
            <h3>Sortimente</h3>
            <div className="tab-wrap"><table className="tab">
              <thead><tr><th>Baumart</th><th>Sorte</th><th className="z">Efm</th><th className="z">€/Efm</th><th className="z">Erlös</th></tr></thead>
              <tbody>{r.sortimente.map((s) => <tr key={s.art + s.sorte}><td>{s.art}</td><td>{s.sorte}</td><td className="z">{zahl(s.efm)}</td><td className="z">{zahl(s.preis)}</td><td className="z">{zahl(Math.round(s.erloes))}</td></tr>)}</tbody>
            </table></div>
            <p className="unterzeile" style={{ marginTop: 10 }}>{r.modell}. Preise frei Waldstraße, Annahmen {annahmen.version}.</p>
            {modus === 'pro' && <ul className="liste ruhig" style={{ marginTop: 10 }}>{QUELLEN_ANNAHMEN.slice(0, 2).map((q) => <li key={q} style={{ fontSize: 13 }}>{q}</li>)}</ul>}
          </div>
        </div>
      </div>

      <dialog ref={dialog} aria-label="Angebotsanfrage">
        <span className="klein" style={{ color: 'var(--amber)' }}>Unternehmeranfrage</span>
        <h2 className="serif" style={{ fontSize: 28, marginTop: 6 }}>Angebot für {b.label}</h2>
        <p className="unterzeile">Diese Anfrage enthält alles, was ein Unternehmer für ein belastbares Angebot braucht. Die Waldgrafen leiten sie an passende Betriebe weiter.</p>
        <pre>{anfrage}</pre>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <button className="knopf" onClick={async () => { try { await navigator.clipboard.writeText(anfrage); toast('Anfrage kopiert.'); } catch { toast('Kopieren nicht möglich – bitte markieren und kopieren.'); } massnahmeAnlegen({ art: 'ernte', bestandId: b.id, titel: `Angebot angefragt · ${b.label}`, vfmProHa: e.vfm, kostenRahmen: -r.db }); dialog.current?.close(); }}><Icon n="copy" />Kopieren</button>
          <button className="knopf2" style={{ marginTop: 18 }} onClick={() => dialog.current?.close()}>Schließen</button>
        </div>
      </dialog>
    </Werkzeug>
  );
}
