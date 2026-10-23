/**
 * Start ohne Zwilling: Ein Waldbesitzer beschreibt jede Fläche mit vier Angaben
 * (Größe, Hauptbaumart, Alter, Zustand). Daraus entsteht ein grober Zwilling.
 *
 * Die Werte sind Größenordnungen aus Ertragstafel-Mitteln (mäßige Bonität), keine Messung.
 * Deshalb trägt jeder Vorrat die Herkunft „Annahme“ und den Status „noch zu prüfen“:
 * Geldentscheidungen bleiben gesperrt, bis gemessen oder ein Zwilling erstellt ist.
 */
import { ART_TEXT, istNadel, type Artgruppe, type Bestand, type Eignung, type Wald } from './modell';

export type Altersklasse = 'jung' | 'mittel' | 'alt' | 'sehr_alt';
export type Zustand = 'gesund' | 'schaeden' | 'kahl';

export interface FlaechenAngabe { name: string; ha: number; art: Artgruppe; alter: Altersklasse; zustand: Zustand }
export interface WaldAngabe { name: string; bundesland: string; flaechen: FlaechenAngabe[] }

export const ALTER_TEXT: Record<Altersklasse, string> = { jung: 'bis 20 Jahre', mittel: '20–60 Jahre', alt: '60–100 Jahre', sehr_alt: 'über 100 Jahre' };
export const ZUSTAND_TEXT: Record<Zustand, string> = { gesund: 'Sieht gesund aus', schaeden: 'Schäden sichtbar', kahl: 'Kahlfläche' };

/** Größenordnungen je Altersklasse: [Vorrat Vfm/ha, Zuwachs Vfm/ha/J, BHD cm, Höhe m, Alter von, bis] */
const TAFEL: Record<'nadel' | 'laub', Record<Altersklasse, [number, number, number, number, number, number]>> = {
  nadel: { jung: [15, 6, 8, 5, 5, 20], mittel: [260, 13, 22, 18, 20, 60], alt: [420, 10, 34, 27, 60, 100], sehr_alt: [460, 7, 44, 31, 100, 130] },
  laub: { jung: [10, 4, 6, 4, 5, 20], mittel: [180, 9, 20, 17, 20, 60], alt: [330, 8, 34, 26, 60, 100], sehr_alt: [400, 6, 48, 30, 100, 140] },
};
/** Kiefer und Lärche tragen weniger Vorrat als Fichte und Tanne */
const ART_FAKTOR: Partial<Record<Artgruppe, number>> = { kiefer: 0.8, laerche: 0.85, eiche: 0.9 };

const EIGNUNG_ALLGEMEIN: Eignung[] = [
  { art: 'Fichte', heute: 'mittel', entwicklung: 'schlechter', gruende: ['Allgemeine Einschätzung ohne Standortdaten: Trockenheit und Borkenkäfer setzen ihr in tieferen Lagen zu.'] },
  { art: 'Weißtanne', heute: 'gut', entwicklung: 'stabil', gruende: ['Tiefwurzelnd, schattenverträglich – allgemeine Einschätzung'] },
  { art: 'Buche', heute: 'gut', entwicklung: 'stabil', gruende: ['Standortheimisch auf den meisten Böden – allgemeine Einschätzung'] },
  { art: 'Traubeneiche', heute: 'gut', entwicklung: 'stabil', gruende: ['Trockenheitstolerant – allgemeine Einschätzung'] },
];

const id = (s: string, i: number) => `fl-${i + 1}-${s.toLowerCase().replace(/[^a-z0-9äöüß]+/g, '-').slice(0, 20)}`;

export function waldAusAngaben(e: WaldAngabe, heute = new Date()): Wald {
  const datum = heute.toISOString().slice(0, 10);
  const laubVorhanden = e.flaechen.filter((f) => !istNadel(f.art) && f.zustand !== 'kahl').map((f) => ART_TEXT[f.art]);
  const bestaende: Bestand[] = e.flaechen.map((f, i) => {
    const t = TAFEL[istNadel(f.art) ? 'nadel' : 'laub'][f.alter];
    const k = ART_FAKTOR[f.art] ?? 1;
    const kahl = f.zustand === 'kahl';
    const vorrat = kahl ? 0 : Math.round(t[0] * k);
    return {
      id: id(f.name || 'flaeche', i),
      label: f.name || `Fläche ${i + 1}`,
      kennung: `Fläche ${i + 1}`,
      ha: f.ha,
      polygon: [],
      mitte: { lat: 0, lon: 0 },
      hoeheM: kahl ? undefined : t[3],
      bhdCm: kahl ? undefined : t[2],
      alter: kahl ? undefined : { von: t[4], bis: t[5], text: ALTER_TEXT[f.alter] },
      nadelPct: kahl ? undefined : istNadel(f.art) ? 100 : 0,
      fuehrend: kahl ? 'sonstiges' : f.art,
      fuehrendText: kahl ? 'Freifläche' : ART_TEXT[f.art],
      arten: [{ art: kahl ? 'sonstiges' : f.art, pct: 100 }],
      vorrat: { wert: vorrat, einheit: 'Vfm/ha', quelle: 'Schätzung aus Ihren Angaben (Baumart und Alter)', herkunft: 'annahme', stand: datum, genauigkeitPct: 40 },
      zuwachs: kahl ? undefined : { wert: Math.round(t[1] * k * 10) / 10, einheit: 'Vfm/ha/J', quelle: 'Ertragstafel-Mittel', herkunft: 'annahme', genauigkeitPct: 40 },
      kahlflaeche: kahl,
      jungbestand: !kahl && f.alter === 'jung' ? { hoeheM: t[3] } : undefined,
      verjuengungMoeglich: laubVorhanden,
      vital: ZUSTAND_TEXT[f.zustand],
      befunde: f.zustand === 'schaeden' ? [{ befund: 'Schäden von Ihnen gemeldet', wert: `${Math.min(0.5, f.ha).toLocaleString('de-DE')} ha angenommen`, folge: 'Ansehen lohnt sich: Bei Käfer entscheidet sich in Wochen, ob daraus ein Nest wird.', dringlichkeit: 'hoch' }] : [],
      eignung: EIGNUNG_ALLGEMEIN,
    };
  });
  return {
    id: `eigen-${(e.name || 'wald').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    quelle: 'eigen',
    stand: datum,
    betrieb: { name: e.name || 'Mein Wald', langname: e.name || 'Mein Wald', bundesland: e.bundesland },
    bestaende,
    ereignisse: [],
    offeneFragen: [],
    tagebuch: [{ datum, titel: 'Wald angelegt', text: `${bestaende.length} ${bestaende.length === 1 ? 'Fläche' : 'Flächen'} aus Ihren Angaben – grobe Schätzung, noch ohne Messung.`, quelle: 'Ihre Angaben', sicherheit: 'belegt' }],
    profil: { besitzer: e.name || 'Mein Wald', kalkulationszins: 0.015, gewichtWirtschaft: 0.6, verbiss: 'mittel', annahme: true },
    foerderBezug: {},
    kontakte: [],
  };
}
