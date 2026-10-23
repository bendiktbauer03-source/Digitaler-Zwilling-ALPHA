import { useState } from 'react';
import { ART_LABEL } from '../../engine/entscheidungen';
import { datumKurz, euro, euroSpanne, ha, pct, zahl } from '../../engine/format';
import { statusLabel, statusVon } from '../../engine/messwert';
import { ART_TEXT, gesamtHa } from '../../engine/modell';
import { waldVermoegen } from '../../engine/vermoegen';
import { Icon, Kopf, Status } from '../bausteine';
import { farbeVon, Legende, Waldkarte } from '../waldkarte';
import { beschlussVon, useZustand } from '../zustand';

export function MeinWald() {
  const { wald, entscheidungen, annahmen, fortschreibung } = useZustand();
  const [auswahl, setAuswahl] = useState<string | undefined>(wald.bestaende[0]?.id);
  const v = waldVermoegen(wald, annahmen);
  const offen = entscheidungen.filter((e) => !beschlussVon(fortschreibung, e.id));
  const erste = offen[0];
  const b = wald.bestaende.find((x) => x.id === auswahl) ?? wald.bestaende[0];
  const flaeche = gesamtHa(wald);
  const status = { bestaetigt: 0, geschaetzt: 0, pruefen: 0 };
  for (const x of wald.bestaende) if (!x.kahlflaeche) status[statusVon(x.vorrat)] += x.ha;
  const [vorname] = wald.betrieb.langname.split(' ');
  const zieleFuer = (s: string) => offen.find((e) => e.art === s);

  const einstiege: [string, string][] = [
    ['Ich habe eine Kahlfläche', zieleFuer('kultur') ? `#/entscheidungen/${zieleFuer('kultur')!.id}` : '#/zukunft'],
    ['Ich möchte Holz verkaufen', '#/ernte'],
    ['Welche Förderung bekomme ich?', '#/zukunft'],
    ['Was muss ich dieses Jahr tun?', '#/entscheidungen'],
    ['Ich will meinen Vorrat genau wissen', '#/messen'],
    ['Mein Wald wurde vererbt', '#/vermoegen'],
  ];

  return (
    <>
      <section className="buehne">
        <div className="bild an" style={{ backgroundImage: 'url(bilder/hochwald.webp)' }} />
        <div className="schleier" />
        <div className="ui">
          <Kopf seite="" />
          <div className="start">
            <div className="ein" style={{ animationDelay: '.15s' }}>
              <div className="ort"><i /><span>Mein Wald · {[wald.betrieb.gemeinde, wald.betrieb.landkreis && `Landkreis ${wald.betrieb.landkreis}`].filter(Boolean).join(' · ') || wald.betrieb.bundesland}</span></div>
              <h1>{vorname} <em>{wald.betrieb.langname.slice(vorname.length).trim() || ''}</em></h1>
              <p className="unter">Ein Besitz, der Generationen überdauert. Hier sehen Sie, wie es ihm geht, was er wert ist – und was jetzt zu tun ist.</p>
              <div className="kennz">
                <div><span>Waldfläche</span><b>{ha(flaeche)}</b><small>{wald.bestaende.length} Bestände</small></div>
                <div><span>Holzwert stehend</span><b>{euro(v.holzwert)}</b><small>Spanne {euroSpanne(...v.holzwertSpanne)}</small></div>
                <div><span>CO₂ gebunden</span><b>{zahl(v.co2t)} t</b><small>+ {zahl(v.co2JahrT)} t pro Jahr</small></div>
              </div>
            </div>
            {erste ? (
              <aside className="anstehend ein" style={{ animationDelay: '.35s' }} aria-label="Wichtigste Entscheidung">
                <div className="kopfzeile" style={{ marginBottom: 0 }}><span className="klein" style={{ color: 'var(--amber)' }}>Jetzt wichtig · {ART_LABEL[erste.art]}</span><Status s={erste.status} text={erste.statusText} erklaerung={erste.statusErklaerung} /></div>
                <h3>{erste.titel[0]}<em>{erste.titel[1]}</em>{erste.titel[2]}</h3>
                <p>{erste.satz}</p>
                <a className="knopf" href={`#/entscheidungen/${erste.id}`}>Entscheidung ansehen <Icon n="arrow" /></a>
                {offen.length > 1 && (
                  <div className="weitere">{offen.slice(1, 5).map((e) => <a key={e.id} href={`#/entscheidungen/${e.id}`}>{e.kurz}</a>)}{offen.length > 5 && <a href="#/entscheidungen">+ {offen.length - 5}</a>}</div>
                )}
              </aside>
            ) : (
              <aside className="anstehend ein"><span className="klein" style={{ color: 'var(--gut)' }}>Alles entschieden</span><h3>Ihr Wald ist <em>in Ordnung.</em></h3><p>Alle anstehenden Entscheidungen sind getroffen. Ihre Maßnahmen finden Sie in der Chronik.</p><a className="knopf gruen" href="#/chronik">Zur Chronik <Icon n="arrow" /></a></aside>
            )}
          </div>
        </div>
        <div className="korn" />
        <span className="bildhinweis">Stimmungsbild, nicht Ihr Wald</span>
      </section>

      <main className="papier" style={{ borderRadius: 24, marginTop: 0 }}>
        <section className="abschnitt" style={{ marginTop: 10 }}>
          <span className="klein">Ihr Wald heute</span>
          <h2>Alles im Blick, <em>Bestand für Bestand.</em></h2>
          <div className="zwei breit-links">
            <div>
              <Waldkarte wald={wald} ents={offen} auswahl={b?.id} onWahl={setAuswahl} />
              <Legende />
            </div>
            <div>
              <div className="bestaende">
                {wald.bestaende.map((x) => (
                  <button key={x.id} className={`bestandzeile ${x.id === b?.id ? 'an' : ''}`} onClick={() => setAuswahl(x.id)} aria-pressed={x.id === b?.id}>
                    <i style={{ background: farbeVon(x, offen) }} />
                    <span><b>{x.label}</b><small>{x.kennung} · {x.kahlflaeche ? 'Freifläche' : `${x.fuehrendText}${x.alter ? ` · ${x.alter.text}` : ''}`}</small></span>
                    <span className="mono" style={{ fontSize: 13 }}>{ha(x.ha)}</span>
                  </button>
                ))}
              </div>
              {b && (
                <div className="feld" style={{ marginTop: 14 }}>
                  <div className="kopfzeile" style={{ marginBottom: 4 }}><h2 style={{ fontSize: 22 }}>{b.label}</h2>{!b.kahlflaeche && <Status s={statusVon(b.vorrat)} text={statusLabel(b.vorrat)} erklaerung={`${b.vorrat.quelle}${b.vorrat.stand ? `, Stand ${datumKurz(b.vorrat.stand)}` : ''}`} />}</div>
                  <p style={{ fontSize: 14, color: 'var(--slate)' }}>{b.vital}</p>
                  <div className="kennwerte">
                    {!b.kahlflaeche && <div><span>Vorrat</span><b>{zahl(b.vorrat.wert)} Vfm/ha</b>{b.vorrat.spanne && <span> Spanne {zahl(b.vorrat.spanne[0])}–{zahl(b.vorrat.spanne[1])}</span>}</div>}
                    <div><span>Baumarten</span><b>{b.arten.filter((a) => a.pct >= 5 && a.art !== 'sonstiges').map((a) => `${ART_TEXT[a.art]} ${pct(a.pct)}`).join(' · ') || '—'}</b></div>
                    {b.hoeheM != null && <div><span>Höhe · BHD</span><b>{zahl(b.hoeheM)} m{b.bhdCm ? ` · ${zahl(b.bhdCm)} cm` : ''}</b></div>}
                    {b.hangGrad != null && <div><span>Gelände</span><b>{zahl(b.hangGrad)}° {b.exposition ?? ''}</b></div>}
                    {b.zuwachs && <div><span>Zuwachs</span><b>{zahl(b.zuwachs.wert, 1)} Vfm/ha/Jahr</b></div>}
                    {b.boden?.nfkMm && <div><span>Wasserspeicher</span><b>{zahl(b.boden.nfkMm)} mm</b></div>}
                  </div>
                  {offen.filter((e) => e.bestandId === b.id).map((e) => (
                    <a key={e.id} className="knopf2" href={`#/entscheidungen/${e.id}`} style={{ justifyContent: 'space-between' }}><span>{e.kurz}</span><Icon n="arrow" /></a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="abschnitt">
          <span className="klein">Was möchten Sie tun?</span>
          <h2>Beschreiben Sie Ihr Anliegen <em>in einem Satz.</em></h2>
          <div className="fragen">
            {einstiege.map(([t, z]) => <a key={t} className="frage" href={z}>{t}<Icon n="arrow" /></a>)}
          </div>
        </section>

        <section className="abschnitt">
          <span className="klein">Datenlage</span>
          <h2>Wie sicher sind <em>unsere Zahlen?</em></h2>
          <div className="datenlage">
            <div className="feld"><Status s="bestaetigt" /><b style={{ marginTop: 10 }}>{ha(status.bestaetigt)}</b><p className="unterzeile">gemessen oder geprüft – trägt Geldentscheidungen</p></div>
            <div className="feld"><Status s="geschaetzt" /><b style={{ marginTop: 10 }}>{ha(status.geschaetzt)}</b><p className="unterzeile">aus Fernerkundung und Modellen, mit Spanne</p></div>
            <div className="feld"><Status s="pruefen" /><b style={{ marginTop: 10 }}>{ha(status.pruefen)}</b><p className="unterzeile">reicht noch nicht für eine verlässliche Entscheidung</p></div>
          </div>
          {status.pruefen + status.geschaetzt > 0 && <a className="knopf gruen" href="#/messen" style={{ maxWidth: 420 }}>Genauer werden: Winkelzählprobe <Icon n="arrow" /></a>}
        </section>
      </main>
    </>
  );
}
