// Rückkamera, Zoom (falls der Browser es kann) und Standbild.

export async function startCamera(video) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } },
  });
  video.srcObject = stream;
  video.setAttribute('playsinline', '');
  video.muted = true;
  await video.play();
  const track = stream.getVideoTracks()[0];
  return { stream, track };
}

export function stopCamera(cam) {
  cam?.stream.getTracks().forEach((t) => t.stop());
}

// {min, max} oder null, wenn kein Zoom unterstützt wird.
export function zoomRange(track) {
  const caps = track?.getCapabilities?.() || {};
  if (!caps.zoom || caps.zoom.max <= caps.zoom.min) return null;
  return { min: caps.zoom.min, max: caps.zoom.max };
}

export async function setZoom(track, value) {
  await track.applyConstraints({ advanced: [{ zoom: value }] });
}

// Aktuelles Videobild in voller Auflösung.
export function grabFrame(video) {
  const c = document.createElement('canvas');
  c.width = video.videoWidth;
  c.height = video.videoHeight;
  c.getContext('2d').drawImage(video, 0, 0);
  return c;
}

// Mittlere Helligkeit (0–255) eines Bildausschnitts, grob abgetastet.
const probe = typeof document !== 'undefined' ? document.createElement('canvas') : null;
export function meanLuma(video, rect) {
  probe.width = 24;
  probe.height = 24;
  const ctx = probe.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(video, rect.x, rect.y, rect.w, rect.h, 0, 0, 24, 24);
  const d = ctx.getImageData(0, 0, 24, 24).data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  return sum / (d.length / 4);
}
