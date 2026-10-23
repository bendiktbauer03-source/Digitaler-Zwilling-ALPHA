import { euroSpanne, ha, pct, zahl } from '../../engine/format';
import { statusVon } from '../../engine/messwert';
import { ART_TEXT, gesamtHa, type Wald } from '../../engine/modell';
import { AUFNAHME_TEXT, startzustand, waldaufnahme, waldjahr, wertAnzeige } from '../../engine/startseite';
import { allokation } from '../../engine/vermoegen';
import { FrageKnopf, Icon, Initialen, Ring, useOffen } from '../bausteine';
import { farbeVon, Umrisse } from '../waldkarte';
import { useZustand } from '../zustand';

export const ART_FARBE: Record<string, string> = {
  fichte: '#0D2E24', tanne: '#335C46', kiefer: '#6F8F5E', douglasie: '#4E7356', laerche: '#A9B9A1',
  buche: '#E8C76A', eiche: '#B8862F', edellaub: '#D6B9AC', bergahorn: '#C79A6B', sonstiges: '#D9D7D0',
};

/** Liegen die Waldorte weit auseinander, zeigt das Porträt den größten – sonst wären die Umrisse nur Punkte. */
export function hauptflaechen(wald: Wald) {
  if (!wald.reviere || wald.reviere.length < 2) return wald.bestaende;
  const groesse = (r: string) => wald.bestaende.filter((b) => b.revier === r).reduce((s, b) => s + b.ha, 0);
  const haupt = [...wald.reviere].sort((a, b) => groesse(b.name) - groesse(a.name))[0];
  return wald.bestaende.filter((b) => b.revier === haupt.name);
}

/** Das Waldporträt: der eigene Wald als Bild, die Fläche als einzige große Zahl. */
export function Portraet({ wald, href, hoehe = 440, unter, verdacht }: { wald: Wald; href?: string; hoehe?: number; unter?: string; verdacht?: Set<string> }) {
  const ort = [wald.betrieb.landkreis && `Landkreis ${wald.betrieb.landkreis}`, wald.betrieb.gemeinde].filter(Boolean)[0] ?? wald.betrieb.bundesland;
  const n = wald.bestaende.length;
  const inhalt = (
    <>
      <img src="bilder/hochwald.webp" alt="" />
      <span className="schleier" />
      <div className="grenzen-box"><Umrisse bestaende={hauptflaechen(wald).filter((b) => b.polygon.length > 2)} breite={350} hoehe={hoehe - 210} rand={16} verdacht={verdacht} /></div>
      <span className="oben">
        <span className="hinweis-bild">{wald.quelle === 'beispiel' ? 'BEISPIEL' : 'STIMMUNGSBILD'}</span>
      </span>
      <span className="unten">
        <span className="name">{wald.betrieb.langname}</span>
        <span className="flaeche">{ha(gesamtHa(wald)).replace(' ha', '')}<small> ha</small></span>
        <span className="zeile">
          <span>{unter ?? (wald.reviere && wald.reviere.length > 1 ? `${n} Flurstücke · ${wald.reviere.length} Waldorte · ${ort}` : `${n} ${n === 1 ? 'Fläche' : 'Flächen'} · ${ort}`)}</span>
          {href && <span className="entdecken">Entdecken <Icon n="ecke" /></span>}
        </span>
      </span>
    </>
  );
  return href
    ? <a className="portraet" href={href} style={{ minHeight: hoehe }} aria-label={`${wald.betrieb.langname} auf der Karte öffnen`}>{inhalt}</a>
    : <div className="portraet" style={{ minHeight: hoehe }}>{inhalt}</div>;
}

export function Uebersicht() {
  const { wald, annahmen, fortschreibung, entscheidungen, ziele, modus } = useZustand();
  const offen = useOffen();
  const zustand = startzustand(wald, ziele);
  const wichtig = offen[0];
  const dringend = offen.filter((e) => e.dringlichkeit === 'hoch').length;
  const wert = wertAnzeige(wald, annahmen);
  const aufnahme = waldaufnahme(wald);
  const jahr = waldjahr(wald, fortschreibung, entscheidungen);
  const verdacht = new Set(wald.ereignisse.filter((e) => !e.erholt && !e.bestaetigt && e.bestandId).map((e) => e.bestandId!));
  const stehend = wald.bestaende.filter((b) => !b.kahlflaeche).reduce((s, b) => s + b.ha, 0);
  const bestaetigtPct = stehend > 0 ? ((wert?.bestaetigtHa ?? 0) / stehend) * 100 : 0;
  const mitGrenzen = wald.bestaende.filter((b) => b.polygon.length > 2);
  const alloc = allokation(wald).filter((a) => a.pct >= 1);

  const kopf = zustand === 'neu' ? <>Entdecken Sie<br />Ihren Wald.</> : zustand === 'betrieb' ? <>Ihr Waldportfolio.</> : null;

  return (
    <main className="app">
      <header className="leiste">
        {kopf ? <h1 className="titel2">{kopf}</h1> : <a className="marke" href="#/"><span className="siegel"><img src="siegel.webp" alt="" /></span><b>Die Waldgrafen</b></a>}
        <span style={{ display: 'flex', gap: 8, alignItems: 'center' }}><FrageKnopf /><Initialen /></span>
      </header>

      <Portraet wald={wald} href="#/wald" verdacht={verdacht} hoehe={zustand === 'neu' ? 380 : 440} />

      {/* 1 · Heute wichtig – genau ein Hinweis */}
      {wichtig && (zustand !== 'neu' || wichtig.dringlichkeit === 'hoch') ? (
        <section className="wichtig ein">
          <span className="kopf"><i />{zustand === 'neu' ? 'Für Sie als Nächstes' : 'Heute wichtig'}</span>
          <h2 className="titel2">{wichtig.titel.join('')}</h2>
          <p className="satz">{wichtig.satz}</p>
          <a className="aktion" href={`#/aufgabe/${wichtig.id}`}>Was jetzt zu tun ist<span className="pfeil"><Icon n="arrow" /></span></a>
        </section>
      ) : zustand === 'neu' ? (
        <section className="wichtig ein">
          <span className="kopf"><i />Für Sie als Nächstes</span>
          <h2 className="titel2">Lernen Sie Ihre Fläche kennen.</h2>
          <p className="satz">Wir zeigen Ihnen, was wir über Ihren Wald schon wissen – und wo nur Sie weiterhelfen können.</p>
          <a className="aktion" href="#/wald">Meinen Wald entdecken<span className="pfeil"><Icon n="arrow" /></span></a>
        </section>
      ) : (
        <section className="wichtig ein">
          <span className="kopf"><i style={{ background: 'var(--gut)' }} />Heute wichtig</span>
          <h2 className="titel2">Gerade steht nichts Dringendes an.</h2>
          <p className="satz">Alle Entscheidungen sind getroffen. Was als Nächstes kommt, steht in Ihrem Waldjahr.</p>
          <a className="aktion dunkel" href="#/aufgaben">Maßnahmen ansehen<span className="pfeil"><Icon n="arrow" /></span></a>
        </section>
      )}

      {/* 2 · Höchstens drei Eckdaten */}
      {zustand === 'neu' ? (
        <section className="feld aufnahme">
          <div className="kopfzeile" style={{ alignItems: 'center' }}>
            <div><h3 style={{ marginBottom: 2 }}>Waldaufnahme</h3><b style={{ fontSize: 17 }}>{aufnahme.anteil >= 0.99 ? 'Vollständig' : 'In Arbeit'}</b></div>
            <Ring anteil={aufnahme.vorhanden / 5} groesse={72} text={`${aufnahme.vorhanden}/5`} label={`${aufnahme.vorhanden} von 5 Bereichen liegen vor`} />
          </div>
          <div className="liste-zeilen">
            {aufnahme.bereiche.map((b) => (
              <div key={b.id}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><span className={`punkt-st ${b.status === 'liegt_vor' ? 'gut' : b.status === 'geschaetzt' ? 'halb' : b.status === 'angabe' ? 'amber' : 'offen'}`} />{b.titel}</span><b className={b.status === 'offen' ? '' : ''} style={{ color: b.status === 'offen' ? 'var(--grau)' : b.status === 'angabe' ? 'var(--amber-text)' : undefined }}>{AUFNAHME_TEXT[b.status]}</b></div>
            ))}
          </div>
          <p className="unterzeile" style={{ marginTop: 10 }}>Einen Wert zeigen wir erst, wenn wir ihn begründen können.</p>
          <a className="knopf2" href="#/messen" style={{ marginTop: 12, background: 'var(--grund)' }}><Icon n="ruler" />Vorrat selbst messen – 5 Minuten je Punkt</a>
        </section>
      ) : (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <span className="klein">{zustand === 'betrieb' ? 'Steuerung' : 'Mein Wald auf einen Blick'}</span>
          <div className="bento">
            {zustand === 'betrieb' ? (
              <>
                <a className="kachel breit k-salbei" href="#/vermoegen">
                  <span className="etikett" style={{ justifyContent: 'space-between', width: '100%' }}><span>Holzwert, geschätzt</span><span className="unterzeile" style={{ color: 'var(--grau2)' }}>Spanne, nicht exakt</span></span>
                  <span className="wert">{wert ? euroSpanne(wert.lo, wert.hi) : '—'}</span>
                  <span className="fuss">{wert ? `Wächst um etwa ${zahl(Math.round(wert.zuwachsJahr / 100) * 100)} € im Jahr.` : 'Noch kein belegter Vorrat.'}</span>
                </a>
                <a className={`kachel ${dringend ? 'k-amber-hell' : ''}`} href="#/aufgaben">
                  <span className="etikett">Zur Prüfung</span>
                  <span className="wert">{offen.length}</span>
                  <span className="fuss">{dringend ? `${dringend} davon dringend` : 'nichts dringend'}</span>
                </a>
                <a className="kachel" href="#/aufgaben">
                  <span className="etikett">Jahresprogramm</span>
                  <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 8 }}>
                    <span><span className="wert">{programm(fortschreibung.massnahmen)}</span><span className="fuss" style={{ display: 'block', marginTop: 4 }}>{fortschreibung.massnahmen.length ? 'umgesetzt' : 'noch nichts geplant'}</span></span>
                    <Ring anteil={programmAnteil(fortschreibung.massnahmen)} />
                  </span>
                </a>
              </>
            ) : (
              <>
                <a className="kachel breit k-salbei" href="#/vermoegen">
                  <span className="etikett" style={{ justifyContent: 'space-between', width: '100%' }}><span>Holzwert, geschätzt</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, fontSize: 12.5, color: 'var(--grau2)' }}><span className="punkt-st halb" />Spanne, nicht exakt</span></span>
                  <span className="wert">{wert ? euroSpanne(wert.lo, wert.hi) : '—'}</span>
                  <span className="fuss">{wert ? `Wächst um etwa ${zahl(Math.round(wert.zuwachsJahr / 100) * 100)} € im Jahr. Messen macht die Spanne schmaler.` : 'Noch kein belegter Vorrat.'}</span>
                </a>
                <a className={`kachel ${dringend ? 'k-amber-hell' : ''}`} href="#/aufgaben">
                  <span className="etikett">Offene Aufgaben</span>
                  <span><span className="wert">{offen.length}</span><span className="fuss" style={{ display: 'block', marginTop: 6 }}>{dringend ? `${dringend} davon dringend` : offen.length ? 'nichts dringend' : 'alles entschieden'}</span></span>
                </a>
                <a className="kachel" href="#/messen">
                  <span className="etikett">Waldaufnahme</span>
                  <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'end', gap: 8 }}>
                    <span><span className="wert">{pct(bestaetigtPct)}</span><span className="fuss" style={{ display: 'block', marginTop: 6 }}>vor Ort bestätigt</span></span>
                    <Ring anteil={bestaetigtPct / 100} />
                  </span>
                </a>
              </>
            )}
          </div>
        </section>
      )}

      {/* Großprivatwald: Flächen nach Handlungsbedarf */}
      {zustand === 'betrieb' && (
        <section className="feld">
          <h3>Flächen nach Handlungsbedarf</h3>
          {[...wald.bestaende].sort((a, b) => rang(a.id) - rang(b.id) || b.ha - a.ha).slice(0, 6).map((b) => {
            const n = offen.filter((e) => e.bestandId === b.id).length;
            return (
              <a key={b.id} className="reihe" href={`#/bestand/${b.id}`}>
                <span className="punkt-st" style={{ width: 12, height: 12, borderRadius: 6, background: farbeVon(b, offen) }} />
                <span><b>{b.label}</b><small>{n ? `${n} zur Prüfung` : b.kahlflaeche ? 'Freifläche' : b.fuehrendText}</small></span>
                <span className="mono" style={{ fontSize: 13 }}>{ha(b.ha)}</span>
              </a>
            );
          })}
          {wald.bestaende.length > 6 && <a className="mehr" href="#/wald">Alle {wald.bestaende.length} Flächen</a>}
        </section>
      )}

      {/* 3 · Meinen Wald entdecken */}
      <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="klein">Meinen Wald entdecken</span>
        <div className="karussell">
          <a href="#/wald" className="k-dunkel">
            {mitGrenzen.length > 0 ? <div className="mini-karte"><Umrisse bestaende={hauptflaechen(wald).filter((b) => b.polygon.length > 2)} breite={168} hoehe={140} rand={14} farbig={(b) => farbeVon(b, offen, 'baumarten')} /></div> : <Icon n="map" gross />}
            <span className="bildfuss"><b>Ihre {wald.bestaende.length} {wald.bestaende.length === 1 ? 'Fläche' : 'Flächen'}</b><small>{mitGrenzen.length ? 'auf der Karte' : 'Grenzen folgen mit dem Zwilling'}</small></span>
          </a>
          <a href={`#/wald/baumarten`} className="k-salbei">
            <span className="allok" aria-hidden="true">{alloc.map((a) => <i key={a.art} style={{ flex: a.pct, background: ART_FARBE[a.art] }} />)}</span>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><b>Welche Bäume wachsen hier?</b><small>{alloc.slice(0, 3).map((a) => ART_TEXT[a.art]).join(', ') || 'noch offen'}{alloc.length > 3 ? ' …' : ''}</small></span>
          </a>
          <a href="#/wald/boden" className="k-stein">
            <svg width="64" height="56" viewBox="0 0 64 56" aria-hidden="true"><path d="M2 14 Q 18 4 32 14 T 62 14" fill="none" stroke="#141A16" strokeWidth="2.5" strokeLinecap="round" /><path d="M2 30 Q 18 20 32 30 T 62 30" fill="none" stroke="#141A16" strokeWidth="2.5" strokeLinecap="round" opacity=".6" /><path d="M2 46 Q 18 36 32 46 T 62 46" fill="none" stroke="#141A16" strokeWidth="2.5" strokeLinecap="round" opacity=".3" /></svg>
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><b>Boden und Wasser</b><small>Was Ihr Standort kann</small></span>
          </a>
          {wald.umbau ? (
            <a href="#/plan" className="k-bild">
              <img src="bilder/stamm.webp" alt="" />
              <span className="bildfuss"><b>Ihr Plan für {wald.umbau.rechnung.horizont} Jahre</b><small>{wald.umbau.bestandName.split(' · ').at(-1)}: Dauerwald</small></span>
            </a>
          ) : (
            <a href="#/zukunft" className="k-bild">
              <img src="bilder/stamm.webp" alt="" />
              <span className="bildfuss"><b>Ihr Wald in 30 Jahren</b><small>Wege im Vergleich</small></span>
            </a>
          )}
          {(wald.fotos ?? []).filter((f) => f.bild).slice(0, 3).map((f) => {
            const ziel = wald.bestaende.filter((b) => b.revier === f.revier).sort((a, b) => b.ha - a.ha)[0];
            return (
              <a key={f.ort} href={ziel ? `#/bestand/${ziel.id}` : '#/wald'} className="k-bild">
                <img src={f.bild} alt="" />
                <span className="bildfuss"><b>{f.ort}</b><small>Ihr Foto · {f.kurz.split(' — ')[0]}</small></span>
              </a>
            );
          })}
          {wert && (
            <a href="#/vermoegen" className="k-rinde">
              <Icon n="chart" gross />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}><b>Wert und CO₂</b><small>{zahl(Math.round(wert.co2t / 100) * 100)} t gebunden</small></span>
            </a>
          )}
        </div>
      </section>

      {/* 4 · Mein Waldjahr */}
      {jahr.length > 0 && (
        <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="kopfzeile" style={{ marginBottom: 0, alignItems: 'center' }}><span className="klein">Mein Waldjahr</span><a href="#/chronik" style={{ fontSize: 14, fontWeight: 600 }}>Ganze Chronik</a></div>
          <div className="zeitleiste">
            {jahr.map((j, i) => (
              <Zeile key={i} wann={j.wann} titel={j.titel} text={j.text} art={j.art} letzte={i === jahr.length - 1} />
            ))}
          </div>
        </section>
      )}

      {modus === 'pro' && (
        <p className="lauf">Zustand {zustand} · Aufnahme {pct(aufnahme.anteil * 100)} · {wald.bestaende.filter((b) => !b.kahlflaeche && statusVon(b.vorrat) === 'pruefen').length} Flächen „noch zu prüfen“ · Stand {wald.stand}</p>
      )}
    </main>
  );

  function rang(id: string) {
    const e = offen.filter((x) => x.bestandId === id);
    return e.some((x) => x.dringlichkeit === 'hoch') ? 0 : e.length ? 1 : 2;
  }
}

function Zeile({ wann, titel, text, art, letzte }: { wann: string; titel: string; text: string; art: 'erledigt' | 'geplant' | 'vorhaben'; letzte: boolean }) {
  return (
    <>
      <span className={`wann ${art === 'vorhaben' ? 'amber' : ''}`}>{wann}</span>
      <span className="spur"><i className={art === 'erledigt' ? '' : art === 'vorhaben' ? 'amber' : 'offen'} />{!letzte && <span />}</span>
      <span className="was"><b>{titel}</b>{text && <small>{text}</small>}</span>
    </>
  );
}

function programmAnteil(ms: { status: string }[]) {
  return ms.length ? ms.filter((m) => m.status === 'erledigt').length / ms.length : 0;
}
function programm(ms: { status: string }[]) {
  return pct(programmAnteil(ms) * 100);
}
