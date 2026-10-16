import { describe, expect, test } from "bun:test";
import type { AudioFrame, AudioSource } from "./audio-source";
import { createFileSource } from "./file-source";
import { encodeWav } from "./test-helpers";
import { generateTone } from "./tones";

const SAMPLE_RATE = 48_000;
const LOW_E = 41.2;

/** Knows only the AudioSource interface, like the detectors will. */
async function recordFrames(source: AudioSource) {
  const frames: AudioFrame[] = [];
  const unsubscribe = source.onFrame((frame) => frames.push(frame));
  await source.start();
  unsubscribe();
  return frames;
}

function lowEFile(sampleCount: number) {
  const { samples } = generateTone({
    duration: sampleCount / SAMPLE_RATE,
    frequency: LOW_E,
    sampleRate: SAMPLE_RATE,
  });
  const bytes = encodeWav({
    channels: [samples],
    encoding: "float32",
    sampleRate: SAMPLE_RATE,
  });
  return { bytes, samples };
}

describe("createFileSource", () => {
  test("delivers the whole recording in order, in timed frames", async () => {
    const { bytes, samples } = lowEFile(2500);

    const frames = await recordFrames(
      createFileSource(bytes, { frameSize: 1024 })
    );

    expect(frames.map((frame) => frame.samples.length)).toEqual([
      1024, 1024, 452,
    ]);
    expect(frames.map((frame) => frame.time)).toEqual([
      0,
      1024 / SAMPLE_RATE,
      2048 / SAMPLE_RATE,
    ]);
    expect(frames.every((frame) => frame.sampleRate === SAMPLE_RATE)).toBe(
      true
    );

    const joined = new Float32Array(samples.length);
    for (const frame of frames) {
      joined.set(frame.samples, Math.round(frame.time * SAMPLE_RATE));
    }
    expect(joined).toEqual(new Float32Array(samples));
  });

  test("replays from the beginning when started again", async () => {
    const source = createFileSource(lowEFile(3000).bytes);

    const first = await recordFrames(source);
    const second = await recordFrames(source);

    expect(second).toEqual(first);
  });

  test("stop() from a listener ends playback early", async () => {
    const source = createFileSource(lowEFile(5000).bytes, { frameSize: 1000 });
    const times: number[] = [];
    source.onFrame((frame) => {
      times.push(frame.time);
      if (times.length === 2) {
        source.stop();
      }
    });

    await source.start();

    expect(times).toHaveLength(2);
  });

  test("unsubscribed listeners get no more frames", async () => {
    const source = createFileSource(lowEFile(2048).bytes);
    let calls = 0;
    const unsubscribe = source.onFrame(() => {
      calls += 1;
    });
    unsubscribe();

    await source.start();

    expect(calls).toBe(0);
  });

  test("start() rejects when a listener throws, and can run again", async () => {
    const source = createFileSource(lowEFile(2048).bytes);
    const unsubscribe = source.onFrame(() => {
      throw new Error("listener failed");
    });

    await expect(source.start()).rejects.toThrow("listener failed");

    unsubscribe();
    expect(await recordFrames(source)).toHaveLength(2);
  });

  test("rejects files that aren't WAV when created", () => {
    expect(() => createFileSource(new ArrayBuffer(4))).toThrow(
      "Not a WAV file"
    );
  });
});
