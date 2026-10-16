import { PitchDetector as McLeodPitchDetector } from "pitchy";

export interface PitchEstimate {
  /** How periodic the window was, from 0 (noise) to 1 (a perfectly steady tone). */
  clarity: number;
  frequency: number;
}

/**
 * Finds the pitch of one window of samples. Everything else depends on this
 * interface, so trying another algorithm only means writing a new factory.
 */
export interface PitchDetector {
  detect: (window: Float32Array, sampleRate: number) => PitchEstimate | null;
  /** The number of samples detect() expects in each window. */
  windowSize: number;
}

export type CreatePitchDetector = (windowSize: number) => PitchDetector;

/** Shortest window that still holds several cycles of a bass's lowest notes. */
const MIN_WINDOW_SECONDS = 0.08;

/**
 * The smallest power of two holding at least 80 ms at this sample rate: 4096
 * samples at 44.1 or 48 kHz. That is about 3.5 cycles of low E (41.2 Hz).
 */
export function windowSizeFor(sampleRate: number) {
  return 2 ** Math.ceil(Math.log2(sampleRate * MIN_WINDOW_SECONDS));
}

/**
 * The McLeod Pitch Method, from the pitchy library. NOTES.md explains why it
 * was picked over YIN, FFT peaks and the others.
 */
export const createMcLeodDetector: CreatePitchDetector = (windowSize) => {
  const detector = McLeodPitchDetector.forFloat32Array(windowSize);

  return {
    detect: (window, sampleRate) => {
      const [frequency, clarity] = detector.findPitch(window, sampleRate);
      if (!Number.isFinite(frequency) || frequency <= 0) {
        return null;
      }
      return { clarity, frequency };
    },
    windowSize,
  };
};
