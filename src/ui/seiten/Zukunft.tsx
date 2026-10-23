import { useState } from 'react';
import { euro, euroSpanne, ha, pct, zahl } from '../../engine/format';
import { FOERDERSTATUS_TEXT } from '../../engine/foerderung/pruefen';
import { kulturRechnen, standardMischung, STRATEGIE_TEXT, type KulturEingabe, type Mischungsanteil, type Schutz, type Strategie } from '../../engine/kultur';
import { ART_TEXT, artgruppeAusText, type Artgruppe, type Belastung, type Bestand } from '../../engine/modell';
import { Icon, Regler, Werkzeug } from '../bausteine';
import { useZustand } from '../zustand';

const ARTEN: Artgruppe[] = ['tanne', 'buche', 'eiche', 'edellaub', 'douglasie', 'kiefer', 'laerche', 'fichte'];
const STANDARD_STK: Record<Artgruppe, number> = { tanne: 3000, buche: 5000, eiche: 6000, edellaub: 2500, douglasie: 2000, kiefer: 5000, laerche: 2500, fichte: 2500, sonstiges: 2500 };

export function Zukunft({ param }: { param?: string }) {
  const { wald, modus } = useZustand();
  const start = param ?? wald.bestaende.find((b) => b.kahlflaeche)?.id ?? wald.bestaende.find((b) => b.waldweg)?.id ?? wald.bestaende[0]?.id;
  const [id, setId] = useState(start);
  const [eigene, setEigene] = useState(false);
  const b = wald.bestaende.find((x) => x.id === id) ?? wald.bestaende[0];
  if (!b) return null;
  return (
    <Werkzeug seite="zukunft" bild="bilder/stamm.webp" titel={<>Wie sieht Ihr Wald <em>in 30 Jahren</em> aus?</>} lead="Mögliche Zukünfte des eigenen Waldes vergleichen – mit Kosten, Förderung, Ausfallrisiken und dem nächsten konkreten Schritt.">
      <div className="chips" role="group" aria-label="Bestand">
        {wald.bestaende.map((x) => <button key={x.id} className={`chip ${x.id === b.id ? 'an' : ''}`} onClick={() => { setId(x.id); setEigene(false); }} aria-pressed={x.id === b.id}>{x.label}{x.kahlflaeche ? ' · Freifläche' : x.waldweg ? ' · simuliert' : ''}</button>)}
      </div>
      {b.waldweg && <Waldweg b={b} pro={modus === 'pro'} />}
      {b.waldweg && !eigene
        ? <button className="knopf2" style={{ maxWidth: 420, marginTop: 28 }} onClick={() => setEigene(true)}>Eigene Pflanz- oder Voranbauvariante durchrechnen</button>
        : <Kulturrechner key={b.id} b={b} />}
    </Werkzeug>
  );
}

function Waldweg({ b, pro }: { b: Bestand; pro: boolean }) {
  const w = b.waldweg!;
  const reihe = w.bildreihe;
  const [i, setI] = useState(0);
  const stufe = reihe[i];
  const sieger = w.varianten.find((v) => v.id === w.siegerId) ?? w.varianten[0];
  const pfade = Object.keys(sieger.kapitalwertHa);
  return (
    <section className="abschnitt" style={{ marginTop: 24 }}>
      <span className="klein">Simulierter Weg · {w.modell}</span>
      <h2>{b.label}: <em>{w.jahre} Jahre</em> im Zeitraffer.</h2>
      <div className="zwei">
        <div>
          {reihe.length > 0 && (
            <>
              <div className="zeitreise">
                {reihe.map((s, k) => s.bild && <img key={k} src={s.bild} alt={`${s.titel} (${s.jahr})`} style={{ opacity: k === i ? 1 : 0 }} />)}
                {!stufe?.bild && <div className="leer" style={{ color: 'var(--warm)', paddingTop: 80 }}>Keine Visualisierung für diese Stufe.</div>}
                <span className="marke-v">VISUALISIERUNG DES SIMULATIONSSTANDS · KEIN FOTO</span>
                <div className="text"><span className="mono" style={{ fontSize: 12 }}>{stufe?.jahr}</span><br /><b>{stufe?.titel}</b><p style={{ fontSize: 14, opacity: .85, marginTop: 4 }}>{stufe?.text}</p></div>
              </div>
              <Regler label="Zeitraffer" wert={i} anzeige={String(stufe?.jahr ?? '')} min={0} max={reihe.length - 1} onChange={setI} />
            </>
          )}
          {w.zielwald && (
            <div className="feld" style={{ marginTop: 10 }}>
              <h3>Zielwald {w.zielwald.jahr}</h3>
              <div className="balken">{w.zielwald.anteile.map((x) => <div className="z" key={x.art}><span>{x.art}</span><span className="spur"><i style={{ width: `${x.pct}%` }} /></span><b>{pct(x.pct)}</b></div>)}</div>
              <p className="unterzeile" style={{ marginTop: 10 }}>Vorrat {zahl(w.zielwald.vorrat)} Vfm/ha{w.zielwald.totholz != null ? ` · Totholz ${zahl(w.zielwald.totholz)} m³/ha` : ''}{w.zielwald.habitat != null ? ` · ${zahl(w.zielwald.habitat)} Habitatbäume/ha` : ''}</p>
            </div>
          )}
        </div>
        <div className="feld">
          <h3>Die gerechneten Wege</h3>
          <div className="tab-wrap"><table className="tab">
            <thead><tr><th>Weg</th><th className="z">Robust</th>{(pro ? pfade : ['RCP4.5']).filter((p) => pfade.includes(p)).map((p) => <th key={p} className="z">KW {p}</th>)}<th className="z">Ökologie</th></tr></thead>
            <tbody>{w.varianten.map((v) => (
              <tr key={v.id} style={v.id === w.siegerId ? { background: '#e7f3ec' } : undefined}>
                <td style={{ fontSize: 13 }}>{v.id === w.siegerId && <b className="gut">Empfohlen · </b>}{v.id === 'nichtstun' ? 'Nichts tun (Referenz)' : v.text}</td>
                <td className="z">{v.robust}</td>
                {(pro ? pfade : ['RCP4.5']).filter((p) => pfade.includes(p)).map((p) => <td key={p} className="z">{zahl(Math.round(v.kapitalwertHa[p] * b.ha))}</td>)}
                <td className="z">{v.oekologie['RCP4.5'] ?? Object.values(v.oekologie)[0]}</td>
              </tr>
            ))}</tbody>
          </table></div>
          <p className="unterzeile" style={{ marginTop: 10 }}>{w.gewichtung}</p>
          {w.eingriffe.length > 0 && <>
            <h3 style={{ marginTop: 18 }}>Fahrplan des empfohlenen Wegs</h3>
            <ul className="liste">{w.eingriffe.slice(0, pro ? 20 : 4).map((x) => <li key={x.jahr + x.art}><b className="mono">{x.jahr}</b> · {x.art}{x.vfmProHa > 0 ? ` · ${zahl(x.vfmProHa)} Vfm/ha` : ''}{x.deckungsbeitragGesamt ? ` · DB ${euro(x.deckungsbeitragGesamt)}` : ''}</li>)}</ul>
          </>}
        </div>
      </div>
    </section>
  );
}

function Kulturrechner({ b }: { b: Bestand }) {
  const { wald, annahmen, massnahmeAnlegen, toast } = useZustand();
  const geeignet = b.eignung.filter((e) => e.heute === 'gut' && e.entwicklung !== 'schlechter').map((e) => e.art);
  const [flaecheHa, setFlaeche] = useState(b.kahlflaeche ? b.ha : Math.round(b.ha * 0.3 * 100) / 100);
  const [verbiss, setVerbiss] = useState<Belastung>(wald.profil.verbiss);
  const [schutz, setSchutz] = useState<Schutz>(wald.profil.verbiss === 'hoch' ? 'zaun' : 'einzelschutz');
  const [mischung, setMischung] = useState<Mischungsanteil[]>(() => standardMischung(geeignet));
  const [nvAnteil, setNv] = useState(50);
  const [jahr, setJahr] = useState(30);
  const [gewaehlt, setGewaehlt] = useState<Strategie>((b.verjuengungMoeglich?.length ?? 0) > 0 ? 'kombination' : 'pflanzung');

  const e: KulturEingabe = {
    ha: flaecheHa, bundesland: wald.betrieb.bundesland, verbiss, schutz, mischung,
    nvMoeglich: (b.verjuengungMoeglich?.length ?? 0) > 0, nvAnteil: nvAnteil / 100,
    voranbau: !b.kahlflaeche, zins: wald.profil.kalkulationszins, annahmen,
  };
  const ergebnisse = (['naturverjuengung', 'pflanzung', 'kombination'] as Strategie[]).map((s) => kulturRechnen(s, e));
  const r = ergebnisse.find((x) => x.strategie === gewaehlt)!;
  const toggleArt = (art: Artgruppe) => setMischung(mischung.some((m) => m.art === art) ? mischung.filter((m) => m.art !== art) : [...mischung, { art, anteil: 20, stkProHa: STANDARD_STK[art] }]);

  return (
    <section className="abschnitt">
      <span className="klein">{b.kahlflaeche ? 'Wiederbewaldung' : 'Voranbau und Waldumbau'} · {b.label}</span>
      <h2>Drei Wege, <em>ehrlich verglichen.</em></h2>
      <div className="strategien">
        {ergebnisse.map((x) => (
          <button key={x.strategie} className={`strategie ${x.strategie === gewaehlt ? 'an' : ''} ${x.gesperrt ? 'gesperrt' : ''}`} onClick={() => setGewaehlt(x.strategie)} aria-pressed={x.strategie === gewaehlt}>
            <span className="m">{STRATEGIE_TEXT[x.strategie].kurz.split(' · ')[0]}</span>
            <h4>{x.titel}</h4>
            <span className="k">{x.kurz}</span>
            <span className="unterzeile" style={{ marginTop: 14 }}>Ihr Eigenanteil (5 Jahre)</span>
            <span className="wert">{x.gesperrt ? '—' : euro(x.eigenanteil[1])}</span>
            <span className="unterzeile">{x.gesperrt ?? `Spanne ${euroSpanne(x.eigenanteil[0], x.eigenanteil[2])}`}</span>
          </button>
        ))}
      </div>

      <div className="zwei" style={{ marginTop: 18 }}>
        <div>
          <div className="feld">
            <h3>Ihre Fläche</h3>
            <Regler label={b.kahlflaeche ? 'Fläche' : 'Voranbaufläche'} wert={flaecheHa} anzeige={ha(flaecheHa)} min={0.05} max={b.ha} schritt={0.05} onChange={setFlaeche} />
            <div className="regler"><label><span>Verbissdruck</span></label>
              <div className="chips">{(['gering', 'mittel', 'hoch'] as Belastung[]).map((v) => <button key={v} className={`chip ${verbiss === v ? 'an' : ''}`} onClick={() => setVerbiss(v)}>{v}</button>)}</div></div>
            <div className="regler"><label><span>Schutz</span></label>
              <div className="chips">{([['zaun', 'Zaun'], ['einzelschutz', 'Einzelschutz'], ['keiner', 'Jagd statt Schutz']] as [Schutz, string][]).map(([v, t]) => <button key={v} className={`chip ${schutz === v ? 'an' : ''}`} onClick={() => setSchutz(v)}>{t}</button>)}</div></div>
            {gewaehlt === 'kombination' && <Regler label="Anteil Naturverjüngung" wert={nvAnteil} anzeige={`${nvAnteil} %`} min={10} max={90} schritt={5} onChange={setNv} />}
          </div>
          <div className="feld">
            <h3>Baumartenmischung</h3>
            <div className="chips" style={{ flexWrap: 'wrap' }}>{ARTEN.map((a) => <button key={a} className={`chip ${mischung.some((m) => m.art === a) ? 'an' : ''}`} onClick={() => toggleArt(a)}>{ART_TEXT[a]}</button>)}</div>
            {mischung.map((m) => (
              <Regler key={m.art} label={`${ART_TEXT[m.art]} · ${zahl(m.stkProHa)} Stk/ha`} wert={m.anteil} anzeige={`${m.anteil} Teile`} min={5} max={80} schritt={5} onChange={(v) => setMischung(mischung.map((x) => (x.art === m.art ? { ...x, anteil: v } : x)))} />
            ))}
            {geeignet.length > 0 && <p className="unterzeile" style={{ marginTop: 10 }}>Laut Eignungsansprache gut geeignet: {geeignet.join(', ')}.</p>}
          </div>
        </div>

        <div>
          <div className="feld">
            <div className="kopfzeile"><h2>{r.titel}</h2></div>
            {r.gesperrt && <div className="hinweis warn">{r.gesperrt}</div>}
            <div className="drei" style={{ marginTop: 6 }}>
              <div><span className="unterzeile">Investition Jahr 1</span><div className="serif" style={{ fontSize: 26 }}>{euro(r.investition)}</div></div>
              <div><span className="unterzeile">Förderung</span><div className="serif gut" style={{ fontSize: 26 }}>{r.foerderung.betrag > 0 ? euro(r.foerderung.betrag) : '—'}</div><span className="unterzeile">{FOERDERSTATUS_TEXT[r.foerderung.status]}</span></div>
              <div><span className="unterzeile">Pflanzen</span><div className="serif" style={{ fontSize: 26 }}>{r.pflanzen ? zahl(r.pflanzen) : '—'}</div><span className="unterzeile">{r.pflanzen ? 'Stück' : 'aus Naturverjüngung'}</span></div>
            </div>
            <h3 style={{ marginTop: 18 }}>Ausfall – drei Szenarien statt einer Scheinzahl</h3>
            <div className="balken breit">
              {(['gering', 'mittel', 'hoch'] as const).map((s, k) => (
                <div className="z" key={s}><span>{s}</span><span className="spur"><i className={k === 2 ? 'amber' : ''} style={{ width: `${r.ausfall[k] * 100}%` }} /></span><b>{pct(r.ausfall[k] * 100)} · {euro(r.eigenanteil[k], false)}</b></div>
              ))}
            </div>
            <p className="unterzeile" style={{ marginTop: 8 }}>Rechts: Ihr Eigenanteil über fünf Jahre inkl. Nachbesserung, Schutz und Pflege, nach Förderung.</p>
            <div className="zwei halb" style={{ marginTop: 14, gap: 18 }}>
              <div><h3>Dafür spricht</h3><ul className="liste ruhig">{r.vorteile.map((x) => <li key={x}>{x}</li>)}</ul></div>
              <div><h3>Darauf achten</h3><ul className="liste">{r.risiken.map((x) => <li key={x}>{x}</li>)}</ul></div>
            </div>
            <button className="knopf" disabled={!!r.gesperrt} onClick={() => { massnahmeAnlegen({ art: 'kultur', bestandId: b.id, titel: `${r.titel} · ${b.label}`, kostenRahmen: Math.round(r.kosten[1]), foerderung: r.foerderung.betrag, erstNachBewilligung: r.foerderung.posten.length > 0 }); toast('Vorgemerkt. Wichtig: Förderantrag vor Beginn stellen.'); }}>Förderantrag vorbereiten <Icon n="arrow" /></button>
          </div>

          <div className="feld">
            <h3>Förderung im Detail</h3>
            {r.foerderung.posten.length > 0 && <div className="tab-wrap"><table className="tab"><tbody>{r.foerderung.posten.map((p) => <tr key={p.titel}><td>{p.titel}</td><td className="z">{zahl(p.menge, p.einheit === 'ha' ? 2 : 0)} {p.einheit}</td><td className="z">{p.satz == null ? 'nicht hinterlegt' : `${zahl(p.satz, 2)} €`}</td><td className="z">{p.satz == null ? '—' : zahl(p.betrag)}</td></tr>)}</tbody></table></div>}
            <ul className="liste" style={{ marginTop: 10 }}>{r.foerderung.hinweise.map((h) => <li key={h} style={{ fontSize: 13.5 }}>{h}</li>)}</ul>
            <p className="unterzeile" style={{ marginTop: 10 }}>{r.foerderung.regelpaket}. Quellen: {r.foerderung.quellen.map((q, k) => <span key={q.url}>{k > 0 && ' · '}<a href={q.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'underline' }}>{q.titel}</a></span>)}</p>
          </div>

          <div className="feld">
            <div className="kopfzeile"><h3 style={{ margin: 0 }}>Ihr Wald in {jahr} Jahren</h3><span className="beispiel" style={{ color: 'var(--slate)', borderColor: 'var(--linie)' }}>ABSTRAKT · KEINE SIMULATION</span></div>
            <Zukunftsbild mischung={r.strategie === 'naturverjuengung' ? (b.verjuengungMoeglich ?? []).map((t) => ({ art: artgruppeAusText(t), anteil: 1, stkProHa: 0 })) : mischung} jahr={jahr} ausfall={r.ausfall[1]} />
            <Regler label="Zeithorizont" wert={jahr} anzeige={`${new Date().getFullYear() + jahr}`} min={0} max={40} onChange={setJahr} />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Abstrakte Zukunftsansicht: Höhenwachstum nach Chapman-Richards-Näherung je Baumart, deterministisch gestreut. */
const HMAX: Record<Artgruppe, number> = { tanne: 36, buche: 34, eiche: 30, edellaub: 30, douglasie: 42, kiefer: 28, laerche: 34, fichte: 36, sonstiges: 28 };
const FARBEN: Record<Artgruppe, string> = { tanne: '#1f4d3a', buche: '#5f8f3e', eiche: '#7a8a3a', edellaub: '#8fae4c', douglasie: '#244f45', kiefer: '#3f5f3f', laerche: '#9aa94a', fichte: '#2c5a40', sonstiges: '#6b8b5b' };
const NADELIG: Artgruppe[] = ['tanne', 'douglasie', 'kiefer', 'laerche', 'fichte'];

function Zukunftsbild({ mischung, jahr, ausfall }: { mischung: Mischungsanteil[]; jahr: number; ausfall: number }) {
  const summe = mischung.reduce((s, m) => s + m.anteil, 0) || 1;
  const n = 26;
  let seed = 7;
  const zufall = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const baeume = Array.from({ length: n }, (_, i) => {
    let x = zufall() * summe, art: Artgruppe = mischung[0]?.art ?? 'buche';
    for (const m of mischung) { if ((x -= m.anteil) <= 0) { art = m.art; break; } }
    const h = HMAX[art] * Math.pow(1 - Math.exp(-0.045 * (jahr + 3)), 1.6) * (0.85 + zufall() * 0.3);
    return { x: 20 + (i / (n - 1)) * 560 + (zufall() - 0.5) * 14, art, h, weg: zufall() < ausfall * Math.min(1, jahr / 6) };
  }).filter((b) => !b.weg);
  const px = (h: number) => (h / 42) * 210;
  return (
    <svg viewBox="0 0 600 250" style={{ width: '100%', borderRadius: 12, background: 'linear-gradient(#eef2ea,#f8f6f0)', marginTop: 8 }} role="img" aria-label={`Abstrakte Darstellung des Waldes nach ${jahr} Jahren`}>
      <rect y={230} width={600} height={20} fill="#d9d2bf" />
      {[10, 20, 30, 40].map((m) => <g key={m}><line x1={0} x2={600} y1={230 - px(m)} y2={230 - px(m)} stroke="rgba(2,44,34,.08)" /><text x={596} y={226 - px(m)} textAnchor="end" fontSize={10} fill="#64748b">{m} m</text></g>)}
      {baeume.sort((a, b) => b.h - a.h).map((t, i) => {
        const hp = Math.max(4, px(t.h)), y = 230;
        return NADELIG.includes(t.art)
          ? <g key={i}><rect x={t.x - 1} y={y - hp * 0.25} width={2} height={hp * 0.25} fill="#5b4a3a" /><path d={`M${t.x} ${y - hp} L${t.x + hp * 0.16} ${y - hp * 0.2} L${t.x - hp * 0.16} ${y - hp * 0.2}Z`} fill={FARBEN[t.art]} /></g>
          : <g key={i}><rect x={t.x - 1.2} y={y - hp * 0.45} width={2.4} height={hp * 0.45} fill="#6b5a48" /><ellipse cx={t.x} cy={y - hp * 0.66} rx={hp * 0.2} ry={hp * 0.32} fill={FARBEN[t.art]} /></g>;
      })}
    </svg>
  );
}
