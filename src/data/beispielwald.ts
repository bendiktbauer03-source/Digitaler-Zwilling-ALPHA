/**
 * BEISPIELDATEN – vollständig fiktiv. Kein realer Betrieb, keine realen Flurstücke.
 * Dient der Vorführung aller Entscheidungswege, solange kein eigener Zwilling geladen ist.
 */
import type { Befund, Bestand, Eignung, Wald } from '../engine/modell';

const URSPRUNG = { lat: 48.0412, lon: 10.8975 };
const M_JE_GRAD_LAT = 111_320;
const M_JE_GRAD_LON = 111_320 * Math.cos((URSPRUNG.lat * Math.PI) / 180);

/** Polygon in Metern um einen Mittelpunkt, auf Zielfläche skaliert, als [lon, lat]. */
function form(punkte: [number, number][], zielHa: number, dx: number, dy: number): { polygon: [number, number][]; mitte: { lat: number; lon: number } } {
  let a = 0;
  for (let i = 0; i < punkte.length; i++) {
    const [x1, y1] = punkte[i], [x2, y2] = punkte[(i + 1) % punkte.length];
    a += x1 * y2 - x2 * y1;
  }
  const s = Math.sqrt((zielHa * 10_000) / Math.abs(a / 2));
  const polygon = punkte.map(([x, y]) => [URSPRUNG.lon + (x * s + dx) / M_JE_GRAD_LON, URSPRUNG.lat + (y * s + dy) / M_JE_GRAD_LAT] as [number, number]);
  return { polygon: [...polygon, polygon[0]], mitte: { lat: URSPRUNG.lat + dy / M_JE_GRAD_LAT, lon: URSPRUNG.lon + dx / M_JE_GRAD_LON } };
}

const EIGNUNG: Eignung[] = [
  { art: 'Fichte', heute: 'mittel', entwicklung: 'schlechter', gruende: ['Sommerwasserbilanz sinkt, flache Wurzeln auf Lehm', 'Käferdruck steigt mit jedem warmen Jahr'], hinweis: 'Sie trägt heute den Wert des Waldes und zugleich das größte Risiko.' },
  { art: 'Weißtanne', heute: 'gut', entwicklung: 'stabil', gruende: ['Tiefe Wurzeln, schattenverträglich', 'Niederschlag reicht ihr'] },
  { art: 'Buche', heute: 'gut', entwicklung: 'stabil', gruende: ['Standortheimisch, verjüngt sich selbst'] },
  { art: 'Bergahorn', heute: 'gut', entwicklung: 'stabil', gruende: ['Frische, nährstoffreiche Böden'] },
  { art: 'Douglasie', heute: 'gut', entwicklung: 'stabil', gruende: ['Trockenheitstoleranter als die Fichte'] },
  { art: 'Kiefer', heute: 'mittel', entwicklung: 'stabil', gruende: ['Kommt mit Trockenheit zurecht, geringe Wuchsleistung'] },
];

const basis = { befunde: [] as Befund[], eignung: EIGNUNG, beispiel: true };

const b1: Bestand = {
  ...basis, ...form([[0, 0], [260, 30], [300, 160], [120, 210], [-20, 120]], 3.8, -120, 60),
  id: 'abt-1', label: 'Hangfichte', kennung: 'Abteilung 1', ha: 3.8,
  hangGrad: 14, exposition: 'Nordost', hoeheM: 27, bhdCm: 33, alter: { von: 70, bis: 80, text: '70–80 Jahre' },
  nadelPct: 82, fuehrend: 'fichte', fuehrendText: 'Fichte', arten: [{ art: 'fichte', pct: 82 }, { art: 'buche', pct: 18 }],
  vorrat: { wert: 470, einheit: 'Vfm/ha', quelle: 'Laser-Einzelbaumsuche und Ertragstafel (Konsens)', herkunft: 'abgeleitet', stand: '2026-09-30', genauigkeitPct: 22, spanne: [380, 580] },
  zuwachs: { wert: 11, einheit: 'Vfm/ha/J', quelle: 'Ertragstafel über Oberhöhe', herkunft: 'modelliert', genauigkeitPct: 30 },
  bestockungsgrad: 0.95, stammzahlProHa: 540,
  vital: 'Frischer Vitalitätseinbruch am Südrand.',
  befunde: [{ befund: 'Frischer Verdacht aus dem Satellitenbild', wert: '0,4 ha, Beginn 2026', folge: 'Die Stelle sollte angesehen werden: Ist es Käfer, entscheidet sich in Wochen, ob daraus ein Nest wird.', dringlichkeit: 'hoch' }],
  verjuengungMoeglich: ['Buche'],
};

const b2: Bestand = {
  ...basis, ...form([[0, 0], [150, -10], [170, 90], [20, 110]], 1.5, 230, -40),
  id: 'abt-2', label: 'Käferloch', kennung: 'Abteilung 2', ha: 1.5,
  hangGrad: 6, exposition: 'Süd', kahlflaeche: true,
  fuehrend: 'sonstiges', fuehrendText: 'Freifläche', arten: [{ art: 'sonstiges', pct: 100 }],
  vorrat: { wert: 0, einheit: 'Vfm/ha', quelle: 'Luftbild 2026: geräumt', herkunft: 'gemessen', stand: '2026-08-12' },
  vital: 'Nach Käferbefall 2024 geräumt, Schlagflora breitet sich aus.',
  verjuengungMoeglich: ['Buche', 'Bergahorn'],
};

const b3: Bestand = {
  ...basis, ...form([[0, 0], [200, 20], [230, 130], [60, 150], [-10, 70]], 2.9, 40, 250),
  id: 'abt-3', label: 'Buchenrand', kennung: 'Abteilung 3', ha: 2.9,
  hangGrad: 4, exposition: 'West', hoeheM: 31, bhdCm: 46, alter: { von: 100, bis: 115, text: '100–115 Jahre' },
  nadelPct: 0, fuehrend: 'buche', fuehrendText: 'Buche', arten: [{ art: 'buche', pct: 75 }, { art: 'edellaub', pct: 15 }, { art: 'eiche', pct: 10 }],
  vorrat: { wert: 420, einheit: 'Vfm/ha', quelle: 'Winkelzählprobe beim Wald-Check, 7 Punkte', herkunft: 'vor_ort', stand: '2025-11-12', genauigkeitPct: 8, spanne: [386, 454] },
  zuwachs: { wert: 7, einheit: 'Vfm/ha/J', quelle: 'Ertragstafel Buche', herkunft: 'modelliert', genauigkeitPct: 25 },
  hiebsreife: 'Zielstärke erreicht — 32 % des Vorrats über 55 cm',
  bestockungsgrad: 0.9, stammzahlProHa: 230,
  vital: 'Vital, kein Ereignis seit 2017.',
};

const b4: Bestand = {
  ...basis, ...form([[0, 0], [240, 0], [250, 80], [10, 95]], 2.6, -310, -150),
  id: 'abt-4', label: 'Kiefernriegel', kennung: 'Abteilung 4', ha: 2.6,
  hangGrad: 3, exposition: 'eben', hoeheM: 22, bhdCm: 29, alter: { von: 55, bis: 65, text: '55–65 Jahre' },
  nadelPct: 85, fuehrend: 'kiefer', fuehrendText: 'Kiefer', arten: [{ art: 'kiefer', pct: 70 }, { art: 'fichte', pct: 15 }, { art: 'buche', pct: 15 }],
  vorrat: { wert: 300, einheit: 'Vfm/ha', quelle: 'Ertragstafel über Oberhöhe (nur ein Schätzweg)', herkunft: 'modelliert', stand: '2026-09-30', genauigkeitPct: 34 },
  zuwachs: { wert: 7, einheit: 'Vfm/ha/J', quelle: 'Ertragstafel Kiefer', herkunft: 'modelliert', genauigkeitPct: 35 },
  bestockungsgrad: 0.85, stammzahlProHa: 620,
  vital: 'Vital.',
  verjuengungMoeglich: ['Buche', 'Kiefer'],
};

const b5: Bestand = {
  ...basis, ...form([[0, 0], [170, 15], [160, 110], [-5, 95]], 1.6, 330, 190),
  id: 'abt-5', label: 'Jungwuchs', kennung: 'Abteilung 5', ha: 1.6,
  hangGrad: 8, exposition: 'Südost', hoeheM: 4, alter: { von: 10, bis: 14, text: '10–14 Jahre' },
  nadelPct: 25, fuehrend: 'buche', fuehrendText: 'Buche', arten: [{ art: 'buche', pct: 60 }, { art: 'tanne', pct: 25 }, { art: 'edellaub', pct: 15 }],
  jungbestand: { hoeheM: 4 },
  vorrat: { wert: 12, einheit: 'Vfm/ha', quelle: 'Laserhöhen', herkunft: 'gemessen', stand: '2026-09-30', genauigkeitPct: 40 },
  vital: 'Dicht, Buche drängt Tanne.',
};

export const BEISPIELWALD: Wald = {
  id: 'beispiel-waldgut-am-lech',
  quelle: 'beispiel',
  stand: '2026-09-30',
  betrieb: { name: 'Beispielwald', langname: 'Waldgut am Lech', landkreis: 'Landsberg am Lech', bundesland: 'Bayern', wuchsgebiet: 'Schwäbisch-Bayerische Schotterplatten- und Altmoränenlandschaft' },
  bestaende: [b1, b2, b3, b4, b5],
  ereignisse: [
    { label: '0,4 ha · 2026', bestandId: 'abt-1', ha: 0.4, jahr: 2026, bestaetigt: false, erholt: false },
    { label: '1,5 ha · 2024', bestandId: 'abt-2', ha: 1.5, jahr: 2024, bestaetigt: true, erholt: false },
  ],
  offeneFragen: [
    { id: 'grundflaeche', frage: 'Haben Sie die Grundfläche gemessen?', warum: 'Eine Winkelzählprobe dauert im Bestand fünf Minuten je Punkt und ist die Angabe, die den Vorrat wirklich festlegt.', gewinn: 'aus ± 34 % wird ± 9 %', aufwand: 'fünf Minuten je Punkt, Smartphone oder Relaskop', betrifft: ['abt-1', 'abt-4'] },
  ],
  tagebuch: [
    { datum: '2026-09-30', titel: 'Digitaler Zwilling erstellt', text: 'Alle fünf Abteilungen aus offenen Daten erfasst – Gelände, Höhen, Baumarten, Boden, Vitalität.', quelle: 'Waldgrafen-Erfassung', sicherheit: 'belegt' },
    { datum: '2026', titel: 'Verdacht aus dem Satellitenbild', text: '0,4 ha in der Hangfichte, Folgesaison fehlt.', bestand: 'Hangfichte', quelle: 'Sentinel-2', sicherheit: 'zu_pruefen' },
    { datum: '2025-11-12', titel: 'Wald-Check im Buchenrand', text: 'Winkelzählprobe mit 7 Punkten, Vorrat 420 Vfm/ha ± 8 %.', bestand: 'Buchenrand', quelle: 'Die Waldgrafen', sicherheit: 'belegt' },
    { datum: '2024', titel: 'Käferholz geräumt', text: '1,5 ha Fichte nach Buchdruckerbefall.', bestand: 'Käferloch', quelle: 'Eigentümer', sicherheit: 'belegt' },
  ],
  profil: { besitzer: 'Beispiel-Eigentümer', kalkulationszins: 0.015, gewichtWirtschaft: 0.6, verbiss: 'mittel', vorratMin: 350, vorratMax: 450, annahme: true },
  klima: { niederschlagMm: 980, temperaturC: 8.9, verschiebungC: 1.1, wasserbilanzSommerMm: 95 },
  foerderBezug: {},
  kontakte: [
    { name: 'Die Waldgrafen', art: 'Dienstleister', notiz: 'Holzvermarktung, Unternehmer, Förderanträge.' },
    { name: 'Amt für Ernährung, Landwirtschaft und Forsten (AELF)', art: 'Beratung', notiz: 'Kostenfreier Begang, Förderfragen.' },
  ],
};
