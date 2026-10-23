import { useState } from 'react';
import { ART_LABEL } from '../../engine/entscheidungen';
import { euro, euroSpanne, ha, zahl } from '../../engine/format';
import { statusLabel } from '../../engine/messwert';
import { waldVermoegen } from '../../engine/vermoegen';
import { Regler, Status, Werkzeug } from '../bausteine';
import { useZustand } from '../zustand';

export function Vermoegen() {
  const { wald, annahmen, entscheidungen, modus } = useZustand();
  const v = waldVermoegen(wald, annahmen);

  // Investitionen aus den empfohlenen Optionen: Was kostet es, was steht auf dem Spiel?
  const investitionen = entscheidungen.flatMap((e) => {
    const empf = e.optionen[e.empfohlen];
    const o = (empf.massnahme?.kostenRahmen ?? 0) > 0 ? empf : e.optionen.find((x) => !x.gesperrt && (x.massnahme?.kostenRahmen ?? 0) > 0) ?? empf;
    const kosten = o.massnahme?.kostenRahmen ?? 0;
    if (kosten <= 0) return [];
    const foerderung = o.massnahme?.foerderung ?? 0;
    const eigen = Math.max(1, kosten - foerderung);
    return [{ e, o, kosten, foerderung, eigen, hebel: e.wertEuro / eigen }];
  }).sort((a, b) => b.hebel - a.hebel);
  const summeEigen = investitionen.reduce((s, x) => s + x.eigen, 0);
  const [budget, setBudget] = useState(Math.round(summeEigen * 0.6));
  // Gierige Auswahl nach Hebel innerhalb des Budgets
  const gewaehlt = new Set<string>();
  let rest = budget;
  for (const x of investitionen) if (x.eigen <= rest) { gewaehlt.add(x.e.id); rest -= x.eigen; }

  return (
    <Werkzeug seite="vermoegen" bild="bilder/kronendach.webp" titel={<>Was Ihr Wald <em>wert ist.</em></>} lead="Holzwert, gebundener Kohlenstoff und die Frage, wohin das nächste Kapital am meisten bewirkt – mit Spannen statt Scheingenauigkeit.">
      <div className="drei">
        <div className="feld"><h3>Holzwert stehend</h3><div className="gross">{euro(v.holzwert)}</div><p className="unterzeile">Spanne {euroSpanne(...v.holzwertSpanne)} · Abtriebswert-Näherung nach Erntekosten, ohne Boden. Kein Verkehrswertgutachten.</p></div>
        <div className="feld"><h3>CO₂ im Holz</h3><div className="gross">{zahl(v.co2t)} t</div><p className="unterzeile">+ {zahl(v.co2JahrT)} t pro Jahr aus dem Zuwachs · inkl. Äste und Wurzeln, ohne Boden.</p></div>
        <div className="feld"><h3>Fläche und Vorrat</h3><div className="gross">{ha(v.ha)}</div><p className="unterzeile">{zahl(v.vorratGesamt)} Vfm gesamt · davon {ha(v.bestaetigtHa)} mit bestätigtem Vorrat</p></div>
      </div>

      <section className="abschnitt">
        <span className="klein">Je Bestand</span>
        <h2>Woraus sich <em>der Wert</em> zusammensetzt.</h2>
        <div className="feld tab-wrap">
          <table className="tab">
            <thead><tr><th>Bestand</th><th className="z">Fläche</th><th className="z">Vorrat</th>{modus === 'pro' && <th className="z">Netto €/Vfm</th>}<th className="z">Holzwert</th><th className="z">CO₂ t</th><th>Datenlage</th></tr></thead>
            <tbody>{v.werte.map((x) => (
              <tr key={x.bestand.id}>
                <td><b style={{ fontWeight: 500 }}>{x.bestand.label}</b><br /><span className="unterzeile">{x.bestand.kahlflaeche ? 'Freifläche' : x.bestand.fuehrendText}</span></td>
                <td className="z">{zahl(x.bestand.ha, 2)} ha</td>
                <td className="z">{zahl(x.vorratGesamt)} Vfm</td>
                {modus === 'pro' && <td className="z">{zahl(x.nettoJeVfm, 1)}</td>}
                <td className="z">{x.holzwert > 0 ? euroSpanne(...x.holzwertSpanne) : '—'}</td>
                <td className="z">{zahl(x.co2t)}</td>
                <td>{!x.bestand.kahlflaeche && <Status s={x.status} text={statusLabel(x.bestand.vorrat)} erklaerung={x.bestand.vorrat.quelle} />}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      {investitionen.length > 0 && (
        <section className="abschnitt">
          <span className="klein">Kapital einsetzen</span>
          <h2>Wohin fließt <em>der nächste Euro?</em></h2>
          <div className="feld">
            {modus === 'pro' ? (
              <Regler label="Budget Eigenanteil" wert={budget} anzeige={euro(budget, false)} min={0} max={Math.max(1000, Math.ceil(summeEigen / 1000) * 1000)} schritt={500} onChange={setBudget} />
            ) : <p className="unterzeile">Gereiht nach Hebel: Wie viel Wert schützt oder schafft jeder Euro Eigenanteil? Im Pro-Modus mit Budgetgrenze.</p>}
            <div className="tab-wrap" style={{ marginTop: 12 }}><table className="tab">
              <thead><tr><th>Maßnahme</th><th className="z">Kosten</th><th className="z">Förderung</th><th className="z">Eigenanteil</th><th className="z">Es geht um</th><th className="z">Hebel</th></tr></thead>
              <tbody>{investitionen.map((x) => (
                <tr key={x.e.id} style={modus === 'pro' && gewaehlt.has(x.e.id) ? { background: '#e7f3ec' } : undefined}>
                  <td><a href={`#/entscheidungen/${x.e.id}`} style={{ textDecoration: 'underline' }}>{x.o.name}</a><br /><span className="unterzeile">{ART_LABEL[x.e.art]} · {x.e.ort.split(' · ')[0]}</span></td>
                  <td className="z">{zahl(Math.round(x.kosten))}</td>
                  <td className="z gut">{x.foerderung ? zahl(x.foerderung) : '—'}</td>
                  <td className="z">{zahl(Math.round(x.eigen))}</td>
                  <td className="z">{zahl(Math.round(x.e.wertEuro))}</td>
                  <td className="z">{zahl(x.hebel, 1)}×</td>
                </tr>
              ))}</tbody>
            </table></div>
            {modus === 'pro' && <p className="unterzeile" style={{ marginTop: 10 }}>Grün: Auswahl innerhalb des Budgets ({euro([...gewaehlt].reduce((s, eid) => s + (investitionen.find((x) => x.e.id === eid)?.eigen ?? 0), 0), false)}). Priorisierung nach Wert je Euro – für große Betriebe folgt eine mehrjährige Optimierung mit Restriktionen.</p>}
          </div>
        </section>
      )}
    </Werkzeug>
  );
}
