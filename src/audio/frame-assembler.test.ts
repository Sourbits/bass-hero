import { describe, expect, test } from "bun:test";
import type { AudioFrame } from "./audio-source";
import { createFrameAssembler } from "./frame-assembler";

function collectFrames(frameSize: number, sampleRate = 4) {
  const frames: AudioFrame[] = [];
  const assembler = createFrameAssembler({
    frameSize,
    onFrame: (frame) => frames.push(frame),
    sampleRate,
  });
  return { assembler, frames };
}

const ramp = (start: number, length: number) =>
  Float32Array.from({ length }, (_, index) => start + index);

describe("createFrameAssembler", () => {
  test("regroups uneven chunks into fixed-size frames", () => {
    const { assembler, frames } = collectFrames(4);

    assembler.push(ramp(0, 3));
    assembler.push(ramp(3, 6));
    assembler.push(ramp(9, 2));

    expect(frames.map((frame) => [...frame.samples])).toEqual([
      [0, 1, 2, 3],
      [4, 5, 6, 7],
    ]);
  });

  test("times each frame by the samples before it", () => {
    const { assembler, frames } = collectFrames(2, 4);

    assembler.push(ramp(0, 6));

    expect(frames.map((frame) => frame.time)).toEqual([0, 0.5, 1]);
    expect(frames.every((frame) => frame.sampleRate === 4)).toBe(true);
  });

  test("flush emits the leftover samples as a short frame", () => {
    const { assembler, frames } = collectFrames(4);

    assembler.push(ramp(0, 6));
    assembler.flush();
    assembler.flush();

    expect(frames.map((frame) => [...frame.samples])).toEqual([
      [0, 1, 2, 3],
      [4, 5],
    ]);
    expect(frames[1]?.time).toBe(1);
  });

  test("frames don't change when the input is reused", () => {
    const { assembler, frames } = collectFrames(2);
    const input = ramp(0, 2);

    assembler.push(input);
    input.fill(9);

    expect([...(frames[0]?.samples ?? [])]).toEqual([0, 1]);
  });

  test("rejects frame sizes that aren't positive integers", () => {
    expect(() => collectFrames(0)).toThrow(RangeError);
    expect(() => collectFrames(1.5)).toThrow(RangeError);
  });
});
