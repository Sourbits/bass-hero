import type { BassString } from "@/game/positions";

/**
 * One color per string, used for highway lanes, notes and the fretboard.
 * Dark enough for white text to read on them.
 */
export const STRING_COLORS: Record<BassString, string> = {
  A: "#b45309",
  D: "#047857",
  E: "#be123c",
  G: "#1d4ed8",
};
