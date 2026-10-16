const STORAGE_KEY = "bass-hero:tempo-bpm";

export const TEMPO = {
  default: 70,
  max: 140,
  min: 40,
  step: 5,
};

/** The tempo last picked in this browser, or the default. */
export function loadTempo(): number {
  try {
    const value = Number(window.localStorage.getItem(STORAGE_KEY));
    if (value >= TEMPO.min && value <= TEMPO.max) {
      return value;
    }
  } catch {
    // Storage can be blocked, for example in a private window.
  }
  return TEMPO.default;
}

export function saveTempo(bpm: number) {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(bpm));
  } catch {
    // Not saving the tempo is fine; it only saves picking it again.
  }
}
