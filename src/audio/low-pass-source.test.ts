import { describe, expect, test } from "bun:test";
import { CLICK, clickSamples } from "@/audio/play-note";
import { createSampleSource } from "@/audio/sample-source";
import { generatePlucks } from "@/audio/tones";
import { detectOnsets, type Onset } from "@/onset/onset-detector";
import { midiToFrequency } from "@/pitch/notes";
import { lowPass } from "./low-pass-source";

const SAMPLE_RATE = 48_000;
const BASS_HARMONICS = [0.6, 1, 0.5, 0.3, 0.15];

/** Adds the metronome's click, as the mic would hear it, louder than life. */
function addClick(samples: Float32Array, timeSeconds: number) {
  const click = clickSamples(SAMPLE_RATE, CLICK.frequencyHz);
  const start = Math.round(timeSeconds * SAMPLE_RATE);
  for (const [index, value] of click.entries()) {
    samples[start + index] = (samples[start + index] ?? 0) + 0.5 * value;
  }
}

async function onsets(filtered: boolean) {
  const clip = generatePlucks(
    [{ amplitude: 0.3, frequency: midiToFrequency(33), time: 1 }],
    {
      duration: 2,
      harmonics: BASS_HARMONICS,
      noise: 0.002,
      sampleRate: SAMPLE_RATE,
    }
  );
  // Clicks on their own, and one just before the pluck.
  addClick(clip.samples, 0.5);
  addClick(clip.samples, 0.97);
  const source = createSampleSource(clip);
  const listened = filtered ? lowPass(source, 350) : source;
  const found: Onset[] = [];
  detectOnsets(listened, { onOnset: (onset) => found.push(onset) });
  await source.start();
  return found.map(({ timeMs }) => Math.round(timeMs));
}

describe("lowPass", () => {
  test("hides a metronome click from the onset detector", async () => {
    // Unfiltered, the clicks count as plucks.
    expect((await onsets(false)).length).toBeGreaterThan(1);
    // Filtered, only the bass pluck is left, on time.
    const times = await onsets(true);
    expect(times).toHaveLength(1);
    expect(Math.abs((times[0] ?? 0) - 1000)).toBeLessThan(6);
  });
});
