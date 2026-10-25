# Framed Web – Design (MVP)

Ziel: Web-App (PWA) nach dem Vorbild von „Framed – Foto Komposition“ (App Store id6761207600),
ohne Abo. Live-Kamera zeigt einen Ziel-Frame für eine gute Komposition, führt per Fadenkreuz und
Wasserwaage dorthin, optional bestätigt/korrigiert Claude den Frame. Foto wird auf den Frame
zugeschnitten, mit Look und Rahmen versehen und gespeichert.

Repo: `Kjubyy/framed-web-Test` (öffentlich), Hosting: GitHub Pages. Zielgerät: iPhone, Safari / Home-Bildschirm.

## Technik
- Reines HTML/CSS/JS (ES-Module), kein Build-Schritt, keine Server-Komponente.
- Live-Erkennung: MediaPipe Tasks Vision (Objekt- und Gesichtserkennung) per CDN, läuft im Browser.
- KI-Check, zwei Wege:
  1. **Standard – Teilen an KI-App (z. B. Claude-App):** Schnappschuss + Prompt über die Web Share API.
     Die KI antwortet mit einer Zeile `FRAME x y b h` (Prozent) + Tipp. Nutzer kopiert die Antwort,
     tippt in der App auf „Einfügen“ → Frame wird übernommen. Keine Kosten, kein Key.
  2. **Optional – Gemini-API-Key:** automatischer Check direkt aus dem Browser
     (`generateContent`, Modell in den Einstellungen wählbar, Liste per `models`-Endpoint).
     Key nur in `localStorage`, nie im Repo.
- PWA: `manifest.webmanifest` + Service Worker für App-Shell-Cache.

## Module
| Datei | Aufgabe |
|---|---|
| `camera.js` | Rückkamera via `getUserMedia`, Zoom über `applyConstraints` falls unterstützt, Standbild in Video-Auflösung |
| `detector.js` | MediaPipe → Hauptmotiv-Box (größtes/zentralstes Objekt, Gesicht bevorzugt) |
| `composer.js` | Reine Funktionen: Motiv-Box + Bildgröße + Seitenverhältnis → Ziel-Frame; Abweichung → Hinweise (links/rechts/hoch/runter/näher/weiter) und „ausgerichtet“-Status |
| `level.js` | `DeviceOrientationEvent` (iOS-Permission) → Neigung/Roll, Horizont-Hinweis |
| `overlay.js` | Canvas-Zeichnung: Frame, Fadenkreuz, Drittel-Linien, Wasserwaage, Hinweistext |
| `ai-check.js` | Prompt bauen, Antwort parsen (`FRAME x y b h`), Teilen-Weg und Gemini-Weg |
| `looks.js` | Filmlooks (Korn, Vignette, Farbstich, Kontrast) + Rahmen (Galerie, Polaroid) auf Canvas |
| `save.js` | Zuschnitt auf Frame, Export als JPEG, Web Share API („Bild sichern“), Fallback Download |
| `app.js` | Zustand & Bildschirme: Start → Kamera → Bearbeiten → Einstellungen |

## Ablauf
Kamera → Live-Frame (Regeln) → Ausrichten nach Fadenkreuz/Wasserwaage → Frame grün →
optional „KI prüfen“ (oder automatisch bei ruhiger Hand, Drosselung) → Auslöser →
Look/Rahmen wählen → Speichern (zugeschnitten auf Frame).

## Kompositionsregeln (composer.js)
- Seitenverhältnisse: 4:5 (Standard), 1:1, 3:4, 9:16.
- Motivplatzierung: Drittel-Schnittpunkt nächst zur aktuellen Motivposition; Gesichter mit
  Blickraum; sehr große Motive → zentriert.
- Frame-Größe: Motiv füllt ca. 18 % der Frame-Fläche (gut 40 % der Breite, damit es auf einen
  Drittel-Punkt passt); Frame muss im Bild liegen (sonst
  „weiter weg“), ist er sehr klein → „näher ran“ / Zoom-Hinweis.
- Ohne Motiv: Frame zentriert, Horizont auf unterem Drittel (Hinweis via Wasserwaage).
- Glättung der Frame-Position über Zeit (gegen Zittern).

## Fehlerfälle
- Kein Kamerazugriff / kein HTTPS → Erklärseite.
- Kein Bewegungssensor-Zugriff → Wasserwaage ausgeblendet.
- Kein Key / offline / API-Fehler → Regelmodus, kurzer Hinweis.
- Zoom nicht unterstützt → nur Text-Hinweis „näher ran“.
- MediaPipe lädt nicht → Frame zentriert nach Drittel-Regel ohne Motiv.

## Tests
- Unit-Tests für `composer.js` und Zuschnitt-Mathematik (Node, `node --test`).
- UI-Smoke-Test lokal mit Playwright und Fake-Kamera.
- Praxistest auf dem iPhone durch den Nutzer.

## Nicht im MVP
RAW, Belichtungssteuerung (Safari-Limit), native App, Backend.
