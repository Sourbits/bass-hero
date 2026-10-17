import { describe, expect, test } from "bun:test";
import { generatePlucks } from "@/audio/tones";
import { TIMING } from "@/config/timing";
import { measureBuzz } from "./buzz";

const SAMPLE_RATE = 48_000;
const NOTES = [41.2, 55, 73.4, 98, 130.8, 196];
const SPECTRA = {
  bassLike: [0.6, 1, 0.5, 0.3, 0.15],
  bright: [1, 0.8, 0.6, 0.5, 0.4, 0.3, 0.25, 0.2, 0.15, 0.1],
  pure: [1],
};

/** Buzz measured the way the game does: 25 to 105 ms after the pluck. */
function buzzOf(frequency: number, harmonics: number[], buzz: number) {
  const clip = generatePlucks([{ buzz, frequency, time: 0 }], {
    duration: 0.2,
    harmonics,
    noise: 0.003,
    sampleRate: SAMPLE_RATE,
  });
  const after = clip.samples.subarray(
    Math.round(0.025 * SAMPLE_RATE),
    Math.round(0.105 * SAMPLE_RATE)
  );
  return measureBuzz(after, SAMPLE_RATE, frequency);
}

describe("measureBuzz", () => {
  test("clean notes stay under the threshold, even bright ones", () => {
    for (const frequency of NOTES) {
      for (const harmonics of Object.values(SPECTRA)) {
        expect(buzzOf(frequency, harmonics, 0)).toBeLessThan(
          TIMING.buzzThresholdDb
        );
      }
    }
  });

  test("strong fret buzz goes over the threshold on every note", () => {
    // Bass tones always have harmonics. A pure sine at the lowest notes needs
    // more buzz than this to cross the threshold: it clicks fewer times a
    // second against a big fundamental.
    for (const frequency of NOTES) {
      for (const harmonics of [SPECTRA.bassLike, SPECTRA.bright]) {
        expect(buzzOf(frequency, harmonics, 0.4)).toBeGreaterThan(
          TIMING.buzzThresholdDb
        );
      }
    }
  });

  test("more buzz measures higher", () => {
    const levels = [0, 0.1, 0.2, 0.4].map((buzz) =>
      buzzOf(55, SPECTRA.bassLike, buzz)
    );

    expect(levels).toEqual([...levels].sort((a, b) => a - b));
  });

  test("silence has no buzz", () => {
    expect(measureBuzz(new Float32Array(1000), SAMPLE_RATE, 55)).toBe(
      Number.NEGATIVE_INFINITY
    );
  });
});
