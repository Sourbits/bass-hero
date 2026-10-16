import { TIMING } from "@/config/timing";

const STORAGE_KEY = "bass-hero:latency-offset-ms";
/** Offsets outside this range are surely a mistake, in ms. */
const MAX_OFFSET_MS = 1000;

/**
 * The calibration offset saved in this browser, in ms. Latency depends on the
 * device, mic and speakers, so it's kept per browser rather than in the code.
 * Falls back to the config default when nothing valid is saved.
 */
export function loadLatencyOffset(): number {
  try {
    const value = Number(window.localStorage.getItem(STORAGE_KEY));
    if (
      window.localStorage.getItem(STORAGE_KEY) !== null &&
      Number.isFinite(value) &&
      Math.abs(value) <= MAX_OFFSET_MS
    ) {
      return value;
    }
  } catch {
    // Storage can be blocked, for example in a private window.
  }
  return TIMING.defaultLatencyOffsetMs;
}

/** Saves the calibration offset for this browser. Returns false if it couldn't. */
export function saveLatencyOffset(offsetMs: number): boolean {
  try {
    window.localStorage.setItem(STORAGE_KEY, String(Math.round(offsetMs)));
    return true;
  } catch {
    return false;
  }
}
