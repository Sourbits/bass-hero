import type { AudioFrameListener, AudioSource } from "@/audio/audio-source";

/** One second-order filter section, with its running state. */
interface Section {
  a1: number;
  a2: number;
  b0: number;
  b1: number;
  b2: number;
  z1: number;
  z2: number;
}

/** Q of each section of a 4th-order Butterworth filter: flat, no peak. */
const BUTTERWORTH_Q = [0.5412, 1.3066];

function lowPassSection(cutoffHz: number, sampleRate: number, q: number) {
  const w0 = (2 * Math.PI * cutoffHz) / sampleRate;
  const cos = Math.cos(w0);
  const alpha = Math.sin(w0) / (2 * q);
  const a0 = 1 + alpha;
  return {
    a1: (-2 * cos) / a0,
    a2: (1 - alpha) / a0,
    b0: (1 - cos) / 2 / a0,
    b1: (1 - cos) / a0,
    b2: (1 - cos) / 2 / a0,
    z1: 0,
    z2: 0,
  } satisfies Section;
}

function filter(sections: Section[], input: Float32Array) {
  const output = new Float32Array(input.length);
  for (let index = 0; index < input.length; index += 1) {
    let value = input[index] ?? 0;
    for (const section of sections) {
      const result = section.b0 * value + section.z1;
      section.z1 = section.b1 * value - section.a1 * result + section.z2;
      section.z2 = section.b2 * value - section.a2 * result;
      value = result;
    }
    output[index] = value;
  }
  return output;
}

/**
 * Another source, passed through a steep low-pass filter. Calibration
 * listens through it, so the metronome's high click, heard by the mic over
 * the speakers, isn't taken for a pluck, while a bass's notes come through.
 * Call dispose() when done listening.
 */
export function lowPass(
  source: AudioSource,
  cutoffHz: number
): AudioSource & { dispose: () => void } {
  const listeners = new Set<AudioFrameListener>();
  let sections: Section[] = [];
  let sampleRate = 0;

  const dispose = source.onFrame((frame) => {
    if (frame.sampleRate !== sampleRate) {
      ({ sampleRate } = frame);
      sections = BUTTERWORTH_Q.map((q) =>
        lowPassSection(cutoffHz, sampleRate, q)
      );
    }
    const filtered = { ...frame, samples: filter(sections, frame.samples) };
    for (const listener of listeners) {
      listener(filtered);
    }
  });

  return {
    dispose,
    onFrame: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start: () => source.start(),
    stop: () => source.stop(),
  };
}
