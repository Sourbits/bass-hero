import { midiToFrequency } from "@/pitch/notes";

/** A bass-like spectrum, so low notes are audible on small speakers too. */
const HARMONICS = [0.6, 1, 0.5, 0.3, 0.15];
const RING_SECONDS = 1.6;

let shared: AudioContext | null = null;

/**
 * Plucks a note out loud at a time on the context's clock, in seconds. Used
 * to hear notes while learning, and for the game's guide tone.
 */
export function pluckAt(context: AudioContext, midi: number, when: number) {
  const oscillator = new OscillatorNode(context, {
    frequency: midiToFrequency(midi),
    periodicWave: context.createPeriodicWave(
      new Float32Array(HARMONICS.length + 1),
      Float32Array.from([0, ...HARMONICS])
    ),
  });
  const gain = new GainNode(context, { gain: 0 });
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(0.4, when + 0.005);
  gain.gain.setTargetAtTime(0, when + 0.005, RING_SECONDS / 4);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(when);
  oscillator.stop(when + RING_SECONDS);
}

/**
 * Plays a short plucked note out loud now, for learning what notes sound
 * like. Call it from a click: browsers only allow sound after the user
 * interacts.
 */
export function playNote(midi: number) {
  shared ??= new AudioContext();
  shared.resume().catch(() => undefined);
  pluckAt(shared, midi, shared.currentTime + 0.01);
}
