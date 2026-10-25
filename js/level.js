// Wasserwaage über den Schwerkraftvektor des Bewegungssensors.

const DEG = 180 / Math.PI;

// roll: Drehung um die Blickachse in Grad, auf ±45° um die nächste Hoch-/Querlage normiert
// (damit egal ist, ob das Gerät die Achsen mit umgekehrtem Vorzeichen meldet).
// pitch: Neigung nach vorn/hinten; nur der Betrag ist aussagekräftig.
export function levelFromGravity(gx, gy, gz) {
  const angle = Math.atan2(gx, gy) * DEG;
  const roll = ((((angle + 45) % 90) + 90) % 90) - 45;
  const pitch = Math.atan2(gz, Math.hypot(gx, gy)) * DEG;
  return { roll, pitch };
}

// iOS verlangt eine Erlaubnis, die nur aus einer Nutzergeste heraus angefragt werden darf.
export async function requestMotionPermission() {
  const DME = globalThis.DeviceMotionEvent;
  if (!DME) return false;
  if (typeof DME.requestPermission !== 'function') return true;
  try {
    return (await DME.requestPermission()) === 'granted';
  } catch {
    return false;
  }
}

// Ruft onChange({roll, pitch}) mit geglätteten Werten auf. Gibt eine Stopp-Funktion zurück.
export function startLevel(onChange) {
  let g = null;
  const handler = (e) => {
    const a = e.accelerationIncludingGravity;
    if (!a || a.x == null) return;
    const k = 0.15; // Tiefpass: Handbewegungen herausfiltern
    g = g
      ? { x: g.x + (a.x - g.x) * k, y: g.y + (a.y - g.y) * k, z: g.z + (a.z - g.z) * k }
      : { x: a.x, y: a.y, z: a.z };
    onChange(levelFromGravity(g.x, g.y, g.z));
  };
  window.addEventListener('devicemotion', handler);
  return () => window.removeEventListener('devicemotion', handler);
}
