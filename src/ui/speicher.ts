/**
 * Alles bleibt im Browser. Importierte Zwillinge können mehrere MB groß sein (Bilder der
 * Wachstumsreihe) – sie liegen in IndexedDB. Kleine Zustände (Fortschreibung, Annahmen,
 * Modus) in localStorage. Jeder Zugriff ist abgesichert: Ohne Speicher läuft die App weiter.
 */
const DB = 'waldgrafen';
const STORE = 'zwilling';

function oeffnen(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function zwillingSpeichern(wert: unknown) {
  try {
    const db = await oeffnen();
    await new Promise<void>((res, rej) => {
      const t = db.transaction(STORE, 'readwrite');
      t.objectStore(STORE).put(wert, 'aktuell');
      t.oncomplete = () => res();
      t.onerror = () => rej(t.error);
    });
  } catch { /* ohne Speicher weiter */ }
}

export async function zwillingLaden<T>(): Promise<T | undefined> {
  try {
    const db = await oeffnen();
    return await new Promise<T | undefined>((res) => {
      const r = db.transaction(STORE).objectStore(STORE).get('aktuell');
      r.onsuccess = () => res(r.result as T | undefined);
      r.onerror = () => res(undefined);
    });
  } catch { return undefined; }
}

export async function zwillingEntfernen() {
  try {
    const db = await oeffnen();
    db.transaction(STORE, 'readwrite').objectStore(STORE).delete('aktuell');
  } catch { /* egal */ }
}

export function lesen<T>(schluessel: string, standard: T): T {
  try {
    const s = localStorage.getItem(schluessel);
    return s ? (JSON.parse(s) as T) : standard;
  } catch { return standard; }
}

export function schreiben(schluessel: string, wert: unknown) {
  try { localStorage.setItem(schluessel, JSON.stringify(wert)); } catch { /* egal */ }
}
