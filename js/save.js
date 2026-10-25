// Zuschneiden, als JPEG verpacken, über das Teilen-Menü sichern.

export function cropToFrame(src, frame) {
  const x = Math.max(0, Math.round(frame.x));
  const y = Math.max(0, Math.round(frame.y));
  const w = Math.min(src.width - x, Math.round(frame.w));
  const h = Math.min(src.height - y, Math.round(frame.h));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  c.getContext('2d').drawImage(src, x, y, w, h, 0, 0, w, h);
  return c;
}

export function canvasToFile(canvas, name, quality = 0.92) {
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(new File([blob], name, { type: 'image/jpeg' })) : reject(new Error('JPEG-Export fehlgeschlagen'))),
      'image/jpeg',
      quality,
    ),
  );
}

export function canShareFiles(file) {
  return !!navigator.canShare?.({ files: [file] });
}

// Muss direkt aus einem Tipp heraus aufgerufen werden (iOS verlangt eine Nutzergeste).
// Gibt false zurück, wenn der Nutzer abbricht.
export async function shareFiles(files, text) {
  try {
    await navigator.share(text ? { files, text } : { files });
    return true;
  } catch (e) {
    if (e.name === 'AbortError') return false;
    throw e;
  }
}

export function downloadFile(file) {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function timestampName(prefix = 'framed') {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${prefix}-${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}.jpg`;
}
