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
