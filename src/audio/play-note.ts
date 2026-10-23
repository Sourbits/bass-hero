import { createNoise } from "@/audio/tones";
import { midiToFrequency } from "@/pitch/notes";

const RING_SECONDS = 1.6;

let shared: AudioContext | null = null;

/** The metronome click: a short, high, smooth blip. */
export const CLICK = {
  /** Pitch of a normal click and of the first beat of a bar, in Hz. */
  accentHz: 4200,
  /** Length of the blip, in seconds. */
  duration: 0.03,
  frequencyHz: 3200,
  volume: 0.25,
  /** Width of its bell-shaped envelope, in seconds. */
  widthSeconds: 0.004,
};

/**
 * One click, as samples. The bell-shaped (Gaussian) envelope has no
 * low frequencies at all, unlike a sudden start, so calibration's
 * low-pass filter can hide it from the onset detector completely.
 */
export function clickSamples(sampleRate: number, frequencyHz: number) {
  const samples = new Float32Array(Math.round(CLICK.duration * sampleRate));
  const center = CLICK.duration / 2;
  for (let index = 0; index < samples.length; index += 1) {
    const time = index / sampleRate;
    const envelope = Math.exp(-(((time - center) / CLICK.widthSeconds) ** 2));
    samples[index] = envelope * Math.sin(2 * Math.PI * frequencyHz * time);
  }
  return samples;
}

const clickBuffers = new WeakMap<BaseAudioContext, Map<number, AudioBuffer>>();

/** Plays a metronome click at a time on the context's clock, in seconds. */
export function clickAt(context: AudioContext, when: number, accent: boolean) {
  const frequency = accent ? CLICK.accentHz : CLICK.frequencyHz;
  let buffers = clickBuffers.get(context);
  if (!buffers) {
    buffers = new Map();
    clickBuffers.set(context, buffers);
  }
  let buffer = buffers.get(frequency);
  if (!buffer) {
    const samples = clickSamples(context.sampleRate, frequency);
    buffer = new AudioBuffer({
      length: samples.length,
      sampleRate: context.sampleRate,
    });
    buffer.copyToChannel(samples, 0);
    buffers.set(frequency, buffer);
  }
  const player = new AudioBufferSourceNode(context, { buffer });
  const gain = new GainNode(context, { gain: CLICK.volume });
  player.connect(gain).connect(context.destination);
  // Centered on the beat: the blip's loudest point is halfway through.
  player.start(Math.max(context.currentTime, when - CLICK.duration / 2));
}

/** How much of each pass around the string survives: sets how long it rings. */
const DAMPING = 0.994;

/**
 * A plucked string, as samples (Karplus-Strong): a burst of noise goes round
 * a delay line one period long, softened a little each time. It sounds like
 * a real string, and it's full of overtones, so laptop speakers, which can't
 * play a low E's 41 Hz, still carry its pitch.
 */
export function stringSamples(sampleRate: number, midi: number) {
  const samples = new Float32Array(Math.round(RING_SECONDS * sampleRate));
  // Averaging two samples each pass delays the loop by half a sample more.
  const period = Math.max(
    2,
    Math.round(sampleRate / midiToFrequency(midi) - 0.5)
  );
  const random = createNoise(midi + 1);
  for (let index = 0; index < period; index += 1) {
    samples[index] = random();
  }
  // Soften the pluck once: a round bass tone rather than a sharp pick.
  for (let index = 1; index < period; index += 1) {
    samples[index] = 0.5 * ((samples[index] ?? 0) + (samples[index - 1] ?? 0));
  }
  for (let index = period; index < samples.length; index += 1) {
    const back = samples[index - period] ?? 0;
    const further = samples[index - period - 1] ?? back;
    samples[index] = DAMPING * 0.5 * (back + further);
  }
  let peak = 0;
  for (const sample of samples) {
    peak = Math.max(peak, Math.abs(sample));
  }
  if (peak > 0) {
    for (let index = 0; index < samples.length; index += 1) {
      samples[index] = ((samples[index] ?? 0) / peak) * 0.9;
    }
  }
  return samples;
}

const stringBuffers = new WeakMap<BaseAudioContext, Map<number, AudioBuffer>>();

function stringBuffer(context: AudioContext, midi: number) {
  let buffers = stringBuffers.get(context);
  if (!buffers) {
    buffers = new Map();
    stringBuffers.set(context, buffers);
  }
  let buffer = buffers.get(midi);
  if (!buffer) {
    const samples = stringSamples(context.sampleRate, midi);
    buffer = new AudioBuffer({
      length: samples.length,
      sampleRate: context.sampleRate,
    });
    buffer.copyToChannel(samples, 0);
    buffers.set(midi, buffer);
  }
  return buffer;
}

/**
 * Plucks a note out loud at a time on the context's clock, in seconds. Used
 * to hear notes while learning, in ear training, and for the guide tone.
 */
export function pluckAt(context: AudioContext, midi: number, when: number) {
  const player = new AudioBufferSourceNode(context, {
    buffer: stringBuffer(context, midi),
  });
  const gain = new GainNode(context, { gain: 0 });
  gain.gain.setValueAtTime(0, when);
  gain.gain.linearRampToValueAtTime(0.6, when + 0.003);
  // Let it ring, then fade out before the buffer ends.
  gain.gain.setTargetAtTime(0, when + RING_SECONDS * 0.6, RING_SECONDS / 8);
  player.connect(gain).connect(context.destination);
  player.start(when);
  player.stop(when + RING_SECONDS);
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
