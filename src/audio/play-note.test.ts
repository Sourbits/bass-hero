import { describe, expect, test } from "bun:test";
import { createSampleSource } from "@/audio/sample-source";
import { detectNotes } from "@/pitch/note-detector";
import { midiToName } from "@/pitch/notes";
import { stringSamples } from "./play-note";

/** The note the detector hears most often in a clip. */
async function heardNote(samples: Float32Array, sampleRate: number) {
  const source = createSampleSource({ sampleRate, samples });
  const counts = new Map<string, number>();
  detectNotes(source, {
    onReading: ({ note }) => {
      if (note) {
        const name = `${note.name}${note.octave}`;
        counts.set(name, (counts.get(name) ?? 0) + 1);
      }
    },
  });
  await source.start();
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

describe("stringSamples", () => {
  test("sounds the note it's asked for, low E up to the 12th fret", async () => {
    const midis = [28, 33, 38, 43, 48, 55];
    const heard = await Promise.all(
      midis.map((midi) => heardNote(stringSamples(48_000, midi), 48_000))
    );
    expect(heard).toEqual(midis.map((midi) => midiToName(midi)));
  });
});
