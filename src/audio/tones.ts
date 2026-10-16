import type { AudioClip, AudioSource } from "./audio-source";
import { createSampleSource, type SampleSourceOptions } from "./sample-source";

export interface ToneOptions {
  /** Loudness of the mixed tone; its peak never goes above this. Defaults to 0.5. */
  amplitude?: number;
  /** Length of the tone in seconds. */
  duration: number;
  /** Fundamental frequency in Hz. */
  frequency: number;
  /**
   * Relative level of each harmonic, starting with the fundamental. Defaults
   * to a pure sine wave, [1]. A bass usually has a strong second harmonic,
   * for example [0.6, 1, 0.5, 0.3].
   */
  harmonics?: number[];
  sampleRate: number;
}

/** Generates a steady tone, for testing detectors without a real bass. */
export function generateTone({
  amplitude = 0.5,
  duration,
  frequency,
  harmonics = [1],
  sampleRate,
}: ToneOptions): AudioClip {
  const samples = new Float32Array(Math.round(duration * sampleRate));
  const total = harmonics.reduce((sum, level) => sum + Math.abs(level), 0);
  const scale = total > 0 ? amplitude / total : 0;

  for (let index = 0; index < samples.length; index += 1) {
    const phase = (2 * Math.PI * frequency * index) / sampleRate;
    let value = 0;
    for (const [harmonic, level] of harmonics.entries()) {
      value += level * Math.sin((harmonic + 1) * phase);
    }
    samples[index] = value * scale;
  }

  return { sampleRate, samples };
}

/** A generated tone behind the AudioSource interface. */
export function createToneSource(
  tone: ToneOptions,
  options?: SampleSourceOptions
): AudioSource {
  return createSampleSource(generateTone(tone), options);
}

export interface Pluck {
  /** Peak level of this note, from 0 to 1. Defaults to 0.5. */
  amplitude?: number;
  /** Fundamental frequency in Hz. */
  frequency: number;
  /**
   * Starting phase of the fundamental, in radians. Defaults to 0, where the
   * waveform starts from zero, which is the hardest case to time.
   */
  phase?: number;
  /** When the string is plucked, in seconds from the start of the clip. */
  time: number;
}

export interface PluckOptions {
  /** How long each note takes to reach full level, in ms. Defaults to 2. */
  attackMs?: number;
  /** Time for a note to fade to about a third of its level. Defaults to 0.8 s. */
  decaySeconds?: number;
  /** Length of the clip in seconds. */
  duration: number;
  /**
   * What happens to a note when the next one is plucked. "mute": the player
   * silences it `muteMs` before the next pluck. "cut": it stops right at the
   * next pluck, as when the same string is plucked again. "ring": it keeps
   * sounding under the next note, as on another string. Defaults to "mute".
   */
  handoff?: "cut" | "mute" | "ring";
  /** Relative level of each harmonic, starting with the fundamental. */
  harmonics?: number[];
  /** Silence before each pluck in "mute" mode, in ms. Defaults to 20. */
  muteMs?: number;
  /** Peak level of steady background noise. Defaults to 0 (none). */
  noise?: number;
  sampleRate: number;
}

/** Cheap repeatable noise in [-1, 1], so tests give the same result every run. */
export function createNoise(seed = 12_345) {
  // Park–Miller: small enough multipliers to stay exact in floating point.
  let state = seed;
  return () => {
    state = (state * 16_807) % 2_147_483_647;
    return (state / 2_147_483_647) * 2 - 1;
  };
}

/** Adds one plucked note to `samples`, from `start` up to `end` (in samples). */
function addPluck(
  samples: Float32Array,
  pluck: Pluck,
  options: {
    /** Attack length, in samples. */
    attack: number;
    decaySeconds: number;
    end: number;
    harmonics: number[];
    sampleRate: number;
    start: number;
  }
) {
  const { attack, decaySeconds, end, harmonics, sampleRate, start } = options;
  const total = harmonics.reduce((sum, level) => sum + Math.abs(level), 0);
  const scale = (pluck.amplitude ?? 0.5) / (total || 1);
  const phase = pluck.phase ?? 0;

  for (let offset = 0; start + offset < end; offset += 1) {
    const envelope =
      Math.min(1, attack > 0 ? offset / attack : 1) *
      Math.exp(-offset / sampleRate / decaySeconds);
    const angle = (2 * Math.PI * pluck.frequency * offset) / sampleRate;
    let value = 0;
    for (const [harmonic, level] of harmonics.entries()) {
      value += level * Math.sin((harmonic + 1) * (angle + phase));
    }
    samples[start + offset] =
      (samples[start + offset] ?? 0) + value * scale * envelope;
  }
}

/**
 * Generates plucked notes at known times: a fast attack, then an exponential
 * fade. For testing onset detection, where the true pluck times are needed.
 */
export function generatePlucks(
  plucks: Pluck[],
  {
    attackMs = 2,
    decaySeconds = 0.8,
    duration,
    handoff = "mute",
    harmonics = [1],
    muteMs = 20,
    noise = 0,
    sampleRate,
  }: PluckOptions
): AudioClip {
  const samples = new Float32Array(Math.round(duration * sampleRate));
  const sorted = [...plucks].sort((a, b) => a.time - b.time);

  for (const [index, pluck] of sorted.entries()) {
    const start = Math.round(pluck.time * sampleRate);
    const next = sorted[index + 1];
    let end = samples.length;
    if (next && handoff !== "ring") {
      const gap = handoff === "mute" ? (muteMs / 1000) * sampleRate : 0;
      end = Math.min(end, Math.round(next.time * sampleRate - gap));
    }
    addPluck(samples, pluck, {
      attack: (attackMs / 1000) * sampleRate,
      decaySeconds,
      end,
      harmonics,
      sampleRate,
      start,
    });
  }

  if (noise > 0) {
    const random = createNoise();
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = (samples[index] ?? 0) + random() * noise;
    }
  }

  return { sampleRate, samples };
}
