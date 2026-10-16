import { describe, expect, test } from "bun:test";
import type { AudioFrame } from "./audio-source";
import { createToneSource, generateTone } from "./tones";

function countRisingZeroCrossings(samples: Float32Array) {
  let count = 0;
  for (let index = 1; index < samples.length; index += 1) {
    if ((samples[index - 1] ?? 0) < 0 && (samples[index] ?? 0) >= 0) {
      count += 1;
    }
  }
  return count;
}

describe("generateTone", () => {
  test("makes the requested length and frequency", () => {
    const { sampleRate, samples } = generateTone({
      duration: 1,
      frequency: 41.2,
      sampleRate: 48_000,
    });

    expect(sampleRate).toBe(48_000);
    expect(samples.length).toBe(48_000);
    expect(countRisingZeroCrossings(samples)).toBe(41);
  });

  test("keeps the peak at or below the amplitude, even with harmonics", () => {
    const { samples } = generateTone({
      amplitude: 0.8,
      duration: 0.5,
      frequency: 55,
      harmonics: [0.6, 1, 0.5, 0.3],
      sampleRate: 44_100,
    });

    const peak = samples.reduce((max, value) => Math.max(max, Math.abs(value)));
    expect(peak).toBeLessThanOrEqual(0.8);
    expect(peak).toBeGreaterThan(0.4);
  });
});

describe("createToneSource", () => {
  test("delivers the tone as frames", async () => {
    const source = createToneSource(
      { duration: 0.1, frequency: 98, sampleRate: 48_000 },
      { frameSize: 1024 }
    );
    const frames: AudioFrame[] = [];
    source.onFrame((frame) => frames.push(frame));

    await source.start();

    const total = frames.reduce((sum, frame) => sum + frame.samples.length, 0);
    expect(total).toBe(4800);
    expect(frames[0]?.samples.length).toBe(1024);
  });
});
