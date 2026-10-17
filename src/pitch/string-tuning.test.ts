import { describe, expect, test } from "bun:test";
import { midiToFrequency } from "./notes";
import { nearestString, tuneString } from "./string-tuning";

const E1 = midiToFrequency(28);
const A1 = midiToFrequency(33);
const D2 = midiToFrequency(38);
const G2 = midiToFrequency(43);

const detune = (frequency: number, cents: number) =>
  frequency * 2 ** (cents / 1200);

describe("nearestString", () => {
  test("knows each open string when it's in tune", () => {
    expect(
      [E1, A1, D2, G2].map((frequency) => nearestString(frequency))
    ).toEqual(["E", "A", "D", "G"]);
  });

  test("still knows a string tuned well off, up to about two semitones", () => {
    expect(nearestString(detune(E1, -200))).toBe("E");
    expect(nearestString(detune(A1, 200))).toBe("A");
    expect(nearestString(detune(D2, -150))).toBe("D");
    expect(nearestString(detune(G2, 240))).toBe("G");
  });

  test("follows a different tuning reference", () => {
    expect(nearestString(midiToFrequency(33, 432), 432)).toBe("A");
  });
});

describe("tuneString", () => {
  test("says to tune up when the string is flat", () => {
    const tuning = tuneString(detune(E1, -30), "E");

    expect(tuning.direction).toBe("up");
    expect(tuning.cents).toBeCloseTo(-30, 6);
    expect(tuning.targetName).toBe("E1");
  });

  test("says to tune down when the string is sharp", () => {
    const tuning = tuneString(detune(A1, 20), "A");

    expect(tuning.direction).toBe("down");
    expect(tuning.cents).toBeCloseTo(20, 6);
  });

  test("says in tune within ±5 cents", () => {
    expect(tuneString(detune(D2, 4.9), "D").direction).toBe("in-tune");
    expect(tuneString(detune(D2, -4.9), "D").direction).toBe("in-tune");
    expect(tuneString(detune(G2, 5.1), "G").direction).toBe("down");
  });

  test("measures against the string you pick, even far off", () => {
    // An E string tuned all the way down to D1 is 200 cents flat.
    const tuning = tuneString(midiToFrequency(26), "E");

    expect(tuning.cents).toBeCloseTo(-200, 6);
    expect(tuning.direction).toBe("up");
  });
});
