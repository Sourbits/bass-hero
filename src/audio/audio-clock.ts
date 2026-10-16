/** The game clock, in milliseconds. */
export interface Clock {
  now: () => number;
}

/**
 * The game clock: the AudioContext's clock, in milliseconds.
 *
 * now() is the audio time currently coming out of the speakers, from
 * getOutputTimestamp(), advanced smoothly with performance.now() between audio
 * updates. Pluck times from the mic are on the same clock, so a hit time can
 * be compared directly with a note's target time. Never goes backwards.
 */
export function createAudioClock(context: AudioContext): Clock {
  let last = Number.NEGATIVE_INFINITY;

  return {
    now: () => {
      const { contextTime, performanceTime } = context.getOutputTimestamp();
      const estimate =
        contextTime !== undefined && performanceTime
          ? contextTime * 1000 + (performance.now() - performanceTime)
          : context.currentTime * 1000;
      last = Math.max(last, estimate);
      return last;
    },
  };
}
