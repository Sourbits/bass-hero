import type { BassString } from "@/instrument/bass";

/**
 * One color per string, used for highway lanes, notes and the fretboard.
 * Bright enough to glow on the dark stage, dark enough for white text.
 */
export const STRING_COLORS: Record<BassString, string> = {
  A: "#d97706",
  D: "#059669",
  E: "#e11d48",
  G: "#2563eb",
};
