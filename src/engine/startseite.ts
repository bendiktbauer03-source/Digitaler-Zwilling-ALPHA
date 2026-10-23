/**
 * Was die Startseite zeigt – abhängig davon, was über den Wald belegt ist und was der
 * Eigentümer erreichen will. Grundsätze aus dem Home-Blueprint:
 *
 *  - Der Einstieg ist der eigene Wald (Porträt, Fläche), nicht ein Kennzahlenraster.
 *  - Genau ein Hinweis. Liegt keine verlässliche Empfehlung vor, keine künstliche Dringlichkeit.
 *  - Höchstens drei Eckdaten. Ein Wert erscheint nur, wenn er begründbar ist – und dann als Spanne.
 *  - Der Fortschrittsring zeigt Vollständigkeit oder Umsetzung, nie einen „Gesundheitsindex“.
 */
import type { Annahmen } from './annahmen';
import type { Entscheidung } from './entscheidungen';
import type { Fortschreibung } from './fortschreibung';
import { statusVon } from './messwert';
import { gesamtHa, type Wald } from './modell';
import { waldVermoegen, wertzuwachsJahr } from './vermoegen';

export type Ziel = 'kennenlernen' | 'erhalten' | 'bewirtschaften' | 'entwickeln' | 'betrieb';
export type Startzustand = 'neu' | 'aktiv' | 'betrieb';

export const ZIEL_TEXT: Record<Ziel, { titel: string; text: string }> = {
  kennenlernen: { titel: 'Kennenlernen', text: 'Verstehen, was ich besitze' },
  erhalten: { titel: 'Erhalten', text: 'Gesund und stabil weitergeben' },
  bewirtschaften: { titel: 'Selbst bewirtschaften', text: 'Holz, Pflege und Pflanzung planen' },
  entwickeln: { titel: 'Wirtschaftlich entwickeln', text: 'Erträge, Förderung, Wertentwicklung' },
  betrieb: { titel: 'Einen Forstbetrieb führen', text: 'Reviere, Programme, Steuerung' },
};

/** Ab dieser Fläche oder mit dem Ziel „Forstbetrieb“ zeigt die Übersicht die Portfolio-Sicht. */
const BETRIEB_AB_HA = 200;

/** Ob überhaupt eine Fläche einen belegbaren Vorrat hat (gemessen oder fernerkundlich geschätzt). */
export function hatBelegtenVorrat(w: Wald) {
  return w.bestaende.some((b) => !b.kahlflaeche && b.vorrat.herkunft !== 'annahme' && statusVon(b.vorrat) !== 'pruefen');
}

export function startzustand(w: Wald, ziele: Ziel[] = []): Startzustand {
  if (ziele.includes('betrieb') || gesamtHa(w) >= BETRIEB_AB_HA) return 'betrieb';
  return hatBelegtenVorrat(w) ? 'aktiv' : 'neu';
}

export type AufnahmeStatus = 'liegt_vor' | 'geschaetzt' | 'angabe' | 'offen';
export interface AufnahmeBereich { id: string; titel: string; status: AufnahmeStatus; text: string }

export const AUFNAHME_TEXT: Record<AufnahmeStatus, string> = {
  liegt_vor: 'liegt vor', geschaetzt: 'geschätzt', angabe: 'Ihre Angabe', offen: 'noch offen',
};

/** Fünf Bereiche der Waldaufnahme – Grundlage des Fortschrittsrings. */
export function waldaufnahme(w: Wald) {
  const bs = w.bestaende;
  const alle = (f: (b: Wald['bestaende'][number]) => boolean) => bs.length > 0 && bs.every(f);
  const einige = (f: (b: Wald['bestaende'][number]) => boolean) => bs.some(f);
  const stehende = bs.filter((b) => !b.kahlflaeche);
  const bereiche: AufnahmeBereich[] = [
    {
      id: 'lage', titel: 'Lage und Grenzen',
      status: alle((b) => b.polygon.length > 2) ? 'liegt_vor' : 'angabe',
      text: alle((b) => b.polygon.length > 2) ? 'Flächengrenzen aus dem Kataster' : 'Größe aus Ihren Angaben, Grenzen fehlen',
    },
    {
      id: 'gelaende', titel: 'Gelände und Boden',
      status: alle((b) => b.hangGrad != null || !!b.boden) ? 'liegt_vor' : 'offen',
      text: 'Höhe, Hangneigung, Bodenkarte',
    },
    {
      id: 'baumarten', titel: 'Baumarten',
      status: stehende.length === 0 ? 'offen' : stehende.every((b) => b.vorrat.herkunft === 'annahme') ? 'angabe' : 'geschaetzt',
      text: 'Satellitenbild oder Ihre Angabe',
    },
    {
      id: 'alter', titel: 'Alter und Zustand',
      status: stehende.length && stehende.every((b) => b.alter) ? (stehende.every((b) => b.vorrat.herkunft === 'annahme') ? 'angabe' : 'geschaetzt') : 'offen',
      text: 'Aus Höhe und Standort abgeleitet oder angegeben',
    },
    {
      id: 'vorrat', titel: 'Holzvorrat und Wert',
      status: einige((b) => !b.kahlflaeche && statusVon(b.vorrat) === 'bestaetigt') ? 'liegt_vor' : hatBelegtenVorrat(w) ? 'geschaetzt' : 'offen',
      text: 'Gemessen oder aus Laser und Ertragstafel',
    },
  ];
  const punkte = bereiche.reduce((s, b) => s + (b.status === 'liegt_vor' ? 1 : b.status === 'geschaetzt' ? 0.75 : b.status === 'angabe' ? 0.5 : 0), 0);
  return { bereiche, anteil: punkte / bereiche.length, vorhanden: bereiche.filter((b) => b.status === 'liegt_vor' || b.status === 'geschaetzt').length };
}

/** Wert nur, wenn begründbar – und immer als Spanne. */
export function wertAnzeige(w: Wald, a: Annahmen) {
  if (!hatBelegtenVorrat(w)) return null;
  const v = waldVermoegen(w, a);
  if (v.holzwert <= 0) return null;
  return { lo: v.holzwertSpanne[0], hi: v.holzwertSpanne[1], mitte: v.holzwert, zuwachsJahr: wertzuwachsJahr(w, a).euro, bestaetigtHa: v.bestaetigtHa, co2t: v.co2t };
}

export interface WaldjahrEintrag { wann: string; titel: string; text: string; art: 'erledigt' | 'geplant' | 'vorhaben' }

const MONAT = ['Jan.', 'Feb.', 'März', 'Apr.', 'Mai', 'Juni', 'Juli', 'Aug.', 'Sep.', 'Okt.', 'Nov.', 'Dez.'];
function wann(iso: string) {
  if (/^\d{4}$/.test(iso)) return iso;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : MONAT[d.getMonth()];
}

/** Eine kleine Chronologie: zuletzt Erledigtes, was gerade läuft, was als Nächstes ansteht. */
export function waldjahr(w: Wald, f: Fortschreibung, ents: Entscheidung[], heute = new Date()): WaldjahrEintrag[] {
  const jahr = heute.getFullYear();
  const vergangen = w.tagebuch
    .filter((t) => t.sicherheit === 'belegt' && /^\d{4}-\d{2}/.test(t.datum) && t.datum.slice(0, 4) >= String(jahr - 1) && !/^Notiz/.test(t.titel))
    .slice(0, 2)
    .map((t): WaldjahrEintrag => ({ wann: wann(t.datum), titel: t.titel, text: t.bestand ?? t.text, art: 'erledigt' }));
  const laufend = f.massnahmen
    .filter((m) => m.status !== 'erledigt')
    .slice(0, 2)
    .map((m): WaldjahrEintrag => ({ wann: m.status === 'geplant' ? 'Geplant' : m.status === 'beantragt' ? 'Beantragt' : 'Beauftragt', titel: m.titel, text: m.erstNachBewilligung && m.status === 'geplant' ? 'Antrag vor dem Beginn stellen' : '', art: 'geplant' }));
  const offen = ents
    .filter((e) => !f.beschluesse.some((b) => b.entscheidungId === e.id) && e.dringlichkeit !== 'gering')
    .slice(0, Math.max(0, 4 - vergangen.length - laufend.length))
    .map((e): WaldjahrEintrag => ({ wann: e.dringlichkeit === 'hoch' ? 'Bald' : 'Dieses Jahr', titel: e.kurz, text: e.ort.split(' · ')[0], art: 'vorhaben' }));
  return [...vergangen.reverse(), ...laufend, ...offen];
}

/** „Frage stellen“: führt eine Frage in Alltagssprache zum passenden geführten Ablauf. Kein Sprachmodell. */
export function frageRouten(text: string): { ziel: string; titel: string } {
  const s = text.toLowerCase();
  const passt = (...w: string[]) => w.some((x) => s.includes(x));
  if (passt('ernt', 'durchforst', 'holz verkauf', 'verkaufen', 'einschlag', 'festmeter', 'erlös')) return { ziel: '#/ernte', titel: 'Holz ernten?' };
  if (passt('pflanz', 'kahl', 'aufforst', 'wiederbewald', 'umbau', 'tanne', 'zukunft', 'klima', 'mischwald')) return { ziel: '#/zukunft', titel: 'Zukunft planen' };
  if (passt('förder', 'zuschuss', 'antrag', 'geld vom staat')) return { ziel: '#/zukunft', titel: 'Förderung prüfen' };
  if (passt('mess', 'vorrat', 'genau', 'winkelzähl', 'inventur')) return { ziel: '#/messen', titel: 'Genauer messen' };
  if (passt('wert', 'vermögen', 'erb', 'co2', 'co₂', 'kohlenstoff')) return { ziel: '#/vermoegen', titel: 'Wert und Vermögen' };
  if (passt('käfer', 'schad', 'sturm', 'trocken', 'krank')) return { ziel: '#/aufgaben', titel: 'Aufgaben ansehen' };
  return { ziel: '#/planen', titel: 'Planen' };
}

/**
 * Erste Erkenntnis für das Porträt: was die Standorteignung über die Zukunft der Baumarten
 * sagt. Kein Geldwert – der braucht Vorratsdaten.
 */
export function ersteErkenntnis(w: Wald): { satz: string; grundlage: string } | null {
  const schlechter = new Map<string, number>(), gut = new Map<string, number>();
  const plus = (m: Map<string, number>, k: string, v: number) => m.set(k, (m.get(k) ?? 0) + v);
  for (const b of w.bestaende) {
    for (const e of b.eignung) {
      if (e.entwicklung === 'schlechter') plus(schlechter, e.art, b.ha);
      else if (e.heute === 'gut') plus(gut, e.art, b.ha);
    }
  }
  const top = (m: Map<string, number>, n: number) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
  const s = top(schlechter, 1)[0];
  const g = top(gut, 3).filter((x) => x !== s).slice(0, 2);
  if (!s && !g.length) return null;
  const satz = [s && `Für ${s} wird es hier enger.`, g.length && `${g.join(' und ')} ${g.length > 1 ? 'passen' : 'passt'} gut zu Ihrem Standort.`].filter(Boolean).join(' ');
  return {
    satz,
    grundlage: w.quelle === 'eigen'
      ? 'Allgemeine Einschätzung ohne Standortdaten. Mit Boden- und Klimadaten aus dem Zwilling wird sie genauer.'
      : 'Abgeleitet aus Boden, Höhenlage und Klima. Ein Blick in den Bestand macht es sicher.',
  };
}
