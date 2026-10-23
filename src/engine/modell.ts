/**
 * Das gemeinsame Kernmodell. Jeder Rechner – Holzernte, Zukunftswald, Förderung,
 * Vermögen, Entscheidungen – liest denselben Bestand. Niemand gibt Daten viermal ein.
 *
 * Eigentümer → Wald → Bestand → (Inventur) → Szenario → Entscheidung → Maßnahme → Ergebnis
 */
import type { Messwert } from './messwert';

export type Artgruppe = 'fichte' | 'tanne' | 'kiefer' | 'douglasie' | 'laerche' | 'buche' | 'eiche' | 'edellaub' | 'sonstiges';
export type Dringlichkeit = 'hoch' | 'mittel' | 'gering' | 'keine';
export type Belastung = 'gering' | 'mittel' | 'hoch';

export interface Befund {
  befund: string;
  wert?: string;
  folge?: string;
  dringlichkeit: Dringlichkeit;
}

export interface Eignung {
  art: string;
  heute: 'gut' | 'mittel' | 'schlecht' | string;
  entwicklung: 'besser' | 'stabil' | 'schlechter' | string;
  gruende: string[];
  hinweis?: string;
}

/** Ein Eingriff aus einer vorgerechneten Bewirtschaftungsroute (z. B. ForestSimulator + SorSim + HeProMo). */
export interface RoutenEingriff {
  jahr: number;
  art: string;
  vfmProHa: number;
  efmGesamt: number;
  erloesHa: number;
  kostenHa: number;
  pflanzkostenHa: number;
  foerderungHa: number;
  deckungsbeitragGesamt: number;
  verfahren?: string;
  begruendung: string[];
  sortimente: { art: string; sorte: string; efm: number; preis: number; erloes: number }[];
}

export interface Variante {
  id: string;
  text: string;
  /** 0–100, über alle Klimapfade */
  robust: number;
  schlechtester: number;
  kapitalwertHa: Record<string, number>;   // je Klimapfad, € je ha (Simulationsfläche)
  oekologie: Record<string, number>;
  kalamitaetVfm: Record<string, number>;
  vorratEnde: Record<string, number>;
}

export interface Bildstufe { jahr: number; titel: string; text: string; bild?: string; eingriff?: boolean }

export interface Waldweg {
  modell: string;
  jahre: number;
  gewichtung: string;
  varianten: Variante[];
  siegerId: string;
  eingriffe: RoutenEingriff[];
  zielwald?: { jahr: number; vorrat: number; anteile: { art: string; pct: number }[]; totholz?: number; habitat?: number };
  summeHa?: { erloesHa: number; kostenHa: number; deckungsbeitragHa: number; barwertHa: number };
  quellen: Record<string, string>;
  bildreihe: Bildstufe[];
}

export interface Bestand {
  id: string;
  label: string;
  /** Abteilung oder Flurstück */
  kennung: string;
  ha: number;
  polygon: [number, number][];  // [lon, lat]
  mitte: { lat: number; lon: number };
  hangGrad?: number;
  exposition?: string;
  hoeheM?: number;
  bhdCm?: number;
  alter?: { von: number; bis: number; text: string };
  nadelPct?: number;
  fuehrend: Artgruppe;
  fuehrendText: string;
  /** Baumartenanteile am Vorrat, Summe ≈ 100 */
  arten: { art: Artgruppe; pct: number }[];
  vorrat: Messwert;          // Vfm/ha
  zuwachs?: Messwert;        // Vfm/ha/Jahr
  bestockungsgrad?: number;
  stammzahlProHa?: number;
  kahlflaeche?: boolean;
  /** Verjüngung vorhanden: Samenbäume/Vorausverjüngung, die Naturverjüngung trägt */
  verjuengungMoeglich?: string[];
  jungbestand?: { hoeheM: number };
  vital?: string;
  hiebsreife?: string;
  befunde: Befund[];
  eignung: Eignung[];
  boden?: { nfkMm?: number; text?: string };
  waldweg?: Waldweg;
  /** Für Beispieldaten: fiktiv */
  beispiel?: boolean;
}

export interface Ereignis {
  label: string;
  bestandId?: string;
  ha?: number;
  jahr?: number;
  bestaetigt: boolean;
  erholt?: boolean;
  polygon?: [number, number][];
}

export interface OffeneFrage {
  id: string;
  frage: string;
  warum: string;
  gewinn: string;
  aufwand: string;
  betrifft: string[];
}

export interface TagebuchEintrag {
  datum: string;
  titel: string;
  text: string;
  bestand?: string;
  quelle?: string;
  sicherheit: 'belegt' | 'zu_pruefen' | 'vorschlag' | string;
}

export interface Profil {
  besitzer: string;
  kalkulationszins: number;
  gewichtWirtschaft: number;
  verbiss: Belastung;
  vorratMin?: number;
  vorratMax?: number;
  annahme: boolean;
}

export interface Wald {
  id: string;
  quelle: 'beispiel' | 'zwilling';
  stand: string;
  betrieb: {
    name: string;
    langname: string;
    gemeinde?: string;
    landkreis?: string;
    bundesland: string;
    wuchsgebiet?: string;
  };
  bestaende: Bestand[];
  ereignisse: Ereignis[];
  offeneFragen: OffeneFrage[];
  tagebuch: TagebuchEintrag[];
  profil: Profil;
  klima?: { niederschlagMm?: number; temperaturC?: number; verschiebungC?: number; wasserbilanzSommerMm?: number; text?: string };
  foerderBezug: Record<string, string>;
  kontakte: { name: string; art: string; notiz?: string }[];
  attribution?: string;
}

export const ART_TEXT: Record<Artgruppe, string> = {
  fichte: 'Fichte', tanne: 'Tanne', kiefer: 'Kiefer', douglasie: 'Douglasie', laerche: 'Lärche',
  buche: 'Buche', eiche: 'Eiche', edellaub: 'Edellaubholz', sonstiges: 'Sonstige',
};

export const NADEL: Artgruppe[] = ['fichte', 'tanne', 'kiefer', 'douglasie', 'laerche'];

export function istNadel(a: Artgruppe) { return NADEL.includes(a); }

export function gesamtHa(w: Wald) { return w.bestaende.reduce((s, b) => s + b.ha, 0); }

export function artgruppeAusText(t: string | undefined | null): Artgruppe {
  const s = (t ?? '').toLowerCase();
  if (s.includes('fichte') || s === '511') return 'fichte';
  if (s.includes('tanne') || s === '521') return 'tanne';
  if (s.includes('kiefer') || s === '711') return 'kiefer';
  if (s.includes('douglas')) return 'douglasie';
  if (s.includes('lärche') || s.includes('laerche')) return 'laerche';
  if (s.includes('buche') || s === '211') return 'buche';
  if (s.includes('eiche') || s === '110') return 'eiche';
  if (s.includes('ahorn') || s.includes('esche') || s.includes('kirsche') || s.includes('edellaub') || s.includes('linde')) return 'edellaub';
  if (s.includes('nadel')) return 'fichte';
  if (s.includes('laub')) return 'buche';
  return 'sonstiges';
}
