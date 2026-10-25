# Framed Web MVP – Implementation Plan

**Goal:** Installierbare Web-App (PWA): Live-Kamera mit Kompositions-Frame, Wasserwaage, KI-Check (Teilen an KI-App oder Gemini-Key), Looks & Rahmen, Speichern zugeschnitten auf den Frame.

**Architecture:** Statische Seite ohne Build. Reine, getestete Logik-Module (`geometry`, `composer`, `level`, `ai-check`, `looks`) + dünne Browser-Module (`camera`, `detector`, `overlay`, `save`, `settings`, `app`). Koordinaten intern in Video-Pixeln.

**Tech Stack:** HTML/CSS/ES-Module, MediaPipe Tasks Vision 0.10.14 (ObjectDetector, efficientdet_lite0), Gemini REST `generateContent`, Node `node --test`, Playwright (Smoke-Test mit Fake-Kamera).

## Global Constraints
- Kein Build-Schritt, keine Server-Komponente; läuft auf GitHub Pages (HTTPS).
- Keys nur in `localStorage`, nie im Repo.
- UI-Sprache Deutsch.
- Seitenverhältnisse: 4:5 (Standard), 1:1, 3:4, 9:16.
- Motiv füllt ca. 18 % der Frame-Fläche (damit Drittel-Platzierung möglich ist).
- KI-Antwortformat: Zeile `FRAME x y b h` (Prozent der Bildbreite/-höhe, x/y = oben links) + kurzer Tipp.

---

### Task 1: Geometrie & Komposition (pure)
Files: `js/geometry.js`, `js/composer.js`, `tests/composer.test.js`
- `geometry.js`: `coverTransform(vw,vh,cw,ch)`, `rectToScreen(r,t)`, `fitRect(imageW,imageH,aspect,scale)`, `adjustAspect(r,aspect)`, `clampRect(r,w,h)`, `smoothRect(prev,next,alpha)`, `center(r)`.
- `composer.js`: `ASPECTS`, `pickSubject(detections,w,h)`, `computeTargetFrame({subject,imageW,imageH,aspect})` → `{frame,tooBig}`, `computeGuidance({frame,tooBig,imageW,imageH,aspect})` → `{dx,dy,fill,aligned,hints}`, `relationFrom(subject,frame)`, `frameFromRelation(subject,rel,aspect,w,h)`, `lumaHint(mean)`.
- Tests: Frame hat exaktes Seitenverhältnis, liegt im Bild, Motiv liegt auf Drittel-Punkt, Motiv ~38 % Fläche, ohne Motiv zentriert, zu großes Motiv → `tooBig`, Guidance-Richtungen, Relation-Roundtrip.

### Task 2: Wasserwaage (pure + Sensor)
Files: `js/level.js`, `tests/level.test.js`
- `levelFromGravity(gx,gy,gz)` → `{roll,pitch}` (roll modulo 90°, robust gegen iOS-Vorzeichen), `requestMotionPermission()`, `startLevel(cb)`.
- Tests: aufrecht → 0°, 5° gekippt → ±5°, invertierte Achsen → gleicher Wert, Querformat → 0°.

### Task 3: KI-Check
Files: `js/ai-check.js`, `tests/ai-check.test.js`
- `buildPrompt({aspectLabel,framePct})`, `parseFrameReply(text)` → `{frame:{x,y,w,h} (0..1), tip} | null`, `pickDefaultModel(names)`, `listGeminiModels(key)`, `askGemini({key,model,prompt,jpegBase64})`, `makeSnapshot(video,frame)`.
- Tests: Parsen mit Punkt/Komma, Klammern/Markdown, fehlende Zeile → null, Clamping, Modellwahl.

### Task 4: Looks & Rahmen
Files: `js/looks.js`, `tests/looks.test.js`
- `LOOKS`, `FRAMES`, `applyLookToPixels(data,w,h,look,seed)`, `renderLook(srcCanvas,lookId)`, `renderFrame(srcCanvas,frameId)`.
- Tests: `original` unverändert, `bw` → R=G=B, Vignette dunkelt Ecken.

### Task 5: Browser-Module & UI
Files: `index.html`, `styles.css`, `js/camera.js`, `js/detector.js`, `js/overlay.js`, `js/save.js`, `js/settings.js`, `js/app.js`
- Bildschirme Start → Kamera → Bearbeiten, Einstellungs-Dialog, KI-Panel (Senden / Einfügen / Gemini).
- Zwei-Schritt-Muster für Teilen (iOS verlangt direkte Nutzergeste).

### Task 6: PWA & Doku
Files: `manifest.webmanifest`, `sw.js`, `icons/*`, `README.md`, `package.json`
- Smoke-Test: Playwright mit Fake-Kamera → Kamera-Bildschirm sichtbar, Overlay zeichnet, Auslöser → Bearbeiten → Speichern erzeugt Bild.
