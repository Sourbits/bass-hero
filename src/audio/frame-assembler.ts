import type { AudioFrame } from "./audio-source";

export interface FrameAssemblerOptions {
  frameSize: number;
  onFrame: (frame: AudioFrame) => void;
  sampleRate: number;
}

/**
 * Turns sample chunks of any length into fixed-size frames, timed by how many
 * samples came before them. Each frame gets its own copy of the samples, so
 * listeners can keep frames around.
 */
export function createFrameAssembler({
  frameSize,
  onFrame,
  sampleRate,
}: FrameAssemblerOptions) {
  if (!Number.isInteger(frameSize) || frameSize <= 0) {
    throw new RangeError(
      `Frame size must be a positive integer, got ${frameSize}`
    );
  }

  let pending = new Float32Array(frameSize);
  let filled = 0;
  let emittedSamples = 0;

  const emit = (samples: Float32Array) => {
    onFrame({ sampleRate, samples, time: emittedSamples / sampleRate });
    emittedSamples += samples.length;
  };

  return {
    /** Emits the leftover samples as a short final frame, if there are any. */
    flush: () => {
      if (filled > 0) {
        const frame = pending.slice(0, filled);
        filled = 0;
        emit(frame);
      }
    },
    push: (samples: Float32Array) => {
      let offset = 0;
      while (offset < samples.length) {
        const count = Math.min(samples.length - offset, frameSize - filled);
        pending.set(samples.subarray(offset, offset + count), filled);
        filled += count;
        offset += count;

        if (filled === frameSize) {
          const frame = pending;
          pending = new Float32Array(frameSize);
          filled = 0;
          emit(frame);
        }
      }
    },
  };
}
