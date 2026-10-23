/**
 * Der Zwilling ist kein PDF, sondern ein fortlaufend aktualisiertes Modell:
 *
 *   Waldzustand ändert sich → Modelle rechnen neu → neue Entscheidung → Maßnahme wird
 *   umgesetzt → Ergebnis geht zurück in den Zwilling.
 *
 * Die Fortschreibung speichert nur, was seit der Erfassung passiert ist (Inventuren,
 * Beschlüsse, Maßnahmen). `anwenden` legt sie über den erfassten Zwilling.
 */
import type { Messwert } from './messwert';
import type { Wald, TagebuchEintrag } from './modell';
import type { WzpPunkt } from './wzp';

export interface Rechenlauf {
  zeit: string;
  eingabenHash: string;
  modelle: string[];
  annahmen: string;
  regelpaket?: string;
}

export interface Inventur { bestandId: string; datum: string; k: number; punkte: WzpPunkt[]; vorrat: Messwert }

export type MassnahmeArt = 'ernte' | 'kultur' | 'begang' | 'pflege' | 'messung' | 'foerderung' | 'sonstiges';
export type MassnahmeStatus = 'geplant' | 'beantragt' | 'beauftragt' | 'erledigt';

export const STATUS_FOLGE: MassnahmeStatus[] = ['geplant', 'beantragt', 'beauftragt', 'erledigt'];
export const MASSNAHME_STATUS_TEXT: Record<MassnahmeStatus, string> = {
  geplant: 'Geplant', beantragt: 'Förderung beantragt', beauftragt: 'Beauftragt', erledigt: 'Erledigt',
};

export interface Massnahme {
  id: string;
  entscheidungId?: string;
  bestandId?: string;
  titel: string;
  art: MassnahmeArt;
  status: MassnahmeStatus;
  erstellt: string;
  kostenRahmen?: number;
  foerderung?: number;
  vfmProHa?: number;
  /** Förderpflichtige Maßnahme: darf erst nach Bewilligung beginnen */
  erstNachBewilligung?: boolean;
  ergebnis?: { datum: string; notiz?: string };
}

export interface Beschluss {
  entscheidungId: string;
  optionId: string;
  optionName: string;
  kurz: string;
  datum: string;
  rechenlauf: Rechenlauf;
}

export interface Fortschreibung {
  version: 1;
  inventuren: Inventur[];
  massnahmen: Massnahme[];
  beschluesse: Beschluss[];
}

export const LEERE_FORTSCHREIBUNG: Fortschreibung = { version: 1, inventuren: [], massnahmen: [], beschluesse: [] };

/** FNV-1a, um Eingaben eines Rechenlaufs eindeutig wiederzuerkennen. */
export function hash(o: unknown): string {
  const s = JSON.stringify(o);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

export function anwenden(w: Wald, f: Fortschreibung): Wald {
  const tagebuch: TagebuchEintrag[] = [...w.tagebuch];
  const bestaende = w.bestaende.map((b) => {
    let vorrat = b.vorrat;
    const inv = f.inventuren.filter((i) => i.bestandId === b.id).sort((x, y) => x.datum.localeCompare(y.datum)).at(-1);
    if (inv) vorrat = inv.vorrat;
    const seit = inv?.datum ?? w.stand ?? '';
    const ernten = f.massnahmen.filter((m) => m.bestandId === b.id && m.art === 'ernte' && m.status === 'erledigt' && m.vfmProHa && (m.ergebnis?.datum ?? '') >= seit);
    const entnommen = ernten.reduce((s, m) => s + (m.vfmProHa ?? 0), 0);
    if (entnommen > 0) {
      vorrat = {
        ...vorrat,
        wert: Math.max(0, vorrat.wert - entnommen),
        spanne: vorrat.spanne ? [Math.max(0, vorrat.spanne[0] - entnommen), Math.max(0, vorrat.spanne[1] - entnommen)] : undefined,
        quelle: `${vorrat.quelle} · fortgeschrieben um ${ernten.length} Eingriff(e), −${Math.round(entnommen)} Vfm/ha`,
      };
    }
    return vorrat === b.vorrat ? b : { ...b, vorrat };
  });

  for (const i of f.inventuren) {
    const b = w.bestaende.find((x) => x.id === i.bestandId);
    tagebuch.push({ datum: i.datum, titel: 'Winkelzählprobe aufgenommen', text: `${i.punkte.length} Punkte · Vorrat ${i.vorrat.wert} Vfm/ha ± ${Math.round(i.vorrat.genauigkeitPct ?? 0)} %`, bestand: b?.label, quelle: 'Eigene Messung', sicherheit: 'belegt' });
  }
  for (const s of f.beschluesse) {
    tagebuch.push({ datum: s.datum, titel: `Entschieden: ${s.kurz}`, text: s.optionName, quelle: `Rechenlauf ${s.rechenlauf.eingabenHash} · ${s.rechenlauf.annahmen}`, sicherheit: 'belegt' });
  }
  for (const m of f.massnahmen.filter((x) => x.status === 'erledigt')) {
    const b = w.bestaende.find((x) => x.id === m.bestandId);
    tagebuch.push({ datum: m.ergebnis?.datum ?? m.erstellt, titel: `Erledigt: ${m.titel}`, text: m.ergebnis?.notiz ?? '', bestand: b?.label, quelle: 'Maßnahme', sicherheit: 'belegt' });
  }
  tagebuch.sort((a, b) => b.datum.localeCompare(a.datum));
  return { ...w, bestaende, tagebuch };
}
