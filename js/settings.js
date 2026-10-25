// Einstellungen im localStorage. Kann leer zurückkommen (privates Fenster) – dann gelten Defaults.

const KEY = 'framed-settings-v1';
const DEFAULTS = { aspect: '4:5', grid: true, geminiKey: '', geminiModel: '', look: 'portra', frame: 'none' };

export function loadSettings() {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) || '{}') };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Speichern nicht möglich – Einstellungen gelten dann nur für diese Sitzung.
  }
}
