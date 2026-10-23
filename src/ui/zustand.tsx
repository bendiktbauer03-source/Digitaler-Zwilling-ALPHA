import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { BEISPIELWALD } from '../data/beispielwald';
import { STANDARD_ANNAHMEN, type Annahmen } from '../engine/annahmen';
import { entscheidungenAbleiten, type Entscheidung, type Option } from '../engine/entscheidungen';
import { heuteIso } from '../engine/format';
import { anwenden, LEERE_FORTSCHREIBUNG, type Fortschreibung, type Inventur, type Massnahme, type MassnahmeStatus } from '../engine/fortschreibung';
import type { Wald } from '../engine/modell';
import { lesen, schreiben, zwillingEntfernen, zwillingLaden, zwillingSpeichern } from './speicher';

export type Modus = 'privat' | 'pro';

interface Zustand {
  basis: Wald;
  wald: Wald;
  entscheidungen: Entscheidung[];
  fortschreibung: Fortschreibung;
  annahmen: Annahmen;
  modus: Modus;
  bereit: boolean;
  setModus: (m: Modus) => void;
  setAnnahmen: (a: Annahmen) => void;
  zwillingSetzen: (w: Wald) => Promise<void>;
  beispielLaden: () => Promise<void>;
  beschliessen: (e: Entscheidung, o: Option) => Massnahme | undefined;
  beschlussZuruecknehmen: (entscheidungId: string) => void;
  inventurUebernehmen: (i: Inventur) => void;
  massnahmeAnlegen: (m: Omit<Massnahme, 'id' | 'erstellt' | 'status'>) => void;
  massnahmeStatus: (id: string, s: MassnahmeStatus, notiz?: string) => void;
  fortschreibungZuruecksetzen: () => void;
  toast: (t: string) => void;
}

const Ctx = createContext<Zustand | null>(null);

export function useZustand() {
  const z = useContext(Ctx);
  if (!z) throw new Error('Zustand fehlt');
  return z;
}

const id = () => Math.random().toString(36).slice(2, 10);

export function ZustandProvider({ children, onToast }: { children: ReactNode; onToast: (t: string) => void }) {
  const [basis, setBasis] = useState<Wald>(BEISPIELWALD);
  const [bereit, setBereit] = useState(false);
  const [modus, setModusS] = useState<Modus>(() => lesen('wg-modus', 'privat'));
  const [annahmen, setAnnahmenS] = useState<Annahmen>(() => ({ ...STANDARD_ANNAHMEN, ...lesen<Partial<Annahmen>>('wg-annahmen', {}), version: STANDARD_ANNAHMEN.version }));
  const [fortschreibung, setFS] = useState<Fortschreibung>(LEERE_FORTSCHREIBUNG);

  useEffect(() => {
    zwillingLaden<Wald>().then((w) => {
      const aktiv = w?.bestaende?.length ? w : BEISPIELWALD;
      setBasis(aktiv);
      setFS(lesen(`wg-fs-${aktiv.id}`, LEERE_FORTSCHREIBUNG));
      setBereit(true);
    });
  }, []);

  const fsSetzen = useCallback((f: Fortschreibung) => {
    setFS(f);
    schreiben(`wg-fs-${basis.id}`, f);
  }, [basis.id]);

  const wald = useMemo(() => anwenden(basis, fortschreibung), [basis, fortschreibung]);
  const entscheidungen = useMemo(() => entscheidungenAbleiten({ wald, annahmen }), [wald, annahmen]);

  const z: Zustand = {
    basis, wald, entscheidungen, fortschreibung, annahmen, modus, bereit,
    toast: onToast,
    setModus: (m) => { setModusS(m); schreiben('wg-modus', m); },
    setAnnahmen: (a) => {
      setAnnahmenS(a);
      const { preisFaktor, kostenFaktor } = a;
      schreiben('wg-annahmen', { preisFaktor, kostenFaktor });
    },
    zwillingSetzen: async (w) => {
      await zwillingSpeichern(w);
      setBasis(w);
      setFS(lesen(`wg-fs-${w.id}`, LEERE_FORTSCHREIBUNG));
    },
    beispielLaden: async () => {
      await zwillingEntfernen();
      setBasis(BEISPIELWALD);
      setFS(lesen(`wg-fs-${BEISPIELWALD.id}`, LEERE_FORTSCHREIBUNG));
    },
    beschliessen: (e, o) => {
      const datum = heuteIso();
      let neu: Massnahme | undefined;
      const massnahmen = [...fortschreibung.massnahmen];
      if (o.massnahme) {
        neu = { ...o.massnahme, id: id(), entscheidungId: e.id, status: 'geplant', erstellt: datum };
        massnahmen.push(neu);
      }
      fsSetzen({
        ...fortschreibung,
        massnahmen,
        beschluesse: [...fortschreibung.beschluesse.filter((b) => b.entscheidungId !== e.id), {
          entscheidungId: e.id, optionId: o.id, optionName: o.name, kurz: e.kurz, datum,
          rechenlauf: { ...e.rechenlauf, zeit: new Date().toISOString() },
        }],
      });
      return neu;
    },
    beschlussZuruecknehmen: (eid) => fsSetzen({
      ...fortschreibung,
      beschluesse: fortschreibung.beschluesse.filter((b) => b.entscheidungId !== eid),
      massnahmen: fortschreibung.massnahmen.filter((m) => m.entscheidungId !== eid || m.status !== 'geplant'),
    }),
    inventurUebernehmen: (i) => fsSetzen({ ...fortschreibung, inventuren: [...fortschreibung.inventuren, i] }),
    massnahmeAnlegen: (m) => fsSetzen({ ...fortschreibung, massnahmen: [...fortschreibung.massnahmen, { ...m, id: id(), status: 'geplant', erstellt: heuteIso() }] }),
    massnahmeStatus: (mid, s, notiz) => fsSetzen({
      ...fortschreibung,
      massnahmen: fortschreibung.massnahmen.map((m) => (m.id === mid ? { ...m, status: s, ergebnis: s === 'erledigt' ? { datum: heuteIso(), notiz } : m.ergebnis } : m)),
    }),
    fortschreibungZuruecksetzen: () => fsSetzen(LEERE_FORTSCHREIBUNG),
  };
  return <Ctx.Provider value={z}>{children}</Ctx.Provider>;
}

/** Ist eine Entscheidung bereits getroffen? */
export function beschlussVon(f: Fortschreibung, eid: string) {
  return f.beschluesse.find((b) => b.entscheidungId === eid);
}
