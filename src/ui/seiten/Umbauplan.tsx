import { datumKurz, euro, euroSpanne, ha, pct, zahl } from '../../engine/format';
import { ART_TEXT, artgruppeAusText, type Umbauplan as Plan } from '../../engine/modell';
import { Icon, Leiste } from '../bausteine';
import { beschlussVon, useZustand } from '../zustand';
import { ART_FARBE } from './Uebersicht';

const farbe = (art: string) => ART_FARBE[art] ?? ART_FARBE[artgruppeAusText(art)] ?? '#D9D7D0';
const name = (art: string) => (art === 'bergahorn' ? 'Bergahorn' : ART_TEXT[artgruppeAusText(art)] ?? art);

/** Vorrat über die Jahrzehnte: Baumarten gestapelt, Zielkorridor als Band, ungünstige Läufe gestrichelt. */
function Verlauf({ u }: { u: Plan }) {
  const B = 350, H = 230, l = 34, r = 8, o = 12, un = 26;
  const v = u.verlauf;
  const arten = u.verlauf[0] ? Object.keys(v[v.length - 1].art).sort((a, b) => (a === 'fichte' ? -1 : b === 'fichte' ? 1 : 0)) : [];
  const max = Math.max(...v.map((x) => x.vorrat), u.korridor?.[1] ?? 0, u.heute.vorrat) * 1.08;
  const x = (j: number) => l + ((j - v[0].jahr) / (v[v.length - 1].jahr - v[0].jahr || 1)) * (B - l - r);
  const y = (w: number) => o + (1 - w / max) * (H - o - un);
  const flaechen = arten.map((a, i) => {
    const unten = (p: Plan['verlauf'][number]) => arten.slice(0, i).reduce((s, k) => s + (p.art[k] ?? 0), 0);
    const oben = v.map((p) => `${x(p.jahr).toFixed(1)},${y(unten(p) + (p.art[a] ?? 0)).toFixed(1)}`);
    const zurueck = [...v].reverse().map((p) => `${x(p.jahr).toFixed(1)},${y(unten(p)).toFixed(1)}`);
    return { a, d: `M${oben.join('L')}L${zurueck.join('L')}Z` };
  });
  const ticks = [0, 200, 400, 600, 800].filter((t) => t < max);
  const jahre = v.filter((_, i) => i % Math.ceil(v.length / 5) === 0).map((p) => p.jahr);
  return (
    <figure className="plan-grafik">
      <svg viewBox={`0 0 ${B} ${H}`} role="img" aria-label={`Vorrat von ${zahl(v[0].vorrat)} auf ${zahl(v[v.length - 1].vorrat)} Vfm/ha bis ${v[v.length - 1].jahr}`}>
        {ticks.map((t) => <g key={t}><line x1={l} x2={B - r} y1={y(t)} y2={y(t)} stroke="rgba(20,26,22,.08)" /><text x={l - 6} y={y(t) + 4} textAnchor="end" fontSize="10" fill="#585E58">{t}</text></g>)}
        {u.korridor && <rect x={l} width={B - l - r} y={y(u.korridor[1])} height={y(u.korridor[0]) - y(u.korridor[1])} fill="rgba(217,119,6,.12)" />}
        {flaechen.map((f) => <path key={f.a} d={f.d} fill={farbe(f.a)} opacity=".92" />)}
        {v.some((p) => p.vorratP10 != null) && <path d={`M${v.filter((p) => p.vorratP10 != null).map((p) => `${x(p.jahr).toFixed(1)},${y(p.vorratP10!).toFixed(1)}`).join('L')}`} fill="none" stroke="#141A16" strokeWidth="1.5" strokeDasharray="4 4" />}
        {u.korridor && <text x={B - r - 4} y={y(u.korridor[1]) - 4} textAnchor="end" fontSize="10" fontWeight="600" fill="#8A4B05">Zielkorridor {u.korridor[0]}–{u.korridor[1]}</text>}
        {[...jahre, v[v.length - 1].jahr].filter((j, i, a) => a.indexOf(j) === i && (j === v[v.length - 1].jahr || v[v.length - 1].jahr - j > 8)).map((j, i, a) => <text key={j} x={x(j)} y={H - 8} textAnchor={i === 0 ? 'start' : i === a.length - 1 ? 'end' : 'middle'} fontSize="10" fill="#585E58">{j}</text>)}
      </svg>
      <figcaption className="legende">
        {arten.map((a) => <span key={a}><i style={{ background: farbe(a) }} />{name(a)}</span>)}
        <span><i style={{ background: 'transparent', borderTop: '2px dashed #141A16', height: 0, borderRadius: 0 }} />ungünstige Läufe (10 %)</span>
      </figcaption>
    </figure>
  );
}

export function Umbauplan() {
  const { wald, fortschreibung, entscheidungen } = useZustand();
  const u = wald.umbau;
  if (!u) return <main className="app"><Leiste eltern="#/planen" mitte="Umbauplan" /><div className="leer">Für diesen Wald liegt noch kein gerechneter Umbauplan vor.<br /><a className="knopf" href="#/zukunft" style={{ marginTop: 16 }}>Zukunft planen</a></div></main>;
  const k = u.kennzahlen;
  const start = u.rechnung.startjahr;
  const naechste = u.massnahmen.filter((m) => m.jahr <= start + 2);
  const jahreN = [...new Set(naechste.map((m) => m.jahr))];
  const maxCash = Math.max(...u.jahrzehnte.map((j) => Math.abs(j.cashflow)), 1);
  const maxKw = Math.max(...u.strategien.map((s) => s.kapitalwert[2]), 1);
  const ent = entscheidungen.find((e) => e.art === 'umbau');
  const beschluss = ent && beschlussVon(fortschreibung, ent.id);
  const summe = u.jahrzehnte.reduce((s, j) => s + j.cashflow, 0);

  return (
    <main className="app">
      <Leiste eltern="#/planen" mitte="Umbauplan" />
      <section style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="unterzeile">{u.bestandName} · {ha(u.ha)} · gerechnet am {datumKurz(u.erstellt)}</span>
        <h1 className="titel">{u.ziel.name}</h1>
        <p className="lead">{u.ziel.beschreibung.split('. ').slice(0, 2).join('. ')}.</p>
      </section>

      <div className="bento">
        <div className="kachel breit k-salbei">
          <span className="etikett" style={{ justifyContent: 'space-between', width: '100%' }}><span>Kapitalwert über {u.rechnung.horizont} Jahre</span><span className="unterzeile" style={{ color: 'var(--grau2)' }}>Median aus {zahl(u.rechnung.laeufe)} Läufen</span></span>
          <span className="wert">{euro(k.kapitalwert[1])}</span>
          <span className="fuss">In 8 von 10 Läufen zwischen {euroSpanne(k.kapitalwert[0], k.kapitalwert[2])} – mit Sturm, Käfer und schwankenden Preisen.</span>
        </div>
        <div className="kachel"><span className="etikett">Reinertrag</span><span><span className="wert" style={{ fontSize: 'clamp(28px,8vw,38px)' }}>{zahl(k.reinertragHaJahr)} €</span><span className="fuss" style={{ display: 'block', marginTop: 6 }}>je Hektar und Jahr</span></span></div>
        <div className="kachel k-rinde"><span className="etikett">Nadelholz</span><span><span className="wert" style={{ fontSize: 'clamp(24px,7vw,34px)', whiteSpace: 'nowrap' }}>{zahl(u.heute.nadelPct)} → {zahl(k.endNadelPct)} %</span><span className="fuss" style={{ display: 'block', marginTop: 6 }}>{k.endBaumarten} Baumarten am Ende</span></span></div>
        <div className="kachel"><span className="etikett">Größte Freifläche</span><span><span className="wert" style={{ fontSize: 'clamp(28px,8vw,38px)' }}>{zahl(k.kahlMaxHa, 1)} ha</span><span className="fuss" style={{ display: 'block', marginTop: 6 }}>{k.kahlMaxHa === 0 ? 'nie kahl' : 'zu keinem Zeitpunkt mehr'}</span></span></div>
        <div className="kachel k-stein"><span className="etikett">Förderung</span><span><span className="wert" style={{ fontSize: 'clamp(28px,8vw,38px)' }}>{euro(k.foerderung, false)}</span><span className="fuss" style={{ display: 'block', marginTop: 6 }}>für Pflanzungen eingerechnet</span></span></div>
      </div>

      <section className="feld">
        <h3>Vorrat und Baumarten · Vfm/ha</h3>
        <Verlauf u={u} />
        <p className="unterzeile" style={{ marginTop: 8 }}>Heute {zahl(u.heute.vorrat)} Vfm/ha, {pct(u.heute.nadelPct)} Nadelholz. Naturverjüngung trägt {pct(k.nvAnteilPct)} der neuen Generation.</p>
      </section>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <span className="klein">Vier Phasen</span>
        <div className="zeitleiste">
          {u.phasen.map((p, i) => (
            <div key={p.id} style={{ display: 'contents' }}>
              <span className={`wann ${p.von <= start && p.bis >= start ? 'amber' : ''}`}>{p.von}–{Math.floor(p.von / 100) === Math.floor(p.bis / 100) ? String(p.bis).slice(2) : p.bis}</span>
              <span className="spur"><i className={p.von <= start && p.bis >= start ? 'amber' : 'offen'} />{i < u.phasen.length - 1 && <span />}</span>
              <span className="was"><b>{p.name}</b><small>{p.ziel}</small></span>
            </div>
          ))}
        </div>
      </section>

      <section className="feld">
        <h3>Die nächsten Jahre</h3>
        {jahreN.map((j) => (
          <div key={j} style={{ marginTop: 6 }}>
            <b className="titel2" style={{ fontSize: 19 }}>{j}</b>
            <ul className="liste" style={{ marginTop: 4 }}>
              {naechste.filter((m) => m.jahr === j).map((m, i) => (
                <li key={i}>
                  {m.text}{m.menge ? ` · ${zahl(m.menge, m.menge < 10 ? 1 : 0)} ${m.einheit ?? ''}` : ''}
                  {(m.erloes > 0 || m.kosten > 0) && <span className="unterzeile" style={{ display: 'block' }}>{[m.erloes > 0 && `Erlös ${euro(m.erloes)}`, m.kosten > 0 && `Kosten ${euro(m.kosten)}`, m.foerderung > 0 && `Förderung ${euro(m.foerderung)}`].filter(Boolean).join(' · ')}</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="feld">
        <h3>Geld je Jahrzehnt</h3>
        <div className="balken breit">
          {u.jahrzehnte.map((j) => (
            <div key={j.von} className="z">
              <span>{j.von}er</span>
              <span className="spur"><i className={j.cashflow < 0 ? 'amber' : ''} style={{ width: `${(Math.abs(j.cashflow) / maxCash) * 100}%` }} /></span>
              <b>{euro(j.cashflow)}</b>
            </div>
          ))}
        </div>
        <p className="unterzeile" style={{ marginTop: 10 }}>Erlöse minus Kosten plus Förderung, nicht abgezinst: zusammen {euro(summe)}. In den ersten zehn Jahren {zahl(u.jahrzehnte[0]?.efm ?? 0)} Efm Holz und {zahl(u.jahrzehnte[0]?.pflanzen ?? 0)} Pflanzen.</p>
      </section>

      <section className="feld">
        <h3>Sechs Wege im Vergleich</h3>
        {[...u.strategien].sort((a, b) => Number(b.empfohlen) - Number(a.empfohlen) || b.nutzwert - a.nutzwert).map((s) => (
          <div key={s.id} className={`weg-zeile ${s.empfohlen ? 'an' : ''}`}>
            <div className="kopfzeile" style={{ marginBottom: 4 }}>
              <b>{s.empfohlen ? '★ ' : ''}{s.name}</b>
              <span className="mono" style={{ fontSize: 13 }}>{euro(s.kapitalwert[1])}</span>
            </div>
            <div className="kw-spanne" aria-hidden="true"><i style={{ left: `${(s.kapitalwert[0] / maxKw) * 100}%`, width: `${((s.kapitalwert[2] - s.kapitalwert[0]) / maxKw) * 100}%` }} /><b style={{ left: `${(s.kapitalwert[1] / maxKw) * 100}%` }} /></div>
            <small className="unterzeile">Großschaden {pct(s.grossschadenPct)} · Nadelholz am Ende {pct(s.endNadelPct)} · Nutzwert {zahl(s.nutzwert, 1)}/10</small>
            {s.verletzt.length > 0 && <small style={{ display: 'block', color: 'var(--amber-text)', fontWeight: 600, fontSize: 13 }}>Verletzt Ihre Vorgaben: {s.verletzt.join('; ')}</small>}
          </div>
        ))}
      </section>

      {u.offen.length > 0 && (
        <section className="feld">
          <h3>Was den Plan noch genauer macht</h3>
          <div className="liste-zeilen">
            {u.offen.map((o) => <div key={o.was} style={{ alignItems: 'flex-start', padding: '10px 0' }}><span><b style={{ fontWeight: 600 }}>{o.was}</b><small className="unterzeile" style={{ display: 'block' }}>{o.warum}</small></span>{o.dringlich && <span className="status pruefen" style={{ cursor: 'default' }}>dringend</span>}</div>)}
          </div>
        </section>
      )}

      <p className="lauf">Umbaumodell · {zahl(u.rechnung.laeufe)} Läufe · Klimapfad {u.rechnung.szenario} · Zins {zahl(u.rechnung.zinsPct, 1)} % · Start {start} · Horizont {u.rechnung.horizont} Jahre</p>

      {ent && (beschluss
        ? <div className="hinweis"><Icon n="check" /> Beschlossen am {datumKurz(beschluss.datum)}: {beschluss.optionName}. Die Maßnahmen für {start} stehen unter Aufgaben.</div>
        : <a className="knopf amber" href={`#/aufgabe/${ent.id}`}>Plan beschließen <Icon n="arrow" /></a>)}
    </main>
  );
}
