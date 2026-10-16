import type { AudioFrame } from "./audio-source";

export interface FrameAssemblerOptions {
  frameSize: number;
  onFrame: (frame: AudioFrame) => void;
  sampleRate: number;
  /** Clock time of the first sample, in seconds. Defaults to 0. */
  startTime?: number;
}

/**
 * Turns sample chunks of any length into fixed-size frames. Each frame gets
 * its own copy of the samples, so listeners can keep frames around.
 *
 * Frames are timed on the source's clock. A chunk can bring its own time, as
 * live audio does; otherwise it's assumed to follow the previous chunk.
 */
export function createFrameAssembler({
  frameSize,
  onFrame,
  sampleRate,
  startTime = 0,
}: FrameAssemblerOptions) {
  if (!Number.isInteger(frameSize) || frameSize <= 0) {
    throw new RangeError(
      `Frame size must be a positive integer, got ${frameSize}`
    );
  }

  let pending = new Float32Array(frameSize);
  let filled = 0;
  let pendingTime = startTime;
  let nextChunkTime = startTime;

  const emit = (samples: Float32Array) => {
    onFrame({ sampleRate, samples, time: pendingTime });
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
    /** Adds a chunk. `time` is the clock time of its first sample, in seconds. */
    push: (samples: Float32Array, time = nextChunkTime) => {
      let offset = 0;
      while (offset < samples.length) {
        if (filled === 0) {
          pendingTime = time + offset / sampleRate;
        }
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
      nextChunkTime = time + samples.length / sampleRate;
    },
  };
}
