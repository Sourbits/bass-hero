import { createNoise } from "@/audio/tones";
import { type Chart, chartPositions } from "./chart";
import { WARM_UP } from "./charts";
import { type Position, positionMidi, positionName } from "./positions";

export interface NoteSet {
  description: string;
  /** A fixed song to play, instead of a run generated from the positions. */
  fixedChart?: Chart;
  id: string;
  name: string;
  positions: Position[];
}

export const CUSTOM_SET_ID = "custom";

function frets(string: Position["string"], list: number[]): Position[] {
  return list.map((fret) => ({ fret, string }));
}

/** Natural notes (no sharps) in first position, frets 0 to 4. */
const NATURALS = {
  A: frets("A", [0, 2, 3]),
  D: frets("D", [0, 2, 3]),
  E: frets("E", [0, 1, 3]),
  G: frets("G", [0, 2, 4]),
};

export const NOTE_SETS: NoteSet[] = [
  {
    description: "The 16-note song: open strings, then the 3rd fret.",
    fixedChart: WARM_UP,
    id: "warm-up",
    name: "Warm-up song",
    positions: chartPositions(WARM_UP),
  },
  {
    description: "E, A, D and G, no fretting.",
    id: "open-strings",
    name: "Open strings",
    positions: [
      ...frets("E", [0]),
      ...frets("A", [0]),
      ...frets("D", [0]),
      ...frets("G", [0]),
    ],
  },
  {
    description: "E F G on the E string, A B C on the A string.",
    id: "low-naturals",
    name: "E and A strings, natural notes",
    positions: [...NATURALS.E, ...NATURALS.A],
  },
  {
    description: "D E F on the D string, G A B on the G string.",
    id: "high-naturals",
    name: "D and G strings, natural notes",
    positions: [...NATURALS.D, ...NATURALS.G],
  },
  {
    description: "Every natural note from open E to the 4th fret of G.",
    id: "first-position-naturals",
    name: "First position, natural notes",
    positions: [...NATURALS.E, ...NATURALS.A, ...NATURALS.D, ...NATURALS.G],
  },
  {
    description: "Every note on frets 0 to 4, sharps included.",
    id: "first-position-all",
    name: "First position, all notes",
    positions: (["E", "A", "D", "G"] as const).flatMap((string) =>
      frets(string, [0, 1, 2, 3, 4])
    ),
  },
];

export interface GenerateOptions {
  /** Notes in the run, one per beat. Defaults to 16. */
  length?: number;
  /** Same seed, same run. Defaults to a new run every time. */
  seed?: number;
}

/**
 * A run of notes picked at random from the positions, one per beat. The same
 * note never comes up three times in a row.
 */
export function generateChart(
  positions: Position[],
  { length = 16, seed = (Date.now() % 2_147_483_646) + 1 }: GenerateOptions = {}
): Chart {
  if (positions.length === 0) {
    throw new Error("Pick at least one note.");
  }
  const random = createNoise(seed);
  const picked: Position[] = [];

  while (picked.length < length) {
    const index = Math.floor(((random() + 1) / 2) * positions.length);
    const position = positions[Math.min(index, positions.length - 1)];
    const [previous, beforeThat] = [picked.at(-1), picked.at(-2)];
    const tripled =
      position &&
      previous &&
      beforeThat &&
      positionMidi(position) === positionMidi(previous) &&
      positionMidi(position) === positionMidi(beforeThat) &&
      new Set(positions.map(positionMidi)).size > 1;
    if (position && !tripled) {
      picked.push(position);
    }
  }

  return {
    notes: picked.map((position, beat) => ({
      beat,
      note: positionName(position),
      string: position.string,
    })),
    title: "Practice run",
  };
}
