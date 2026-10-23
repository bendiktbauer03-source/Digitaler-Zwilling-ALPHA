import { useEffect, useState, type ReactNode } from 'react';
import { STATUS_TEXT, type Datenstatus } from '../engine/messwert';
import { beschlussVon, useZustand } from './zustand';

/* ───── Routing über den Hash: #/seite/parameter ───── */
let schritte = 0;
export function useRoute(): [string, string | undefined] {
  const lesen = () => {
    const [, seite = '', p] = location.hash.replace(/^#/, '').split('/');
    return [seite, p ? decodeURIComponent(p) : undefined] as [string, string | undefined];
  };
  const [r, setR] = useState(lesen);
  useEffect(() => {
    const f = () => { schritte++; setR(lesen()); window.scrollTo({ top: 0 }); };
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return r;
}

export const gehe = (ziel: string) => { location.hash = ziel.replace(/^#/, ''); };

/** Zurück innerhalb der App; beim direkten Einstieg zur übergeordneten Seite. */
export const zurueck = (eltern: string) => { if (schritte > 0) history.back(); else gehe(eltern); };

/* ───── Icons (Lucide-Formen, inline) ───── */
const PFADE: Record<string, ReactNode> = {
  home: <><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9.5V20a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V9.5" /></>,
  map: <><path d="M14.1 5.1 9.9 3 3 5.6v15.4l6.9-2.6 4.2 2.1L21 18V2.6z" /><path d="M9.9 3v15.4" /><path d="M14.1 5.1v15.4" /></>,
  plan: <><circle cx="12" cy="12" r="10" /><path d="m16.2 7.8-2 6.1-6.1 2 2-6.1z" /></>,
  tasks: <><path d="M9 6h11" /><path d="M9 12h11" /><path d="M9 18h11" /><path d="m3 6 1.5 1.5L7 5" /><path d="m3 12 1.5 1.5L7 11" /><path d="m3 18 1.5 1.5L7 17" /></>,
  trees: <><path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z" /><path d="M7 16v6" /><path d="M13 19v3" /><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5" /></>,
  chart: <><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="m19 9-5 5-4-4-3 3" /></>,
  book: <><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></>,
  arrow: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
  ecke: <><path d="M7 17 17 7" /><path d="M8 7h9v9" /></>,
  back: <><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  frage: <><circle cx="12" cy="12" r="10" /><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" /><path d="M12 17h.01" /></>,
  ruler: <><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z" /><path d="m14.5 12.5 2-2" /><path d="m11.5 9.5 2-2" /><path d="m8.5 6.5 2-2" /><path d="m17.5 15.5 2-2" /></>,
  sprout: <><path d="M7 20h10" /><path d="M10 20c5.5-2.5.8-6.4 3-10" /><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" /><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" /></>,
  axe: <><path d="m14 12-8.5 8.5a2.12 2.12 0 1 1-3-3L11 9" /><path d="M15 13 9 7l4-4 6 6h3a8 8 0 0 1-7 7z" /></>,
  euro: <><path d="M4 10h12" /><path d="M4 14h9" /><path d="M19 6a7.7 7.7 0 0 0-5.2-2A7.9 7.9 0 0 0 6 12c0 4.4 3.5 8 7.8 8 2 0 3.8-.8 5.2-2" /></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5" /><path d="M12 3v12" /></>,
  pin: <><path d="M20 10c0 5-5.5 10.2-7.4 11.8a1 1 0 0 1-1.2 0C9.5 20.2 4 15 4 10a8 8 0 0 1 16 0" /><circle cx="12" cy="10" r="3" /></>,
  pen: <><path d="M12 20h9" /><path d="M16.4 3.6a2 2 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  settings: <><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></>,
  copy: <><rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></>,
  plus: <><path d="M5 12h14" /><path d="M12 5v14" /></>,
  bell: <><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /><path d="M3.3 15.3A1 1 0 0 0 4 17h16a1 1 0 0 0 .7-1.7C19.4 14 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.4 6-2.7 7.3" /></>,
  layers: <><path d="m12.8 2.2 8.6 3.9a1 1 0 0 1 0 1.8l-8.6 3.9a2 2 0 0 1-1.6 0L2.6 7.9a1 1 0 0 1 0-1.8l8.6-3.9a2 2 0 0 1 1.6 0Z" /><path d="m2 12 9.2 4.2a2 2 0 0 0 1.6 0L22 12" /><path d="m2 17 9.2 4.2a2 2 0 0 0 1.6 0L22 17" /></>,
};

export function Icon({ n, gross }: { n: keyof typeof PFADE | string; gross?: boolean }) {
  return <svg className="i" viewBox="0 0 24 24" style={gross ? { width: 24, height: 24 } : undefined} aria-hidden="true">{PFADE[n]}</svg>;
}

/* ───── Datenstatus ───── */
export function Status({ s, text, erklaerung }: { s: Datenstatus; text?: string; erklaerung?: string }) {
  return <span className={`status ${s}`} title={erklaerung} tabIndex={erklaerung ? 0 : undefined}><i />{text ?? STATUS_TEXT[s]}</span>;
}

/** Fortschrittsring – nur für Vollständigkeit oder Umsetzung, nie als „Gesundheitsindex“. */
export function Ring({ anteil, groesse = 48, farbe = 'var(--racing)', text, label }: { anteil: number; groesse?: number; farbe?: string; text?: string; label?: string }) {
  const u = 2 * Math.PI * 26;
  const a = Math.max(0, Math.min(1, anteil));
  return (
    <svg width={groesse} height={groesse} viewBox="0 0 64 64" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true} style={{ flex: 'none' }}>
      <circle cx="32" cy="32" r="26" fill="none" stroke="#E3E3DD" strokeWidth="8" />
      {a > 0 && <circle cx="32" cy="32" r="26" fill="none" stroke={farbe} strokeWidth="8" strokeLinecap="round" strokeDasharray={`${Math.max(a * u, 4)} ${u}`} transform="rotate(-90 32 32)" />}
      {text && <text x="32" y="37" textAnchor="middle" fontFamily="Inter Tight, Inter, sans-serif" fontSize="15" fontWeight="600" fill="#141A16">{text}</text>}
    </svg>
  );
}

export function useOffen() {
  const { entscheidungen, fortschreibung } = useZustand();
  return entscheidungen.filter((e) => !beschlussVon(fortschreibung, e.id));
}

/* ───── Kopfleiste ───── */
export function FrageKnopf() {
  return <a className="pille" href="#/planen/frage" aria-label="Frage stellen"><Icon n="frage" />Fragen</a>;
}

export function Initialen() {
  const { wald } = useZustand();
  const init = (wald.profil.besitzer || wald.betrieb.name).split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase();
  return <a className="rund dunkel" href="#/daten" aria-label="Daten, Quellen und Einstellungen">{init || <Icon n="settings" />}</a>;
}

/** Leiste einer Unterseite: zurück, Titel in der Mitte, Frage stellen. */
export function Leiste({ eltern, mitte }: { eltern: string; mitte?: string }) {
  return (
    <header className="leiste">
      <button className="rund" onClick={() => zurueck(eltern)} aria-label="Zurück"><Icon n="back" /></button>
      <span className="mitte">{mitte}</span>
      <a className="rund" href="#/planen/frage" aria-label="Frage stellen"><Icon n="frage" /></a>
    </header>
  );
}

/* ───── Tab-Leiste: vier Ziele, mehr nicht ───── */
const TABS: [string, string, string, string[]][] = [
  ['', 'Übersicht', 'home', ['']],
  ['wald', 'Mein Wald', 'map', ['wald', 'bestand']],
  ['planen', 'Planen', 'plan', ['planen', 'ernte', 'zukunft', 'messen', 'vermoegen']],
  ['aufgaben', 'Aufgaben', 'tasks', ['aufgaben', 'aufgabe', 'pruefen', 'chronik', 'entscheidungen']],
];

export function Tabs({ seite }: { seite: string }) {
  const offen = useOffen().length;
  return (
    <nav className="tabs" aria-label="Hauptnavigation">
      {TABS.map(([z, t, i, gruppe]) => {
        const an = gruppe.includes(seite);
        return (
          <a key={z} href={`#/${z}`} className={an ? 'an' : ''} aria-current={an ? 'page' : undefined}>
            <Icon n={i} gross />{t}
            {z === 'aufgaben' && offen > 0 && <span className="zaehler-badge" aria-label={`${offen} offen`}>{offen}</span>}
          </a>
        );
      })}
    </nav>
  );
}

const ELTERN: Record<string, string> = { ernte: '#/planen', zukunft: '#/planen', messen: '#/planen', vermoegen: '#/planen', chronik: '#/aufgaben', daten: '#/' };
const MITTE: Record<string, string> = { ernte: 'Holz ernten?', zukunft: 'Zukunft planen', messen: 'Genauer messen', vermoegen: 'Wert und Vermögen', chronik: 'Chronik', daten: 'Daten und Quellen' };

/** Werkzeugseite: die ausführlichen Rechner – eine Ebene unter den einfachen Ansichten. */
export function Werkzeug({ seite, titel, lead, bild, children }: { seite: string; titel: ReactNode; lead?: ReactNode; bild?: string; children: ReactNode }) {
  const { wald } = useZustand();
  return (
    <main className="app breit">
      <Leiste eltern={ELTERN[seite] ?? '#/'} mitte={MITTE[seite]} />
      <section className="werkkopf ein">
        <div className="text">
          {wald.quelle === 'beispiel' && <span className="beispiel">BEISPIELDATEN</span>}
          <h1 className="titel">{titel}</h1>
          {lead && <p className="lead">{lead}</p>}
        </div>
        {bild && <img className="werkbild" src={bild} alt="" />}
      </section>
      <div className="werkinhalt">{children}</div>
    </main>
  );
}

export function Regler({ label, wert, anzeige, min, max, schritt = 1, onChange }: { label: string; wert: number; anzeige: string; min: number; max: number; schritt?: number; onChange: (v: number) => void }) {
  return (
    <div className="regler">
      <label><span>{label}</span><b>{anzeige}</b></label>
      <input type="range" min={min} max={max} step={schritt} value={wert} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
    </div>
  );
}
