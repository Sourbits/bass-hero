import { describe, expect, test } from "bun:test";
import type { NoteReading } from "./note-detector";
import { createNoteSmoother } from "./note-smoother";
import { frequencyToNote } from "./notes";

function reading(time: number, frequency: number | null): NoteReading {
  return {
    clarity: frequency === null ? 0 : 0.99,
    levelDb: -20,
    note: frequency === null ? null : frequencyToNote(frequency),
    time,
  };
}

const label = (note: ReturnType<typeof frequencyToNote> | null) =>
  note ? `${note.name}${note.octave}` : null;

describe("createNoteSmoother", () => {
  test("shows the first note straight away", () => {
    const smoother = createNoteSmoother();

    expect(label(smoother.update(reading(0, 41.2)))).toBe("E1");
  });

  test("eases the cents value toward new readings", () => {
    const smoother = createNoteSmoother({ response: 0.5 });
    smoother.update(reading(0, 55));

    const shown = smoother.update(reading(0.02, 55 * 2 ** (20 / 1200)));

    expect(shown?.cents).toBeCloseTo(10, 6);
  });

  test("ignores one stray reading of a different note", () => {
    const smoother = createNoteSmoother();
    smoother.update(reading(0, 41.2));

    expect(label(smoother.update(reading(0.02, 82.4)))).toBe("E1");
    expect(label(smoother.update(reading(0.04, 41.2)))).toBe("E1");
  });

  test("switches once a new note is heard twice in a row", () => {
    const smoother = createNoteSmoother();
    smoother.update(reading(0, 41.2));

    smoother.update(reading(0.02, 55));

    expect(label(smoother.update(reading(0.04, 55)))).toBe("A1");
  });

  test("holds a fading note briefly, then clears it", () => {
    const smoother = createNoteSmoother({ holdSeconds: 0.4 });
    smoother.update(reading(0, 41.2));

    expect(label(smoother.update(reading(0.3, null)))).toBe("E1");
    expect(smoother.update(reading(0.5, null))).toBeNull();
  });
});
