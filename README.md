# Framed Web

Web-App (PWA) nach dem Vorbild von *Framed – Foto Komposition*, **ohne Abo**:
Die Kamera zeigt live einen **Frame** für den besten Bildausschnitt, Fadenkreuz und Wasserwaage
führen dich hin, eine KI kann den Frame bestätigen oder verbessern. Das Foto wird auf den Frame
zugeschnitten, bekommt einen Filmlook/Rahmen und landet in deinen Fotos.

## Funktionen
- **Live-Frame** nach Drittel-Regel um das erkannte Motiv (MediaPipe, läuft im Browser)
- **Hinweise**: schwenken, näher ran / weiter weg, Helligkeit, Kamera gerade halten
- **Wasserwaage** über den Bewegungssensor
- **Seitenverhältnisse** 4:5 · 1:1 · 3:4 · 9:16, Zoom-Stufen (falls der Browser es unterstützt)
- **KI-Check**
  - *Standard:* Bild + Prompt per **Teilen** an eine KI-App (z. B. Claude) → Antwort kopieren → **Einfügen** → Frame wird übernommen
  - *Optional:* **Gemini-API-Key** in den Einstellungen → Check läuft automatisch
- **Looks**: Portra, Gold, Cinestill, Verblasst, Tri-X · **Rahmen**: Galerie, Sofortbild, Schwarz
- **Speichern** zugeschnitten auf den Frame, über *Teilen → Bild sichern*

## Auf dem iPhone nutzen
1. Seite in **Safari** öffnen (GitHub-Pages-Link, siehe unten).
2. *Teilen → Zum Home-Bildschirm* – startet danach wie eine App.
3. *Kamera starten* → Kamera und Bewegungssensor erlauben.

## Hosting (GitHub Pages)
Repo-Einstellungen → **Pages** → *Deploy from a branch* → Branch `main`, Ordner `/ (root)`.
Die App ist dann unter `https://<user>.github.io/<repo>/` erreichbar (HTTPS ist Pflicht für die Kamera).

## Gemini-Key (optional)
Kostenlos unter [aistudio.google.com/apikey](https://aistudio.google.com/apikey). Der Key wird nur im
Browser gespeichert (`localStorage`), nie im Repo. Im Gratis-Kontingent kann Google Eingaben zur
Verbesserung seiner Dienste nutzen.

## Entwicklung
Kein Build-Schritt – reine HTML/CSS/JS-Module.

```bash
npm run serve        # lokaler Server auf http://localhost:8080
npm test             # Unit-Tests (Node ≥ 20)
node tests/e2e/smoke.cjs http://localhost:8080/   # Browser-Test mit Fake-Kamera (braucht Playwright)
```

| Datei | Aufgabe |
|---|---|
| `js/composer.js` | Kompositionsregeln: Motiv → Frame → Hinweise |
| `js/geometry.js` | Rechteck-Mathematik, Bildschirm-Abbildung |
| `js/level.js` | Wasserwaage |
| `js/ai-check.js` | Prompt, Antwort-Parser, Gemini |
| `js/looks.js` | Filmlooks und Rahmen |
| `js/camera.js`, `js/detector.js`, `js/overlay.js`, `js/save.js`, `js/settings.js` | Browser-Anbindung |
| `js/app.js` | Bildschirme und Ablauf |

## Grenzen (Web statt nativ)
- Foto ist ein Standbild aus dem Kamera-Stream (kein HDR/RAW)
- Belichtung lässt sich in Safari nicht steuern – nur Hinweise
- Zoom nur, wenn der Browser es anbietet
