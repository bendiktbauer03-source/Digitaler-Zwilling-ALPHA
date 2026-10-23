import { useEffect, useRef, useState } from 'react';
import { gehe, Tabs, useRoute } from './ui/bausteine';
import { Aufgabe, Pruefen } from './ui/seiten/Aufgabe';
import { Aufgaben } from './ui/seiten/Aufgaben';
import { Bestand } from './ui/seiten/Bestand';
import { Chronik } from './ui/seiten/Chronik';
import { Daten } from './ui/seiten/Daten';
import { Ernte } from './ui/seiten/Ernte';
import { Karte } from './ui/seiten/Karte';
import { Messen } from './ui/seiten/Messen';
import { Planen } from './ui/seiten/Planen';
import { Start } from './ui/seiten/Start';
import { Uebersicht } from './ui/seiten/Uebersicht';
import { Umbauplan } from './ui/seiten/Umbauplan';
import { Vermoegen } from './ui/seiten/Vermoegen';
import { Zukunft } from './ui/seiten/Zukunft';
import { useZustand, ZustandProvider } from './ui/zustand';

const TITEL: Record<string, string> = {
  '': 'Übersicht', wald: 'Mein Wald', bestand: 'Fläche', planen: 'Planen', plan: 'Umbauplan', aufgaben: 'Aufgaben', aufgabe: 'Aufgabe', pruefen: 'Wie sicher ist das?',
  zukunft: 'Zukunft planen', ernte: 'Holz ernten?', messen: 'Genauer messen', vermoegen: 'Wert und Vermögen', chronik: 'Chronik', daten: 'Daten und Quellen', start: 'Willkommen',
};

function Seiten() {
  const [seite, param] = useRoute();
  const { bereit, wald, startGesehen } = useZustand();
  document.title = `${TITEL[seite] ?? 'Übersicht'} · ${wald.betrieb.langname} · Die Waldgrafen`;

  // Alte Links weiterleiten; beim allerersten Besuch beginnt der Einstieg.
  const umleitung = !bereit ? null
    : seite === 'entscheidungen' ? (param ? `#/aufgabe/${param}` : '#/aufgaben')
      : seite === '' && !startGesehen && wald.quelle === 'beispiel' ? '#/start'
        : null;
  useEffect(() => {
    if (!umleitung) return;
    history.replaceState(null, '', umleitung);
    dispatchEvent(new HashChangeEvent('hashchange'));
  }, [umleitung]);

  if (!bereit || umleitung) return <div style={{ minHeight: '100vh', background: 'var(--grund)' }} />;
  const s = (() => {
    switch (seite) {
      case 'start': return <Start key={param} param={param} />;
      case 'wald': return <Karte key={param} param={param} />;
      case 'bestand': return <Bestand key={param} param={param} />;
      case 'planen': return <Planen param={param} />;
      case 'plan': return <Umbauplan />;
      case 'aufgaben': return <Aufgaben />;
      case 'aufgabe': return <Aufgabe key={param} param={param} />;
      case 'pruefen': return <Pruefen key={param} param={param} />;
      case 'zukunft': return <Zukunft key={param} param={param} />;
      case 'ernte': return <Ernte key={param} param={param} />;
      case 'messen': return <Messen key={param} param={param} />;
      case 'vermoegen': return <Vermoegen />;
      case 'chronik': return <Chronik />;
      case 'daten': return <Daten />;
      case '': return <Uebersicht />;
      default: gehe('#/'); return null;
    }
  })();
  return <>{s}{seite !== 'start' && seite !== 'aufgabe' && <Tabs seite={seite} />}</>;
}

export function App() {
  const [text, setText] = useState('');
  const [da, setDa] = useState(false);
  const t = useRef<number>(undefined);
  const toast = (x: string) => {
    setText(x); setDa(true);
    clearTimeout(t.current);
    t.current = window.setTimeout(() => setDa(false), 3200);
  };
  return (
    <ZustandProvider onToast={toast}>
      <Seiten />
      <div className={`toast ${da ? 'da' : ''}`} role="status" aria-live="polite">{text}</div>
    </ZustandProvider>
  );
}
