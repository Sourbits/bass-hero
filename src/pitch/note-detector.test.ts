import { describe, expect, test } from "bun:test";
import type { AudioClip } from "@/audio/audio-source";
import { createSampleSource } from "@/audio/sample-source";
import { createToneSource, generateTone } from "@/audio/tones";
import { detectNotes, type NoteReading } from "./note-detector";
import { midiToFrequency, parseNote } from "./notes";

/** A bass-like spectrum: the second harmonic is louder than the fundamental. */
const BASS_HARMONICS = [0.6, 1, 0.5, 0.3, 0.15];

async function readNotes(source: ReturnType<typeof createSampleSource>) {
  const readings: NoteReading[] = [];
  const stop = detectNotes(source, {
    onReading: (reading) => readings.push(reading),
  });
  await source.start();
  stop();
  return readings;
}

function frequencyOf(note: string, cents = 0) {
  const midi = parseNote(note);
  if (midi === null) {
    throw new Error(`Not a note: ${note}`);
  }
  return midiToFrequency(midi) * 2 ** (cents / 1200);
}

function noteNames(readings: NoteReading[]) {
  return readings.map((reading) =>
    reading.note ? `${reading.note.name}${reading.note.octave}` : null
  );
}

/** Cheap repeatable noise, so the test gives the same result every run. */
function whiteNoise(sampleRate: number, duration: number): AudioClip {
  const samples = new Float32Array(Math.round(sampleRate * duration));
  let seed = 12_345;
  for (let index = 0; index < samples.length; index += 1) {
    seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
    samples[index] = (seed / 2_147_483_648 - 0.5) * 0.5;
  }
  return { sampleRate, samples };
}

const OPEN_STRINGS = ["E1", "A1", "D2", "G2"];
const FRETTED_NOTES = [
  "F1", // E string, 1st fret
  "G#1", // E string, 4th fret
  "C2", // A string, 3rd fret
  "F#2", // D string, 4th fret
  "C3", // G string, 5th fret
  "G3", // G string, 12th fret
  "B0", // 5-string low B, below the 41 Hz requirement
];

describe("detectNotes", () => {
  for (const sampleRate of [44_100, 48_000]) {
    for (const note of [...OPEN_STRINGS, ...FRETTED_NOTES]) {
      test(`hears a ${note} sine wave at ${sampleRate} Hz`, async () => {
        const readings = await readNotes(
          createToneSource({
            duration: 0.5,
            frequency: frequencyOf(note),
            sampleRate,
          })
        );

        expect(readings.length).toBeGreaterThan(10);
        expect(new Set(noteNames(readings))).toEqual(new Set([note]));
        for (const reading of readings) {
          expect(Math.abs(reading.note?.cents ?? 99)).toBeLessThan(1);
        }
      });
    }
  }

  for (const note of OPEN_STRINGS) {
    test(`hears ${note} in the right octave when the 2nd harmonic is louder`, async () => {
      const readings = await readNotes(
        createToneSource({
          duration: 0.5,
          frequency: frequencyOf(note),
          harmonics: BASS_HARMONICS,
          sampleRate: 48_000,
        })
      );

      expect(new Set(noteNames(readings))).toEqual(new Set([note]));
    });
  }

  for (const cents of [-35, -12, 8, 25]) {
    test(`measures E1 played ${cents} cents off`, async () => {
      const readings = await readNotes(
        createToneSource({
          duration: 0.3,
          frequency: frequencyOf("E1", cents),
          sampleRate: 48_000,
        })
      );

      expect(noteNames(readings).at(-1)).toBe("E1");
      expect(readings.at(-1)?.note?.cents).toBeCloseTo(cents, 0);
    });
  }

  test("reports the level, and no note, for silence", async () => {
    const readings = await readNotes(
      createSampleSource({
        sampleRate: 48_000,
        samples: new Float32Array(24_000),
      })
    );

    expect(readings.length).toBeGreaterThan(0);
    for (const reading of readings) {
      expect(reading.note).toBeNull();
      expect(reading.levelDb).toBe(Number.NEGATIVE_INFINITY);
    }
  });

  test("ignores a note that is too quiet", async () => {
    const readings = await readNotes(
      createToneSource({
        amplitude: 0.001,
        duration: 0.3,
        frequency: frequencyOf("A1"),
        sampleRate: 48_000,
      })
    );

    expect(noteNames(readings).every((name) => name === null)).toBe(true);
    expect(readings[0]?.levelDb).toBeCloseTo(-63, 0);
  });

  test("ignores noise", async () => {
    const readings = await readNotes(
      createSampleSource(whiteNoise(48_000, 0.5))
    );

    expect(noteNames(readings).every((name) => name === null)).toBe(true);
  });

  test("switches notes when the player does", async () => {
    const sampleRate = 48_000;
    const first = generateTone({
      duration: 0.4,
      frequency: frequencyOf("E1"),
      sampleRate,
    });
    const second = generateTone({
      duration: 0.4,
      frequency: frequencyOf("A1"),
      sampleRate,
    });
    const samples = new Float32Array(
      first.samples.length + second.samples.length
    );
    samples.set(first.samples);
    samples.set(second.samples, first.samples.length);

    const names = noteNames(
      await readNotes(createSampleSource({ sampleRate, samples }))
    );

    expect(names[0]).toBe("E1");
    expect(names.at(-1)).toBe("A1");
  });

  test("times each reading at the end of its window", async () => {
    const readings = await readNotes(
      createToneSource(
        { duration: 0.2, frequency: 55, sampleRate: 48_000 },
        { frameSize: 1024 }
      )
    );

    expect(readings[0]?.time).toBeCloseTo(4096 / 48_000, 6);
    expect(readings[1]?.time).toBeCloseTo(5120 / 48_000, 6);
  });
});
