# Raumluftkomfort

Ein intelligentes Smart Home Klimaüberwachungssystem mit integriertem Lernsystem für optimale Lüftungszeiten.

## Funktionen

### 🧠 Intelligentes Lernsystem
Die App lernt automatisch, wie lange Fenster geöffnet werden müssen, um:
- **CO2-Werte** zu senken (Ziel: unter 800 ppm)
- **Luftfeuchtigkeit** zu reduzieren (Ziel: unter Maximum für Raumtyp)
- **Temperatur** zu optimieren

#### Wie funktioniert das Lernen?

1. **Datenerfassung**: Bei jeder Fenstersession werden Start- und Endwerte erfasst:
   - Temperatur
   - Luftfeuchtigkeit
   - CO2-Konzentration (wenn verfügbar)
   - Außenbedingungen

2. **Ratenberechnung**: Das System berechnet Änderungsraten pro Minute:
   - Temperatur: °C/min
   - CO2: ppm/min
   - Luftfeuchtigkeit: %/min

3. **Gleitender Durchschnitt**: Neue Messungen werden mit 20% Gewichtung einbezogen, bisherige Erfahrungen mit 80%

4. **Präzise Vorhersagen**: 
   - Bei geschlossenem Fenster: Zeigt gelernte Empfehlung (z.B. "12 Min (Gelernt: CO2)")
   - Bei offenem Fenster: Live-Anpassung der Restzeit basierend auf aktueller Änderungsrate

### 📊 Anzeige der Lernempfehlungen

Die App zeigt jetzt präzise Minutenangaben für:
- **"Noch X Min. (Gelernt: Feuchte)"** - Basierend auf gelernter Entfeuchtungsrate
- **"CO2: Noch X Min. (Gelernt)"** - Basierend auf gelernter CO2-Reduktionsrate
- **"Lüften: X Min (Gelernt: CO2)"** - Empfohlene Lüftungsdauer basierend auf historischen Daten

Das System wählt automatisch die längste benötigte Zeit aus allen drei Metriken (Temperatur, CO2, Feuchtigkeit).

### 🔄 Live-Anpassung

Während das Fenster offen ist, passt sich die Vorhersage dynamisch an:
- Nach 3 Minuten beginnt die Live-Analyse
- Nach 15 Minuten wird der Live-Messung vollständig vertraut
- Die verbleibende Zeit wird kontinuierlich aktualisiert

### 💾 Datenspeicherung

Alle Lerndaten werden lokal im Browser gespeichert (localStorage):
- Anzahl der Lern-Sessions pro Raum
- Durchschnittliche Änderungsraten
- Letzte Session-Details
- Außenbedingungen während des Lernens

### 📋 Mindestanforderungen für Lernen

- Fenstersession muss mindestens **5 Minuten** dauern
- Positive Änderung muss messbar sein (Abkühlung/CO2-Reduktion/Entfeuchtung)

## Installation & Entwicklung

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```