import { describe, expect, test } from "bun:test";
import { scheduleChart } from "./chart";
import { generateChart, NOTE_SETS } from "./note-sets";
import {
  defaultPosition,
  positionKey,
  positionMidi,
  positionName,
} from "./positions";

describe("positions", () => {
  test("knows the note at each string and fret", () => {
    expect(positionName({ fret: 0, string: "E" })).toBe("E1");
    expect(positionName({ fret: 3, string: "E" })).toBe("G1");
    expect(positionName({ fret: 3, string: "A" })).toBe("C2");
    expect(positionName({ fret: 1, string: "D" })).toBe("D#2");
    expect(positionName({ fret: 12, string: "G" })).toBe("G3");
    expect(positionKey({ fret: 5, string: "A" })).toBe("A5");
  });

  test("puts a note on its usual string near the nut", () => {
    const names = ["E1", "G#1", "A1", "C#2", "D2", "F#2", "G2", "C3"];
    const midis = [28, 32, 33, 37, 38, 42, 43, 48];

    expect(midis.map((midi) => positionKey(defaultPosition(midi)))).toEqual([
      "E0",
      "E4",
      "A0",
      "A4",
      "D0",
      "D4",
      "G0",
      "G5",
    ]);
    expect(midis.map((midi) => positionName(defaultPosition(midi)))).toEqual(
      names
    );
  });
});

describe("NOTE_SETS", () => {
  test("every set has notes, and ids are unique", () => {
    for (const set of NOTE_SETS) {
      expect(set.positions.length).toBeGreaterThan(0);
    }
    expect(new Set(NOTE_SETS.map((set) => set.id)).size).toBe(NOTE_SETS.length);
  });

  test("the natural-note sets have no sharps", () => {
    for (const set of NOTE_SETS.filter((noteSet) =>
      noteSet.id.includes("naturals")
    )) {
      for (const position of set.positions) {
        expect(positionName(position)).not.toContain("#");
      }
    }
  });

  test("the warm-up set lists the song's notes", () => {
    const warmUp = NOTE_SETS.find((set) => set.id === "warm-up");

    expect(warmUp?.fixedChart?.notes).toHaveLength(16);
    expect(warmUp?.positions.map(positionKey).sort()).toEqual(
      ["A0", "A3", "D0", "D3", "E0", "E3", "G0", "G2"].sort()
    );
  });
});

describe("generateChart", () => {
  const set = NOTE_SETS.find(
    (noteSet) => noteSet.id === "first-position-naturals"
  );
  const positions = set?.positions ?? [];

  test("makes 16 notes, one per beat, all from the set", () => {
    const chart = generateChart(positions, { seed: 7 });
    const allowed = new Set(positions.map(positionKey));
    const notes = scheduleChart(chart, { bpm: 60, startMs: 0 });

    expect(notes).toHaveLength(16);
    expect(notes.map((note) => note.beat)).toEqual(
      Array.from({ length: 16 }, (_, beat) => beat)
    );
    for (const note of notes) {
      expect(allowed.has(positionKey(note))).toBe(true);
    }
  });

  test("gives the same run for the same seed, and a different one otherwise", () => {
    expect(generateChart(positions, { seed: 7 })).toEqual(
      generateChart(positions, { seed: 7 })
    );
    expect(generateChart(positions, { seed: 7 })).not.toEqual(
      generateChart(positions, { seed: 8 })
    );
  });

  test("never repeats a note three times in a row", () => {
    const twoNotes = positions.slice(0, 2);
    for (let seed = 1; seed <= 50; seed += 1) {
      const midis = scheduleChart(generateChart(twoNotes, { seed }), {
        bpm: 60,
        startMs: 0,
      }).map(positionMidi);
      for (let index = 2; index < midis.length; index += 1) {
        const same =
          midis[index] === midis[index - 1] &&
          midis[index] === midis[index - 2];
        expect(same).toBe(false);
      }
    }
  });

  test("works with a single note", () => {
    const chart = generateChart([{ fret: 0, string: "A" }], {
      length: 4,
      seed: 3,
    });

    expect(chart.notes.map((note) => note.note)).toEqual([
      "A1",
      "A1",
      "A1",
      "A1",
    ]);
  });

  test("asks for at least one note", () => {
    expect(() => generateChart([])).toThrow("at least one note");
  });
});
