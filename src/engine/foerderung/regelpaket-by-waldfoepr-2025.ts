/**
 * Regelpaket Bayern · WALDFÖPR 2025
 *
 * Grundsatz: Kein Fördersatz wird generiert. Jeder Satz hier hat eine Quelle und ein
 * Abrufdatum. Wo kein belegter Satz vorliegt, steht `satz: null` – die App sagt dann
 * „Satz nicht hinterlegt, wird vor Antrag geprüft“ statt eine Zahl zu erfinden.
 *
 * Stand der Prüfung: 23.10.2026. Vor jedem Antrag gegen die amtliche Anlage zur
 * Richtlinie (BayMBl. 2025 Nr. 261) und die Bewilligungsbehörde (AELF) prüfen.
 */

export type Einheit = 'stueck' | 'ha' | 'massnahme';

export interface Foerdertatbestand {
  id: string;
  titel: string;
  einheit: Einheit;
  /** € je Einheit; null = nicht hinterlegt */
  satz: number | null;
  /** Abgestufte Sätze, z. B. nach Bestandeshöhe */
  stufen?: { bis: number; satz: number; text: string }[];
  zuschlaege?: { id: string; text: string; satzProEinheit: number | null }[];
  bagatellgrenze?: number;
  bindefristJahre?: number;
  ausschluesse?: string[];
  voraussetzungen: string[];
  quelle: { titel: string; url: string; abgerufen: string; art: 'amtlich' | 'sekundaer' };
  /** Ist der Satz direkt aus amtlicher Quelle übernommen oder noch gegen sie zu prüfen? */
  geprueft: boolean;
}

export interface Regelpaket {
  id: string;
  land: 'BY';
  programm: string;
  version: string;
  gueltigAb: string;
  gueltigBis: string;
  allgemein: string[];
  tatbestaende: Foerdertatbestand[];
}

const PORTAL = 'https://www.waldbesitzer-portal.bayern.de';

export const WALDFOEPR_2025: Regelpaket = {
  id: 'by-waldfoepr-2025',
  land: 'BY',
  programm: 'WALDFÖPR 2025 – Richtlinie für Zuwendungen zu waldbaulichen Maßnahmen',
  version: '2025.1 (Prüfstand 23.10.2026)',
  gueltigAb: '2025-07-01',
  gueltigBis: '2027-12-31',
  allgemein: [
    'Mit der Maßnahme darf grundsätzlich erst nach der Bewilligung begonnen werden. Ausnahmen und die Definition des Maßnahmenbeginns sind vorher mit dem AELF zu klären.',
    'Die beantragte Fläche darf je Bewilligungsbehörde und Jahr 50 ha für Pflanzung/Saat, Bodenverwundung, Pflege von Naturverjüngung und Jungbestandspflege nicht übersteigen.',
    'Förderung ist eine Zuwendung nach Prüfung durch die Behörde – kein Rechtsanspruch, keine Zusage durch diese App.',
  ],
  tatbestaende: [
    {
      id: 'pflanzung',
      titel: 'Erst- und Wiederaufforstung durch Pflanzung (Baumschulpflanzen)',
      einheit: 'stueck',
      satz: 3.8,
      zuschlaege: [
        { id: 'selten', text: 'Seltene Baumarten und Sträucher', satzProEinheit: 5.0 },
      ],
      bagatellgrenze: 700,
      bindefristJahre: 5,
      voraussetzungen: [
        'Standortgemäße Baumarten nach Vorgabe des AELF, geeignete Herkunft',
        'Antrag vor Beginn der Maßnahme',
      ],
      quelle: { titel: 'Bayerisches Waldbesitzer-Portal · Förderung der Wiederaufforstung', url: `${PORTAL}/unser_angebot/foerderung-der-wiederaufforstung/index.html`, abgerufen: '2026-03-05', art: 'amtlich' },
      geprueft: true,
    },
    {
      id: 'naturverjuengung',
      titel: 'Sicherung und Pflege von Naturverjüngung',
      einheit: 'ha',
      satz: 1300,
      ausschluesse: ['Schließt sich mit der Förderung von Kleinzäunen für Verjüngungskerne gegenseitig aus.'],
      voraussetzungen: ['Ausreichende, standortgemäße Naturverjüngung vorhanden', 'Antrag vor Beginn der Maßnahme'],
      quelle: { titel: 'Bayerisches Waldbesitzer-Portal · Förderung Naturverjüngung (WALDFÖPR 2025)', url: `${PORTAL}/unser_angebot/foerderung-naturverjuengung-waldfoepr/index.html`, abgerufen: '2026-10-23', art: 'sekundaer' },
      geprueft: false,
    },
    {
      id: 'kleinzaun',
      titel: 'Kleinzaun zur Etablierung von Verjüngungskernen',
      einheit: 'stueck',
      satz: 600,
      ausschluesse: ['Nicht zusammen mit „Sicherung und Pflege von Naturverjüngung“ auf derselben Fläche.'],
      voraussetzungen: ['Antrag vor Beginn der Maßnahme'],
      quelle: { titel: 'StMELF · Informationen zur WALDFÖPR 2025', url: 'https://www.stmelf.bayern.de/mam/cms01/agrarpolitik/dateien/stmelf_aktuell102_b.pdf', abgerufen: '2026-10-23', art: 'sekundaer' },
      geprueft: false,
    },
    {
      id: 'jungbestandspflege',
      titel: 'Jungbestandspflege',
      einheit: 'ha',
      satz: null,
      stufen: [
        { bis: 5, satz: 650, text: 'bis 5 m mittlere Bestandeshöhe' },
        { bis: 15, satz: 1000, text: 'über 5 bis 15 m mittlere Bestandeshöhe' },
      ],
      zuschlaege: [
        { id: 'kleinprivatwald', text: 'Kleinprivatwald (Zuschlag je nach Höhenstufe 65 bzw. 100 €/ha)', satzProEinheit: null },
      ],
      bagatellgrenze: 300,
      bindefristJahre: 0,
      voraussetzungen: ['Antrag vor Beginn der Maßnahme'],
      quelle: { titel: 'Bayerisches Waldbesitzer-Portal · Förderung der Jungbestandspflege', url: `${PORTAL}/unser_angebot/foerderung-der-jungbestandspflege/index.html`, abgerufen: '2026-10-23', art: 'sekundaer' },
      geprueft: false,
    },
    {
      id: 'voranbau',
      titel: 'Voranbau unter Schirm (Pflanzung)',
      einheit: 'stueck',
      satz: null,
      voraussetzungen: ['Satz und Zuordnung zum Tatbestand Pflanzung mit dem AELF klären', 'Antrag vor Beginn der Maßnahme'],
      quelle: { titel: 'WALDFÖPR 2025, Anlage (BayMBl. 2025 Nr. 261)', url: 'https://www.verkuendung-bayern.de/baymbl/2025-261/', abgerufen: '2026-10-23', art: 'amtlich' },
      geprueft: false,
    },
    {
      id: 'schutz',
      titel: 'Schutz gegen Wildverbiss (Zaun, Einzelschutz)',
      einheit: 'massnahme',
      satz: null,
      voraussetzungen: ['Satz nicht hinterlegt – Zuschläge und Bedingungen mit dem AELF klären'],
      quelle: { titel: 'WALDFÖPR 2025, Anlage (BayMBl. 2025 Nr. 261)', url: 'https://www.verkuendung-bayern.de/baymbl/2025-261/', abgerufen: '2026-10-23', art: 'amtlich' },
      geprueft: false,
    },
  ],
};

export function tatbestand(id: string) {
  const t = WALDFOEPR_2025.tatbestaende.find((x) => x.id === id);
  if (!t) throw new Error(`Unbekannter Fördertatbestand ${id}`);
  return t;
}
