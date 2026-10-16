import type { AudioFrame, AudioSource } from "@/audio/audio-source";

export interface Onset {
  /** Peak level of the new note just after the pluck, from 0 to 1. */
  peak: number;
  /** When the pluck started, on the source's clock, in milliseconds. */
  timeMs: number;
}

export interface OnsetDetectorOptions {
  /** Plucks quieter than this peak level, in dBFS, are ignored. Defaults to -45. */
  floorDb?: number;
  /** Shortest time between two plucks, in ms. Defaults to 60. */
  minGapMs?: number;
  /**
   * How much louder the level must get than just before, as a ratio, to count
   * as a pluck. Defaults to 1.5 (about 3.5 dB).
   */
  minRise?: number;
  onOnset: (onset: Onset) => void;
  /** How long to watch the new note before pinning its start, in ms. Defaults to 15. */
  refineDelayMs?: number;
  /**
   * Where the pluck starts: the first sample that rises this fraction of the
   * way from the old level to the new peak. Defaults to 0.1.
   */
  startFraction?: number;
  /**
   * Length of the level window, in ms. It must hold a full cycle of the
   * lowest note, or the level ripples with the waveform and fakes plucks.
   * Defaults to 35, enough for a 5-string's low B (30.9 Hz, 32 ms a cycle).
   */
  windowMs?: number;
}

/** Samples per level block: about 0.7 ms at 44.1 or 48 kHz. */
const BLOCK_SIZE = 32;
/** How much past audio to keep for pinning the start, in seconds. */
const HISTORY_SECONDS = 0.25;
/** When pinning a start, a quiet stretch this long before the rise is a mute. */
const QUIET_MS = 5;
/**
 * To trigger on a mute, the quiet must last longer: a third of a cycle of
 * low B. Low bass waveforms can sit near zero for several ms within a cycle.
 */
const MUTE_MS = 12;
/** After a mute, a rise to this share of the level before it is a new pluck. */
const MUTE_RISE = 0.25;

interface Mute {
  /** Last quiet sample index. */
  at: number;
  /** Level before the mute. */
  level: number;
}

interface PendingOnset {
  /** Whether the pluck came right after a mute. */
  afterMute: boolean;
  /** Level just before the pluck, or before the mute. */
  level: number;
  /** Sample index at which there's enough of the new note to pin its start. */
  refineAt: number;
  /** Earliest sample index where the pluck can start. */
  searchStart: number;
}

/**
 * Finds the moment each note is plucked, to the sample, in a stream of
 * frames. It needs no pitch, so it isn't slowed down by low notes.
 *
 * 1. Detect: the peak level over the last 35 ms (a full cycle of low B) jumps
 *    to at least 1.5× the level over the 35 ms before, and above the floor.
 *    Or the note was muted (12 ms below a tenth of its level) and the level
 *    then comes back to at least a quarter of what it was: a quick re-pluck.
 * 2. Pin the start: 15 ms later, once the new note's peak is known, find the
 *    first sample that rises 10% of the way from the old level to the new
 *    peak. If the old note was muted first, measure from the silence instead.
 *    That sample is the onset.
 */
export function createOnsetDetector({
  floorDb = -45,
  minGapMs = 60,
  minRise = 1.5,
  onOnset,
  refineDelayMs = 15,
  startFraction = 0.1,
  windowMs = 35,
}: OnsetDetectorOptions) {
  const floor = 10 ** (floorDb / 20);

  let sampleRate = 0;
  let windowBlocks = 0;
  let history = new Float32Array(0);
  let blockPeaks = new Float32Array(0);
  let sampleIndex = 0;
  let blockIndex = 0;
  let blockPeak = 0;
  let quietUntilBlock = 0;
  let pending: PendingOnset | null = null;
  let recentLevel = 0;
  let quietRun = 0;
  let mute: Mute | null = null;
  let frameStartIndex = 0;
  let frameStartTime = 0;

  const reset = (rate: number) => {
    sampleRate = rate;
    windowBlocks = Math.ceil(((windowMs / 1000) * rate) / BLOCK_SIZE);
    history = new Float32Array(Math.ceil(HISTORY_SECONDS * rate));
    blockPeaks = new Float32Array(2 * windowBlocks);
    sampleIndex = 0;
    blockIndex = 0;
    blockPeak = 0;
    // Wait for two full windows, so the stream's start isn't a "jump".
    quietUntilBlock = 2 * windowBlocks;
    pending = null;
    recentLevel = 0;
    quietRun = 0;
    mute = null;
  };

  const sampleAt = (index: number) => history[index % history.length] ?? 0;

  const peakOfBlocks = (from: number, to: number) => {
    let peak = 0;
    for (let block = Math.max(0, from); block <= to; block += 1) {
      peak = Math.max(peak, blockPeaks[block % blockPeaks.length] ?? 0);
    }
    return peak;
  };

  const endBlock = () => {
    blockPeaks[blockIndex % blockPeaks.length] = blockPeak;
    const current = peakOfBlocks(blockIndex - windowBlocks + 1, blockIndex);
    const before = peakOfBlocks(
      blockIndex - 2 * windowBlocks + 1,
      blockIndex - windowBlocks
    );

    if (mute && sampleIndex - mute.at > 2 * windowBlocks * BLOCK_SIZE) {
      mute = null;
    }
    const afterMute =
      mute !== null && blockPeak >= Math.max(floor, MUTE_RISE * mute.level);

    if (
      !pending &&
      blockIndex >= quietUntilBlock &&
      current >= floor &&
      (current >= minRise * before || afterMute)
    ) {
      const refineAt =
        sampleIndex + Math.round((refineDelayMs / 1000) * sampleRate);
      pending =
        afterMute && mute
          ? {
              afterMute: true,
              level: mute.level,
              refineAt,
              searchStart: mute.at,
            }
          : {
              afterMute: false,
              level: before,
              refineAt,
              searchStart: (blockIndex - windowBlocks + 1) * BLOCK_SIZE,
            };
      mute = null;
    }

    recentLevel = Math.max(current, before);

    blockIndex += 1;
    blockPeak = 0;
  };

  /** First sample at or after `from` that's at least `threshold` loud. */
  const firstAbove = (from: number, threshold: number) => {
    let index = from;
    while (index < sampleIndex && Math.abs(sampleAt(index)) < threshold) {
      index += 1;
    }
    return index;
  };

  /**
   * End of the last stretch, at least `quietMs` long, that stays below
   * `threshold` between `from` and `to`, or -1 if there's none.
   */
  const lastQuietStretch = (from: number, to: number, threshold: number) => {
    const minRun = Math.round((QUIET_MS / 1000) * sampleRate);
    let run = 0;
    let end = -1;
    for (let index = from; index < to; index += 1) {
      run = Math.abs(sampleAt(index)) < threshold ? run + 1 : 0;
      if (run >= minRun) {
        end = index;
      }
    }
    return end;
  };

  const report = (start: number, peak: number) => {
    const time = frameStartTime + (start - frameStartIndex) / sampleRate;
    quietUntilBlock = Math.floor(
      (start + (minGapMs / 1000) * sampleRate) / BLOCK_SIZE
    );
    onOnset({ peak, timeMs: time * 1000 });
  };

  const pinStart = ({ afterMute, level, searchStart }: PendingOnset) => {
    const oldest = sampleIndex - history.length;
    const first = Math.max(searchStart, oldest);
    let peak = 0;
    for (let index = first; index < sampleIndex; index += 1) {
      peak = Math.max(peak, Math.abs(sampleAt(index)));
    }
    const quietThreshold = startFraction * Math.min(peak, level);

    if (afterMute) {
      // The search starts at the end of the mute, so the rise is measured
      // from silence.
      report(firstAbove(first, quietThreshold), peak);
      return;
    }

    // Measured from the old note's level: right when the old note rings
    // until the pluck.
    let start = firstAbove(first, level + startFraction * (peak - level));

    // But if the old note was muted first, there's a quiet stretch just
    // before the pluck, and the rise can be measured from silence instead.
    const quietEnd = lastQuietStretch(
      Math.max(first - Math.round((QUIET_MS / 1000) * sampleRate), oldest),
      start,
      quietThreshold
    );
    if (quietEnd >= 0) {
      start = Math.min(start, firstAbove(quietEnd + 1, quietThreshold));
    }
    report(start, peak);
  };

  const processSample = (sample: number) => {
    const size = Math.abs(sample);
    history[sampleIndex % history.length] = sample;
    blockPeak = Math.max(blockPeak, size);

    // Watch for the player muting the string, which can come right before a
    // quick re-pluck.
    const muteLength = Math.round((MUTE_MS / 1000) * sampleRate);
    quietRun = size < startFraction * recentLevel ? quietRun + 1 : 0;
    if (quietRun === muteLength) {
      mute = { at: sampleIndex, level: recentLevel };
    } else if (mute && quietRun > muteLength) {
      mute.at = sampleIndex;
    }
    sampleIndex += 1;

    if (sampleIndex % BLOCK_SIZE === 0) {
      endBlock();
    }
    if (pending && sampleIndex >= pending.refineAt) {
      const ready = pending;
      pending = null;
      pinStart(ready);
    }
  };

  return {
    process: (frame: AudioFrame) => {
      if (frame.sampleRate !== sampleRate) {
        reset(frame.sampleRate);
      }
      frameStartIndex = sampleIndex;
      frameStartTime = frame.time;

      for (const sample of frame.samples) {
        processSample(sample);
      }
    },
  };
}

/** Reports every pluck in an audio source. Returns a function that stops listening. */
export function detectOnsets(
  source: AudioSource,
  options: OnsetDetectorOptions
): () => void {
  return source.onFrame(createOnsetDetector(options).process);
}
