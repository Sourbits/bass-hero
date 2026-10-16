/**
 * The seam between where audio comes from and everything that analyzes it.
 *
 * Pitch and onset detection depend only on this interface, so the live
 * microphone can be swapped for a recorded audio file in tests.
 */

/**
 * Samples per frame unless a source is told otherwise. About 21 ms at 48 kHz.
 * Detectors that need a longer window should keep their own history.
 */
export const DEFAULT_FRAME_SIZE = 1024;

/**
 * A block of mono samples in the range [-1, 1]. Every frame holds the
 * source's frame size, except the last frame of a finite source, which may
 * be shorter.
 */
export interface AudioFrame {
  sampleRate: number;
  samples: Float32Array;
  /**
   * Time of the frame's first sample on the source's clock, in seconds. For
   * live audio that's the AudioContext clock; for clips it starts at 0.
   */
  time: number;
}

/** A finite run of mono samples, such as a decoded file or a generated tone. */
export interface AudioClip {
  sampleRate: number;
  samples: Float32Array;
}

export type AudioFrameListener = (frame: AudioFrame) => void;

export interface AudioSource {
  /** Registers a listener for incoming frames and returns an unsubscribe function. */
  onFrame: (listener: AudioFrameListener) => () => void;
  /** Starts delivering frames. Does nothing if the source is already running. */
  start: () => Promise<void>;
  /** Stops delivering frames. Safe to call when the source isn't running. */
  stop: () => Promise<void>;
}
