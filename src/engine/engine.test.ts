import { describe, expect, it } from 'vitest';
import { BEISPIELWALD } from '../data/beispielwald';
import { STANDARD_ANNAHMEN as A } from './annahmen';
import { ernteRechnen, zeitpunkteVergleichen } from './ernte';
import { entscheidungenAbleiten } from './entscheidungen';
import { annuitaet, kapitalwert, schadenBis } from './finanzen';
import { foerderungPruefen } from './foerderung/pruefen';
import { anwenden, hash, LEERE_FORTSCHREIBUNG } from './fortschreibung';
import { kulturRechnen, type KulturEingabe } from './kultur';
import { statusLabel, statusVon } from './messwert';
import { allokation, waldVermoegen, wertverlauf, wertzuwachsJahr } from './vermoegen';
import { waldAusAngaben } from './angaben';
import { ersteErkenntnis, frageRouten, startzustand, waldaufnahme, waldjahr, wertAnzeige } from './startseite';
import { grundflaecheAmPunkt, wzpAlsMesswert, wzpAuswerten } from './wzp';
import { zwillingImportieren, zwillingTextLesen } from './zwilling-import';

const bestand = (id: string) => BEISPIELWALD.bestaende.find((b) => b.id === id)!;
const HEUTE = new Date('2026-10-23');

describe('Datenstatus', () => {
  it('leitet den Status aus Herkunft und Genauigkeit ab', () => {
    expect(statusVon({ wert: 400, einheit: 'Vfm/ha', quelle: '', herkunft: 'vor_ort', genauigkeitPct: 8 })).toBe('bestaetigt');
    expect(statusVon({ wert: 400, einheit: 'Vfm/ha', quelle: '', herkunft: 'abgeleitet', genauigkeitPct: 25 })).toBe('geschaetzt');
    expect(statusVon({ wert: 400, einheit: 'Vfm/ha', quelle: '', herkunft: 'modelliert', genauigkeitPct: 34 })).toBe('pruefen');
    expect(statusVon({ wert: 400, einheit: 'Vfm/ha', quelle: '', herkunft: 'annahme' })).toBe('pruefen');
    expect(statusVon(undefined)).toBe('pruefen');
  });
  it('benennt eigene Messungen als gemessen, nicht als Modell', () => {
    expect(statusLabel({ wert: 300, einheit: 'Vfm/ha', quelle: '', herkunft: 'vor_ort', genauigkeitPct: 19 })).toBe('Gemessen ± 19 %');
    expect(statusLabel({ wert: 300, einheit: 'Vfm/ha', quelle: '', herkunft: 'abgeleitet', genauigkeitPct: 19 })).toBe('Modell geschätzt ± 19 %');
  });
  it('nutzt asymmetrische Spannen, wenn keine Genauigkeit angegeben ist', () => {
    expect(statusVon({ wert: 543, einheit: 'Vfm/ha', quelle: '', herkunft: 'abgeleitet', spanne: [433, 679] })).toBe('geschaetzt');
  });
});

describe('Finanzen', () => {
  it('zinst korrekt ab', () => {
    expect(kapitalwert([{ jahr: 0, betrag: -1000 }, { jahr: 1, betrag: 1100 }], 0.1)).toBeCloseTo(0, 6);
    expect(annuitaet(1000, 0, 10)).toBe(100);
    expect(annuitaet(1000, 0.05, 10)).toBeCloseTo(129.5, 1);
    expect(schadenBis(10, 0.025)).toBeCloseTo(0.2237, 3);
  });
});

describe('Förderung Bayern (WALDFÖPR 2025)', () => {
  it('rechnet 3,80 € je Pflanze', () => {
    const r = foerderungPruefen({ bundesland: 'Bayern', pflanzen: 1000 });
    expect(r.betrag).toBe(3800);
    expect(r.status).toBe('voraussichtlich');
    expect(r.bindefristJahre).toBe(5);
    expect(r.hinweise.some((h) => h.includes('nach der Bewilligung'))).toBe(true);
  });
  it('wendet die Bagatellgrenze von 700 € an', () => {
    const r = foerderungPruefen({ bundesland: 'Bayern', pflanzen: 150 });
    expect(r.betrag).toBe(0);
    expect(r.status).toBe('unter_bagatellgrenze');
  });
  it('fördert seltene Baumarten mit 5,00 €', () => {
    expect(foerderungPruefen({ bundesland: 'Bayern', pflanzen: 1000, pflanzenSelten: 200 }).betrag).toBe(800 * 3.8 + 200 * 5);
  });
  it('stuft die Jungbestandspflege nach Höhe ab', () => {
    expect(foerderungPruefen({ bundesland: 'Bayern', jungbestand: { ha: 1.6, hoeheM: 4 } }).betrag).toBe(1040);
    expect(foerderungPruefen({ bundesland: 'Bayern', jungbestand: { ha: 1, hoeheM: 8 } }).betrag).toBe(1000);
    expect(foerderungPruefen({ bundesland: 'Bayern', jungbestand: { ha: 1, hoeheM: 18 } }).betrag).toBe(0);
  });
  it('erfindet keinen Satz, wo keiner hinterlegt ist', () => {
    const r = foerderungPruefen({ bundesland: 'Bayern', voranbauPflanzen: 2000 });
    expect(r.betrag).toBe(0);
    expect(r.status).toBe('nicht_hinterlegt');
  });
  it('rechnet außerhalb Bayerns ohne Förderung', () => {
    expect(foerderungPruefen({ bundesland: 'Hessen', pflanzen: 5000 }).status).toBe('nicht_im_land');
  });
});

describe('Winkelzählprobe', () => {
  it('zählt Grenzbäume halb und korrigiert die Hangneigung', () => {
    expect(grundflaecheAmPunkt({ gezaehlt: 7, grenzbaeume: 2 }, 4)).toBe(32);
    expect(grundflaecheAmPunkt({ gezaehlt: 8, grenzbaeume: 0, hangGrad: 60 }, 4)).toBeCloseTo(64, 6);
  });
  it('liefert Vorrat und Stichprobenfehler', () => {
    const r = wzpAuswerten([7, 8, 6, 9, 7].map((n) => ({ gezaehlt: n, grenzbaeume: 0 })), 4, 27, 'fichte');
    expect(r.gMittel).toBeCloseTo(29.6, 6);
    expect(r.vorratVfmHa).toBeCloseTo(29.6 * 27 * 0.47, 6);
    expect(r.fehlerGPct!).toBeGreaterThan(5);
    expect(r.fehlerGPct!).toBeLessThan(25);
    const m = wzpAlsMesswert(r, '2026-10-23', 4);
    expect(m.herkunft).toBe('vor_ort');
  });
  it('gibt ohne drei Punkte keine scheinbare Präzision', () => {
    expect(wzpAuswerten([{ gezaehlt: 8, grenzbaeume: 0 }], 4, 27, 'fichte').genauigkeitPct).toBeGreaterThan(25);
  });
});

describe('Holzernte', () => {
  it('rechnet einen positiven Deckungsbeitrag für die Zielstärkennutzung im Buchenrand', () => {
    const r = ernteRechnen({ bestand: bestand('abt-3'), entnahmeVfmHa: 60, annahmen: A });
    expect(r.efm).toBeCloseTo(60 * 2.9 * 0.75, 6);
    expect(r.db).toBeGreaterThan(0);
    expect(r.dbSpanne[0]).toBeLessThan(r.db);
    expect(r.dbSpanne[1]).toBeGreaterThan(r.db);
  });
  it('wählt am steilen Hang den Seilkran und rechnet ihn teurer', () => {
    const flach = ernteRechnen({ bestand: bestand('abt-1'), entnahmeVfmHa: 60, annahmen: A });
    const steil = ernteRechnen({ bestand: { ...bestand('abt-1'), hangGrad: 28 }, entnahmeVfmHa: 60, annahmen: A });
    expect(steil.verfahren).toBe('seilkran');
    expect(steil.kostenJeEfm).toBeGreaterThan(flach.kostenJeEfm);
  });
  it('folgt dem Stückmassegesetz', () => {
    const duenn = ernteRechnen({ bestand: bestand('abt-1'), entnahmeVfmHa: 60, entnahmeBhdCm: 18, annahmen: A });
    const stark = ernteRechnen({ bestand: bestand('abt-1'), entnahmeVfmHa: 60, entnahmeBhdCm: 40, annahmen: A });
    expect(stark.kostenJeEfm).toBeLessThan(duenn.kostenJeEfm);
  });
  it('reagiert auf Preis- und Kostenfaktoren', () => {
    const basis = ernteRechnen({ bestand: bestand('abt-3'), entnahmeVfmHa: 60, annahmen: A });
    const billig = ernteRechnen({ bestand: bestand('abt-3'), entnahmeVfmHa: 60, annahmen: { ...A, preisFaktor: 0.8 } });
    expect(billig.db).toBeLessThan(basis.db);
  });
  it('berücksichtigt beim Warten das Schadrisiko', () => {
    const [jetzt, spaeter] = zeitpunkteVergleichen({ bestand: bestand('abt-1'), entnahmeVfmHa: 60, annahmen: A }, 0.015, [0, 5]);
    expect(jetzt.schadenWahrscheinlichkeit).toBe(0);
    expect(spaeter.schadenWahrscheinlichkeit).toBeGreaterThan(0);
    expect(spaeter.erwarteterDb).toBeLessThan(spaeter.ergebnis.db);
  });
});

describe('Zukunftswald', () => {
  const e: KulturEingabe = {
    ha: 1.5, bundesland: 'Bayern', verbiss: 'mittel', schutz: 'einzelschutz',
    mischung: [{ art: 'buche', anteil: 50, stkProHa: 5000 }, { art: 'tanne', anteil: 50, stkProHa: 3000 }],
    nvMoeglich: false, zins: 0.015, annahmen: A,
  };
  it('fördert die Pflanzung je Stück und rechnet den Eigenanteil', () => {
    const r = kulturRechnen('pflanzung', e);
    expect(r.pflanzen).toBe(Math.round(1.5 * 5000 * 0.5) + Math.round(1.5 * 3000 * 0.5));
    expect(r.foerderung.betrag).toBe(Math.round(r.pflanzen * 3.8));
    expect(r.eigenanteil[1]).toBeCloseTo(r.kosten[1] - r.foerderung.betrag, 6);
    expect(r.kosten[0]).toBeLessThan(r.kosten[2]);
  });
  it('sperrt Naturverjüngung ohne Samenbäume', () => {
    expect(kulturRechnen('naturverjuengung', e).gesperrt).toBeTruthy();
    expect(kulturRechnen('naturverjuengung', { ...e, nvMoeglich: true }).gesperrt).toBeUndefined();
  });
  it('senkt mit dem Zaun den Ausfall', () => {
    expect(kulturRechnen('pflanzung', { ...e, schutz: 'zaun' }).ausfall[1]).toBeLessThan(kulturRechnen('pflanzung', { ...e, schutz: 'keiner' }).ausfall[1]);
  });
});

describe('Entscheidungen', () => {
  const liste = entscheidungenAbleiten({ wald: BEISPIELWALD, annahmen: A, heute: HEUTE });
  it('leitet für den Beispielwald alle Entscheidungsarten ab', () => {
    const arten = new Set(liste.map((e) => e.art));
    for (const a of ['schaden', 'kultur', 'holzernte', 'voranbau', 'pflege', 'messen']) expect(arten.has(a as never)).toBe(true);
    expect(new Set(liste.map((e) => e.id)).size).toBe(liste.length);
  });
  it('stellt dringende Entscheidungen nach vorn', () => {
    expect(liste[0].dringlichkeit).toBe('hoch');
  });
  it('sperrt Holzverkauf auf „Noch zu prüfen“-Daten und empfiehlt die Messung', () => {
    const kiefer = liste.find((e) => e.id === 'ernte-abt-4')!;
    expect(kiefer.status).toBe('pruefen');
    expect(kiefer.optionen[0].gesperrt).toBeTruthy();
    expect(kiefer.optionen[kiefer.empfohlen].id).toBe('messen');
  });
  it('gibt bei bestätigten Daten eine Ernteempfehlung ohne Sperre', () => {
    const buche = liste.find((e) => e.id === 'ernte-abt-3')!;
    expect(buche.status).toBe('bestaetigt');
    expect(buche.optionen.every((o) => !o.gesperrt)).toBe(true);
    expect(buche.optionen[buche.empfohlen].id).not.toBe('messen');
  });
  it('speichert zu jeder Entscheidung einen nachvollziehbaren Rechenlauf', () => {
    for (const e of liste) expect(e.rechenlauf.eingabenHash).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('Fortschreibung', () => {
  it('übernimmt eine Inventur und schreibt eine erledigte Ernte fort', () => {
    const r = wzpAuswerten([7, 8, 6, 9, 7].map((n) => ({ gezaehlt: n, grenzbaeume: 0 })), 4, 22, 'kiefer');
    const f = {
      ...LEERE_FORTSCHREIBUNG,
      inventuren: [{ bestandId: 'abt-4', datum: '2026-10-20', k: 4, punkte: [], vorrat: wzpAlsMesswert(r, '2026-10-20', 4) }],
      massnahmen: [{ id: 'm1', bestandId: 'abt-4', titel: 'Durchforstung', art: 'ernte' as const, status: 'erledigt' as const, erstellt: '2026-10-21', vfmProHa: 40, ergebnis: { datum: '2026-10-22' } }],
    };
    const w = anwenden(BEISPIELWALD, f);
    const b = w.bestaende.find((x) => x.id === 'abt-4')!;
    expect(b.vorrat.herkunft).toBe('vor_ort');
    expect(b.vorrat.wert).toBe(Math.round(r.vorratVfmHa) - 40);
    expect(w.tagebuch[0].datum >= '2026-10-20').toBe(true);
  });
  it('hasht stabil', () => {
    expect(hash({ a: 1 })).toBe(hash({ a: 1 }));
    expect(hash({ a: 1 })).not.toBe(hash({ a: 2 }));
  });
});

describe('Vermögen', () => {
  it('bewertet stehendes Holz und CO₂, Freiflächen ohne Holzwert', () => {
    const v = waldVermoegen(BEISPIELWALD, A);
    expect(v.ha).toBeCloseTo(12.4, 6);
    expect(v.holzwert).toBeGreaterThan(0);
    expect(v.werte.find((x) => x.bestand.id === 'abt-2')!.holzwert).toBe(0);
    expect(v.co2t).toBeGreaterThan(v.vorratGesamt * 0.7);
  });
});

describe('Import eines Waldgrafen-Zwillings', () => {
  const minimal = {
    betrieb: { id: 'test', name: 'Test', langname: 'Testwald', bundesland: 'Bayern' },
    kennzahlen: { erfasst: '2026-10-19' },
    bestaende: [{
      id: 'fl-1', label: 'Testwald · 1', flurstueck: '1', haBerechnet: 2.5, polygon: [[12, 47], [12.01, 47], [12.01, 47.01], [12, 47]], mitte: { lat: 47.005, lon: 12.005 },
      hangneigungGrad: 22, mittelhoeheM: 30, bhdMittelCm: 40, nadelPct: 90,
      konsens: { vfmProHa: 520, spanneVfmProHa: [420, 650], genauigkeitPct: 25, herkunft: 'abgeleitet', wege: [{ name: 'Laser' }] },
      alter: { artengruppe: 'fichte', schaetzung: { alterVonJahre: 80, alterBisJahre: 95, spanneText: '80–95 Jahre' } },
      baumartenKarte: { anteile: [{ gruppe: 'fichte', pct: 90 }, { gruppe: 'buche', pct: 10 }] },
      massnahmen: [{ befund: 'Frischer Verdacht aus dem Satellitenbild', wert: '0,3 ha, Beginn 2026', dringlichkeit: 'hoch' }],
      ereignisse: [{ ha: 0.3, beginnJahr: 2026, bestaetigt: false, erholt: false }],
    }],
    standort: { metriken: { 'fl-1': { zuwachsVfmProHaJahr: 10, hiebsreife: 'Zielstärke erreicht' } }, eignungJeBestand: { 'fl-1': { eignung: [{ art: 'Fichte', heute: 'mittel', entwicklung: 'schlechter', gruende: [] }] } } },
    profil: { besitzer: 'Test', kalkulationszins: 0.02, verbiss: 'hoch' },
  };
  it('übersetzt Bestände mit Herkunft und Spanne', () => {
    const w = zwillingImportieren(minimal);
    const b = w.bestaende[0];
    expect(b.ha).toBe(2.5);
    expect(b.fuehrend).toBe('fichte');
    expect(b.vorrat.spanne).toEqual([420, 650]);
    expect(statusVon(b.vorrat)).toBe('geschaetzt');
    expect(w.profil.verbiss).toBe('hoch');
    expect(w.ereignisse[0].bestaetigt).toBe(false);
  });
  it('liest den Zwilling auch aus der HTML-Datei', () => {
    const html = `<html><script type="application/json" id="wg-daten">${JSON.stringify(minimal)}</script></html>`;
    expect(zwillingTextLesen(html).betrieb.id).toBe('test');
  });
  it('erzeugt aus importierten Daten Entscheidungen inkl. Seilkran-Hinweis', () => {
    const liste = entscheidungenAbleiten({ wald: zwillingImportieren(minimal), annahmen: A, heute: HEUTE });
    expect(liste[0].art).toBe('schaden');
    expect(liste.find((e) => e.art === 'holzernte')!.risiken.some((r) => r.includes('Seilkran'))).toBe(true);
  });
});

describe('Depot-Sicht', () => {
  it('rechnet eine wachsende Wertentwicklung mit Spanne', () => {
    const v = wertverlauf(BEISPIELWALD, A, 10, 2026);
    expect(v).toHaveLength(11);
    expect(v[0].jahr).toBe(2026);
    expect(v[10].wert).toBeGreaterThan(v[0].wert);
    for (const p of v) { expect(p.lo).toBeLessThan(p.wert); expect(p.hi).toBeGreaterThan(p.wert); }
    expect(wertzuwachsJahr(BEISPIELWALD, A).euro).toBeGreaterThan(0);
  });
  it('summiert die Baumarten-Allokation auf 100 %', () => {
    const al = allokation(BEISPIELWALD);
    expect(al.reduce((s, x) => s + x.pct, 0)).toBeCloseTo(100, 6);
    expect(al[0].art).toBe('fichte');
  });
});

describe('Wald aus einfachen Angaben', () => {
  const w = waldAusAngaben({ name: 'Hofwald', bundesland: 'Bayern', flaechen: [
    { name: 'Am Bach', ha: 2, art: 'fichte', alter: 'alt', zustand: 'schaeden' },
    { name: 'Sturmloch', ha: 0.8, art: 'fichte', alter: 'alt', zustand: 'kahl' },
    { name: 'Buchen', ha: 1.5, art: 'buche', alter: 'sehr_alt', zustand: 'gesund' },
  ] }, HEUTE);
  it('kennzeichnet die Schätzung als noch zu prüfen', () => {
    for (const b of w.bestaende.filter((x) => !x.kahlflaeche)) expect(statusVon(b.vorrat)).toBe('pruefen');
  });
  it('führt zu Begang, Wiederbewaldung und Messung – ohne Verkaufsempfehlung', () => {
    const liste = entscheidungenAbleiten({ wald: w, annahmen: A, heute: HEUTE });
    const ids = liste.map((e) => e.art);
    expect(ids).toContain('schaden');
    expect(ids).toContain('kultur');
    expect(ids).toContain('messen');
    expect(liste.find((e) => e.art === 'schaden')!.statusText).toBe('Von Ihnen gemeldet');
    for (const e of liste.filter((x) => x.art === 'holzernte')) expect(e.optionen[e.empfohlen].id).toBe('messen');
  });
});

describe('Startseite', () => {
  const eigen = waldAusAngaben({ name: 'Hirschberg', bundesland: 'Bayern', flaechen: [{ name: 'Hang', ha: 2.4, art: 'fichte', alter: 'alt', zustand: 'gesund' }] }, HEUTE);
  it('erkennt Neueinsteiger, aktive Besitzer und Betriebe', () => {
    expect(startzustand(eigen)).toBe('neu');
    expect(startzustand(BEISPIELWALD)).toBe('aktiv');
    expect(startzustand(BEISPIELWALD, ['betrieb'])).toBe('betrieb');
  });
  it('zeigt einen Wert nur, wenn er begründbar ist', () => {
    expect(wertAnzeige(eigen, A)).toBeNull();
    const w = wertAnzeige(BEISPIELWALD, A)!;
    expect(w.lo).toBeLessThan(w.mitte);
    expect(w.hi).toBeGreaterThan(w.mitte);
  });
  it('misst die Vollständigkeit der Waldaufnahme in fünf Bereichen', () => {
    const neu = waldaufnahme(eigen);
    const aktiv = waldaufnahme(BEISPIELWALD);
    expect(neu.bereiche).toHaveLength(5);
    expect(neu.anteil).toBeLessThan(aktiv.anteil);
    expect(neu.bereiche.find((b) => b.id === 'vorrat')!.status).toBe('offen');
  });
  it('baut ein kurzes Waldjahr', () => {
    const ents = entscheidungenAbleiten({ wald: BEISPIELWALD, annahmen: A, heute: HEUTE });
    const j = waldjahr(BEISPIELWALD, LEERE_FORTSCHREIBUNG, ents, HEUTE);
    expect(j.length).toBeGreaterThan(0);
    expect(j.length).toBeLessThanOrEqual(4);
  });
  it('führt Fragen zum passenden Ablauf', () => {
    expect(frageRouten('Lohnt sich eine Durchforstung?').ziel).toBe('#/ernte');
    expect(frageRouten('Was pflanze ich auf der Kahlfläche?').ziel).toBe('#/zukunft');
    expect(frageRouten('Wie genau ist mein Vorrat?').ziel).toBe('#/messen');
  });
  it('nennt eine erste Erkenntnis aus der Standorteignung, ohne Geldwert', () => {
    const e = ersteErkenntnis(BEISPIELWALD)!;
    expect(e.satz).toMatch(/enger/);
    expect(e.satz).not.toMatch(/€/);
    expect(ersteErkenntnis(eigen)!.grundlage).toMatch(/Allgemeine/);
  });
});
