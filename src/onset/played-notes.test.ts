import { describe, expect, test } from "bun:test";
import type { AudioClip } from "@/audio/audio-source";
import { createSampleSource } from "@/audio/sample-source";
import { generatePlucks } from "@/audio/tones";
import { midiToFrequency, parseNote } from "@/pitch/notes";
import { detectPlayedNotes, type PlayedNote } from "./played-notes";

const BASS_HARMONICS = [0.6, 1, 0.5, 0.3, 0.15];

function frequencyOf(note: string) {
  const midi = parseNote(note);
  if (midi === null) {
    throw new Error(`Not a note: ${note}`);
  }
  return midiToFrequency(midi);
}

async function playedNotes(clip: AudioClip) {
  const source = createSampleSource(clip);
  const played: PlayedNote[] = [];
  const stop = detectPlayedNotes(source, {
    onNote: (note) => played.push(note),
  });
  await source.start();
  stop();
  return played;
}

const label = ({ note }: PlayedNote) =>
  note ? `${note.name}${note.octave}` : null;

describe("detectPlayedNotes", () => {
  test("names each note and keeps its pluck time", async () => {
    const melody = ["E1", "G1", "A1", "C2", "D2", "F2", "G2", "A2"];
    const clip = generatePlucks(
      melody.map((note, index) => ({
        frequency: frequencyOf(note),
        phase: index,
        time: 0.3 + index * 0.5,
      })),
      {
        duration: 4.5,
        harmonics: BASS_HARMONICS,
        noise: 0.003,
        sampleRate: 48_000,
      }
    );

    const played = await playedNotes(clip);

    expect(played.map(label)).toEqual(melody);
    for (const [index, note] of played.entries()) {
      const error = note.onsetMs - (300 + index * 500);
      expect(error).toBeGreaterThanOrEqual(-0.1);
      expect(error).toBeLessThan(4);
    }
  });

  test("times low E by the pluck, not by when its pitch is known", async () => {
    const clip = generatePlucks([{ frequency: 41.2, time: 0.5 }], {
      duration: 1.2,
      harmonics: BASS_HARMONICS,
      sampleRate: 48_000,
    });

    const [played] = await playedNotes(clip);

    expect(played && label(played)).toBe("E1");
    expect(played?.onsetMs).toBeGreaterThanOrEqual(500);
    expect(played?.onsetMs).toBeLessThan(504);
  });

  test("reports a pluck with no clear pitch as unnamed", async () => {
    const samples = new Float32Array(48_000);
    // A short click: loud enough to be a pluck, too short to have a pitch.
    for (let index = 0; index < 48; index += 1) {
      samples[12_000 + index] = index % 2 === 0 ? 0.5 : -0.5;
    }

    const played = await playedNotes({ sampleRate: 48_000, samples });

    expect(played).toHaveLength(1);
    expect(played[0]?.note).toBeNull();
    expect(played[0]?.onsetMs).toBeCloseTo(250, 0);
  });

  test("gives up on a note when the next pluck comes too soon to name it", async () => {
    const clip = generatePlucks(
      [
        { frequency: frequencyOf("A1"), time: 0.3 },
        { frequency: frequencyOf("D2"), time: 0.38 },
      ],
      { duration: 1, sampleRate: 48_000 }
    );

    const played = await playedNotes(clip);

    expect(played.map(label)).toEqual([null, "D2"]);
  });
});
