import { datumKurz, euro } from '../engine/format';
import { MASSNAHME_STATUS_TEXT, STATUS_FOLGE, type Massnahme, type MassnahmeStatus } from '../engine/fortschreibung';
import { Icon } from './bausteine';
import { useZustand } from './zustand';

export function naechsterStatus(m: Massnahme): MassnahmeStatus | null {
  if (m.status === 'erledigt') return null;
  if (m.status === 'geplant') return m.erstNachBewilligung ? 'beantragt' : 'beauftragt';
  return STATUS_FOLGE[STATUS_FOLGE.indexOf(m.status) + 1];
}

const AKTION: Record<MassnahmeStatus, string> = { geplant: 'Planen', beantragt: 'Antrag gestellt', beauftragt: 'Beauftragt', erledigt: 'Erledigt' };

/** Eine Maßnahme mit ihrem nächsten Schritt. Erledigt fließt in den Zwilling zurück. */
export function MassnahmeKarte({ m }: { m: Massnahme }) {
  const { wald, massnahmeStatus, toast } = useZustand();
  const name = wald.bestaende.find((b) => b.id === m.bestandId)?.label;
  const n = naechsterStatus(m);
  const vor = () => {
    if (!n) return;
    massnahmeStatus(m.id, n, n === 'erledigt' ? `${m.titel} abgeschlossen` : undefined);
    toast(n === 'erledigt' && m.art === 'ernte' ? 'Erledigt. Der Vorrat im Zwilling ist fortgeschrieben.' : `${MASSNAHME_STATUS_TEXT[n]}.`);
  };
  return (
    <div className="massnahme">
      <b>{m.titel}</b>
      <small>{name ?? 'Gesamter Wald'} · {MASSNAHME_STATUS_TEXT[m.status]} seit {datumKurz(m.erstellt)}{m.kostenRahmen ? ` · ${m.kostenRahmen > 0 ? 'Kosten' : 'Beitrag'} ${euro(Math.abs(m.kostenRahmen))}` : ''}{m.foerderung ? ` · Förderung ${euro(m.foerderung)}` : ''}</small>
      {m.erstNachBewilligung && m.status === 'geplant' && <small style={{ color: 'var(--amber-text)', fontWeight: 600 }}>Förderantrag vor Beginn stellen – sonst entfällt die Förderung.</small>}
      {n && <div className="aktionen"><button className="vor" onClick={vor}>{AKTION[n]} <Icon n="arrow" /></button></div>}
    </div>
  );
}
