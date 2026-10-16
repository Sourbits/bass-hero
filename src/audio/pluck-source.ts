import type { AudioSource } from "./audio-source";
import { createWebAudioSource } from "./web-audio-source";

export interface ScheduledPluck {
  frequency: number;
  /** When to pluck, on the AudioContext clock, in ms. */
  timeMs: number;
}

export interface PluckSource extends AudioSource {
  /** Schedules plucks on the AudioContext clock. Call after start(). */
  schedule: (plucks: ScheduledPluck[]) => void;
}

export interface PluckSourceOptions {
  context: AudioContext;
  frameSize?: number;
  /** Relative level of each harmonic. Defaults to a bass-like spectrum. */
  harmonics?: number[];
  /** Peak level of each pluck. Defaults to 0.5. */
  level?: number;
}

/** Silence before the next pluck, like a finger muting the string, in seconds. */
const MUTE_SECONDS = 0.015;
/** How quickly a note fades, in seconds. */
const DECAY_SECONDS = 0.6;

/**
 * A silent synthesized bass, played through the same capture path as the
 * mic. Plucks are scheduled on the AudioContext clock, so they land exactly
 * when asked. Used for the demo modes, to check the game without a bass.
 * Nothing is played through the speakers.
 */
export function createPluckSource({
  context,
  frameSize,
  harmonics = [0.6, 1, 0.5, 0.3, 0.15],
  level = 0.5,
}: PluckSourceOptions): PluckSource {
  const mix = new GainNode(context);
  const voices: GainNode[] = [];
  // Index 0 of a periodic wave is the DC offset, so harmonics start at 1.
  const wave = context.createPeriodicWave(
    new Float32Array(harmonics.length + 1),
    Float32Array.from([0, ...harmonics])
  );

  const source = createWebAudioSource(
    () =>
      Promise.resolve({
        node: mix,
        release: () => {
          for (const voice of voices) {
            voice.disconnect();
          }
          voices.length = 0;
        },
      }),
    { context, frameSize }
  );

  return {
    ...source,
    schedule: (plucks) => {
      const sorted = [...plucks].sort((a, b) => a.timeMs - b.timeMs);
      for (const [index, pluck] of sorted.entries()) {
        const start = pluck.timeMs / 1000;
        const next = sorted[index + 1];
        const end = next ? next.timeMs / 1000 - MUTE_SECONDS : start + 3;

        const oscillator = new OscillatorNode(context, {
          frequency: pluck.frequency,
          periodicWave: wave,
        });
        const gain = new GainNode(context, { gain: 0 });
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(level, start + 0.001);
        gain.gain.setTargetAtTime(0, start + 0.001, DECAY_SECONDS);
        gain.gain.setTargetAtTime(0, end, 0.002);
        oscillator.connect(gain).connect(mix);
        oscillator.start(start);
        oscillator.stop(end + 0.02);
        voices.push(gain);
      }
    },
  };
}
