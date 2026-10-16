import { describe, expect, test } from "bun:test";
import { suggestLatencyOffset } from "./calibration";

const BEAT_MS = 750;
const OPTIONS = { matchWindowMs: 300, minHits: 8 };
const beats = Array.from({ length: 16 }, (_, index) => 2000 + index * BEAT_MS);
/** Small, repeatable timing wobble, as a human player has. */
const WOBBLE = [3, -7, 12, -2, 5, -11, 8, 0, -4, 9, -6, 2, 10, -9, 1, -3];

describe("suggestLatencyOffset", () => {
  test("suggests the system's delay from plucks played on the beat", () => {
    const plucks = beats.map((beat, index) => beat + 40 + (WOBBLE[index] ?? 0));

    const result = suggestLatencyOffset(beats, plucks, OPTIONS);

    expect(result?.hits).toBe(16);
    // 40 ms plus the median wobble (0.5 ms).
    expect(result?.offsetMs).toBe(40.5);
    expect(result?.spreadMs).toBeLessThan(10);
  });

  test("handles a negative delay", () => {
    const plucks = beats.map((beat) => beat - 25);

    expect(suggestLatencyOffset(beats, plucks, OPTIONS)?.offsetMs).toBe(-25);
  });

  test("ignores stray plucks and skipped beats", () => {
    const plucks = beats
      .filter((_, index) => index % 4 !== 3)
      .map((beat) => beat + 60);
    // Halfway between beats, and far after the last one.
    plucks.push((beats[2] ?? 0) + 375, 99_999);

    const result = suggestLatencyOffset(beats, plucks, OPTIONS);

    expect(result?.hits).toBe(12);
    expect(result?.offsetMs).toBe(60);
  });

  test("isn't thrown off by a few flubbed beats", () => {
    const plucks = beats.map((beat, index) =>
      index === 5 || index === 9 ? beat + 250 : beat + 30
    );

    expect(suggestLatencyOffset(beats, plucks, OPTIONS)?.offsetMs).toBe(30);
  });

  test("uses each pluck for one beat only", () => {
    const plucks = [beats[0] ?? 0];

    expect(
      suggestLatencyOffset(beats, plucks, { ...OPTIONS, minHits: 1 })?.hits
    ).toBe(1);
  });

  test("gives no suggestion when too few beats were played", () => {
    const plucks = beats.slice(0, 7).map((beat) => beat + 40);

    expect(suggestLatencyOffset(beats, plucks, OPTIONS)).toBeNull();
  });
});
