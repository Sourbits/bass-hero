import { describe, expect, test } from "bun:test";
import type { AudioClip } from "@/audio/audio-source";
import { createSampleSource } from "@/audio/sample-source";
import { generatePlucks, type Pluck, type PluckOptions } from "@/audio/tones";
import { midiToFrequency, parseNote } from "@/pitch/notes";
import { detectOnsets, type Onset } from "./onset-detector";

/** A bass-like spectrum: the second harmonic is louder than the fundamental. */
const BASS_HARMONICS = [0.6, 1, 0.5, 0.3, 0.15];
const NOTES = ["B0", "E1", "A1", "D2", "G2", "C3", "G3"];
/** Starting phases, including 0, where the waveform starts from silence. */
const PHASES = [0, Math.PI / 2, Math.PI, 4];
/** Background noise at about -55 dBFS. */
const NOISE = 0.003;

function frequencyOf(note: string) {
  const midi = parseNote(note);
  if (midi === null) {
    throw new Error(`Not a note: ${note}`);
  }
  return midiToFrequency(midi);
}

async function findOnsets(clip: AudioClip, startTime = 0) {
  const source = createSampleSource(clip, { startTime });
  const onsets: Onset[] = [];
  detectOnsets(source, { onOnset: (onset) => onsets.push(onset) });
  await source.start();
  return onsets;
}

/**
 * Plucks a note at each time and returns how far off each detected onset was,
 * in ms. Fails if any pluck is missed or an extra one is found.
 */
async function onsetErrors(
  note: string,
  times: number[],
  options: Omit<PluckOptions, "duration">,
  pluck: Partial<Pluck> = {}
) {
  const plucks = times.map((time) => ({
    frequency: frequencyOf(note),
    time,
    ...pluck,
  }));
  const duration = (times.at(-1) ?? 0) + 0.5;
  const onsets = await findOnsets(
    generatePlucks(plucks, { duration, ...options })
  );

  expect(onsets).toHaveLength(times.length);
  return times.map((time, index) => (onsets[index]?.timeMs ?? 0) - time * 1000);
}

/** Every pairing of an item from `first` with an item from `second`. */
function pairs<A, B>(first: A[], second: B[]): [A, B][] {
  return first.flatMap((a) => second.map((b): [A, B] => [a, b]));
}

const SPECTRA = [[1], BASS_HARMONICS];

function expectWithin(errors: number[], minMs: number, maxMs: number) {
  for (const error of errors) {
    expect(error).toBeGreaterThanOrEqual(minMs);
    expect(error).toBeLessThanOrEqual(maxMs);
  }
}

describe("detectOnsets", () => {
  for (const sampleRate of [44_100, 48_000]) {
    for (const note of NOTES) {
      test(`pins ${note} plucked onto silence within 3.5 ms at ${sampleRate} Hz`, async () => {
        const errors = await Promise.all(
          pairs(SPECTRA, PHASES).map(([harmonics, phase]) =>
            onsetErrors(
              note,
              [0.25],
              { attackMs: 1, harmonics, noise: NOISE, sampleRate },
              { phase }
            )
          )
        );
        expectWithin(errors.flat(), -0.1, 3.5);
      });
    }
  }

  for (const note of NOTES) {
    test(`pins ${note} re-plucked after a mute within 3.5 ms`, async () => {
      const errors = await Promise.all(
        pairs(SPECTRA, PHASES).map(([harmonics, phase]) =>
          onsetErrors(
            note,
            [0.2, 0.7, 1.2, 1.7],
            {
              attackMs: 2,
              handoff: "mute",
              harmonics,
              noise: NOISE,
              sampleRate: 48_000,
            },
            { phase }
          )
        )
      );
      expectWithin(errors.flat(), -0.1, 3.5);
    });
  }

  test("catches quick, equally loud re-plucks of low E after a 15 ms mute", async () => {
    const times = Array.from({ length: 8 }, (_, index) => 0.2 + index * 0.15);
    const errors = await Promise.all(
      PHASES.map((phase) =>
        onsetErrors(
          "E1",
          times,
          {
            attackMs: 1,
            decaySeconds: 2,
            handoff: "mute",
            harmonics: BASS_HARMONICS,
            muteMs: 15,
            noise: NOISE,
            sampleRate: 48_000,
          },
          { phase }
        )
      )
    );
    expectWithin(errors.flat(), -0.1, 3.5);
  });

  test("catches every note of a fast run, 200 ms apart with only 8 ms mutes", async () => {
    // Demon speed: two notes a beat at 150 BPM, changing notes each time.
    const times = Array.from({ length: 12 }, (_, index) => 0.2 + index * 0.2);
    const runs = await Promise.all(
      pairs(NOTES, SPECTRA).map(([note, harmonics]) =>
        findOnsets(
          generatePlucks(
            times.map((time, index) => ({
              frequency: frequencyOf(note) * (index % 2 === 0 ? 1 : 1.5),
              phase: index,
              time,
            })),
            {
              attackMs: 1,
              decaySeconds: 1.5,
              duration: 2.8,
              handoff: "mute",
              harmonics,
              muteMs: 8,
              noise: NOISE,
              sampleRate: 48_000,
            }
          )
        )
      )
    );

    for (const onsets of runs) {
      expect(onsets).toHaveLength(times.length);
      expectWithin(
        onsets.map((onset, index) => onset.timeMs - (times[index] ?? 0) * 1000),
        -0.1,
        5
      );
    }
  });

  test("pins low E with a slow 5 ms attack within 6 ms", async () => {
    const errors = await Promise.all(
      PHASES.map((phase) =>
        onsetErrors(
          "E1",
          [0.2, 0.7],
          {
            attackMs: 5,
            harmonics: BASS_HARMONICS,
            noise: NOISE,
            sampleRate: 48_000,
          },
          { phase }
        )
      )
    );
    expectWithin(errors.flat(), 0, 6);
  });

  test("pins a pure tone re-plucked while still ringing within 4 ms", async () => {
    const errors = await Promise.all(
      pairs(NOTES, PHASES).map(([note, phase]) =>
        onsetErrors(
          note,
          [0.2, 0.7, 1.2],
          { attackMs: 1, handoff: "cut", noise: NOISE, sampleRate: 48_000 },
          { phase }
        )
      )
    );
    expectWithin(errors.flat(), -0.1, 4);
  });

  test("finds a bass-like note re-plucked while ringing, up to 20 ms late", async () => {
    // Without a mute, the new pluck only stands out once it's louder than the
    // old note, which for low notes can take most of a cycle. NOTES.md has more.
    const errors = await Promise.all(
      pairs(NOTES, PHASES).map(([note, phase]) =>
        onsetErrors(
          note,
          [0.2, 0.7, 1.2],
          {
            attackMs: 1,
            handoff: "cut",
            harmonics: BASS_HARMONICS,
            noise: NOISE,
            sampleRate: 48_000,
          },
          { phase }
        )
      )
    );
    expectWithin(errors.flat(), -0.1, 20);
  });

  test("finds a louder note over another string that's still ringing", async () => {
    const results = await Promise.all(
      NOTES.map((note) =>
        findOnsets(
          generatePlucks(
            [
              { amplitude: 0.2, frequency: frequencyOf(note) * 1.5, time: 0.2 },
              { amplitude: 0.5, frequency: frequencyOf(note), time: 0.7 },
            ],
            {
              attackMs: 1,
              duration: 1.2,
              handoff: "ring",
              harmonics: BASS_HARMONICS,
              noise: NOISE,
              sampleRate: 48_000,
            }
          )
        )
      )
    );

    for (const onsets of results) {
      expect(onsets).toHaveLength(2);
      expectWithin([(onsets[1]?.timeMs ?? 0) - 700], -0.1, 20);
    }
  });

  test("reports times on the source's clock", async () => {
    const clip = generatePlucks([{ frequency: 41.2, time: 0.25 }], {
      duration: 0.5,
      sampleRate: 48_000,
    });

    const onsets = await findOnsets(clip, 1000);

    expect(onsets[0]?.timeMs).toBeGreaterThanOrEqual(1_000_250);
    expect(onsets[0]?.timeMs).toBeLessThan(1_000_253.5);
  });

  test("finds nothing in steady noise", async () => {
    const clip = generatePlucks([], {
      duration: 2,
      noise: 0.01,
      sampleRate: 48_000,
    });

    expect(await findOnsets(clip)).toHaveLength(0);
  });

  test("finds one onset in a long, fading low E", async () => {
    const clip = generatePlucks([{ frequency: 41.2, time: 0.2 }], {
      decaySeconds: 1.5,
      duration: 4,
      harmonics: BASS_HARMONICS,
      noise: NOISE,
      sampleRate: 48_000,
    });

    expect(await findOnsets(clip)).toHaveLength(1);
  });

  test("ignores plucks below the floor", async () => {
    const clip = generatePlucks(
      [{ amplitude: 0.003, frequency: 55, time: 0.2 }],
      { duration: 0.6, sampleRate: 48_000 }
    );

    expect(await findOnsets(clip)).toHaveLength(0);
  });

  test("reports how loud the new note is", async () => {
    const clip = generatePlucks(
      [{ amplitude: 0.4, frequency: 55, phase: Math.PI / 2, time: 0.2 }],
      { duration: 0.6, sampleRate: 48_000 }
    );

    const [onset] = await findOnsets(clip);

    expect(onset?.peak).toBeCloseTo(0.4, 1);
  });
});

describe("a note that swells after its pluck", () => {
  test("counts once, at the pluck", async () => {
    const frequency = frequencyOf("E1");
    const results = await Promise.all(
      [20, 27, 40, 55].map((swellMs) =>
        findOnsets(
          generatePlucks(
            [
              { amplitude: 0.08, frequency, time: 0.5 },
              { amplitude: 0.2, frequency, time: 0.5 + swellMs / 1000 },
            ],
            {
              duration: 1.5,
              handoff: "ring",
              harmonics: BASS_HARMONICS,
              noise: NOISE,
              sampleRate: 48_000,
            }
          )
        )
      )
    );
    for (const onsets of results) {
      expect(onsets).toHaveLength(1);
      expect(Math.abs((onsets[0]?.timeMs ?? 0) - 500)).toBeLessThan(10);
    }
  });
});
