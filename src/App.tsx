import { useRef, useState } from 'react';
import { Tabs, useRoute } from './ui/bausteine';
import { Chronik } from './ui/seiten/Chronik';
import { Daten } from './ui/seiten/Daten';
import { Entscheidungen } from './ui/seiten/Entscheidungen';
import { Ernte } from './ui/seiten/Ernte';
import { MeinWald } from './ui/seiten/MeinWald';
import { Messen } from './ui/seiten/Messen';
import { Vermoegen } from './ui/seiten/Vermoegen';
import { Zukunft } from './ui/seiten/Zukunft';
import { useZustand, ZustandProvider } from './ui/zustand';

const TITEL: Record<string, string> = {
  '': 'Mein Wald', entscheidungen: 'Entscheidungen', zukunft: 'Zukunftswald', ernte: 'Holzernte',
  messen: 'Winkelzählprobe', vermoegen: 'Vermögen', chronik: 'Chronik', daten: 'Daten und Quellen',
};

function Seiten() {
  const [seite, param] = useRoute();
  const { bereit, wald } = useZustand();
  document.title = `${TITEL[seite] ?? 'Mein Wald'} · ${wald.betrieb.langname} · Die Waldgrafen`;
  if (!bereit) return <div style={{ minHeight: '100vh', background: 'var(--racing)' }} />;
  const s = (() => {
    switch (seite) {
      case 'entscheidungen': return <Entscheidungen param={param} />;
      case 'zukunft': return <Zukunft key={param} param={param} />;
      case 'ernte': return <Ernte key={param} param={param} />;
      case 'messen': return <Messen key={param} param={param} />;
      case 'vermoegen': return <Vermoegen />;
      case 'chronik': return <Chronik />;
      case 'daten': return <Daten />;
      default: return <MeinWald />;
    }
  })();
  return <>{s}<Tabs seite={seite} /></>;
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
