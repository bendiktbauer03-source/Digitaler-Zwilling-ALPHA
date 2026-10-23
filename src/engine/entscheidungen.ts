/**
 * Die Entscheidungs-Engine.
 *
 * Aus dem Zwilling werden die Entscheidungen abgeleitet, die jetzt anstehen – jede mit
 * berechneten Optionen, ihrer Wirkung, dem Datenstatus, Gründen, Risiken und Datenlage.
 * Reihenfolge: Dringlichkeit, dann der Geldbetrag, um den es geht.
 *
 * Regel: Reicht die Datenlage nicht, wird die Messung zur empfohlenen Option – und eine
 * Geldentscheidung auf „Noch zu prüfen“-Daten wird gesperrt statt schöngerechnet.
 */
import type { Annahmen } from './annahmen';
import { QUELLEN_ANNAHMEN } from './annahmen';
import { standardEntnahme, VERFAHREN_TEXT, zeitpunkteVergleichen } from './ernte';
import { schadenBis } from './finanzen';
import { euro, euroSpanne, ha as haText, pct, zahl } from './format';
import { FOERDERSTATUS_TEXT, foerderungPruefen } from './foerderung/pruefen';
import { WALDFOEPR_2025 } from './foerderung/regelpaket-by-waldfoepr-2025';
import { hash, type Massnahme, type Rechenlauf } from './fortschreibung';
import { kulturRechnen, standardMischung, type KulturEingabe, type Strategie } from './kultur';
import { genauigkeit, schwaechster, STATUS_TEXT, statusLabel, statusVon, type Datenstatus } from './messwert';
import { ART_TEXT, istNadel, type Bestand, type Dringlichkeit, type Umbauplan, type Wald } from './modell';
import { bestandWert } from './vermoegen';

export type EntscheidungsArt = 'schaden' | 'holzernte' | 'waldweg' | 'umbau' | 'kultur' | 'voranbau' | 'pflege' | 'messen';

export const ART_LABEL: Record<EntscheidungsArt, string> = {
  schaden: 'Waldschutz', holzernte: 'Holzernte', waldweg: 'Waldentwicklung', umbau: 'Umbauplan', kultur: 'Wiederbewaldung',
  voranbau: 'Waldumbau', pflege: 'Pflege', messen: 'Datenlage',
};

export interface Wirkung { label: string; wert: string; ton?: 'gut' | 'schlecht' }

export interface Option {
  id: string;
  marke: string;
  name: string;
  preis: string;
  wirkung: Wirkung[];
  zeilen: [string, string][];
  gesperrt?: string;
  /** Wird beim Beschluss als Maßnahme angelegt */
  massnahme?: Omit<Massnahme, 'id' | 'erstellt' | 'status' | 'entscheidungId'>;
  /** Weitere Maßnahmen desselben Beschlusses (z. B. das erste Jahr eines Umbauplans) */
  weitere?: Omit<Massnahme, 'id' | 'erstellt' | 'status' | 'entscheidungId'>[];
  /** Führt nach dem Beschluss in einen Arbeitsschritt (z. B. Messung) */
  ziel?: string;
}

export interface Entscheidung {
  id: string;
  art: EntscheidungsArt;
  kurz: string;
  ort: string;
  bild: string;
  titel: [string, string, string];
  satz: string;
  status: Datenstatus;
  statusText: string;
  statusErklaerung: string;
  fehlt?: string[];
  optionen: Option[];
  empfohlen: number;
  cta: string;
  gruende: string[];
  risiken: string[];
  datenlage: string[];
  dringlichkeit: Dringlichkeit;
  wertEuro: number;
  bestandId?: string;
  rechner?: string;
  rechenlauf: Omit<Rechenlauf, 'zeit'>;
}

export interface Kontext { wald: Wald; annahmen: Annahmen; heute?: Date }

const RANG: Record<Dringlichkeit, number> = { hoch: 0, mittel: 1, gering: 2, keine: 3 };
/** Bei gleicher Dringlichkeit: Was in Wochen verloren geht, vor dem, was in Monaten verloren geht. */
const ZEITKRITISCH: Record<EntscheidungsArt, number> = { schaden: 0, kultur: 1, umbau: 2, pflege: 2, messen: 3, holzernte: 3, voranbau: 4, waldweg: 4 };

const BILD = {
  schaden: 'bilder/kronendach.webp', holzernte: 'bilder/waldweg.webp', waldweg: 'bilder/hochwald.webp',
  umbau: 'bilder/hochwald.webp', kultur: 'bilder/stamm.webp', voranbau: 'bilder/hochwald.webp', pflege: 'bilder/stamm.webp', messen: 'bilder/nebel.webp',
} satisfies Record<EntscheidungsArt, string>;

function lauf(k: Kontext, eingaben: unknown, modelle: string[], regelpaket?: string): Omit<Rechenlauf, 'zeit'> {
  return { eingabenHash: hash({ eingaben, annahmen: k.annahmen }), modelle, annahmen: k.annahmen.version, regelpaket };
}

function haAusText(s?: string) {
  const m = s?.match(/(\d+(?:,\d+)?)\s*ha/);
  return m ? Number(m[1].replace(',', '.')) : undefined;
}

function nadelAnteil(b: Bestand) { return b.arten.filter((a) => istNadel(a.art)).reduce((s, a) => s + a.pct, 0); }

const stehend = (b: Bestand) => !b.kahlflaeche && !b.jungbestand && b.vorrat.wert >= 150;

/** Unter dieser Menge lohnt sich kein eigener Hieb: Ein Unternehmer kommt nicht für ein paar Festmeter. */
const MINDESTMENGE_EFM = 25;

/** Gehört der Bestand zu einem gerechneten Umbauplan? Dann entscheidet der Plan über Ernte und Verjüngung. */
function imPlan(k: Kontext, b: Bestand) {
  const u = k.wald.umbau;
  return !!u?.revier && b.revier === u.revier;
}

/** Mischung nach Standorteignung – mit den Wunschbaumarten des Eigentümers zuerst und ohne seine Tabus. */
function wunschMischung(k: Kontext, geeignet: string[]) {
  const tabu = (k.wald.profil.artenTabu ?? []).map((t) => t.toLowerCase());
  const erlaubt = (a: string) => !tabu.some((t) => a.toLowerCase().includes(t) || t.includes(a.toLowerCase()));
  return standardMischung([...(k.wald.profil.artenWunsch ?? []), ...geeignet].filter(erlaubt));
}

// ───────────────────────────── 1 · Schadverdacht ─────────────────────────────
function schaden(k: Kontext, b: Bestand, jahr: number): Entscheidung | null {
  const befund = b.befunde.find((x) => x.dringlichkeit === 'hoch' && /verdacht|käfer|schad|schäd|befall/i.test(x.befund));
  const ereignis = k.wald.ereignisse.find((e) => e.bestandId === b.id && !e.bestaetigt && !e.erholt && (e.jahr ?? jahr) >= jahr - 1);
  if (!befund && !ereignis) return null;
  const flaeche = Math.min(b.ha, ereignis?.ha ?? haAusText(befund?.wert) ?? Math.min(0.5, b.ha));
  const nadel = nadelAnteil(b);
  const kaefer = nadel >= 20;
  const bw = bestandWert(b, k.annahmen);
  const wertImBereich = bw.nettoJeVfm * b.vorrat.wert * flaeche;
  const verlust = Math.min(bw.holzwert, wertImBereich * k.annahmen.schadholzAbschlag * (kaefer ? 2 : 1));
  const gemeldet = !ereignis && /gemeldet/i.test(befund?.befund ?? '');
  const ort = `${b.label} · ${haText(flaeche)} Verdachtsfläche`;
  const begang = { art: 'begang' as const, bestandId: b.id, titel: `Verdachtsfläche ansehen · ${b.label}` };
  return {
    id: `schaden-${b.id}`,
    art: 'schaden',
    kurz: 'Verdacht ansehen',
    ort,
    bild: BILD.schaden,
    titel: ['Ein Verdacht im ', 'Kronendach.', ' Erst ansehen, dann handeln.'],
    satz: gemeldet
      ? `Sie haben in ${b.label} Schäden gesehen.${kaefer ? ' Ist es Käfer, entscheidet sich in Wochen, ob daraus ein Nest wird.' : ' Ein genauer Blick zeigt, was zu tun ist.'}`
      : `Auf rund ${haText(flaeche)} in ${b.label} ist die Vitalität eingebrochen. Die Folgesaison fehlt noch – es kann ein trockener Sommer gewesen sein.${kaefer ? ' Ist es Käfer, entscheidet sich in Wochen, ob daraus ein Nest wird.' : ''}`,
    status: 'pruefen',
    statusText: gemeldet ? 'Von Ihnen gemeldet' : 'Verdacht aus dem Satellitenbild',
    statusErklaerung: gemeldet ? 'Ihre Beobachtung. Umfang und Ursache klärt der Begang.' : 'Sentinel-2, Vitalität je 10-m-Zelle gegen den Bestand. Ein Verdacht ist keine Diagnose – erst der Begang bestätigt ihn.',
    optionen: [
      {
        id: 'selbst', marke: 'Empfohlen', name: 'Selbst ansehen, in 14 Tagen', preis: '≈ 2 Std. Begang',
        wirkung: [
          { label: 'Klarheit', wert: 'in 14 Tagen', ton: 'gut' },
          { label: 'Holzwert im Verdachtsbereich', wert: euro(wertImBereich) },
          { label: 'Kosten', wert: '0 €', ton: 'gut' },
        ],
        zeilen: [['Wo', b.mitte.lat ? `${b.label}, ${b.mitte.lat.toFixed(5)}, ${b.mitte.lon.toFixed(5)}` : b.label], ['Worauf achten', kaefer ? 'Bohrmehl, Harzfluss, braune Kronen' : 'lichte Kronen, Rindenschäden'], ['Danach', 'Befund hier eintragen']],
        massnahme: begang,
      },
      {
        id: 'beauftragen', marke: 'Begleitet', name: 'Begang durch Die Waldgrafen', preis: 'nach Angebot',
        wirkung: [
          { label: 'Klarheit', wert: 'in 7 Tagen', ton: 'gut' },
          { label: 'Ergebnis', wert: 'Bericht mit Karte' },
          { label: 'Sie', wert: 'müssen nichts tun', ton: 'gut' },
        ],
        zeilen: [['Umfang', 'Begang, Fotos, Befund'], ['Bei Befall', 'Aufarbeitung wird organisiert'], ['Termin', 'nach Absprache']],
        massnahme: { ...begang, titel: `Begang beauftragt · ${b.label}` },
      },
      {
        id: 'abwarten', marke: 'Abwarten', name: `Bis Sommer ${jahr + 1} beobachten`, preis: '0 €',
        wirkung: [
          { label: 'Möglicher Wertverlust', wert: euro(verlust), ton: 'schlecht' },
          { label: 'Risiko', wert: kaefer ? 'Käfernest möglich' : 'Schaden unklar', ton: 'schlecht' },
          { label: 'Klarheit', wert: `Sommer ${jahr + 1}` },
        ],
        zeilen: [['Hinweis', 'Satellit prüft im nächsten Sommer'], ['Bei Käfer', 'Ausbreitung ab April']],
      },
    ],
    empfohlen: 0,
    cta: 'Begang vormerken',
    gruende: [
      befund?.folge ?? 'Vitalitätseinbruch gegenüber dem eigenen Bestand.',
      `Im Verdachtsbereich stehen rund ${zahl(b.vorrat.wert * flaeche)} Vfm.`,
      kaefer ? `${pct(nadel)} Nadelholz – der Borkenkäfer ist die wahrscheinlichste Ursache.` : 'Überwiegend Laubholz – eher Trockenstress als Käfer.',
    ],
    risiken: ['Fehlalarm möglich: Ein trockener Sommer zeigt dasselbe Bild.', kaefer ? 'Ab dem Frühjahr kann sich ein Befall auf Nachbarbäume ausbreiten.' : 'Geschwächte Bäume werden später anfällig.'],
    datenlage: gemeldet ? ['Ihre Beobachtung', `Vorrat: ${statusLabel(b.vorrat)}`] : ['Sentinel-2, Vitalität je 10-m-Zelle', `Vorrat: ${statusLabel(b.vorrat)}`, 'Folgesaison noch nicht ausgewertet'],
    dringlichkeit: 'hoch',
    wertEuro: verlust,
    bestandId: b.id,
    rechenlauf: lauf(k, { b: b.id, flaeche, vorrat: b.vorrat.wert }, ['Waldgrafen-Vermögensmodell v1']),
  };
}

// ───────────────────────────── 2 · Holzernte ─────────────────────────────
function holzernte(k: Kontext, b: Bestand, jahr: number): Entscheidung | null {
  if (!stehend(b) || (b.bhdCm ?? 30) < 20) return null;
  const a = k.annahmen;
  const zins = k.wald.profil.kalkulationszins;
  const status = statusVon(b.vorrat);
  const g = genauigkeit(b.vorrat);
  const naechster = b.waldweg?.eingriffe.find((e) => e.jahr <= jahr + 1 && e.vfmProHa > 0);

  // Trügerisch stabile Bestände vertragen nur schwache Eingriffe – sonst droht Sturmwurf.
  const vorsicht = !!b.stabilitaet?.kritisch && !naechster;
  const entnahme = vorsicht ? Math.min(standardEntnahme(b), Math.max(20, Math.round((b.vorrat.wert * 0.1) / 5) * 5)) : naechster?.vfmProHa ?? standardEntnahme(b);
  const zp = zeitpunkteVergleichen({ bestand: b, entnahmeVfmHa: entnahme, annahmen: a }, zins, [0, 5]);
  const [jetzt, spaeter] = zp;
  const dbJetzt = naechster ? naechster.deckungsbeitragGesamt : jetzt.ergebnis.db;
  const efmJetzt = naechster ? naechster.efmGesamt : jetzt.ergebnis.efm;
  // Ein Eingriff, der Geld kostet, gehört zum Waldweg; unter einer Lkw-Ladung kommt kein Unternehmer.
  if (dbJetzt <= 0) return null;
  if (efmJetzt < MINDESTMENGE_EFM) return null;
  const kostenJeEfm = naechster ? (naechster.kostenHa * b.ha) / Math.max(1, naechster.efmGesamt) : jetzt.ergebnis.kostenJeEfm;
  // Liegt eine gerechnete Route vor, ist sie die Basis. Das eigene Modell liefert nur die
  // relative Veränderung durch Warten – so werden nie zwei Modelle direkt verglichen.
  const skala = naechster && jetzt.ergebnis.db > 0 ? dbJetzt / jetzt.ergebnis.db : 1;
  const kwJetzt = jetzt.kapitalwert * skala;
  const kwSpaeter = spaeter.kapitalwert * skala;
  const dbSpaeter = spaeter.erwarteterDb * skala;
  const spanne = naechster ? [dbJetzt * 0.85, dbJetzt * 1.15] : jetzt.ergebnis.dbSpanne;
  const sperre = status === 'pruefen' ? 'Ohne Messung geben wir keine Verkaufsempfehlung.' : undefined;
  const verfahren = naechster?.verfahren ?? VERFAHREN_TEXT[jetzt.ergebnis.verfahren];
  const titelArt = naechster?.art ?? (vorsicht ? 'Vorsichtige Auslese' : b.hiebsreife?.includes('Zielstärke') ? 'Zielstärkennutzung' : 'Durchforstung');
  const p = k.wald.profil;
  const zielVorrat = p.vorratMax && b.vorrat.wert > p.vorratMax * 1.15 ? `Ihr Zielvorrat liegt bei ${zahl(p.vorratMin ?? p.vorratMax)}–${zahl(p.vorratMax)} Vfm/ha, hier stehen ${zahl(b.vorrat.wert)}: Abbau über mehrere Eingriffe.` : undefined;

  const optionen: Option[] = [
    {
      id: 'jetzt', marke: 'Jetzt', name: `${titelArt}, ${zahl(entnahme)} Vfm/ha`, preis: euro(dbJetzt),
      wirkung: [
        { label: 'Deckungsbeitrag', wert: euro(dbJetzt), ton: dbJetzt > 0 ? 'gut' : 'schlecht' },
        { label: 'Holzmenge', wert: `${zahl(efmJetzt)} Efm` },
        { label: 'Erntekosten', wert: `${zahl(kostenJeEfm, 1)} €/Efm` },
      ],
      zeilen: [['Spanne', euroSpanne(spanne[0], spanne[1])], ['Verfahren', verfahren], ['Zeitraum', `Winter ${jahr}/${String(jahr + 1).slice(2)}`]],
      gesperrt: sperre,
      massnahme: { art: 'ernte', bestandId: b.id, titel: `${titelArt} · ${b.label}`, kostenRahmen: -dbJetzt, vfmProHa: entnahme },
    },
    {
      id: 'spaeter', marke: 'Warten', name: 'In fünf Jahren ernten', preis: euro(dbSpaeter),
      wirkung: [
        { label: 'Erwarteter Beitrag, inkl. Risiko', wert: euro(dbSpaeter), ton: kwSpaeter > kwJetzt ? 'gut' : undefined },
        { label: 'Schadrisiko bis dahin', wert: pct(spaeter.schadenWahrscheinlichkeit * 100), ton: spaeter.schadenWahrscheinlichkeit > 0.08 ? 'schlecht' : undefined },
        { label: `Heute bewertet (${pct(zins * 100, 1)})`, wert: euro(kwSpaeter) },
      ],
      zeilen: [['Grund', 'Stärkere Bäume, bessere Sortimente'], ['Dagegen', 'Länger im Sturm- und Käferrisiko'], ...(naechster ? [['Rechnung', 'Route als Basis, Veränderung aus dem Erntemodell'] as [string, string]] : [])],
      gesperrt: sperre,
      massnahme: { art: 'ernte', bestandId: b.id, titel: `Ernte ${jahr + 5} vorgemerkt · ${b.label}` },
    },
  ];
  if (status !== 'bestaetigt') {
    optionen.push({
      id: 'messen', marke: 'Empfohlen', name: 'Erst messen, dann verkaufen', preis: '≈ 30 Min. im Bestand',
      wirkung: [
        { label: 'Genauigkeit Vorrat', wert: `± ${Math.round(g ?? 30)} → ± 9 %`, ton: 'gut' },
        { label: 'Verhandlungsbasis', wert: 'belastbar', ton: 'gut' },
        { label: 'Kosten', wert: '0 €', ton: 'gut' },
      ],
      zeilen: [['Wie', 'Winkelzählprobe, 5 Punkte'], ['Werkzeug', 'Smartphone oder Relaskop'], ['Danach', 'Rechnung läuft neu']],
      ziel: `#/messen/${b.id}`,
      massnahme: { art: 'messung', bestandId: b.id, titel: `Winkelzählprobe · ${b.label}` },
    });
  }
  const empfohlen = status !== 'bestaetigt' ? 2 : kwSpaeter > kwJetzt * 1.05 ? 1 : 0;
  if (status === 'bestaetigt') optionen[empfohlen].marke = 'Empfohlen';

  const vergleich = kwSpaeter > kwJetzt
    ? `Warten bringt heute bewertet ${euro(kwSpaeter - kwJetzt)} mehr – trotz ${pct(spaeter.schadenWahrscheinlichkeit * 100)} Schadrisiko.`
    : `Jetzt zu ernten ist heute bewertet ${euro(kwJetzt - kwSpaeter)} mehr wert als zu warten.`;

  return {
    id: `ernte-${b.id}`,
    art: 'holzernte',
    kurz: 'Holzernte prüfen',
    ort: `${b.label} · ${haText(b.ha)} · ${b.fuehrendText}`,
    bild: BILD.holzernte,
    titel: ['Lohnt sich die ', 'Holzernte', ` in ${b.label}?`],
    satz: `${b.hiebsreife ? b.hiebsreife + '. ' : ''}${naechster ? `Der gerechnete Plan sieht ${jahr <= naechster.jahr ? naechster.jahr : 'jetzt'} vor: ${naechster.art}.` : `Gerechnet mit ${zahl(entnahme)} Vfm/ha Entnahme.`} ${vergleich}`,
    status,
    statusText: statusLabel(b.vorrat),
    statusErklaerung: `${b.vorrat.quelle}. Für eine Verkaufsentscheidung rechnen wir ab ± 10 % mit „bestätigt“.`,
    fehlt: status === 'pruefen' ? ['Winkelzählprobe im Bestand (≈ 30 Min.)'] : undefined,
    optionen,
    empfohlen,
    cta: empfohlen === 2 ? 'Messung starten' : empfohlen === 0 ? 'Angebot anfordern' : 'Vormerken',
    gruende: [
      ...(vorsicht ? [`Nur ${zahl(entnahme)} Vfm/ha: Der Bestand ist ${b.stabilitaet!.stufe} (h/d ${zahl(b.stabilitaet!.hd ?? 0)}, grüne Krone ${zahl(b.stabilitaet!.kronePct ?? 0)} %).`] : []),
      ...(zielVorrat ? [zielVorrat] : []),
      ...(naechster?.begruendung.slice(0, 3) ?? [
        `Vorrat ${zahl(b.vorrat.wert)} Vfm/ha, mittlerer BHD ${zahl(b.bhdCm ?? 0)} cm.`,
        `Stückmasse ≈ ${zahl(jetzt.ergebnis.stueckmasseEfm, 2)} Efm je Baum – davon hängen die Kosten ab.`,
        vergleich,
      ]),
    ].slice(0, 4),
    risiken: [
      ...(b.stabilitaet?.kritisch ? [b.stabilitaet.folge] : []),
      ...jetzt.ergebnis.hinweise,
      'Holzpreise schwanken: ± 12 % Preis verschiebt den Beitrag spürbar.',
      ...(status !== 'bestaetigt' ? [`Vorrat nur ${STATUS_TEXT[status].toLowerCase()} (± ${Math.round(g ?? 0)} %).`] : []),
    ],
    datenlage: [
      `Vorrat: ${b.vorrat.quelle}`,
      naechster ? `Erlös und Kosten: ${b.waldweg?.quellen.sortierung ?? 'Sortierung der Route'} · ${b.waldweg?.quellen.erntekosten ?? ''}` : jetzt.ergebnis.modell,
      `Annahmen ${a.version}: ${QUELLEN_ANNAHMEN[0]}`,
    ],
    dringlichkeit: naechster || b.hiebsreife?.includes('Zielstärke') ? 'mittel' : 'gering',
    wertEuro: Math.max(dbJetzt, dbSpaeter),
    bestandId: b.id,
    rechner: `#/ernte/${b.id}`,
    rechenlauf: lauf(k, { b: b.id, entnahme, vorrat: b.vorrat }, [naechster ? `${b.waldweg?.modell} (Route)` : jetzt.ergebnis.modell]),
  };
}

// ───────────────────────────── 3 · Waldentwicklung ─────────────────────────────
function kurzText(t: string) {
  const s = t.replace(/^[A-Z]\d*\s*·\s*/, '').split(/,\s*(?=[A-ZÄÖÜa-z])/)[0].split(' (')[0].replace(/^nur /, '');
  return s.length > 60 ? `${s.slice(0, 58).replace(/\s+\S*$/, '')} …` : s;
}

function waldweg(k: Kontext, b: Bestand, jahr: number): Entscheidung | null {
  const w = b.waldweg;
  if (!w || w.varianten.length < 2) return null;
  const sieger = w.varianten.find((v) => v.id === w.siegerId) ?? w.varianten[0];
  const referenz = w.varianten.find((v) => v.id === 'nichtstun');
  const alternative = w.varianten.find((v) => v !== sieger && v !== referenz);
  const varianten = [sieger, alternative, referenz].filter(Boolean) as typeof w.varianten;
  const pfad = (v: Record<string, number>) => v['RCP4.5'] ?? Object.values(v)[0] ?? 0;
  const hart = (v: Record<string, number>) => v['RCP8.5'] ?? Object.values(v).at(-1) ?? 0;
  const status = schwaechster(statusVon(b.vorrat), 'geschaetzt');
  const e0 = w.eingriffe[0];
  // Gibt es einen wirtschaftlich stärkeren Weg, den der Optimierer wegen der Ziele verworfen hat?
  const reicher = varianten.filter((v) => v !== sieger).sort((x, y) => pfad(y.kapitalwertHa) - pfad(x.kapitalwertHa))[0];
  const robustester = [...w.varianten].sort((x, y) => y.robust - x.robust)[0];
  const abwaegung = reicher && pfad(reicher.kapitalwertHa) > pfad(sieger.kapitalwertHa)
    ? ` „${reicher === referenz ? 'Nichts tun' : kurzText(reicher.text)}“ brächte heute bewertet ${euro((pfad(reicher.kapitalwertHa) - pfad(sieger.kapitalwertHa)) * b.ha)} mehr, verfehlt aber Ihr Waldziel (Ökologie ${pfad(reicher.oekologie)} statt ${pfad(sieger.oekologie)} von 100).`
    : '';
  const kern = robustester === sieger
    ? `„${kurzText(sieger.text)}“ ist am robustesten: ${sieger.robust} von 100 Punkten, im ungünstigsten Pfad noch ${sieger.schlechtester}.`
    : `Der Optimierer empfiehlt „${kurzText(sieger.text)}“ – er erfüllt Ihre Ziele für Mischung und Vorrat am besten.`;

  const optionen: Option[] = varianten.map((v, i) => ({
    id: v.id,
    marke: i === 0 ? 'Empfohlen' : v === referenz ? 'Referenz' : 'Alternative',
    name: v === referenz ? 'Nichts tun' : kurzText(v.text),
    preis: `KW ${euro(pfad(v.kapitalwertHa) * b.ha)}`,
    wirkung: [
      { label: 'Kapitalwert (mittlerer Klimapfad)', wert: euro(pfad(v.kapitalwertHa) * b.ha) },
      { label: 'Robust über drei Klimapfade', wert: `${v.robust} / 100`, ton: v.robust >= 80 ? 'gut' : v.robust < 55 ? 'schlecht' : undefined },
      { label: 'Ökologie', wert: `${pfad(v.oekologie)} / 100`, ton: pfad(v.oekologie) >= 80 ? 'gut' : pfad(v.oekologie) < 55 ? 'schlecht' : undefined },
    ],
    zeilen: i === 0 && e0
      ? [['Erster Schritt', `${e0.jahr} · ${e0.art}`], ['Zielwald', w.zielwald ? `${w.zielwald.jahr}: ${w.zielwald.anteile.slice(0, 3).map((x) => `${x.art} ${x.pct} %`).join(', ')}` : '–'], ['Schadholz (heißer Pfad)', `${zahl(hart(v.kalamitaetVfm))} Vfm/ha`]]
      : [['Schadholz (heißer Pfad)', `${zahl(hart(v.kalamitaetVfm))} Vfm/ha`], ['Vorrat am Ende', `${zahl(pfad(v.vorratEnde))} Vfm/ha`], ['Ungünstigster Pfad', `${v.schlechtester} / 100`]],
    massnahme: i === 0 && e0 ? { art: e0.vfmProHa > 0 ? 'ernte' : 'kultur', bestandId: b.id, titel: `${e0.art} · ${b.label}`, vfmProHa: e0.vfmProHa || undefined } : undefined,
  }));

  return {
    id: `weg-${b.id}`,
    art: 'waldweg',
    kurz: 'Waldweg festlegen',
    ort: `${b.label} · ${haText(b.ha)} · ${w.modell}`,
    bild: BILD.waldweg,
    titel: ['Welcher Weg trägt ', `${w.jahre} Jahre?`, ''],
    satz: `${w.varianten.length} Bewirtschaftungswege, je drei Klimapfade. ${kern}${abwaegung}`,
    status,
    statusText: status === 'pruefen' ? statusLabel(b.vorrat) : 'Modell geschätzt',
    statusErklaerung: `Wachstum: ${w.quellen.wachstum ?? w.modell}. Startvorrat: ${statusLabel(b.vorrat)}.`,
    optionen,
    empfohlen: 0,
    cta: 'Weg festlegen',
    gruende: e0?.begruendung.slice(0, 3).length ? e0.begruendung.slice(0, 3) : [w.gewichtung],
    risiken: [
      referenz ? `Ohne Eingriff im heißen Pfad ${zahl(hart(referenz.kalamitaetVfm))} Vfm/ha Schadholz.` : 'Klimapfade streuen stark.',
      'Wachstumsmodelle gelten in ihrem Kalibrierbereich – Mischbestände und Naturverjüngung sind unsicherer.',
      ...(status === 'pruefen' ? ['Startvorrat noch zu prüfen.'] : []),
    ],
    datenlage: [
      ...Object.entries(w.quellen).map(([k2, v]) => `${k2[0].toUpperCase()}${k2.slice(1)}: ${v}`).slice(0, 3),
      'Kapitalwerte je ha aus der Optimierung, auf die Bestandesfläche hochgerechnet.',
    ],
    dringlichkeit: e0 && e0.jahr <= jahr + 1 ? 'mittel' : 'gering',
    wertEuro: Math.abs(pfad(sieger.kapitalwertHa) - (referenz ? pfad(referenz.kapitalwertHa) : 0)) * b.ha,
    bestandId: b.id,
    rechner: `#/zukunft/${b.id}`,
    rechenlauf: lauf(k, { b: b.id, sieger: sieger.id }, [w.modell]),
  };
}

// ───────────────────────────── 4 · Wiederbewaldung ─────────────────────────────
function kulturEingabe(k: Kontext, b: Bestand, ha: number, extra: Partial<KulturEingabe> = {}): KulturEingabe {
  const geeignet = b.eignung.filter((e) => e.heute === 'gut' && e.entwicklung !== 'schlechter').map((e) => e.art);
  return {
    ha,
    bundesland: k.wald.betrieb.bundesland,
    verbiss: k.wald.profil.verbiss,
    schutz: k.wald.profil.verbiss === 'hoch' ? 'zaun' : 'einzelschutz',
    mischung: wunschMischung(k, geeignet),
    nvMoeglich: (b.verjuengungMoeglich?.length ?? 0) > 0,
    nvAnteil: 0.5,
    zins: k.wald.profil.kalkulationszins,
    annahmen: k.annahmen,
    ...extra,
  };
}

function kulturOption(r: ReturnType<typeof kulturRechnen>, marke: string, b: Bestand): Option {
  const f = r.foerderung;
  return {
    id: r.strategie,
    marke,
    name: r.titel,
    preis: euro(r.investition),
    wirkung: [
      { label: 'Ihr Eigenanteil (5 Jahre)', wert: euro(r.eigenanteil[1]) },
      { label: 'Förderung', wert: f.betrag > 0 ? euro(f.betrag) : FOERDERSTATUS_TEXT[f.status], ton: f.betrag > 0 ? 'gut' : undefined },
      { label: r.pflanzen > 0 ? 'Ausfall (mittleres Szenario)' : 'Nachpflanzbedarf (mittel)', wert: pct(r.ausfall[1] * 100), ton: r.ausfall[1] >= 0.35 ? 'schlecht' : undefined },
    ],
    zeilen: [
      ['Eigenanteil Spanne', euroSpanne(r.eigenanteil[0], r.eigenanteil[2])],
      ['Pflanzen', r.pflanzen > 0 ? `${zahl(r.pflanzen)} Stk.` : 'aus Naturverjüngung'],
      ['Beginn', f.betrag > 0 || f.posten.length ? 'erst nach Bewilligung' : 'Herbst oder Frühjahr'],
    ],
    gesperrt: r.gesperrt,
    massnahme: { art: 'kultur', bestandId: b.id, titel: `${r.titel} · ${b.label}`, kostenRahmen: Math.round(r.kosten[1]), foerderung: Math.round(f.betrag), erstNachBewilligung: f.posten.length > 0 },
  };
}

function wiederbewaldung(k: Kontext, b: Bestand): Entscheidung | null {
  if (!b.kahlflaeche) return null;
  const e = kulturEingabe(k, b, b.ha);
  const strategien: Strategie[] = ['naturverjuengung', 'pflanzung', 'kombination'];
  const r = strategien.map((s) => kulturRechnen(s, e));
  const empfohlen = !e.nvMoeglich ? 1 : e.verbiss === 'gering' ? 0 : 2;
  const opt = r.map((x, i) => kulturOption(x, i === empfohlen ? 'Empfohlen' : x.strategie === 'naturverjuengung' ? 'Sparsam' : x.strategie === 'pflanzung' ? 'Gezielt' : 'Kombiniert', b));
  const best = r[empfohlen];
  return {
    id: `kultur-${b.id}`,
    art: 'kultur',
    kurz: 'Fläche wiederbewalden',
    ort: `${b.label} · ${haText(b.ha)} Freifläche`,
    bild: BILD.kultur,
    titel: ['Was soll hier ', 'in 30 Jahren', ' stehen?'],
    satz: `Drei Wege für ${haText(b.ha)}: Naturverjüngung, Pflanzung oder beides. ${e.nvMoeglich ? `Samenbäume von ${b.verjuengungMoeglich!.join(', ')} stehen in der Nähe.` : 'Samenbäume fehlen – ohne Pflanzung bleibt die Fläche lange offen.'} Verbiss ist ${e.verbiss}.`,
    status: k.wald.profil.annahme ? 'geschaetzt' : 'bestaetigt',
    statusText: 'Kosten aus Richtwerten',
    statusErklaerung: `Pflanzen- und Arbeitskosten: Annahmen ${k.annahmen.version}. Förderung: ${WALDFOEPR_2025.programm}, Regelpaket ${WALDFOEPR_2025.version}.`,
    fehlt: e.nvMoeglich ? ['Verjüngungsaufnahme vor Ort: Was wächst schon?'] : undefined,
    optionen: opt,
    empfohlen,
    cta: 'Förderantrag vorbereiten',
    gruende: [...best.vorteile, `Mischung: ${e.mischung.map((m) => `${m.art[0].toUpperCase()}${m.art.slice(1)} ${m.anteil} %`).join(', ')} – nach Standorteignung.`],
    risiken: [...best.risiken, 'Ausfälle sind Szenarien, keine Prognose – regionale Erfahrung fehlt noch.'],
    datenlage: [`Standorteignung: ${b.eignung.length ? 'Eignungsansprache des Zwillings' : 'nicht hinterlegt'}`, `Regelpaket ${WALDFOEPR_2025.version}`, QUELLEN_ANNAHMEN[2]],
    dringlichkeit: 'hoch',
    wertEuro: best.kosten[1],
    bestandId: b.id,
    rechner: `#/zukunft/${b.id}`,
    rechenlauf: lauf(k, { b: b.id, e: { ...e, annahmen: undefined } }, ['Waldgrafen-Kulturmodell v1'], WALDFOEPR_2025.version),
  };
}

// ───────────────────────────── 5 · Voranbau ─────────────────────────────
const fichteAnteil = (b: Bestand) => b.arten.filter((a) => a.art === 'fichte').reduce((s, a) => s + a.pct, 0);

function voranbauKandidat(k: Kontext, b: Bestand) {
  if (!stehend(b) || b.waldweg || imPlan(k, b)) return false;
  const fi = b.eignung.find((e) => /fichte/i.test(e.art));
  return fichteAnteil(b) >= 50 && nadelAnteil(b) >= 70 && fi?.entwicklung === 'schlechter';
}

/** Voranbau je Revier: Kleine Flurstücke nebeneinander werden in einem Zug bepflanzt. */
function voranbau(k: Kontext, gruppe: Bestand[]): Entscheidung | null {
  if (!gruppe.length) return null;
  const b = [...gruppe].sort((x, y) => y.ha - x.ha)[0];
  const ha = gruppe.reduce((s, x) => s + x.ha, 0);
  const fi = b.eignung.find((e) => /fichte/i.test(e.art));
  const fichte = Math.round(gruppe.reduce((s, x) => s + fichteAnteil(x) * x.ha, 0) / ha);
  const vHa = Math.round(ha * 0.3 * 100) / 100;
  const geeignet = b.eignung.filter((e) => e.heute === 'gut' && e.entwicklung !== 'schlechter').map((e) => e.art);
  const wunsch = wunschMischung(k, ['tanne', 'buche', ...geeignet]).filter((m) => m.art !== 'fichte').slice(0, 2);
  const e = kulturEingabe(k, b, vHa, {
    voranbau: true,
    schutz: 'einzelschutz',
    mischung: wunsch.length === 2 ? [{ ...wunsch[0], anteil: 60, stkProHa: 2000 }, { ...wunsch[1], anteil: 40, stkProHa: 3000 }] : [{ art: 'tanne', anteil: 60, stkProHa: 2000 }, { art: 'buche', anteil: 40, stkProHa: 3000 }],
  });
  const artenText = e.mischung.map((m) => ART_TEXT[m.art as keyof typeof ART_TEXT] ?? m.art).join('/');
  const r = kulturRechnen('pflanzung', e);
  const bw = gruppe.reduce((s, x) => s + bestandWert(x, k.annahmen).holzwert, 0);
  const p = k.annahmen.schadrisiko.schlechter;
  const risiko10 = bw * schadenBis(10, p) * k.annahmen.schadholzAbschlag;
  const ort = gruppe.length > 1 ? `${b.revier ?? b.label} · ${gruppe.length} Flurstücke · ${haText(ha)}` : `${b.label} · ${pct(fichte)} Fichte`;
  const nass = gruppe.find((x) => /oberflächennah|< ?1[0-3] dm|grundwassernah/i.test(x.boden?.grundwasser ?? ''));
  const foto = k.wald.fotos?.find((f) => f.revier === b.revier);
  const opt: Option[] = [
    {
      id: 'aelf', marke: 'Empfohlen', name: 'Begang mit dem AELF, dann Voranbau beantragen', preis: '0 € Beratung',
      wirkung: [
        { label: 'Klarheit über Baumarten', wert: 'nach dem Begang', ton: 'gut' },
        { label: 'Kosten Beratung', wert: '0 €', ton: 'gut' },
        { label: 'Voranbau danach', wert: euro(r.investition) },
      ],
      zeilen: [['Wer', 'Revierleiter am AELF'], ['Was', 'Voranbaufläche, Baumarten, Förderweg'], ['Danach', 'Antrag vor Beginn']],
      massnahme: { art: 'foerderung', bestandId: b.id, titel: `Begang mit AELF vereinbaren · ${b.label}`, erstNachBewilligung: true },
    },
    { ...kulturOption(r, 'Direkt', b), name: `Voranbau ${artenText} auf ${haText(vHa)}` },
    {
      id: 'abwarten', marke: 'Abwarten', name: 'Nur Käferkontrolle', preis: '0 €',
      wirkung: [
        { label: 'Erwarteter Schaden in 10 J.', wert: euro(risiko10), ton: 'schlecht' },
        { label: 'Zweite Schicht', wert: 'fehlt', ton: 'schlecht' },
        { label: 'Kosten heute', wert: '0 €' },
      ],
      zeilen: [['Käferkontrolle', 'April bis September, alle 2–3 Wochen'], ['Risiko', 'Kahlfläche nach Sturm oder Käfer']],
    },
  ];
  return {
    id: `voranbau-${gruppe.length > 1 ? (b.revier ?? b.id).toLowerCase().replace(/[^a-z0-9]+/g, '-') : b.id}`,
    art: 'voranbau',
    kurz: 'Zweite Schicht anlegen',
    ort,
    bild: BILD.voranbau,
    titel: ['Unter die Fichte eine ', 'zweite Schicht', ' bringen.'],
    satz: `Die Fichte trägt hier Wert und Risiko zugleich. Ein Voranbau mit ${artenText.replace('/', ' und ')} auf rund ${haText(vHa)} steht bereit, wenn oben etwas ausfällt.${gruppe.length > 1 ? ` Die ${gruppe.length} Flurstücke liegen beieinander – ein Antrag, ein Pflanztrupp.` : ''} ${fi?.hinweis ?? ''}`.trim(),
    status: schwaechster(statusVon(b.vorrat), 'geschaetzt'),
    statusText: 'Eignung abgeleitet',
    statusErklaerung: `Baumarteneignung aus Standort und Klimaverschiebung; Kosten aus Richtwerten ${k.annahmen.version}.`,
    optionen: opt,
    empfohlen: 0,
    cta: 'Begang anfragen',
    gruende: [
      ...(foto ? [`Ihr Foto vom ${foto.datum.split('-').reverse().join('.')}: ${foto.kurz}.`] : []),
      ...(nass ? [`Grundwassernah (${nass.label}): Die Fichte wurzelt hier flach – Tanne und Buche halten den Boden tiefer.`] : []),
      ...(fi?.gruende.slice(0, 2) ?? []),
      ...(k.wald.profil.artenWunsch?.length ? [`Baumarten nach Ihrem Wunsch: ${k.wald.profil.artenWunsch.join(', ')}.`] : []),
      `Erwarteter Schaden ohne zweite Schicht in zehn Jahren ≈ ${euro(risiko10, false)}.`,
    ].slice(0, 4),
    risiken: [...(b.stabilitaet?.kritisch ? ['Zum Auflichten nur behutsam eingreifen: ' + b.stabilitaet.folge] : []), 'Tanne braucht Schutz vor Verbiss', 'Voranbau-Satz der WALDFÖPR vor Antrag prüfen'],
    datenlage: ['Eignungsansprache je Baumart', `Holzwert: ${statusLabel(b.vorrat)}`, `Regelpaket ${WALDFOEPR_2025.version}`],
    dringlichkeit: 'mittel',
    wertEuro: risiko10,
    bestandId: b.id,
    rechner: `#/zukunft/${b.id}`,
    rechenlauf: lauf(k, { b: gruppe.map((x) => x.id), vHa }, ['Waldgrafen-Kulturmodell v1', 'Waldgrafen-Vermögensmodell v1'], WALDFOEPR_2025.version),
  };
}

// ───────────────────────────── 6 · Jungbestandspflege ─────────────────────────────
function pflege(k: Kontext, b: Bestand): Entscheidung | null {
  const jungwuchs = !!b.jungbestand && b.jungbestand.hoeheM <= 15;
  // Junge Stangenhölzer mit vielen Stämmen: Jetzt entscheidet die Auslese der Zukunftsbäume.
  const auslese = !jungwuchs && !b.kahlflaeche && !!b.alter && b.alter.bis <= 45 && (b.stammzahlProHa ?? 0) >= 250;
  if (!jungwuchs && !auslese) return null;
  if (auslese) return zukunftsbaeume(k, b);
  const kosten = k.annahmen.kultur.jungbestandspflegeHa * b.ha;
  const f = foerderungPruefen({ bundesland: k.wald.betrieb.bundesland, jungbestand: { ha: b.ha, hoeheM: b.jungbestand!.hoeheM } });
  return {
    id: `pflege-${b.id}`,
    art: 'pflege',
    kurz: 'Jungbestand pflegen',
    ort: `${b.label} · ${haText(b.ha)} · ${zahl(b.jungbestand!.hoeheM)} m hoch`,
    bild: BILD.pflege,
    titel: ['Jetzt die ', 'Mischung sichern', ', solange es wenig kostet.'],
    satz: `Im Jungbestand entscheidet sich, welche Baumarten durchkommen. Eine Pflege jetzt sichert die Mischung und kostet einen Bruchteil späterer Korrekturen.`,
    status: 'geschaetzt',
    statusText: 'Kosten aus Richtwerten',
    statusErklaerung: `Pflegekosten: Annahme ${zahl(k.annahmen.kultur.jungbestandspflegeHa)} €/ha. Förderung nach Regelpaket ${WALDFOEPR_2025.version}.`,
    optionen: [
      {
        id: 'foerdern', marke: 'Empfohlen', name: 'Pflege mit Förderung', preis: euro(kosten),
        wirkung: [
          { label: 'Förderung', wert: f.betrag > 0 ? euro(f.betrag) : FOERDERSTATUS_TEXT[f.status], ton: f.betrag > 0 ? 'gut' : undefined },
          { label: 'Ihr Eigenanteil', wert: euro(Math.max(0, kosten - f.betrag)) },
          { label: 'Mischung', wert: 'gesichert', ton: 'gut' },
        ],
        zeilen: [['Beginn', 'erst nach Bewilligung'], ['Bagatellgrenze', '300 €'], ['Bindefrist', 'keine']],
        massnahme: { art: 'pflege', bestandId: b.id, titel: `Jungbestandspflege · ${b.label}`, kostenRahmen: Math.round(kosten), foerderung: Math.round(f.betrag), erstNachBewilligung: true },
      },
      {
        id: 'selbst', marke: 'Eigenleistung', name: 'Selbst pflegen', preis: '≈ 2–3 Tage/ha',
        wirkung: [
          { label: 'Kosten', wert: 'Ihre Zeit' },
          { label: 'Förderung', wert: 'mit AELF klären' },
          { label: 'Mischung', wert: 'gesichert', ton: 'gut' },
        ],
        zeilen: [['Werkzeug', 'Freischneider, Handsäge'], ['Anleitung', 'beim AELF oder den Waldgrafen']],
        massnahme: { art: 'pflege', bestandId: b.id, titel: `Jungbestandspflege in Eigenleistung · ${b.label}` },
      },
      {
        id: 'spaeter', marke: 'Aufschieben', name: 'In drei Jahren', preis: 'höher',
        wirkung: [
          { label: 'Mischbaumarten', wert: 'gehen verloren', ton: 'schlecht' },
          { label: 'Kosten später', wert: 'steigen', ton: 'schlecht' },
          { label: 'Förderstufe', wert: 'evtl. höher' },
        ],
        zeilen: [['Risiko', 'Buche dunkelt Tanne und Eiche aus']],
      },
    ],
    empfohlen: 0,
    cta: 'Antrag vorbereiten',
    gruende: ['Pflege im Jungbestand ist die günstigste Mischungsregulierung.', ...f.posten.map((p) => `${p.titel}: ${zahl(p.satz ?? 0)} €/ha`)],
    risiken: f.hinweise.slice(0, 3),
    datenlage: [`Höhe ${zahl(b.jungbestand!.hoeheM)} m aus Fernerkundung`, ...f.quellen.map((q) => q.titel)],
    dringlichkeit: 'mittel',
    wertEuro: kosten,
    bestandId: b.id,
    rechenlauf: lauf(k, { b: b.id, kosten }, ['Regelpaket'], WALDFOEPR_2025.version),
  };
}

function zukunftsbaeume(k: Kontext, b: Bestand): Entscheidung {
  const hoehe = b.hoeheM ?? 16;
  const kosten = k.annahmen.kultur.jungbestandspflegeHa * b.ha;
  const f = foerderungPruefen({ bundesland: k.wald.betrieb.bundesland, jungbestand: { ha: b.ha, hoeheM: hoehe } });
  const befund = b.befunde.find((x) => /zukunftsb|stammzahl|auslese/i.test(`${x.befund} ${x.folge ?? ''}`));
  const foto = k.wald.fotos?.find((x) => x.revier === b.revier);
  const gewerk = k.wald.gewerke?.find((g) => g.id === 'auslese');
  const warnungen = b.befunde.filter((x) => x !== befund && /boden|torf|schad|esche|wind/i.test(`${x.befund} ${x.wert ?? ''}`)).map((x) => `${x.befund}: ${x.folge ?? x.wert ?? ''}`.trim());
  const zBaeume = Math.round(b.ha * 100);
  return {
    id: `pflege-${b.id}`,
    art: 'pflege',
    kurz: 'Zukunftsbäume wählen',
    ort: `${b.label} · ${haText(b.ha)} · ${b.alter!.text}`,
    bild: BILD.pflege,
    titel: ['Jetzt die ', 'Zukunftsbäume', ' wählen.'],
    satz: `${zahl(b.stammzahlProHa ?? 0)} Stämme je Hektar teilen sich das Licht. Wer jetzt 80 bis 120 gute Bäume je Hektar auswählt und freistellt, lenkt den Zuwachs der nächsten Jahrzehnte in wertvolles Holz.${gewerk ? ` ${gewerk.wann[0].toUpperCase()}${gewerk.wann.slice(1)}.` : ''}`,
    status: schwaechster(statusVon(b.vorrat), 'geschaetzt'),
    statusText: foto ? 'Foto und Fernerkundung' : 'Aus Fernerkundung',
    statusErklaerung: `Stammzahl und Höhe aus dem Laserscan${foto ? `, Baumarten und Zustand aus Ihrem Foto vom ${foto.datum.split('-').reverse().join('.')}` : ''}. Pflegekosten aus Richtwerten ${k.annahmen.version}.`,
    fehlt: b.eigentuemer && /esche/i.test(b.eigentuemer) ? ['Beim Auszeichnen: Esche mit Triebsterben nicht als Zukunftsbaum wählen'] : undefined,
    optionen: [
      {
        id: 'selbst', marke: 'Empfohlen', name: 'Selbst auszeichnen, Unternehmer pflegt', preis: euro(kosten * 0.8),
        wirkung: [
          { label: 'Zukunftsbäume', wert: `≈ ${zahl(zBaeume)} Stück`, ton: 'gut' },
          { label: 'Förderung', wert: f.betrag > 0 ? euro(f.betrag) : hoehe > 15 ? 'über 15 m nicht mehr' : FOERDERSTATUS_TEXT[f.status], ton: f.betrag > 0 ? 'gut' : undefined },
          { label: 'Ihr Eigenanteil', wert: euro(Math.max(0, kosten * 0.8 - f.betrag)) },
        ],
        zeilen: [['Sie', 'Zukunftsbäume mit Band markieren (≈ 1 Tag)'], ['Unternehmer', 'Bedränger entnehmen'], ['Beginn', f.betrag > 0 ? 'erst nach Bewilligung' : 'Herbst bis Frühjahr']],
        massnahme: { art: 'pflege', bestandId: b.id, titel: `Zukunftsbäume auszeichnen und freistellen · ${b.label}`, kostenRahmen: Math.round(kosten * 0.8), foerderung: Math.round(f.betrag), erstNachBewilligung: f.betrag > 0 },
      },
      {
        id: 'unternehmer', marke: 'Begleitet', name: 'Auslese komplett vergeben', preis: euro(kosten),
        wirkung: [
          { label: 'Zukunftsbäume', wert: `≈ ${zahl(zBaeume)} Stück`, ton: 'gut' },
          { label: 'Förderung', wert: f.betrag > 0 ? euro(f.betrag) : '—' },
          { label: 'Sie', wert: 'müssen nichts tun', ton: 'gut' },
        ],
        zeilen: [['Worauf achten', gewerk?.kriterien[0] ?? 'Erfahrung mit Laubholz'], ['Kosten', 'Richtwert, Angebot einholen']],
        massnahme: { art: 'pflege', bestandId: b.id, titel: `Auslese beauftragen · ${b.label}`, kostenRahmen: Math.round(kosten), foerderung: Math.round(f.betrag), erstNachBewilligung: f.betrag > 0 },
      },
      {
        id: 'spaeter', marke: 'Aufschieben', name: 'In fünf Jahren', preis: '0 € heute',
        wirkung: [
          { label: 'Kronen', wert: 'werden kürzer', ton: 'schlecht' },
          { label: 'Stabilität', wert: 'sinkt', ton: 'schlecht' },
          { label: 'Förderung', wert: 'entfällt wohl', ton: 'schlecht' },
        ],
        zeilen: [['Risiko', 'Schlanke Stämme, später Wind- und Schneebruch']],
      },
    ],
    empfohlen: 0,
    cta: 'Auslese planen',
    gruende: [
      ...(befund?.folge ? [befund.folge] : []),
      ...(foto ? [`Ihr Foto: ${foto.kurz}.`] : []),
      ...(foto?.befund.some((x) => /markier|auszeichn/i.test(x)) ? ['Auf dem Foto sind schon Markierungen zu sehen – die Auszeichnung hat offenbar begonnen. Vor der Vergabe prüfen, was schon steht.'] : []),
      `${zahl(b.stammzahlProHa ?? 0)} Stämme/ha bei ${b.alter!.text} – der Kronenschluss ist erreicht.`,
      ...f.posten.map((x) => `${x.titel}: ${zahl(x.satz ?? 0)} €/ha`),
    ].slice(0, 4),
    risiken: [...warnungen, ...f.hinweise].slice(0, 4),
    datenlage: [`Stammzahl ${zahl(b.stammzahlProHa ?? 0)}/ha und Höhe ${zahl(hoehe, 1)} m aus dem Laserscan`, ...(foto ? [`Foto des Eigentümers, ${foto.datum.split('-').reverse().join('.')}`] : []), ...f.quellen.map((q) => q.titel)].slice(0, 4),
    dringlichkeit: 'mittel',
    wertEuro: kosten,
    bestandId: b.id,
    rechenlauf: lauf(k, { b: b.id, kosten, hoehe }, ['Regelpaket', 'Waldgrafen-Pflegemodell v1'], WALDFOEPR_2025.version),
  };
}

// ───────────────────────────── 7 · Umbauplan ─────────────────────────────
const MASSNAHME_ART: Record<string, Massnahme['art']> = { Holzernte: 'ernte', Kontrolle: 'begang', Pflanzung: 'kultur', Kulturpflege: 'pflege', Pflege: 'pflege' };

function umbau(k: Kontext, u: Umbauplan, jahr: number): Entscheidung | null {
  const bestaende = k.wald.bestaende.filter((b) => imPlan(k, b));
  const empf = u.strategien.find((x) => x.empfohlen) ?? u.strategien[0];
  const reicher = u.strategien.filter((x) => x !== empf && x.kapitalwert[1] > empf.kapitalwert[1]).sort((x, y) => y.kapitalwert[1] - x.kapitalwert[1])[0];
  const bisher = u.strategien.find((x) => x.id === 'altersklasse') ?? u.strategien.find((x) => x.id === 'nichtstun');
  const zeig = [empf, reicher, bisher].filter((x, i, a) => x && a.indexOf(x) === i) as Umbauplan['strategien'];
  const start = u.rechnung.startjahr || jahr + 1;
  const erstesJahr = u.massnahmen.filter((m) => m.jahr === start && !/^Unternehmer/.test(m.text));
  const antrag = u.massnahmen.filter((m) => m.jahr === start + 1 && m.foerderung > 0);
  const erste = [
    ...erstesJahr.map((m) => ({ art: MASSNAHME_ART[m.kategorie] ?? 'sonstiges', bestandId: bestaende[0]?.id, titel: `${m.text.replace(/: Stämme über der oberen Zielstärke$/, '')}${m.menge ? ` (${zahl(m.menge, m.menge < 10 && m.menge % 1 ? 1 : 0)} ${m.einheit ?? ''})`.replace(' )', ')') : ''}`, kostenRahmen: m.kosten - m.erloes || undefined })),
    ...antrag.map((m) => ({ art: 'foerderung' as const, bestandId: bestaende[0]?.id, titel: `Förderantrag: ${m.text}${m.menge ? ` (${zahl(m.menge)} ${m.einheit ?? ''})` : ''}`, kostenRahmen: m.kosten, foerderung: m.foerderung, erstNachBewilligung: true })),
  ];
  const kw = (x: Umbauplan['strategien'][number]) => euro(x.kapitalwert[1]);
  const offenDringlich = u.offen.filter((o) => o.dringlich);
  const ha = u.ha || bestaende.reduce((s, b) => s + b.ha, 0);
  return {
    id: `umbau-${(u.revier ?? 'plan').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    art: 'umbau',
    kurz: 'Umbauplan festlegen',
    ort: `${u.bestandName} · ${haText(ha)} · ${u.rechnung.horizont} Jahre`,
    bild: BILD.umbau,
    titel: ['Ein Plan für ', `${u.rechnung.horizont} Jahre`, ` – ${(u.kurz ?? 'Ihr Ertragsträger').replace(/^(Der|Die|Das) /, (m) => m.toLowerCase())}.`],
    satz: `${u.strategien.length} Wege, je ${zahl(u.rechnung.laeufe)} Durchläufe mit Sturm, Käfer und Holzpreisen. Empfohlen: „${empf.name}“ – ${empf.verletzt.length ? 'der beste Kompromiss' : 'erfüllt als bester alle Ihre Vorgaben'}.${reicher ? ` „${reicher.kurz}“ brächte im Mittel ${euro(reicher.kapitalwert[1] - empf.kapitalwert[1])} mehr, verletzt aber: ${reicher.verletzt.join(', ') || 'Ihre Ziele'}.` : ''}`,
    status: 'geschaetzt',
    statusText: 'Gerechnet, Start gemessen',
    statusErklaerung: `Startvorrat aus der Winkelzählprobe; Entwicklung aus dem Umbaumodell (${zahl(u.rechnung.laeufe)} Läufe, Klimapfad ${u.rechnung.szenario}, Zins ${zahl(u.rechnung.zinsPct, 1)} %). Ergebnisse sind Spannen, keine Prognose.`,
    fehlt: offenDringlich.length ? offenDringlich.map((o) => o.was) : undefined,
    optionen: zeig.map((x, i) => ({
      id: x.id,
      marke: i === 0 ? 'Empfohlen' : x === reicher ? 'Mehr Ertrag' : 'Wie bisher',
      name: x.name,
      preis: `Kapitalwert ${kw(x)}`,
      wirkung: [
        { label: 'Kapitalwert (Median)', wert: kw(x), ton: x === empf ? 'gut' : undefined },
        { label: 'Großschaden in 80 Jahren', wert: pct(x.grossschadenPct), ton: x.grossschadenPct >= 60 ? 'schlecht' : undefined },
        { label: 'Nadelholz am Ende', wert: pct(x.endNadelPct), ton: x.endNadelPct > 60 ? 'schlecht' : x.endNadelPct <= 50 ? 'gut' : undefined },
      ],
      zeilen: [
        ['Spanne (10–90 %)', euroSpanne(x.kapitalwert[0], x.kapitalwert[2])],
        ['Ihre Vorgaben', x.verletzt.length ? `verletzt: ${x.verletzt.join('; ')}` : 'alle erfüllt'],
        ['Nutzwert', `${zahl(x.nutzwert, 1)} von 10`],
      ],
      massnahme: i === 0 ? { art: 'sonstiges', bestandId: bestaende[0]?.id, titel: `Umbauplan beschlossen: ${x.kurz}` } : undefined,
      weitere: i === 0 ? erste : undefined,
    })),
    empfohlen: 0,
    cta: 'Plan beschließen',
    gruende: [
      u.ziel.beschreibung.split('. ').slice(0, 2).join('. ') + '.',
      u.kennzahlen.kahlMaxHa === 0 ? 'Nie kahl: Es entsteht zu keinem Zeitpunkt eine Freifläche.' : `Größte Freifläche ${zahl(u.kennzahlen.kahlMaxHa, 1)} ha.`,
      `Naturverjüngung trägt ${pct(u.kennzahlen.nvAnteilPct)} der neuen Generation – gepflanzt wird nur, wo Samenbäume fehlen.`,
      `Nadelholz von ${pct(u.heute.nadelPct)} auf ${pct(u.kennzahlen.endNadelPct)}, ${u.kennzahlen.endBaumarten} Baumarten am Ende.`,
    ],
    risiken: [
      `Auch der empfohlene Weg erlebt in ${pct(empf.grossschadenPct)} der Läufe einen Großschaden – das Risiko der Fichte verschwindet nicht sofort.`,
      ...offenDringlich.map((o) => o.warum),
    ].slice(0, 4),
    datenlage: [
      `Umbaumodell, ${zahl(u.rechnung.laeufe)} Läufe, Klimapfad ${u.rechnung.szenario}, Zins ${zahl(u.rechnung.zinsPct, 1)} %`,
      ...bestaende.map((b) => `${b.label}: ${b.vorrat.quelle}`),
      `Plan erstellt ${u.erstellt.split('-').reverse().join('.')}`,
    ].slice(0, 4),
    dringlichkeit: start <= jahr + 1 ? 'mittel' : 'gering',
    wertEuro: bisher ? empf.kapitalwert[1] - bisher.kapitalwert[1] : empf.kapitalwert[1],
    bestandId: bestaende[0]?.id,
    rechner: '#/plan',
    rechenlauf: lauf(k, { plan: u.erstellt, strategie: empf.id }, ['Waldgrafen-Umbaumodell (Monte Carlo)']),
  };
}

// ───────────────────────────── 8 · Genauer werden ─────────────────────────────
function messen(k: Kontext, blockiert: boolean): Entscheidung | null {
  const unsicher = k.wald.bestaende.filter((b) => stehend(b) && statusVon(b.vorrat) !== 'bestaetigt');
  if (!unsicher.length) return null;
  const werte = unsicher.map((b) => bestandWert(b, k.annahmen));
  const holzwert = werte.reduce((s, x) => s + x.holzwert, 0);
  const gMax = Math.max(...unsicher.map((b) => genauigkeit(b.vorrat) ?? 30));
  const frage = k.wald.offeneFragen.find((f) => f.id === 'grundflaeche');
  const gewinn = frage?.gewinn ?? `aus ± ${Math.round(gMax)} % wird ± 9 %`;
  const erster = unsicher[0];
  return {
    id: 'messen',
    art: 'messen',
    kurz: 'Genauer werden',
    ort: `${new Set(unsicher.map((b) => b.revier)).size === 1 && unsicher[0].revier ? `${unsicher[0].revier} · ` : ''}${unsicher.length} ${unsicher.length === 1 ? 'Bestand' : 'Bestände'} · ${haText(unsicher.reduce((s, b) => s + b.ha, 0))}`,
    bild: BILD.messen,
    titel: ['Fünf Minuten im Wald, ', 'zehnmal genauer.', ''],
    satz: `${frage?.warum ?? 'Der Vorrat ist bisher aus Fernerkundung geschätzt.'} Es geht um einen Holzwert von ${euro(holzwert)}.`,
    status: 'pruefen',
    statusText: `Vorrat ± ${Math.round(gMax)} %`,
    statusErklaerung: unsicher.map((b) => `${b.label}: ${statusLabel(b.vorrat)}`).join(' · '),
    fehlt: unsicher.map((b) => `Winkelzählprobe in ${b.label}`),
    optionen: [
      {
        id: 'selbst', marke: 'Empfohlen', name: 'Selbst messen mit der App', preis: `≈ ${unsicher.length * 30} Min.`,
        wirkung: [
          { label: 'Genauigkeit', wert: gewinn.replace(/^aus /, '').replace(/\s*%\s*wird\s*/, ' → '), ton: 'gut' },
          { label: 'Betroffener Holzwert', wert: euro(holzwert) },
          { label: 'Kosten', wert: '0 €', ton: 'gut' },
        ],
        zeilen: [['Wie', 'Winkelzählprobe, geführt'], ['Werkzeug', frage?.aufwand ?? 'Smartphone, optional Relaskop'], ['Wo', unsicher.map((b) => b.label).join(', ')]],
        ziel: `#/messen/${erster.id}`,
        massnahme: { art: 'messung', titel: 'Winkelzählprobe in den unsicheren Beständen' },
      },
      {
        id: 'waldcheck', marke: 'Begleitet', name: 'Waldgrafen Wald-Check vor Ort', preis: '497 €',
        wirkung: [
          { label: 'Genauigkeit', wert: '± 6–9 %', ton: 'gut' },
          { label: 'Dazu', wert: 'Qualität, Verjüngung, Verbiss' },
          { label: 'Sie', wert: 'müssen nichts tun', ton: 'gut' },
        ],
        zeilen: [['Umfang', 'Inventur aller Bestände'], ['Ergebnis', 'präzisierter Zwilling, Gespräch']],
        massnahme: { art: 'messung', titel: 'Wald-Check beauftragt', kostenRahmen: 497 },
      },
      {
        id: 'weiter', marke: 'Später', name: 'Mit Schätzung weiterarbeiten', preis: '0 €',
        wirkung: [
          { label: 'Genauigkeit', wert: `bleibt ± ${Math.round(gMax)} %`, ton: 'schlecht' },
          { label: 'Holzverkauf', wert: blockiert ? 'gesperrt' : 'nur Orientierung', ton: 'schlecht' },
          { label: 'Kosten', wert: '0 €' },
        ],
        zeilen: [['Hinweis', 'Verkaufsentscheidungen bleiben vorläufig']],
      },
    ],
    empfohlen: 0,
    cta: 'Messung starten',
    gruende: [frage?.warum ?? 'Fernerkundung sieht die herrschende Schicht; unterdrückte Bäume und Qualität nicht.', `${unsicher.length} Entscheidung(en) hängen am Vorrat.`],
    risiken: ['Messfehler bei zu wenigen Punkten – mindestens drei, besser fünf.'],
    datenlage: unsicher.map((b) => `${b.label}: ${b.vorrat.quelle}`).slice(0, 3),
    dringlichkeit: blockiert ? 'hoch' : 'mittel',
    wertEuro: (holzwert * gMax) / 100,
    rechenlauf: lauf(k, unsicher.map((b) => [b.id, b.vorrat]), ['Waldgrafen-Vermögensmodell v1']),
  };
}

export function entscheidungenAbleiten(k: Kontext): Entscheidung[] {
  const jahr = (k.heute ?? new Date()).getFullYear();
  const liste: Entscheidung[] = [];
  for (const b of k.wald.bestaende) {
    const geplant = imPlan(k, b);
    for (const f of [schaden(k, b, jahr), wiederbewaldung(k, b), pflege(k, b), geplant ? null : holzernte(k, b, jahr), geplant ? null : waldweg(k, b, jahr)]) {
      if (f) liste.push(f);
    }
  }
  const gruppen = new Map<string, Bestand[]>();
  for (const b of k.wald.bestaende.filter((x) => voranbauKandidat(k, x))) gruppen.set(b.revier ?? b.id, [...(gruppen.get(b.revier ?? b.id) ?? []), b]);
  for (const g of gruppen.values()) { const v = voranbau(k, g); if (v) liste.push(v); }
  if (k.wald.umbau) { const u = umbau(k, k.wald.umbau, jahr); if (u) liste.push(u); }
  const blockiert = liste.some((e) => e.art === 'holzernte' && e.status === 'pruefen');
  const m = messen(k, blockiert);
  if (m) liste.push(m);
  return liste.sort((a, b) => RANG[a.dringlichkeit] - RANG[b.dringlichkeit] || ZEITKRITISCH[a.art] - ZEITKRITISCH[b.art] || b.wertEuro - a.wertEuro);
}
