// Verdrahtet Kamera, Erkennung, Komposition, Overlay, KI-Check und Bearbeiten.
import { askGemini, buildPrompt, listGeminiModels, makeSnapshot, parseFrameReply, pickDefaultModel, toPct } from './ai-check.js';
import { grabFrame, meanLuma, setZoom, startCamera, stopCamera, zoomRange } from './camera.js';
import {
  ASPECTS,
  computeGuidance,
  computeTargetFrame,
  frameFromRelation,
  lumaHint,
  pickSubject,
  relationFrom,
} from './composer.js';
import { createDetector } from './detector.js';
import { adjustAspect, clampRect, coverTransform, smoothRect } from './geometry.js';
import { requestMotionPermission, startLevel } from './level.js';
import { FRAMES, LOOKS, renderFrame, renderLook } from './looks.js';
import { LEVEL_TOL, drawOverlay } from './overlay.js';
import { canShareFiles, canvasToFile, cropToFrame, downloadFile, shareFiles, timestampName } from './save.js';
import { loadSettings, saveSettings } from './settings.js';

const $ = (id) => document.getElementById(id);
const video = $('video');
const overlay = $('overlay');
const octx = overlay.getContext('2d');

const settings = loadSettings();
const state = {
  cam: null,
  detector: null,
  subject: null,
  subjectMisses: 0,
  frame: null,
  tooBig: false,
  roll: null,
  ai: null, // {rel} (folgt dem Motiv) oder {abs} (fester Ausschnitt)
  lumaMsg: null,
  lastDetect: 0,
  lastLuma: 0,
  hintText: '',
  aiPending: null, // {file, prompt, subject, imageW, imageH}
  captured: null,
  previewBase: null,
  exportFile: null,
};

function show(screenId) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('active', s.id === screenId);
}
const isActive = (id) => $(id).classList.contains('active');

function setStatus(text) {
  $('status').textContent = text || '';
}

function chips(container, items, activeId, onPick) {
  container.replaceChildren(
    ...items.map(({ id, name }) => {
      const b = document.createElement('button');
      b.className = `chip${id === activeId ? ' active' : ''}`;
      b.textContent = name;
      b.addEventListener('click', () => {
        for (const c of container.children) c.classList.toggle('active', c === b);
        onPick(id);
      });
      return b;
    }),
  );
}

// ---------- Start ----------

$('btn-start').addEventListener('click', async () => {
  const motion = requestMotionPermission(); // muss direkt in der Nutzergeste starten
  $('start-error').hidden = true;
  try {
    if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error(), { name: 'NoMedia' });
    state.cam = await startCamera(video);
  } catch (e) {
    const msg =
      e.name === 'NotAllowedError'
        ? 'Kamerazugriff verweigert. Bitte in den iPhone-Einstellungen → Safari → Kamera erlauben und neu laden.'
        : e.name === 'NoMedia'
          ? 'Kamera nicht verfügbar. Die Seite muss über HTTPS geöffnet werden.'
          : `Kamera konnte nicht gestartet werden (${e.name || e.message}).`;
    $('start-error').textContent = msg;
    $('start-error').hidden = false;
    return;
  }
  show('camera');
  setupZoom();
  if (await motion) startLevel(({ roll }) => (state.roll = roll));
  loadDetector();
});

async function loadDetector() {
  if (state.detector) return;
  setStatus('Motiverkennung lädt …');
  try {
    state.detector = await createDetector();
    setStatus('');
  } catch (e) {
    console.warn('Detector', e);
    setStatus('Motiverkennung nicht verfügbar – Frame nach Drittel-Regel');
  }
}

document.addEventListener('visibilitychange', async () => {
  // Nach dem Wechsel in die KI-App hat iOS die Kamera oft beendet.
  if (document.visibilityState !== 'visible' || !state.cam) return;
  if (state.cam.track.readyState === 'ended') {
    try {
      stopCamera(state.cam);
      state.cam = await startCamera(video);
      setupZoom();
    } catch (e) {
      setStatus('Kamera neu starten fehlgeschlagen – bitte Seite neu laden');
    }
  }
});

// ---------- Kamera-Bildschirm ----------

const ASPECT_ITEMS = Object.keys(ASPECTS).map((k) => ({ id: k, name: k }));
chips($('aspects'), ASPECT_ITEMS, settings.aspect, (id) => {
  settings.aspect = id;
  saveSettings(settings);
  clearAi();
});

function setupZoom() {
  const range = zoomRange(state.cam?.track);
  const box = $('zoom');
  if (!range) {
    box.hidden = true;
    return;
  }
  const steps = [0.5, 1, 2, 3, 5].filter((z) => z >= range.min - 1e-6 && z <= range.max + 1e-6);
  if (steps.length < 2) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  const current = steps.includes(1) ? 1 : steps[0];
  chips(
    box,
    steps.map((z) => ({ id: z, name: `${z}×` })),
    current,
    (z) => setZoom(state.cam.track, z).catch(() => setStatus('Zoom nicht möglich')),
  );
}

function clearAi() {
  state.ai = null;
  $('ai-tip').hidden = true;
  $('btn-reset').disabled = true;
}
$('btn-reset').addEventListener('click', clearAi);

function resizeOverlay() {
  const dpr = window.devicePixelRatio || 1;
  const cw = overlay.clientWidth;
  const ch = overlay.clientHeight;
  if (overlay.width !== Math.round(cw * dpr) || overlay.height !== Math.round(ch * dpr)) {
    overlay.width = Math.round(cw * dpr);
    overlay.height = Math.round(ch * dpr);
  }
  octx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return { cw, ch };
}

function tick(now) {
  requestAnimationFrame(tick);
  if (!isActive('camera') || !video.videoWidth) return;
  const W = video.videoWidth;
  const H = video.videoHeight;
  const aspect = ASPECTS[settings.aspect];

  if (state.detector && now - state.lastDetect > 120) {
    state.lastDetect = now;
    try {
      const s = pickSubject(state.detector.detect(video), W, H);
      if (s) {
        state.subject = { ...smoothRect(state.subject, s, 0.5), category: s.category };
        state.subjectMisses = 0;
      } else if (++state.subjectMisses > 8) {
        state.subject = null;
      }
    } catch (e) {
      console.warn('detect', e);
    }
  }

  // Komposition nur im sichtbaren Ausschnitt rechnen (object-fit: cover schneidet Ränder ab).
  const { cw, ch } = resizeOverlay();
  const t = coverTransform(W, H, cw, ch);
  const vis = { x: -t.ox / t.s, y: -t.oy / t.s, w: cw / t.s, h: ch / t.s };
  const toLocal = (r) => r && { ...r, x: r.x - vis.x, y: r.y - vis.y };
  const toGlobal = (r) => ({ ...r, x: r.x + vis.x, y: r.y + vis.y });

  let target;
  let tooBig = false;
  if (state.ai?.rel && state.subject) target = frameFromRelation(toLocal(state.subject), state.ai.rel, aspect, vis.w, vis.h);
  else if (state.ai?.abs) target = clampRect(adjustAspect(toLocal(state.ai.abs), aspect), vis.w, vis.h);
  else ({ frame: target, tooBig } = computeTargetFrame({ subject: toLocal(state.subject), imageW: vis.w, imageH: vis.h, aspect }));
  const g = computeGuidance({ frame: target, tooBig, imageW: vis.w, imageH: vis.h, aspect });
  state.frame = smoothRect(state.frame, toGlobal(target), 0.2);
  state.tooBig = tooBig;

  if (now - state.lastLuma > 600) {
    state.lastLuma = now;
    state.lumaMsg = lumaHint(meanLuma(video, state.frame));
  }
  const levelOk = state.roll == null || Math.abs(state.roll) < LEVEL_TOL;
  const aligned = g.aligned && levelOk;

  drawOverlay(octx, {
    cw,
    ch,
    t,
    frame: state.frame,
    subject: state.subject,
    aligned,
    showGrid: settings.grid,
    roll: state.roll,
  });

  const hints = [...g.hints];
  if (!levelOk) hints.push('Kamera gerade halten');
  if (state.lumaMsg) hints.push(state.lumaMsg);
  const text = aligned ? (state.lumaMsg ? `✓ Ausgerichtet · ${state.lumaMsg}` : '✓ Perfekt – auslösen') : hints.join(' · ');
  if (text !== state.hintText) {
    state.hintText = text;
    $('hint').textContent = text;
    $('hint').classList.toggle('ok', aligned);
    $('btn-shutter').classList.toggle('ready', aligned);
  }
}
requestAnimationFrame(tick);

// ---------- KI-Check ----------

function applyAiReply(text) {
  const p = state.aiPending;
  const parsed = parseFrameReply(text);
  if (!p || !parsed) return false;
  const aspect = ASPECTS[settings.aspect];
  const px = { x: parsed.frame.x * p.imageW, y: parsed.frame.y * p.imageH, w: parsed.frame.w * p.imageW, h: parsed.frame.h * p.imageH };
  const frame = clampRect(adjustAspect(px, aspect), p.imageW, p.imageH);
  state.ai = p.subject ? { rel: relationFrom(p.subject, frame) } : { abs: frame };
  $('ai-tip').textContent = parsed.tip ? `✨ ${parsed.tip}` : '✨ KI-Frame übernommen';
  $('ai-tip').hidden = false;
  $('btn-reset').disabled = false;
  return true;
}

$('btn-ai').addEventListener('click', async () => {
  if (!state.frame || !video.videoWidth) return;
  const W = video.videoWidth;
  const H = video.videoHeight;
  const snap = makeSnapshot(video, W, H, state.frame);
  const prompt = buildPrompt({ aspectLabel: settings.aspect, framePct: toPct(state.frame, W, H) });
  state.aiPending = { prompt, subject: state.subject && { ...state.subject }, imageW: W, imageH: H, file: null };

  if (settings.geminiKey) {
    setStatus('KI prüft …');
    try {
      const jpeg = snap.toDataURL('image/jpeg', 0.85).split(',')[1];
      if (!settings.geminiModel) {
        settings.geminiModel = pickDefaultModel(await listGeminiModels(settings.geminiKey)) || '';
        saveSettings(settings);
      }
      const reply = await askGemini({ key: settings.geminiKey, model: settings.geminiModel, prompt, jpegBase64: jpeg });
      setStatus(applyAiReply(reply) ? '' : 'KI-Antwort nicht lesbar – bitte erneut versuchen');
      return;
    } catch (e) {
      setStatus(`Gemini-Fehler: ${e.message}`);
      // weiter mit dem Teilen-Weg
    }
  }
  state.aiPending.file = await canvasToFile(snap, 'framed-check.jpg', 0.85);
  $('ai-text').value = '';
  $('ai-msg').textContent = '';
  $('ai-sheet').showModal();
});

$('btn-ai-send').addEventListener('click', async () => {
  const p = state.aiPending;
  if (!p?.file) return;
  navigator.clipboard?.writeText(p.prompt).catch(() => {});
  try {
    if (canShareFiles(p.file)) await shareFiles([p.file], p.prompt);
    else {
      downloadFile(p.file);
      $('ai-msg').textContent = 'Teilen nicht verfügbar – Bild wurde heruntergeladen, Prompt ist in der Zwischenablage.';
    }
  } catch (e) {
    $('ai-msg').textContent = `Teilen fehlgeschlagen: ${e.message}`;
  }
});

function tryApply(text) {
  if (applyAiReply(text)) {
    $('ai-sheet').close();
    return;
  }
  $('ai-msg').textContent = 'Keine „FRAME x y b h“-Zeile gefunden. Bitte die ganze Antwort kopieren.';
}

$('btn-ai-paste').addEventListener('click', async () => {
  try {
    const text = await navigator.clipboard.readText();
    $('ai-text').value = text;
    tryApply(text);
  } catch {
    $('ai-msg').textContent = 'Einfügen nicht erlaubt – bitte Antwort ins Textfeld einfügen und „Übernehmen“ tippen.';
    $('ai-text').focus();
  }
});
$('btn-ai-apply').addEventListener('click', () => tryApply($('ai-text').value));
$('btn-ai-close').addEventListener('click', () => $('ai-sheet').close());

// ---------- Aufnahme & Bearbeiten ----------

$('btn-shutter').addEventListener('click', () => {
  if (!state.frame || !video.videoWidth) return;
  state.captured = cropToFrame(grabFrame(video), state.frame);
  const s = Math.min(1, 1200 / Math.max(state.captured.width, state.captured.height));
  const base = document.createElement('canvas');
  base.width = Math.round(state.captured.width * s);
  base.height = Math.round(state.captured.height * s);
  base.getContext('2d').drawImage(state.captured, 0, 0, base.width, base.height);
  state.previewBase = base;
  show('edit');
  renderPreview();
});

function renderPreview() {
  state.exportFile = null;
  $('btn-save').textContent = 'Speichern';
  $('save-msg').textContent = '';
  const out = renderFrame(renderLook(state.previewBase, settings.look), settings.frame);
  const pv = $('preview');
  pv.width = out.width;
  pv.height = out.height;
  pv.getContext('2d').drawImage(out, 0, 0);
}

chips($('looks'), LOOKS, settings.look, (id) => {
  settings.look = id;
  saveSettings(settings);
  renderPreview();
});
chips($('frames'), FRAMES, settings.frame, (id) => {
  settings.frame = id;
  saveSettings(settings);
  renderPreview();
});

$('btn-back').addEventListener('click', () => show('camera'));

async function deliver(file) {
  if (canShareFiles(file)) {
    const ok = await shareFiles([file]);
    $('save-msg').textContent = ok ? 'Im Teilen-Menü „Bild sichern“ wählen.' : '';
  } else {
    downloadFile(file);
    $('save-msg').textContent = 'Bild heruntergeladen.';
  }
}

$('btn-save').addEventListener('click', async () => {
  try {
    if (state.exportFile) {
      await deliver(state.exportFile);
      return;
    }
    $('btn-save').disabled = true;
    $('btn-save').textContent = 'Wird erstellt …';
    await new Promise((r) => setTimeout(r, 30)); // UI kurz aktualisieren lassen
    const full = renderFrame(renderLook(state.captured, settings.look), settings.frame);
    state.exportFile = await canvasToFile(full, timestampName());
    $('btn-save').disabled = false;
    $('btn-save').textContent = 'In Fotos sichern';
    try {
      await deliver(state.exportFile);
    } catch (e) {
      // iOS erlaubt Teilen nach längerer Berechnung oft nur mit neuem Tipp.
      if (e.name !== 'NotAllowedError') throw e;
      $('save-msg').textContent = 'Fertig – bitte nochmal tippen.';
    }
  } catch (e) {
    $('btn-save').disabled = false;
    $('save-msg').textContent = `Speichern fehlgeschlagen: ${e.message}`;
  }
});

// ---------- Einstellungen ----------

$('btn-settings').addEventListener('click', () => {
  $('set-grid').checked = settings.grid;
  $('set-key').value = settings.geminiKey;
  fillModels(settings.geminiModel ? [settings.geminiModel] : []);
  $('set-msg').textContent = '';
  $('settings').showModal();
});

function fillModels(names) {
  const sel = $('set-model');
  const opts = [new Option('Modell: automatisch', '')];
  for (const n of names) opts.push(new Option(n, n));
  sel.replaceChildren(...opts);
  sel.value = settings.geminiModel;
}

$('set-grid').addEventListener('change', (e) => {
  settings.grid = e.target.checked;
  saveSettings(settings);
});
$('set-key').addEventListener('change', (e) => {
  settings.geminiKey = e.target.value.trim();
  settings.geminiModel = '';
  saveSettings(settings);
  fillModels([]);
});
$('set-model').addEventListener('change', (e) => {
  settings.geminiModel = e.target.value;
  saveSettings(settings);
});
$('btn-models').addEventListener('click', async () => {
  const key = $('set-key').value.trim();
  if (!key) {
    $('set-msg').textContent = 'Bitte zuerst einen Key eintragen.';
    return;
  }
  $('set-msg').textContent = 'Lade …';
  try {
    const names = await listGeminiModels(key);
    if (!settings.geminiModel) settings.geminiModel = pickDefaultModel(names) || '';
    saveSettings(settings);
    fillModels(names);
    $('set-msg').textContent = `${names.length} Modelle gefunden. Key funktioniert ✓`;
  } catch (e) {
    $('set-msg').textContent = `Fehler: ${e.message}`;
  }
});
$('btn-settings-close').addEventListener('click', () => $('settings').close());

// ---------- PWA ----------

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
