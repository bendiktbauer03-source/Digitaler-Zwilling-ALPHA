# Die Waldgrafen · Digitaler Waldzwilling

**Aus Walddaten werden Entscheidungen.** Diese App ist die Entscheidungs- und Erlebnisschicht über dem Waldgrafen-Zwilling. Sie beantwortet drei Fragen:

1. **Was ist mit meinem Wald los?** Zustand, Wert, Risiken, und wie sicher jede Zahl ist.
2. **Was sollte ich tun, und warum?** Berechnete Optionen mit Wirkung, Gründen, Risiken und Datenlage.
3. **Wie setze ich es um?** Förderprüfung, Unternehmeranfrage, Maßnahmen, Rückfluss in den Zwilling.

Die bestehende Erfassungspipeline (Fernerkundung, ForestSimulator, SorSim, HeProMo, Optimierung) rechnet weiterhin die Wissenschaft. Diese App leitet daraus die Entscheidungen ab, die jetzt anstehen, und schließt die Lücken mit eigenen, offen gelegten Rechnern.

## Starten

```bash
npm install
npm run dev        # Entwicklung
npm test           # Tests der Rechen-Engine
npm run build      # Produktionsbuild nach dist/
```

Ohne eigenen Zwilling zeigt die App den **fiktiven Beispielwald „Waldgut am Lech“** (12,4 ha, fünf Bestände). Er ist so gebaut, dass jeder Entscheidungstyp vorkommt.

**Eigenen Zwilling laden:** Unter *Daten* die Zwillings-HTML (z. B. `…_Digitaler_Zwilling.html`) oder das `wg-daten`-JSON hineinziehen. Die Datei wird nur im Browser gelesen und dort gespeichert (IndexedDB). Es wird nichts hochgeladen.

> Echte Kundenzwillinge gehören nicht in dieses öffentliche Repository. `.gitignore` schließt `private/`, `*.zwilling.json` und `*Digitaler_Zwilling*.html` aus.

## Aufbau

```
src/engine/          Rechen-Engine, ohne UI, vollständig getestet
  messwert.ts        Jede Kennzahl: Wert, Einheit, Quelle, Stand, Unsicherheit → Datenstatus
  modell.ts          Ein Bestand für alle Rechner (Eigentümer → Wald → Bestand → …)
  zwilling-import.ts Adapter für die Ausgabe der Waldgrafen-Pipeline (wg-daten)
  entscheidungen.ts  Die Entscheidungs-Engine: leitet anstehende Entscheidungen ab
  ernte.ts           Holzernte-Optimierer: Sortimente, Stückmassegesetz, Verfahren, Zeitpunkt
  kultur.ts          Zukunftswald: Naturverjüngung, Pflanzung, Kombination; Ausfall als Szenarien
  foerderung/        Versioniertes Regelpaket WALDFÖPR 2025 mit Quellen je Satz
  wzp.ts             Winkelzählprobe: G = k · n, Hangkorrektur, Stichprobenfehler, Vorrat
  vermoegen.ts       Holzwert (Abtriebswert-Näherung) und CO₂
  finanzen.ts        Kapitalwert, Annuität, Schadwahrscheinlichkeit
  fortschreibung.ts  Messungen, Beschlüsse, Maßnahmen → zurück in den Zwilling; Rechenläufe
  annahmen.ts        Alle Preise und Kosten an einer Stelle, versioniert
src/ui/              Oberfläche „Heritage meets Intelligence“
src/data/            Fiktiver Beispielwald
```

**Eine Engine, zwei Bedienwelten:** *Privat* zeigt zuerst Ergebnis und Empfehlung. *Pro* zeigt zusätzlich alle Klimapfade, die Preistabelle, Rechenläufe und die Kapitalpriorisierung mit Budget.

## Grundsätze, die im Code durchgesetzt sind

- **Datenstatus vor Ergebnis.** Jede Kennzahl ist *vor Ort bestätigt*, *modellgestützt geschätzt* oder *noch zu prüfen*. Eine Holzverkaufsempfehlung auf „noch zu prüfen“-Daten wird **gesperrt**, die Messung wird zur empfohlenen Option.
- **Kein generierter Fördersatz.** Jeder Satz im Regelpaket hat Quelle und Abrufdatum. Wo nichts belegt ist, steht „Satz nicht hinterlegt“, keine Zahl. Bagatellgrenzen, Bindefristen und „Beginn erst nach Bewilligung“ werden geprüft. Die Zuwendung wird auf die Ausgaben gedeckelt.
- **Keine Scheinpräzision.** Ausfälle als drei Szenarien, Werte als Spannen, Schätzungen gerundet.
- **Nie zwei Modelle direkt vergleichen.** Liegt eine Pipeline-Route vor, ist sie die Basis. Das eigene Modell liefert nur die relative Veränderung (z. B. „in fünf Jahren“).
- **Nachvollziehbarkeit.** Jeder Beschluss speichert einen Rechenlauf (Eingaben-Hash, Modelle, Annahmenversion, Regelpaket).
- **Der Zwilling lebt.** Eine Winkelzählprobe ersetzt den Schätzvorrat. Eine erledigte Ernte schreibt den Vorrat fort. Alle Entscheidungen rechnen sofort neu.

## Offene Punkte

- **Kapitalwerte der Optimierung:** Die App liest `rang[].proKlima[].kapitalwert` als *€ je ha* und rechnet auf die Bestandesfläche hoch. Das ist mit der Pipeline abzugleichen.
- **Regelpaket:** Die Sätze für Naturverjüngung, Kleinzaun und Jungbestandspflege stammen aus dem Waldbesitzer-Portal bzw. StMELF-Informationen. Sie sind gegen die amtliche Anlage (BayMBl. 2025 Nr. 261) zu prüfen. Voranbau und Schutz sind bewusst nicht hinterlegt.
- **Erntemodell und Preise** sind Größenordnungen, nicht kalibriert. Sie werden mit echten Abrechnungen und Unternehmerangeboten ersetzt.
- **Bilder** unter `public/bilder/` stammen aus dem Entscheidungs-Prototyp und sind als Stimmungsbilder gekennzeichnet. Ihre Lizenz ist vor Veröffentlichung zu prüfen.
