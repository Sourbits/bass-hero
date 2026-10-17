import { midiToFrequency } from "@/pitch/notes";

/** A bass-like spectrum, so low notes are audible on small speakers too. */
const HARMONICS = [0.6, 1, 0.5, 0.3, 0.15];
const RING_SECONDS = 1.6;

let shared: AudioContext | null = null;

/**
 * Plays a short plucked note out loud, for learning what notes sound like.
 * Call it from a click: browsers only allow sound after the user interacts.
 */
export function playNote(midi: number) {
  shared ??= new AudioContext();
  const context = shared;
  context.resume().catch(() => undefined);

  const start = context.currentTime + 0.01;
  const oscillator = new OscillatorNode(context, {
    frequency: midiToFrequency(midi),
    periodicWave: context.createPeriodicWave(
      new Float32Array(HARMONICS.length + 1),
      Float32Array.from([0, ...HARMONICS])
    ),
  });
  const gain = new GainNode(context, { gain: 0 });
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(0.4, start + 0.005);
  gain.gain.setTargetAtTime(0, start + 0.005, RING_SECONDS / 4);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(start);
  oscillator.stop(start + RING_SECONDS);
}
