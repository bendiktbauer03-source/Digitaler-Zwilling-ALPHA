/**
 * Liest die Ausgabe der bestehenden Waldgrafen-Pipeline (neuer-zwilling.mjs → `wg-daten`)
 * und übersetzt sie in das gemeinsame Kernmodell. Die Fernerkundung, der ForestSimulator,
 * SorSim und HeProMo rechnen dort – hier wird daraus eine Entscheidungsgrundlage.
 *
 * Akzeptiert: das JSON selbst oder die komplette Zwillings-HTML-Datei
 * (dann wird der Block <script id="wg-daten"> herausgelöst). Alles bleibt im Browser.
 */
import type { Artgruppe, Bestand, Befund, Belastung, Bildstufe, Eignung, Ereignis, Foto, RoutenEingriff, Simulation, Umbauplan, Variante, Wald, Waldweg } from './modell';
import { artgruppeAusText, ART_TEXT } from './modell';
import type { Herkunft, Messwert } from './messwert';

// Die Pipeline-Ausgabe ist groß und wächst; wir lesen tolerant.
type J = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export class ImportFehler extends Error {}

export function zwillingTextLesen(text: string): J {
  const t = text.trim();
  if (t.startsWith('{')) return JSON.parse(t);
  const block = (id: string) => t.match(new RegExp(`<script[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/script>`))?.[1];
  const daten = block('wg-daten');
  if (!daten) throw new ImportFehler('In dieser Datei steckt kein Waldgrafen-Zwilling (Block „wg-daten“ fehlt).');
  const d = JSON.parse(daten);
  // Der Umbauplan steht in neueren Zwillingen in einem eigenen Block.
  const umbau = block('wg-umbau');
  if (umbau && !d.umbau) { try { d.umbau = JSON.parse(umbau); } catch { /* ohne Plan weiter */ } }
  return d;
}

/** Baumartencodes des ForestSimulators (NW-FVA) in Artgruppen. */
export function artAusFva(code: string): Artgruppe {
  const c = Number(code);
  if (c === 521 || (c >= 520 && c < 530)) return 'tanne';
  if (c >= 500 && c < 600) return 'fichte';
  if (c >= 600 && c < 700) return 'douglasie';
  if (c >= 700 && c < 800) return 'kiefer';
  if (c >= 800 && c < 900) return 'laerche';
  if (c >= 100 && c < 200) return 'eiche';
  if (c >= 200 && c < 300) return 'buche';
  if (c >= 300 && c < 400) return 'edellaub';
  return 'sonstiges';
}

const zahl = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

function herkunft(h: unknown): Herkunft {
  return h === 'gemessen' || h === 'modelliert' || h === 'abgeleitet' || h === 'angabe' || h === 'vor_ort' ? h : 'abgeleitet';
}


function dringlichkeit(s: unknown): Befund['dringlichkeit'] {
  return s === 'hoch' || s === 'mittel' || s === 'gering' ? s : 'keine';
}

function verbiss(s: unknown): Belastung {
  return s === 'gering' || s === 'hoch' ? s : 'mittel';
}

function variante(r: J): Variante {
  const pk = r.proKlima ?? {};
  const je = (feld: string) => Object.fromEntries(Object.entries(pk).map(([k, v]) => [k, Number((v as J)[feld] ?? 0)]));
  return {
    id: String(r.id),
    text: String(r.text ?? r.id),
    robust: Number(r.robust ?? r.mittel ?? 0),
    schlechtester: Number(r.schlechtester ?? 0),
    kapitalwertHa: je('kapitalwert'),
    oekologie: je('oekologie'),
    kalamitaetVfm: je('kalamitaetVfm'),
    vorratEnde: je('vorratEnde'),
  };
}

function eingriff(e: J): RoutenEingriff {
  return {
    jahr: Number(e.jahr),
    art: String(e.art ?? 'Eingriff'),
    vfmProHa: Number(e.vfm ?? 0),
    efmGesamt: Number(e.efmGesamt ?? 0),
    erloesHa: Number(e.erloesHa ?? 0),
    kostenHa: Number(e.kostenHa ?? 0),
    pflanzkostenHa: Number(e.pflanzkostenHa ?? 0),
    foerderungHa: Number(e.foerderungHa ?? 0),
    deckungsbeitragGesamt: Number(e.deckungsbeitragGesamt ?? 0),
    verfahren: e.verfahren,
    begruendung: Array.isArray(e.begruendung) ? e.begruendung.map(String) : [],
    sortimente: Array.isArray(e.sortimente) ? e.sortimente.map((s: J) => ({ art: String(s.art), sorte: String(s.sorte), efm: Number(s.efm), preis: Number(s.preis), erloes: Number(s.erloes) })) : [],
  };
}

function waldweg(w: J, wachstum: J): Waldweg | undefined {
  const o = w?.optimierung;
  if (!o?.rang?.length) return undefined;
  const rm = o.roadmap ?? {};
  const bildreihe: Bildstufe[] = Array.isArray(o.bildreihe)
    ? o.bildreihe.map((x: J) => ({ jahr: Number(x.jahr), titel: String(x.titel ?? ''), text: String(x.text ?? ''), bild: typeof x.bild === 'string' ? x.bild : undefined, eingriff: !!x.eingriff }))
    : [];
  return {
    modell: String(wachstum?.modell ?? 'Wachstumsmodell'),
    jahre: Number(o.jahre ?? rm.jahre ?? wachstum?.jahre ?? 30),
    gewichtung: String(o.gewichtung ?? ''),
    varianten: o.rang.map(variante),
    siegerId: String(o.sieger?.id ?? o.rang[0].id),
    eingriffe: Array.isArray(rm.eingriffe) ? rm.eingriffe.map(eingriff) : [],
    zielwald: rm.zielwald ? { jahr: Number(rm.zielwald.jahr), vorrat: Number(rm.zielwald.vorrat), anteile: (rm.zielwald.anteile ?? []).map((a: J) => ({ art: String(a.art), pct: Number(a.pct) })), totholz: zahl(rm.zielwald.totholz), habitat: zahl(rm.zielwald.habitat) } : undefined,
    summeHa: rm.summe ? { erloesHa: Number(rm.summe.erloesHa ?? 0), kostenHa: Number(rm.summe.kostenHa ?? 0), deckungsbeitragHa: Number(rm.summe.deckungsbeitragHa ?? 0), barwertHa: Number(rm.summe.barwertHa ?? 0) } : undefined,
    quellen: rm.quellen ?? {},
    bildreihe,
  };
}

function artenAus(b: J, sim?: J): { art: Artgruppe; pct: number }[] {
  const a = b.baumartenKarte?.anteile;
  if (Array.isArray(a) && a.length) {
    const m = new Map<Artgruppe, number>();
    for (const x of a) {
      const g = artgruppeAusText(x.gruppe ?? x.art);
      m.set(g, (m.get(g) ?? 0) + Number(x.pct ?? 0));
    }
    return [...m.entries()].map(([art, pct]) => ({ art, pct })).sort((x, y) => y.pct - x.pct);
  }
  // Startzustand der Wuchssimulation: Vorrat je Baumartencode
  const start = sim?.szenarien?.nichtstun?.[0]?.arten ?? (Object.values(sim?.szenarien ?? {}) as J[])[0]?.[0]?.arten;
  if (start && typeof start === 'object') {
    const m = new Map<Artgruppe, number>();
    let summe = 0;
    for (const [code, x] of Object.entries(start as Record<string, J>)) {
      const v = Number(x?.v ?? 0);
      m.set(artAusFva(code), (m.get(artAusFva(code)) ?? 0) + v);
      summe += v;
    }
    if (summe > 0) return [...m.entries()].map(([art, v]) => ({ art, pct: Math.round((v / summe) * 100) })).filter((x) => x.pct > 0).sort((x, y) => y.pct - x.pct);
  }
  const nadel = zahl(b.nadelPct);
  if (nadel == null) return [{ art: 'sonstiges', pct: 100 }];
  return [{ art: 'fichte' as Artgruppe, pct: nadel }, { art: 'buche' as Artgruppe, pct: 100 - nadel }].filter((x) => x.pct > 0).sort((x, y) => y.pct - x.pct);
}

export function zwillingImportieren(d: J): Wald {
  if (!d?.betrieb || !Array.isArray(d?.bestaende)) throw new ImportFehler('Die Datei hat nicht das erwartete Zwillingsformat (betrieb, bestaende).');
  const std = d.standort ?? {};
  const wachstumListe: J[] = d.wachstum?.bestaende ?? [];
  const flaechen: J[] = (d.reviere ?? []).map((r: J) => r.flaeche).filter(Boolean);
  const alterVon = (id: string) => {
    for (const f of flaechen) {
      const a = (f.alter ?? []).find((x: J) => x.teilId === id);
      if (a?.schaetzung) return a.schaetzung;
    }
    return undefined;
  };

  const bestaende: Bestand[] = d.bestaende.map((b: J): Bestand => {
    const id = String(b.id);
    const k = b.konsens ?? {};
    const met = std.metriken?.[id] ?? {};
    const sim = wachstumListe.find((w) => w.teilId === id);
    const arten = artenAus(b, sim);
    const fuehrend = arten[0]?.art !== 'sonstiges' && arten[0]?.pct >= 50 ? arten[0].art : artgruppeAusText(b.alter?.artengruppe) !== 'sonstiges' ? artgruppeAusText(b.alter?.artengruppe) : arten[0].art;
    const fm = k.feldmessung;
    const stab = b.stabilitaet;
    const ns = (d.naturschutz ?? []).find((n: J) => n.teilId === id);
    const ea = b.alter?.eigentuemerangabe;
    const sch = alterVon(id) ?? b.alter?.schaetzung;
    const vorrat: Messwert = {
      wert: Number(k.vfmProHa ?? b.vorratVfmProHa ?? 0),
      einheit: 'Vfm/ha',
      quelle: fm ? `${fm.verfahren} am ${datumDe(fm.datum)}: ${fm.grundflaecheM2ProHa} m²/ha Grundfläche, Laser darauf kalibriert`
        : k.urteil === 'kalibriert' ? 'Fernerkundung, an Messungen in vergleichbaren Beständen kalibriert'
          : k.urteil === 'unkalibriert' ? 'Fernerkundung, nur ein Schätzweg – Spanne ist ein Erfahrungswert'
            : k.wege?.length ? `Konsens aus ${k.wege.length} Schätzwegen (${k.wege.map((w: J) => w.name).join(' · ')})` : 'Fernerkundung',
      herkunft: herkunft(k.herkunft ?? 'abgeleitet'),
      stand: fm?.datum ?? d.kennzahlen?.erfasst,
      genauigkeitPct: zahl(k.genauigkeitPct),
      spanne: Array.isArray(k.spanneVfmProHa ?? b.spanneVfmProHa) ? (k.spanneVfmProHa ?? b.spanneVfmProHa) : undefined,
    };
    const ww = waldweg(sim, d.wachstum);
    const eignung: Eignung[] = (std.eignungJeBestand?.[id]?.eignung ?? std.baumarten ?? []).map((e: J) => ({
      art: String(e.art), heute: String(e.heute), entwicklung: String(e.entwicklung), gruende: (e.gruende ?? []).map(String), hinweis: e.hinweis,
    }));
    const bp = std.bodenprofile?.[id];
    return {
      id,
      label: String(b.label ?? id),
      kennung: b.flurstueck ? `Flurstück ${b.flurstueck}` : id,
      ha: Number(b.haAmtlich ?? b.haBerechnet ?? 0),
      polygon: Array.isArray(b.polygon) ? b.polygon : [],
      mitte: b.mitte ?? { lat: 0, lon: 0 },
      hangGrad: zahl(b.hangneigungGrad),
      exposition: b.exposition,
      hoeheM: zahl(b.mittelhoeheM ?? b.h100M),
      bhdCm: zahl(b.bhdMittelCm),
      alter: sch?.alterVonJahre != null ? { von: sch.alterVonJahre, bis: sch.alterBisJahre, text: sch.spanneText ?? `${sch.alterVonJahre}–${sch.alterBisJahre} Jahre` } : undefined,
      nadelPct: zahl(b.nadelPct),
      fuehrend,
      fuehrendText: ART_TEXT[fuehrend],
      arten,
      vorrat,
      zuwachs: zahl(met.zuwachsVfmProHaJahr) != null ? { wert: met.zuwachsVfmProHaJahr, einheit: 'Vfm/ha/J', quelle: 'Ertragstafel über gemessene Oberhöhe', herkunft: 'modelliert', genauigkeitPct: 30 } : undefined,
      bestockungsgrad: zahl(b.bestockungsgrad),
      stammzahlProHa: zahl(b.stammzahlProHa),
      vital: b.vitalGrund,
      hiebsreife: met.hiebsreife,
      befunde: (b.massnahmen ?? []).map((m: J) => ({ befund: String(m.befund), wert: m.wert, folge: m.folge, dringlichkeit: dringlichkeit(m.dringlichkeit) })),
      eignung,
      boden: bp || b.boden?.kurz ? {
        nfkMm: zahl(bp?.nfkMm), text: bp?.interpretation ?? b.boden?.uebk25?.beschreibung,
        naehrstoff: b.boden?.kurz?.naehrstoffverfuegbarkeit, wasser: b.boden?.kurz?.pflanzenverfuegbaresBodenwasser,
        grundwasser: b.boden?.kurz?.grundwasser, humus: b.boden?.kurz?.humusOberboden,
      } : undefined,
      waldweg: ww,
      verjuengungMoeglich: arten.filter((a) => a.pct >= 10).map((a) => ART_TEXT[a.art]),
      revier: b.revier ?? undefined,
      stabilitaet: stab?.stufe ? { stufe: String(stab.stufe), folge: String(stab.folge ?? ''), hd: zahl(stab.hd), kronePct: zahl(stab.krone), kritisch: /trügerisch|labil|instabil|gefährdet/i.test(String(stab.stufe)) } : undefined,
      messung: fm?.datum ? { datum: String(fm.datum), verfahren: String(fm.verfahren ?? 'Messung'), grundflaecheM2Ha: zahl(fm.grundflaecheM2ProHa), erfassungsgradPct: zahl(fm.erfassungsgradPct) } : undefined,
      naturnah: typeof std.gemessen?.[id]?.pnv === 'string' ? std.gemessen[id].pnv.split(';')[0].trim() : undefined,
      standortguete: b.alter?.standortguete?.stufe,
      schutz: ns ? (ns.themen ?? []).filter((t: J) => (t.anzahlImFlurstueck ?? 0) + (t.anzahlImUmkreis ?? 0) > 0).map((t: J) => ({ titel: String(t.titel), imFlurstueck: Number(t.anzahlImFlurstueck ?? 0), imUmkreis: Number(t.anzahlImUmkreis ?? 0) })) : undefined,
      eigentuemer: ea ? [ea.artenText, ea.bemerkung].filter(Boolean).join('. ') : undefined,
      simulation: simulation(sim, d.wachstum),
    };
  });

  const ereignisse: Ereignis[] = [];
  for (const b of d.bestaende as J[]) {
    for (const e of b.ereignisse ?? []) {
      ereignisse.push({
        label: `${String(e.ha).replace('.', ',')} ha · ${e.beginnJahr ?? e.tiefpunktJahr ?? ''}`,
        bestandId: String(b.id), ha: zahl(e.ha), jahr: zahl(e.beginnJahr) ?? zahl(e.tiefpunktJahr),
        bestaetigt: !!e.bestaetigt, erholt: !!e.erholt,
      });
    }
  }
  // Geometrien der Ereignisse aus der Karte zuordnen
  for (const f of d.karte?.ereignisse?.features ?? []) {
    const ziel = ereignisse.find((e) => e.label.replace(/\s/g, '') === String(f.properties?.label ?? '').replace(/\s/g, ''));
    if (ziel && f.geometry?.type === 'Polygon') ziel.polygon = f.geometry.coordinates[0];
  }

  const p = d.profil ?? {};
  const kp = std.klimaprofil ?? std.klima?.klima;
  return {
    id: String(d.betrieb.id ?? 'zwilling'),
    quelle: 'zwilling',
    stand: String(d.kennzahlen?.erfasst ?? ''),
    betrieb: {
      name: String(d.betrieb.name ?? ''),
      langname: String(d.betrieb.langname ?? d.betrieb.name ?? 'Mein Wald'),
      gemeinde: d.betrieb.gemeinde, landkreis: d.betrieb.landkreis,
      bundesland: String(d.betrieb.bundesland ?? 'Bayern'),
      wuchsgebiet: d.betrieb.wuchsgebiet,
    },
    bestaende,
    ereignisse,
    offeneFragen: (d.offeneFragen?.fragen ?? []).map((f: J) => ({ id: String(f.id), frage: String(f.frage), warum: String(f.warum ?? ''), gewinn: String(f.gewinn ?? ''), aufwand: String(f.aufwand ?? ''), betrifft: (f.betrifft ?? []).map(String) })),
    tagebuch: tagebuch(d),
    profil: {
      besitzer: String(p.besitzer ?? d.betrieb.name ?? ''),
      kalkulationszins: zahl(p.kalkulationszins) ?? 0.015,
      gewichtWirtschaft: zahl(p.gewichtWirtschaft) ?? 0.6,
      verbiss: verbiss(p.verbiss),
      vorratMin: zahl(p.vorratMin), vorratMax: zahl(p.vorratMax),
      annahme: String(p._status ?? '').startsWith('ANNAHME') || !p.gespraechAm,
      gespraechAm: p.gespraechAm ?? undefined,
      artenWunsch: Array.isArray(p.artenWunsch) ? p.artenWunsch.map(String) : undefined,
      artenTabu: Array.isArray(p.artenTabu) ? p.artenTabu.map(String) : undefined,
      fichteMax: zahl(p.fichteMax),
      einnahmen: p.einnahmen ?? undefined,
    },
    klima: kp ? {
      niederschlagMm: zahl(kp.jahresNiederschlagMm), temperaturC: zahl(kp.jahresMitteltemperaturC),
      verschiebungC: zahl(kp.verschiebung?.temperaturC), wasserbilanzSommerMm: zahl(kp.wasserbilanzSommerMm),
      text: kp.hinweis,
    } : undefined,
    foerderBezug: Object.fromEntries(Object.entries(d.foerderBezug ?? {}).filter(([, v]) => typeof v === 'string')) as Record<string, string>,
    kontakte: (d.kontakte ?? []).map((k: J) => ({ name: String(k.name), art: String(k.art ?? ''), notiz: k.notiz })),
    attribution: d.karte?.attribution,
    reviere: (d.reviere ?? []).map((r: J) => ({ id: String(r.flaecheId ?? r.name), nummer: r.nummer, name: String(r.name), kurz: r.kurz })),
    fotos: fotos(d),
    gewerke: (d.gewerke ?? []).map((g: J) => ({ id: String(g.id), gewerk: String(g.gewerk), wofuer: String(g.wofuer ?? ''), wann: String(g.wann ?? ''), kriterien: (g.auswahlkriterien ?? []).map(String) })),
    umbau: umbauplan(d.umbau, d.reviere ?? []),
    artenUmfeld: Array.isArray(d.arten?.arten) ? { quelle: String(d.arten.quelle ?? ''), anzahl: d.arten.arten.length, wald: d.arten.arten.filter((a: J) => a.wald).map((a: J) => String(a.deutsch ?? a.wiss)).slice(0, 12) } : undefined,
  };
}

/** Chronik: Einträge des Zwillings plus die Meilensteine, die in v4 nur verstreut stehen. Neueste zuerst. */
function tagebuch(d: J): Wald['tagebuch'] {
  const gespraech = d.profil?.gespraechAm;
  const liste: Wald['tagebuch'] = (d.tagebuch ?? []).map((t: J) => ({
    // Notizen ohne Datum stammen aus dem Eigentümergespräch.
    datum: /^\d{4}/.test(String(t.datum)) ? String(t.datum) : String(gespraech ?? d.kennzahlen?.erfasst ?? ''),
    titel: String(t.titel), text: String(t.text ?? ''), bestand: t.bestand ?? undefined, quelle: t.quelle, sicherheit: t.sicherheit ?? 'belegt',
  }));
  const messungen = new Map<string, J[]>();
  for (const b of d.bestaende ?? []) { const fm = b.konsens?.feldmessung; if (fm?.datum) messungen.set(fm.datum, [...(messungen.get(fm.datum) ?? []), { b, fm }]); }
  for (const [datum, xs] of messungen) liste.push({ datum, titel: `${xs[0].fm.verfahren ?? 'Messung'} im Bestand`, text: `${xs.map((x) => x.b.label).join(', ')}: ${xs[0].fm.grundflaecheM2ProHa} m²/ha Grundfläche gemessen – der Vorrat ist damit belegt.`, bestand: xs[0].b.revier ?? undefined, quelle: 'Messung am Boden', sicherheit: 'belegt' });
  if (gespraech) liste.push({ datum: String(gespraech), titel: 'Gespräch über Ihre Ziele', text: [d.profil.vorratMin && `Zielvorrat ${d.profil.vorratMin}–${d.profil.vorratMax} Vfm/ha`, d.profil.artenWunsch?.length && `Wunschbaumarten ${d.profil.artenWunsch.join(', ')}`].filter(Boolean).join(' · '), quelle: 'Eigentümergespräch', sicherheit: 'belegt' });
  const fotos = d.begutachtung?.eintraege ?? [];
  if (fotos.length) liste.push({ datum: String(fotos[0].datum ?? d.begutachtung.stand), titel: `${fotos.length} Fotos ausgewertet`, text: fotos.map((f: J) => `${f.ort}: ${f.kurz}`).join(' · '), quelle: String(d.begutachtung.quelle ?? 'Fotos des Eigentümers'), sicherheit: 'belegt' });
  if (d.umbau?.erstellt) liste.push({ datum: String(d.umbau.erstellt), titel: 'Umbauplan gerechnet', text: `${d.umbau.strategien?.length ?? 0} Wege für ${d.umbau.bestand?.name ?? 'den Bestand'}, je ${d.umbau.rechnung?.laeufe ?? '?'} Läufe über ${d.umbau.rechnung?.horizont ?? '?'} Jahre.`, quelle: 'Waldgrafen-Umbaumodell', sicherheit: 'belegt' });
  return liste.sort((a, b) => b.datum.localeCompare(a.datum));
}

function datumDe(iso: string) {
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : String(iso);
}

function simulation(sim: J, wachstum: J): Simulation | undefined {
  const sz = sim?.szenarien;
  if (!sz || typeof sz !== 'object') return undefined;
  const start = Number(String(wachstum?.erstellt ?? '').slice(0, 4)) || new Date().getFullYear();
  const wege = Object.entries(sz as Record<string, J[]>).filter(([, r]) => Array.isArray(r) && r.length > 1).map(([id, r]) => ({
    id,
    text: String(wachstum?.szenarien?.[id] ?? id),
    punkte: r.map((p: J) => ({ jahr: start + Number(p.jahr ?? 0), vorrat: Number(p.v ?? 0), entnahmeKum: Number(p.entnahmeKum ?? 0) })),
  }));
  return wege.length ? { modell: String(wachstum?.modell ?? 'Wuchsmodell'), jahre: Number(wachstum?.jahre ?? 30), wege } : undefined;
}

function fotos(d: J): Foto[] {
  const namen = new Map<string, string>((d.reviere ?? []).map((r: J) => [String(r.flaecheId), String(r.name)]));
  return (d.begutachtung?.eintraege ?? []).map((e: J) => ({
    ort: String(e.ort ?? ''), revier: namen.get(String(e.flaecheId)) ?? e.ort, datum: String(e.datum ?? d.begutachtung?.stand ?? ''),
    bild: typeof e.bild === 'string' && e.bild.startsWith('data:image/') ? e.bild : undefined,
    kurz: String(e.kurz ?? ''), befund: (e.befund ?? []).map(String),
  }));
}

const p3 = (x: J): [number, number, number] => [Number(x?.p10 ?? 0), Number(x?.p50 ?? 0), Number(x?.p90 ?? 0)];

function umbauplan(u: J, reviere: J[]): Umbauplan | undefined {
  if (!u?.strategien?.length || !u?.verlauf?.length) return undefined;
  const name = String(u.bestand?.name ?? '');
  const revier = reviere.find((r: J) => name.includes(String(r.name)))?.name;
  const kz = u.kennzahlen ?? {};
  return {
    erstellt: String(u.erstellt ?? ''),
    bestandName: name, kurz: u.bestand?.kurz, ha: Number(u.bestand?.ha ?? 0), revier,
    ziel: { name: String(u.ziel?.name ?? ''), beschreibung: String(u.ziel?.beschreibung ?? '') },
    korridor: Array.isArray(u.korridor) && u.korridor.length === 2 ? [Number(u.korridor[0]), Number(u.korridor[1])] : undefined,
    rechnung: { szenario: String(u.rechnung?.szenario ?? ''), startjahr: Number(u.rechnung?.startjahr ?? 0), horizont: Number(u.rechnung?.horizont ?? 0), laeufe: Number(u.rechnung?.laeufe ?? 0), zinsPct: Number(u.rechnung?.zinsPct ?? 0) },
    heute: { vorrat: Number(u.heute?.vorratVfmProHa ?? 0), nadelPct: Number(u.heute?.nadelPct ?? 0) },
    kennzahlen: {
      kapitalwert: p3(kz.kapitalwert), reinertragHaJahr: Number(kz.reinertragJeHaJahr ?? 0), foerderung: Number(kz.foerderungSumme ?? 0),
      endVorrat: Number(kz.endVorrat ?? 0), endNadelPct: Number(kz.endNadelPct ?? 0), endBaumarten: Number(kz.endBaumarten ?? 0),
      kahlMaxHa: Number(kz.kahlMaxHa ?? 0), nvAnteilPct: Number(kz.nvAnteilPct ?? 0), co2SaldoTHa: zahl(kz.co2SaldoTJeHa),
    },
    strategien: u.strategien.map((x: J) => ({ id: String(x.id), name: String(x.name), kurz: String(x.kurz ?? x.name), empfohlen: !!x.empfohlen, kapitalwert: p3(x.kapitalwert), grossschadenPct: Number(x.grossschadenPct ?? 0), endNadelPct: Number(x.endNadelPct ?? 0), nutzwert: Number(x.nutzwert ?? 0), verletzt: (x.verletzt ?? []).map(String) })),
    phasen: (u.phasen ?? []).map((x: J) => ({ id: String(x.id), name: String(x.name), von: Number(x.von), bis: Number(x.bis), ziel: String(x.ziel ?? '') })),
    massnahmen: (u.massnahmen ?? []).map((x: J) => ({ jahr: Number(x.jahr), phase: String(x.phase ?? ''), kategorie: String(x.kategorie ?? ''), text: String(x.text ?? ''), menge: zahl(x.menge), einheit: x.einheit ?? undefined, erloes: Number(x.erloes ?? 0), kosten: Number(x.kosten ?? 0), foerderung: Number(x.foerderung ?? 0) })),
    jahrzehnte: (u.jahrzehnte ?? []).map((x: J) => ({ von: Number(x.von), bis: Number(x.bis), efm: Number(x.efm ?? 0), pflanzen: Number(x.pflanzen ?? 0), erloes: Number(x.erloes ?? 0), kosten: Number(x.kosten ?? 0), foerderung: Number(x.foerderung ?? 0), cashflow: Number(x.cashflow ?? 0), vorratEnde: Number(x.vorratEnde ?? 0), nadelEnde: Number(x.nadelEnde ?? 0) })),
    verlauf: u.verlauf.map((x: J) => ({ jahr: Number(x.jahr), vorrat: Number(x.vorrat ?? 0), vorratP10: zahl(x.vorratP10), nadelPct: Number(x.nadelPct ?? 0), art: Object.fromEntries(Object.entries(x.art ?? {}).map(([a, v]) => [a, Number(v)])) })),
    offen: (u.offen ?? []).map((x: J) => ({ was: String(x.was), warum: String(x.warum ?? ''), dringlich: !!x.dringlich })),
  };
}

/** Bilder der Wachstumsreihe sind groß; für die Speicherung im Browser optional entfernen. */
export function ohneBilder(w: Wald): Wald {
  return { ...w, bestaende: w.bestaende.map((b) => (b.waldweg ? { ...b, waldweg: { ...b.waldweg, bildreihe: b.waldweg.bildreihe.map(({ bild: _b, ...r }) => r) } } : b)) };
}

