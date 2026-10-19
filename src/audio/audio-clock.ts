/** The game clock, in milliseconds. */
export interface Clock {
  /**
   * The game time at a moment given on the page's clock (performance.now(),
   * or a requestAnimationFrame timestamp). Defaults to right now.
   */
  now: (at?: number) => number;
}

/** How much of each new reading the clock takes in; the rest is smoothing. */
const SMOOTHING = 0.05;
/** A reading further off than this is a real jump, not jitter, in ms. */
const SNAP_MS = 50;

/** What the clock needs from an AudioContext, so tests can fake it. */
export type ClockSource = Pick<
  AudioContext,
  "currentTime" | "getOutputTimestamp"
>;

/**
 * The game clock: the AudioContext's clock, in milliseconds, as it reaches
 * the speakers.
 *
 * The audio clock's own timestamps arrive in uneven steps, so drawing straight
 * from them makes notes stutter. Instead the clock keeps a smoothed offset
 * between the audio clock and the page's clock, and adds it to the time it's
 * asked about. Given a frame's timestamp, every frame then moves by exactly
 * one frame's worth, while staying locked to the audio clock that pluck times
 * use. Never goes backwards.
 */
export function createAudioClock(source: ClockSource): Clock {
  let offset: number | null = null;
  let last = Number.NEGATIVE_INFINITY;

  /** The audio clock minus the page's clock, from the latest audio reading. */
  const measureOffset = () => {
    const { contextTime, performanceTime } = source.getOutputTimestamp();
    if (contextTime !== undefined && performanceTime) {
      return contextTime * 1000 - performanceTime;
    }
    return source.currentTime * 1000 - performance.now();
  };

  return {
    now: (at = performance.now()) => {
      const measured = measureOffset();
      if (offset === null || Math.abs(measured - offset) > SNAP_MS) {
        offset = measured;
      } else {
        offset += SMOOTHING * (measured - offset);
      }
      last = Math.max(last, at + offset);
      return last;
    },
  };
}
