import { markLocalChange } from "./storage-events";

export const TEMPO_STORAGE_KEY = "bass-hero:tempo-bpm";

export const TEMPO = {
  default: 70,
  max: 140,
  min: 40,
  step: 5,
};

/** A saved tempo if it's in range, or null. */
export function parseTempo(value: unknown): number | null {
  const bpm = Number(value);
  return Number.isFinite(bpm) && bpm >= TEMPO.min && bpm <= TEMPO.max
    ? bpm
    : null;
}

/** The tempo last picked in this browser, or the default. */
export function loadTempo(): number {
  try {
    return (
      parseTempo(window.localStorage.getItem(TEMPO_STORAGE_KEY)) ??
      TEMPO.default
    );
  } catch {
    return TEMPO.default;
  }
}

export function saveTempo(bpm: number) {
  try {
    window.localStorage.setItem(TEMPO_STORAGE_KEY, String(bpm));
  } catch {
    // Not saving the tempo is fine; it only saves picking it again.
  }
  markLocalChange();
}
