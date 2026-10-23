import { useState } from 'react';
import { heuteIso, pct, zahl } from '../../engine/format';
import { genauigkeit, statusLabel, statusVon } from '../../engine/messwert';
import { wzpAlsMesswert, wzpAuswerten, ZAEHLFAKTOREN, type WzpPunkt } from '../../engine/wzp';
import { gehe, Icon, Regler, Status, Werkzeug } from '../bausteine';
import { useZustand } from '../zustand';

const KERBE: Record<number, string> = { 1: '1 cm', 2: '1,4 cm', 4: '2 cm' };

function Zaehler({ label, wert, onChange }: { label: string; wert: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="lbl">{label}</div>
      <div className="zaehler">
        <button onClick={() => onChange(Math.max(0, wert - 1))} aria-label={`${label} verringern`}>−</button>
        <output aria-live="polite">{wert}</output>
        <button onClick={() => onChange(wert + 1)} aria-label={`${label} erhöhen`}>+</button>
      </div>
    </div>
  );
}

export function Messen({ param }: { param?: string }) {
  const { wald, inventurUebernehmen, toast, fortschreibung } = useZustand();
  const kandidaten = wald.bestaende.filter((b) => !b.kahlflaeche && !b.jungbestand);
  const vorschlag = kandidaten.find((b) => statusVon(b.vorrat) === 'pruefen') ?? kandidaten.find((b) => statusVon(b.vorrat) !== 'bestaetigt') ?? kandidaten[0];
  const [id, setId] = useState(param && kandidaten.some((b) => b.id === param) ? param : vorschlag?.id);
  const b = kandidaten.find((x) => x.id === id);
  const [k, setK] = useState(4);
  const [punkte, setPunkte] = useState<WzpPunkt[]>([{ gezaehlt: 0, grenzbaeume: 0, hangGrad: Math.round(b?.hangGrad ?? 0) }]);
  const [anleitung, setAnleitung] = useState(false);

  if (!b) return <Werkzeug seite="messen" titel="Genauer werden"><div className="leer">Kein Bestand zum Messen.</div></Werkzeug>;
  const gezaehlt = punkte.filter((p) => p.gezaehlt + p.grenzbaeume > 0);
  const r = gezaehlt.length ? wzpAuswerten(gezaehlt, k, b.hoeheM ?? 25, b.fuehrend) : null;
  const vorher = genauigkeit(b.vorrat);
  const setP = (i: number, p: Partial<WzpPunkt>) => setPunkte(punkte.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const wechsel = (nid: string) => { setId(nid); const nb = kandidaten.find((x) => x.id === nid); setPunkte([{ gezaehlt: 0, grenzbaeume: 0, hangGrad: Math.round(nb?.hangGrad ?? 0) }]); };
  const fruehere = fortschreibung.inventuren.filter((i) => i.bestandId === b.id);

  const uebernehmen = () => {
    if (!r) return;
    const datum = heuteIso();
    inventurUebernehmen({ bestandId: b.id, datum, k, punkte: gezaehlt, vorrat: wzpAlsMesswert(r, datum, k) });
    toast(`Übernommen. ${b.label}: ${zahl(r.vorratVfmHa)} Vfm/ha ± ${zahl(r.genauigkeitPct)} %. Alle Rechnungen laufen neu.`);
    setTimeout(() => gehe('#/entscheidungen'), 900);
  };

  return (
    <Werkzeug seite="messen" bild="bilder/nebel.webp" titel={<>Fünf Minuten im Wald, <em>zehnmal genauer.</em></>} lead="Die Winkelzählprobe ist die eine Messung, die den Vorrat festlegt. Die App führt Sie Punkt für Punkt – und schreibt das Ergebnis in Ihren Zwilling zurück.">
      <div className="chips" role="group" aria-label="Bestand">
        {kandidaten.map((x) => <button key={x.id} className={`chip ${x.id === b.id ? 'an' : ''}`} onClick={() => wechsel(x.id)} aria-pressed={x.id === b.id}><span className={`st ${statusVon(x.vorrat) === 'pruefen' ? 'blockiert' : statusVon(x.vorrat) === 'bestaetigt' ? 'fertig' : ''}`} style={{ borderColor: 'currentColor' }} />{x.label}</button>)}
      </div>

      <div className="zwei" style={{ marginTop: 20 }}>
        <div>
          <div className="feld">
            <div className="kopfzeile"><h2>{b.label}</h2><Status s={statusVon(b.vorrat)} text={statusLabel(b.vorrat)} erklaerung={b.vorrat.quelle} /></div>
            <p className="unterzeile">Heute: {zahl(b.vorrat.wert)} Vfm/ha · Höhe {zahl(b.hoeheM ?? 0)} m aus Fernerkundung · {b.fuehrendText}</p>
            <div className="regler"><label><span>Zählfaktor</span><b>Kerbe {KERBE[k]} auf 50 cm</b></label>
              <div className="chips">{ZAEHLFAKTOREN.map((z) => <button key={z} className={`chip ${k === z ? 'an' : ''}`} onClick={() => setK(z)}>k = {z}</button>)}</div>
            </div>
            <button className="mehr" onClick={() => setAnleitung(!anleitung)} aria-expanded={anleitung}><span>{anleitung ? 'Anleitung schließen' : 'So geht die Winkelzählprobe'}</span></button>
            {anleitung && (
              <ol style={{ marginLeft: 20, fontSize: 14.5, lineHeight: 1.6 }}>
                <li>Gehen Sie zu einem zufällig gewählten Punkt, mindestens 20 m vom Bestandesrand.</li>
                <li>Halten Sie das Relaskop – oder eine Karte mit einer Kerbe von {KERBE[k]} Breite – 50 cm vor das Auge.</li>
                <li>Drehen Sie sich einmal um sich selbst und visieren Sie jeden Baum in Brusthöhe (1,3 m) an.</li>
                <li>Ist der Stamm breiter als die Kerbe: zählen. Genau gleich breit: Grenzbaum (zählt halb).</li>
                <li>Mindestens drei, besser fünf Punkte gleichmäßig über den Bestand verteilen.</li>
              </ol>
            )}
          </div>

          <div className="feld">
            <h3>Probepunkte</h3>
            {punkte.map((p, i) => (
              <div className="punkt" key={i}>
                <span className="nr">P{i + 1}</span>
                <Zaehler label="Gezählt" wert={p.gezaehlt} onChange={(v) => setP(i, { gezaehlt: v })} />
                <Zaehler label="Grenzbäume" wert={p.grenzbaeume} onChange={(v) => setP(i, { grenzbaeume: v })} />
                {punkte.length > 1 ? <button className="rund" style={{ background: 'var(--grund)', color: 'var(--racing)', boxShadow: 'none' }} onClick={() => setPunkte(punkte.filter((_, j) => j !== i))} aria-label={`Punkt ${i + 1} entfernen`}><Icon n="x" /></button> : <span />}
              </div>
            ))}
            <Regler label="Hangneigung am Punkt (ohne automatische Korrektur)" wert={punkte.at(-1)!.hangGrad ?? 0} anzeige={`${punkte.at(-1)!.hangGrad ?? 0}°`} min={0} max={40} onChange={(v) => setP(punkte.length - 1, { hangGrad: v })} />
            <button className="knopf2" onClick={() => setPunkte([...punkte, { gezaehlt: 0, grenzbaeume: 0, hangGrad: punkte.at(-1)!.hangGrad }])}><Icon n="plus" />Nächster Punkt</button>
          </div>
        </div>

        <div>
          <div className="feld">
            <h3>Ergebnis</h3>
            {!r ? <p className="unterzeile">Zählen Sie am ersten Punkt – das Ergebnis erscheint sofort.</p> : (
              <>
                <div className="gross">{zahl(r.vorratVfmHa)} <span style={{ fontSize: '0.4em' }}>Vfm/ha</span></div>
                <p className="unterzeile">Grundfläche {zahl(r.gMittel, 1)} m²/ha aus {r.punkte} {r.punkte === 1 ? 'Punkt' : 'Punkten'} · Spanne {zahl(r.spanne[0])}–{zahl(r.spanne[1])} Vfm/ha</p>
                <div className="balken" style={{ marginTop: 18 }}>
                  <div className="z"><span>Bisher</span><span className="spur"><i className="amber" style={{ width: `${Math.min(100, (vorher ?? 30) * 2)}%` }} /></span><b>± {pct(vorher ?? 30)}</b></div>
                  <div className="z"><span>Mit Messung</span><span className="spur"><i style={{ width: `${Math.min(100, r.genauigkeitPct * 2)}%` }} /></span><b>± {pct(r.genauigkeitPct)}</b></div>
                </div>
                <div className={`hinweis ${r.punkte < 3 ? 'warn' : ''}`} style={{ marginTop: 14 }}>{r.hinweis}</div>
                {Math.abs(r.vorratVfmHa - b.vorrat.wert) / Math.max(1, b.vorrat.wert) > 0.2 && <div className="hinweis warn" style={{ marginTop: 10 }}>Die Messung weicht um {pct((Math.abs(r.vorratVfmHa - b.vorrat.wert) / b.vorrat.wert) * 100)} von der Schätzung ab. Genau dafür misst man.</div>}
                <button className="knopf" onClick={uebernehmen}>In den Zwilling übernehmen <Icon n="check" /></button>
                <p className="unterzeile" style={{ marginTop: 10 }}>G = k · n (Grenzbäume halb, durch cos α am Hang) · Vorrat = G · Höhe · Formzahl. Höhe und Formzahl gehen mit ± 6 % in die Spanne ein.</p>
              </>
            )}
          </div>
          {fruehere.length > 0 && (
            <div className="feld"><h3>Frühere Messungen</h3><ul className="liste ruhig">{fruehere.map((i) => <li key={i.datum + i.vorrat.wert}>{i.datum} · {i.punkte.length} Punkte · {zahl(i.vorrat.wert)} Vfm/ha ± {zahl(i.vorrat.genauigkeitPct ?? 0)} %</li>)}</ul></div>
          )}
        </div>
      </div>
    </Werkzeug>
  );
}
