/**
 * The seam between where audio comes from and everything that analyzes it.
 *
 * Pitch and onset detection depend only on this interface, so the live
 * microphone can be swapped for a recorded audio file in tests.
 */

/** A block of mono samples in the range [-1, 1]. */
export interface AudioFrame {
  sampleRate: number;
  samples: Float32Array;
  /** Seconds since the source started, at the first sample of this frame. */
  time: number;
}

export type AudioFrameListener = (frame: AudioFrame) => void;

export interface AudioSource {
  /** Registers a listener for incoming frames and returns an unsubscribe function. */
  onFrame: (listener: AudioFrameListener) => () => void;
  start: () => Promise<void>;
  stop: () => Promise<void>;
}
