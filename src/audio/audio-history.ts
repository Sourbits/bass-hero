import type { AudioFrame } from "./audio-source";

/**
 * Keeps the last few seconds of a source's audio, so a stretch can be looked
 * up by clock time after the fact, for example just after a pluck.
 */
export function createAudioHistory(seconds: number) {
  let sampleRate = 0;
  let buffer = new Float32Array(0);
  /** Total samples pushed so far. */
  let written = 0;
  /** Clock time of the sample at index `written`, in seconds. */
  let endTime = 0;

  return {
    push: (frame: AudioFrame) => {
      if (frame.sampleRate !== sampleRate) {
        ({ sampleRate } = frame);
        buffer = new Float32Array(Math.ceil(seconds * sampleRate));
        written = 0;
      }
      for (const sample of frame.samples) {
        buffer[written % buffer.length] = sample;
        written += 1;
      }
      endTime = frame.time + frame.samples.length / sampleRate;
    },

    sampleRate: () => sampleRate,

    /**
     * The samples between two clock times, in seconds, or null if that
     * stretch hasn't arrived yet or has already been forgotten.
     */
    slice: (start: number, end: number): Float32Array | null => {
      if (sampleRate === 0 || end <= start) {
        return null;
      }
      const first = written - Math.round((endTime - start) * sampleRate);
      const last = written - Math.round((endTime - end) * sampleRate);
      if (first < Math.max(0, written - buffer.length) || last > written) {
        return null;
      }
      const out = new Float32Array(last - first);
      for (let index = first; index < last; index += 1) {
        out[index - first] = buffer[index % buffer.length] ?? 0;
      }
      return out;
    },
  };
}
