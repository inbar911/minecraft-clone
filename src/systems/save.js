const KEY = 'voxel_sandbox_save_v1';

export function saveGame(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.warn('save failed', e);
    return false;
  }
}

export function loadGame() {
  try {
    const s = localStorage.getItem(KEY);
    if (!s) return null;
    return JSON.parse(s);
  } catch (e) {
    return null;
  }
}

export function clearSave() { localStorage.removeItem(KEY); }
