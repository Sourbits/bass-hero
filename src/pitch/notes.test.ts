import { describe, expect, test } from "bun:test";
import { frequencyToNote, midiToFrequency, parseNote } from "./notes";

describe("frequencyToNote", () => {
  test("names a bass's open strings", () => {
    const names = [41.203, 55, 73.416, 97.999].map((frequency) => {
      const note = frequencyToNote(frequency);
      return `${note.name}${note.octave}`;
    });

    expect(names).toEqual(["E1", "A1", "D2", "G2"]);
  });

  test("measures cents sharp and flat", () => {
    expect(frequencyToNote(440 * 2 ** (10 / 1200)).cents).toBeCloseTo(10, 6);
    expect(frequencyToNote(55 * 2 ** (-30 / 1200)).cents).toBeCloseTo(-30, 6);
  });

  test("rounds to the nearer note halfway between two", () => {
    const note = frequencyToNote(440 * 2 ** (49 / 1200));

    expect(note.name).toBe("A");
    expect(note.cents).toBeCloseTo(49, 6);
    expect(frequencyToNote(440 * 2 ** (51 / 1200)).name).toBe("A#");
  });

  test("follows a different tuning reference", () => {
    const note = frequencyToNote(432, 432);

    expect(note.name).toBe("A");
    expect(note.octave).toBe(4);
    expect(note.cents).toBeCloseTo(0, 6);
  });

  test("handles the octave boundary between B and C", () => {
    expect(frequencyToNote(30.868)).toMatchObject({ name: "B", octave: 0 });
    expect(frequencyToNote(32.703)).toMatchObject({ name: "C", octave: 1 });
  });
});

describe("parseNote", () => {
  test("reads sharps, flats and octaves", () => {
    expect(parseNote("E1")).toBe(28);
    expect(parseNote("F#2")).toBe(42);
    expect(parseNote("Bb0")).toBe(22);
    expect(parseNote(" A4 ")).toBe(69);
  });

  test("returns null for anything else", () => {
    expect(parseNote("H2")).toBeNull();
    expect(parseNote("41.2")).toBeNull();
    expect(parseNote("")).toBeNull();
  });
});

describe("midiToFrequency", () => {
  test("matches standard tuning", () => {
    expect(midiToFrequency(69)).toBe(440);
    expect(midiToFrequency(28)).toBeCloseTo(41.203, 3);
  });
});
