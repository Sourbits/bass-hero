/**
 * Timing and scoring values for judging hits, all in one place to tune.
 * Every time is in milliseconds.
 */

export interface TimingConfig {
  /**
   * A right note buzzier than this counts as a Miss ("Buzzing"), in dB. See
   * measureBuzz: clean notes measure about −35 dB or lower, strong fret buzz
   * about −20 dB or higher. The tuner shows this number live, to tune it.
   */
  buzzThresholdDb: number;
  /** Whether a buzzing note counts as a Miss at all. */
  countBuzz: boolean;
  /** Default calibration offset before you've calibrated. */
  defaultLatencyOffsetMs: number;
  /** A right note within this many ms of its target (either side) is Good. */
  goodWindowMs: number;
  /**
   * How long to wait after a note's window closes before calling it "not
   * played". A late pluck takes ~100 ms to be named, so this must be longer.
   */
  identifyGraceMs: number;
  /**
   * Count a note played in the wrong octave as right. Off by default; turn it
   * on if your mic hears low E as E2, which laptop mics can.
   */
  ignoreOctave: boolean;
  /**
   * A right note within this many ms, but outside the Good window, is a Miss
   * marked early or late. Plucks further away than this are ignored.
   */
  missWindowMs: number;
  /** A right note within this many ms of its target (either side) is Perfect. */
  perfectWindowMs: number;
}

export const TIMING: TimingConfig = {
  buzzThresholdDb: -22,
  countBuzz: true,
  defaultLatencyOffsetMs: 0,
  goodWindowMs: 120,
  identifyGraceMs: 300,
  ignoreOctave: false,
  missWindowMs: 200,
  perfectWindowMs: 50,
};

/** Points for each rating. */
export const SCORING = {
  good: 50,
  miss: 0,
  perfect: 100,
};

export const CALIBRATION = {
  /** Beats you play along to; the result is the median over these. */
  beats: 16,
  /** Tempo of the calibration beat. */
  bpm: 80,
  /** Beats shown before the counted ones, to settle into the tempo. */
  countInBeats: 4,
  /** Fewest matched plucks needed to suggest an offset. */
  minHits: 8,
};
