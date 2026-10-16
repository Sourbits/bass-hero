import type { AudioFrame, AudioSource } from "@/audio/audio-source";
import { A4_FREQUENCY, frequencyToNote, type Note } from "./notes";
import {
  type CreatePitchDetector,
  createMcLeodDetector,
  type PitchDetector,
  windowSizeFor,
} from "./pitch-detector";

export interface NoteReading {
  /** How periodic the window was, from 0 to 1. 0 when it was too quiet. */
  clarity: number;
  /** Loudness of the analyzed window, in dB relative to full scale. */
  levelDb: number;
  /** The note being played, or null when it's too quiet or not clearly a note. */
  note: Note | null;
  /** Seconds since the source started, at the end of the analyzed window. */
  time: number;
}

export interface NoteDetectorOptions {
  /** The pitch algorithm. Defaults to the McLeod Pitch Method. */
  createDetector?: CreatePitchDetector;
  /** Highest accepted pitch in Hz. Defaults to 600, above a bass's 24th fret. */
  maxFrequency?: number;
  /** Lowest clarity that counts as a note, from 0 to 1. Defaults to 0.9. */
  minClarity?: number;
  /** Lowest accepted pitch in Hz. Defaults to 28, below a 5-string's low B. */
  minFrequency?: number;
  /** Quieter input than this, in dBFS, is treated as silence. Defaults to -50. */
  minLevelDb?: number;
  onReading: (reading: NoteReading) => void;
  /** Tuning reference in Hz. Defaults to 440. */
  referenceA4?: number;
}

interface Analysis {
  detector: PitchDetector;
  filled: number;
  sampleRate: number;
  window: Float32Array;
}

function levelDbOf(samples: Float32Array) {
  let sum = 0;
  for (const sample of samples) {
    sum += sample * sample;
  }
  const rms = Math.sqrt(sum / samples.length);
  return rms > 0 ? 20 * Math.log10(rms) : Number.NEGATIVE_INFINITY;
}

/** Keeps the most recent windowSize samples, oldest first. */
function appendToWindow(analysis: Analysis, samples: Float32Array) {
  const { window } = analysis;
  if (samples.length >= window.length) {
    window.set(samples.subarray(samples.length - window.length));
  } else {
    window.copyWithin(0, samples.length);
    window.set(samples, window.length - samples.length);
  }
  analysis.filled = Math.min(window.length, analysis.filled + samples.length);
}

/**
 * Listens to any audio source and reports the note being played after every
 * frame, once enough audio has arrived to fill the analysis window (about
 * 85 ms). Returns a function that stops listening.
 */
export function detectNotes(
  source: AudioSource,
  {
    createDetector = createMcLeodDetector,
    maxFrequency = 600,
    minClarity = 0.9,
    minFrequency = 28,
    minLevelDb = -50,
    onReading,
    referenceA4 = A4_FREQUENCY,
  }: NoteDetectorOptions
): () => void {
  let analysis: Analysis | null = null;

  const analyze = ({ detector, sampleRate, window }: Analysis) => {
    const levelDb = levelDbOf(window);
    if (levelDb < minLevelDb) {
      return { clarity: 0, levelDb, note: null };
    }

    const estimate = detector.detect(window, sampleRate);
    const isNote =
      estimate !== null &&
      estimate.clarity >= minClarity &&
      estimate.frequency >= minFrequency &&
      estimate.frequency <= maxFrequency;

    return {
      clarity: estimate?.clarity ?? 0,
      levelDb,
      note: isNote ? frequencyToNote(estimate.frequency, referenceA4) : null,
    };
  };

  return source.onFrame((frame: AudioFrame) => {
    if (!analysis || analysis.sampleRate !== frame.sampleRate) {
      const windowSize = windowSizeFor(frame.sampleRate);
      analysis = {
        detector: createDetector(windowSize),
        filled: 0,
        sampleRate: frame.sampleRate,
        window: new Float32Array(windowSize),
      };
    }

    appendToWindow(analysis, frame.samples);
    if (analysis.filled < analysis.window.length) {
      return;
    }

    onReading({
      ...analyze(analysis),
      time: frame.time + frame.samples.length / frame.sampleRate,
    });
  });
}
