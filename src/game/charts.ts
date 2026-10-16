import type { Chart } from "./chart";

/**
 * The test chart: 16 notes, one per beat, on the open strings and a few
 * frets low on the neck.
 */
export const WARM_UP: Chart = {
  notes: [
    // Open strings, two of each.
    { beat: 0, note: "E1" },
    { beat: 1, note: "E1" },
    { beat: 2, note: "A1" },
    { beat: 3, note: "A1" },
    { beat: 4, note: "D2" },
    { beat: 5, note: "D2" },
    { beat: 6, note: "G2" },
    { beat: 7, note: "G2" },
    // Open string, then 3rd fret, up the neck.
    { beat: 8, note: "G1" },
    { beat: 9, note: "A1" },
    { beat: 10, note: "C2" },
    { beat: 11, note: "D2" },
    { beat: 12, note: "F2" },
    { beat: 13, note: "G2" },
    { beat: 14, note: "A2" },
    // Home to low E.
    { beat: 15, note: "E1" },
  ],
  title: "Warm-up",
};
