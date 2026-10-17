/** Lowest frequency counted as buzz, in Hz. */
const MIN_CUTOFF_HZ = 1500;
/** Harmonics below this multiple of the note count as its tone, not buzz. */
const TONE_HARMONICS = 12;
/** Filter output ignored at the start, while the filter settles, in seconds. */
const SETTLE_SECONDS = 0.003;

interface Biquad {
  a1: number;
  a2: number;
  b0: number;
  b1: number;
  b2: number;
}

/** A 2nd-order Butterworth high-pass (from the RBJ audio EQ cookbook). */
function highPass(cutoff: number, sampleRate: number): Biquad {
  const omega = (2 * Math.PI * cutoff) / sampleRate;
  const alpha = Math.sin(omega) / Math.SQRT2;
  const cos = Math.cos(omega);
  const a0 = 1 + alpha;
  return {
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0,
    b0: (1 + cos) / 2 / a0,
    b1: -(1 + cos) / a0,
    b2: (1 + cos) / 2 / a0,
  };
}

function applyBiquad(samples: Float32Array, { a1, a2, b0, b1, b2 }: Biquad) {
  const out = new Float32Array(samples.length);
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  for (const [index, x] of samples.entries()) {
    const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    out[index] = y;
    x2 = x1;
    x1 = x;
    y2 = y1;
    y1 = y;
  }
  return out;
}

function energy(samples: Float32Array, from: number) {
  let sum = 0;
  for (let index = from; index < samples.length; index += 1) {
    const sample = samples[index] ?? 0;
    sum += sample * sample;
  }
  return sum;
}

/**
 * How buzzy a note sounds: the share of its energy that is high-frequency
 * rattle, in dB. A string buzzing against a fret clicks once per cycle, which
 * adds energy far above the note's own harmonics. A clean note sits around
 * −35 dB or lower; the closer to 0, the buzzier.
 *
 * Measure a stretch just after the pluck, not the pluck itself, whose attack
 * is bright even on a clean note.
 */
export function measureBuzz(
  samples: Float32Array,
  sampleRate: number,
  fundamental: number
): number {
  const cutoff = Math.min(
    Math.max(MIN_CUTOFF_HZ, TONE_HARMONICS * fundamental),
    sampleRate * 0.45
  );
  // Two passes make a steep 4th-order filter, so the note's harmonics below
  // the cutoff barely leak through.
  const filter = highPass(cutoff, sampleRate);
  const high = applyBiquad(applyBiquad(samples, filter), filter);

  const skip = Math.round(SETTLE_SECONDS * sampleRate);
  const total = energy(samples, skip);
  if (total === 0) {
    return Number.NEGATIVE_INFINITY;
  }
  return 10 * Math.log10(energy(high, skip) / total);
}
