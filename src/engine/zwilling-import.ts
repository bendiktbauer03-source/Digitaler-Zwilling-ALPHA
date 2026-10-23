/**
 * Liest die Ausgabe der bestehenden Waldgrafen-Pipeline (neuer-zwilling.mjs → `wg-daten`)
 * und übersetzt sie in das gemeinsame Kernmodell. Die Fernerkundung, der ForestSimulator,
 * SorSim und HeProMo rechnen dort – hier wird daraus eine Entscheidungsgrundlage.
 *
 * Akzeptiert: das JSON selbst oder die komplette Zwillings-HTML-Datei
 * (dann wird der Block <script id="wg-daten"> herausgelöst). Alles bleibt im Browser.
 */
import type { Artgruppe, Bestand, Befund, Belastung, Bildstufe, Eignung, Ereignis, RoutenEingriff, Variante, Wald, Waldweg } from './modell';
import { artgruppeAusText, ART_TEXT } from './modell';
import type { Herkunft, Messwert } from './messwert';

// Die Pipeline-Ausgabe ist groß und wächst; wir lesen tolerant.
type J = any; // eslint-disable-line @typescript-eslint/no-explicit-any

export class ImportFehler extends Error {}

export function zwillingTextLesen(text: string): J {
  const t = text.trim();
  if (t.startsWith('{')) return JSON.parse(t);
  const m = t.match(/<script[^>]*id=["']wg-daten["'][^>]*>([\s\S]*?)<\/script>/);
  if (!m) throw new ImportFehler('In dieser Datei steckt kein Waldgrafen-Zwilling (Block „wg-daten“ fehlt).');
  return JSON.parse(m[1]);
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

function artenAus(b: J): { art: Artgruppe; pct: number }[] {
  const a = b.baumartenKarte?.anteile;
  if (Array.isArray(a) && a.length) {
    const m = new Map<Artgruppe, number>();
    for (const x of a) {
      const g = artgruppeAusText(x.gruppe ?? x.art);
      m.set(g, (m.get(g) ?? 0) + Number(x.pct ?? 0));
    }
    return [...m.entries()].map(([art, pct]) => ({ art, pct })).sort((x, y) => y.pct - x.pct);
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
    const arten = artenAus(b);
    const fuehrend = artgruppeAusText(b.alter?.artengruppe) !== 'sonstiges' ? artgruppeAusText(b.alter?.artengruppe) : arten[0].art;
    const sch = alterVon(id) ?? b.alter?.schaetzung;
    const vorrat: Messwert = {
      wert: Number(k.vfmProHa ?? b.vorratVfmProHa ?? 0),
      einheit: 'Vfm/ha',
      quelle: k.wege?.length ? `Konsens aus ${k.wege.length} Schätzwegen (${k.wege.map((w: J) => w.name).join(' · ')})` : 'Fernerkundung',
      herkunft: herkunft(k.herkunft ?? 'abgeleitet'),
      stand: d.kennzahlen?.erfasst,
      genauigkeitPct: zahl(k.genauigkeitPct),
      spanne: Array.isArray(k.spanneVfmProHa ?? b.spanneVfmProHa) ? (k.spanneVfmProHa ?? b.spanneVfmProHa) : undefined,
    };
    const ww = waldweg(wachstumListe.find((w) => w.teilId === id), d.wachstum);
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
      boden: bp ? { nfkMm: zahl(bp.nfkMm), text: bp.interpretation } : undefined,
      waldweg: ww,
      verjuengungMoeglich: arten.filter((a) => a.pct >= 10).map((a) => ART_TEXT[a.art]),
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
    tagebuch: (d.tagebuch ?? []).map((t: J) => ({ datum: String(t.datum), titel: String(t.titel), text: String(t.text ?? ''), bestand: t.bestand ?? undefined, quelle: t.quelle, sicherheit: t.sicherheit ?? 'belegt' })),
    profil: {
      besitzer: String(p.besitzer ?? d.betrieb.name ?? ''),
      kalkulationszins: zahl(p.kalkulationszins) ?? 0.015,
      gewichtWirtschaft: zahl(p.gewichtWirtschaft) ?? 0.6,
      verbiss: verbiss(p.verbiss),
      vorratMin: zahl(p.vorratMin), vorratMax: zahl(p.vorratMax),
      annahme: String(p._status ?? '').startsWith('ANNAHME') || !p.gespraechAm,
    },
    klima: kp ? {
      niederschlagMm: zahl(kp.jahresNiederschlagMm), temperaturC: zahl(kp.jahresMitteltemperaturC),
      verschiebungC: zahl(kp.verschiebung?.temperaturC), wasserbilanzSommerMm: zahl(kp.wasserbilanzSommerMm),
      text: kp.hinweis,
    } : undefined,
    foerderBezug: Object.fromEntries(Object.entries(d.foerderBezug ?? {}).filter(([, v]) => typeof v === 'string')) as Record<string, string>,
    kontakte: (d.kontakte ?? []).map((k: J) => ({ name: String(k.name), art: String(k.art ?? ''), notiz: k.notiz })),
    attribution: d.karte?.attribution,
  };
}

/** Bilder der Wachstumsreihe sind groß; für die Speicherung im Browser optional entfernen. */
export function ohneBilder(w: Wald): Wald {
  return { ...w, bestaende: w.bestaende.map((b) => (b.waldweg ? { ...b, waldweg: { ...b.waldweg, bildreihe: b.waldweg.bildreihe.map(({ bild: _b, ...r }) => r) } } : b)) };
}

