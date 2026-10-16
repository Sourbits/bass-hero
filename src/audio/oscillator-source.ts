import type { AudioSource } from "./audio-source";
import {
  createWebAudioSource,
  type WebAudioSourceOptions,
} from "./web-audio-source";

export interface OscillatorSourceOptions extends WebAudioSourceOptions {
  /** Fundamental frequency in Hz. */
  frequency: number;
  /** Relative level of each harmonic, starting with the fundamental. */
  harmonics?: number[];
  /** Peak level, in the range (0, 1]. Defaults to 0.5. */
  level?: number;
}

/**
 * A live, silent test tone in the browser. It runs through the same capture
 * path as the microphone, so the whole page can be checked without a bass.
 * Nothing is played through the speakers.
 */
export function createOscillatorSource({
  frequency,
  harmonics = [1],
  level = 0.5,
  ...options
}: OscillatorSourceOptions): AudioSource {
  return createWebAudioSource((context) => {
    // Index 0 of a periodic wave is the DC offset, so harmonics start at 1.
    const sine = Float32Array.from([0, ...harmonics]);
    const oscillator = new OscillatorNode(context, {
      frequency,
      periodicWave: context.createPeriodicWave(
        new Float32Array(sine.length),
        sine
      ),
    });
    const gain = new GainNode(context, { gain: level });
    oscillator.connect(gain);
    oscillator.start();

    return Promise.resolve({
      node: gain,
      release: () => {
        oscillator.stop();
        oscillator.disconnect();
      },
    });
  }, options);
}
