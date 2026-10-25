// Browser-Smoke-Test mit Fake-Kamera. Aufruf: node tests/e2e/smoke.cjs <url> [screenshot-ordner]
// Benötigt Playwright (npm i -D playwright).
const { chromium } = require('playwright');

(async () => {
  const url = process.argv[2] || 'http://localhost:8080/';
  const out = process.argv[3];
  const browser = await chromium.launch({
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ['camera'] });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

  await page.goto(url);
  await page.click('#btn-start');
  await page.waitForSelector('#camera.active', { timeout: 10000 });
  await page.waitForFunction(() => document.getElementById('video').videoWidth > 0);
  await page.waitForTimeout(1500);

  const drawn = await page.evaluate(() => {
    const c = document.getElementById('overlay');
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
    return n;
  });
  if (!drawn) throw new Error('Overlay ist leer');
  const hint = await page.textContent('#hint');
  const status = await page.textContent('#status');
  if (out) await page.screenshot({ path: `${out}/camera.png` });

  // Aspect wechseln
  await page.click('#aspects .chip:has-text("1:1")');
  await page.waitForTimeout(500);

  // KI-Antwort einfügen (ohne Gemini-Key → Teilen-Dialog)
  await page.click('#btn-ai');
  await page.waitForSelector('#ai-sheet[open]');
  await page.fill('#ai-text', 'FRAME 20 30 50 28\nEtwas mehr Himmel zeigen.');
  await page.click('#btn-ai-apply');
  await page.waitForSelector('#ai-sheet:not([open])', { state: 'attached' });
  const tip = await page.textContent('#ai-tip');
  if (!tip.includes('Himmel')) throw new Error('KI-Tipp fehlt');
  await page.waitForTimeout(800);
  if (out) await page.screenshot({ path: `${out}/camera-ai.png` });

  // Aufnahme → Bearbeiten
  await page.click('#btn-shutter');
  await page.waitForSelector('#edit.active');
  const size = await page.evaluate(() => [document.getElementById('preview').width, document.getElementById('preview').height]);
  if (Math.abs(size[0] / size[1] - 1) > 0.02) throw new Error(`Vorschau nicht 1:1: ${size}`);
  await page.click('#looks .chip:has-text("Tri-X")');
  await page.click('#frames .chip:has-text("Sofortbild")');
  if (out) await page.screenshot({ path: `${out}/edit.png` });

  // Speichern (in Chromium ohne Share → Download)
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.click('#btn-save')]);
  const name = download.suggestedFilename();

  console.log(JSON.stringify({ ok: true, hint, status, previewSize: size, tip, download: name, errors }, null, 2));
  await browser.close();
})().catch((e) => {
  console.error('SMOKE FAIL:', e.message);
  process.exit(1);
});
