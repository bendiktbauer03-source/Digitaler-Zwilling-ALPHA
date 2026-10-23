import { useEffect, useState, type ReactNode } from 'react';
import { STATUS_TEXT, type Datenstatus } from '../engine/messwert';
import { useZustand } from './zustand';

/* ───── Routing über den Hash: #/seite/parameter ───── */
export function useRoute(): [string, string | undefined] {
  const lesen = () => {
    const [, seite = '', p] = location.hash.replace(/^#/, '').split('/');
    return [seite, p ? decodeURIComponent(p) : undefined] as [string, string | undefined];
  };
  const [r, setR] = useState(lesen);
  useEffect(() => {
    const f = () => { setR(lesen()); window.scrollTo({ top: 0 }); };
    addEventListener('hashchange', f);
    return () => removeEventListener('hashchange', f);
  }, []);
  return r;
}

export const gehe = (ziel: string) => { location.hash = ziel.replace(/^#/, ''); };

/* ───── Icons (Lucide-Formen, inline) ───── */
const PFADE: Record<string, ReactNode> = {
  trees: <><path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-1-5.8V10a3 3 0 0 1 6 0Z" /><path d="M7 16v6" /><path d="M13 19v3" /><path d="M12 19h8.3a1 1 0 0 0 .7-1.7L18 14h.3a1 1 0 0 0 .7-1.7L16 9h.2a1 1 0 0 0 .8-1.7L13 3l-1.4 1.5" /></>,
  compass: <><circle cx="12" cy="12" r="10" /><path d="m16.2 7.8-2 6.1-6.1 2 2-6.1z" /></>,
  chart: <><path d="M3 3v16a2 2 0 0 0 2 2h16" /><path d="m19 9-5 5-4-4-3 3" /></>,
  book: <><path d="M12 7v14" /><path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" /></>,
  arrow: <><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></>,
  back: <><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></>,
  check: <path d="M20 6 9 17l-5-5" />,
  x: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  bell: <><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /><path d="M3.3 15.3A1 1 0 0 0 4 17h16a1 1 0 0 0 .7-1.7C19.4 14 18 12.5 18 8A6 6 0 0 0 6 8c0 4.5-1.4 6-2.7 7.3" /></>,
  ruler: <><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z" /><path d="m14.5 12.5 2-2" /><path d="m11.5 9.5 2-2" /><path d="m8.5 6.5 2-2" /><path d="m17.5 15.5 2-2" /></>,
  sprout: <><path d="M7 20h10" /><path d="M10 20c5.5-2.5.8-6.4 3-10" /><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z" /><path d="M14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z" /></>,
  axe: <><path d="m14 12-8.5 8.5a2.12 2.12 0 1 1-3-3L11 9" /><path d="M15 13 9 7l4-4 6 6h3a8 8 0 0 1-7 7z" /></>,
  upload: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="m17 8-5-5-5 5" /><path d="M12 3v12" /></>,
  settings: <><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></>,
  copy: <><rect width="14" height="14" x="8" y="8" rx="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></>,
  plus: <><path d="M5 12h14" /><path d="M12 5v14" /></>,
};

export function Icon({ n, gross }: { n: keyof typeof PFADE | string; gross?: boolean }) {
  return <svg className="i" viewBox="0 0 24 24" style={gross ? { width: 24, height: 24 } : undefined} aria-hidden="true">{PFADE[n]}</svg>;
}

/* ───── Datenstatus ───── */
export function Status({ s, text, erklaerung }: { s: Datenstatus; text?: string; erklaerung?: string }) {
  return <span className={`status ${s}`} title={erklaerung} tabIndex={erklaerung ? 0 : undefined}><i />{text ?? STATUS_TEXT[s]}</span>;
}

/* ───── Kopf ───── */
const NAV: [string, string, string][] = [
  ['', 'Mein Wald', 'trees'],
  ['entscheidungen', 'Entscheiden', 'compass'],
  ['zukunft', 'Zukunft', 'sprout'],
  ['vermoegen', 'Vermögen', 'chart'],
  ['chronik', 'Chronik', 'book'],
];

export function Kopf({ seite }: { seite: string }) {
  const { wald, modus, setModus, entscheidungen, fortschreibung } = useZustand();
  const offen = entscheidungen.filter((e) => !fortschreibung.beschluesse.some((b) => b.entscheidungId === e.id)).length;
  const init = (wald.profil.besitzer || wald.betrieb.name).split(/\s+/).map((x) => x[0]).join('').slice(0, 2).toUpperCase();
  const aktiv = seite === 'ernte' || seite === 'messen' ? 'entscheidungen' : seite;
  return (
    <header className="kopf ein">
      <a className="marke" href="#/"><span className="siegel"><img src="siegel.webp" alt="" /></span><b>Die Waldgrafen</b></a>
      <nav className="nav" aria-label="Hauptnavigation">
        {NAV.map(([z, t]) => <a key={z} href={`#/${z}`} className={aktiv === z ? 'an' : ''} aria-current={aktiv === z ? 'page' : undefined}>{t}</a>)}
      </nav>
      <div className="rechts">
        {wald.quelle === 'beispiel' && <span className="beispiel">BEISPIELDATEN</span>}
        <div className="modus" role="group" aria-label="Ansicht">
          <button className={modus === 'privat' ? 'an' : ''} onClick={() => setModus('privat')} aria-pressed={modus === 'privat'}>Privat</button>
          <button className={modus === 'pro' ? 'an' : ''} onClick={() => setModus('pro')} aria-pressed={modus === 'pro'}>Pro</button>
        </div>
        <a className="rund" href="#/entscheidungen" aria-label={`${offen} offene Entscheidungen`}><Icon n="bell" />{offen > 0 && <span className="zahl">{offen}</span>}</a>
        <a className="rund" href="#/daten" aria-label="Daten, Quellen und Einstellungen" style={{ background: 'var(--warm)', color: 'var(--racing)', fontSize: 13, fontWeight: 600 }}>{init || <Icon n="settings" />}</a>
      </div>
    </header>
  );
}

export function Tabs({ seite }: { seite: string }) {
  const aktiv = seite === 'ernte' || seite === 'messen' ? 'entscheidungen' : seite;
  return (
    <nav className="tabs" aria-label="Navigation">
      {NAV.map(([z, t, i]) => <a key={z} href={`#/${z}`} className={aktiv === z ? 'an' : ''}><Icon n={i} />{t}</a>)}
    </nav>
  );
}

/** Werkzeugseite: dunkles Band mit Titel, darunter warmes Papier. */
export function Werkzeug({ seite, titel, lead, bild, children }: { seite: string; titel: ReactNode; lead?: ReactNode; bild?: string; children: ReactNode }) {
  return (
    <>
      <section className="band" style={bild ? ({ ['--bandbild' as string]: `url(${new URL(bild, document.baseURI).href})` }) : undefined}>
        <Kopf seite={seite} />
        <h1 className="ein" style={{ animationDelay: '.1s' }}>{titel}</h1>
        {lead && <p className="lead ein" style={{ animationDelay: '.2s' }}>{lead}</p>}
      </section>
      <main className="papier">{children}</main>
    </>
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
