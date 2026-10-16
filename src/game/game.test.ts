import { describe, expect, test } from "bun:test";
import { createSampleSource } from "@/audio/sample-source";
import { generatePlucks } from "@/audio/tones";
import { detectPlayedNotes } from "@/onset/played-notes";
import { midiToFrequency } from "@/pitch/notes";
import { createJudge } from "@/timing/judge";
import { scheduleChart, stringFor } from "./chart";
import { WARM_UP } from "./charts";
import { demoPerformance } from "./demo";
import { CIRCLE_RADIUS, circleX, highwayLayout } from "./layout";
import { summarize } from "./score";

const BASS_HARMONICS = [0.6, 1, 0.5, 0.3, 0.15];

describe("scheduleChart", () => {
  test("puts each beat on the clock at the chosen tempo", () => {
    const notes = scheduleChart(WARM_UP, { bpm: 60, startMs: 5000 });

    expect(notes).toHaveLength(16);
    expect(notes[0]).toEqual({ beat: 0, midi: 28, name: "E1", targetMs: 5000 });
    expect(notes[1]?.targetMs).toBe(6000);
    expect(notes[15]?.targetMs).toBe(20_000);
  });

  test("changing the tempo changes the spacing", () => {
    const notes = scheduleChart(WARM_UP, { bpm: 120, startMs: 0 });

    expect(notes.map((note) => note.targetMs).slice(0, 3)).toEqual([
      0, 500, 1000,
    ]);
  });

  test("rejects a chart with a note it can't read", () => {
    expect(() =>
      scheduleChart(
        { notes: [{ beat: 0, note: "H2" }], title: "Bad" },
        { bpm: 60, startMs: 0 }
      )
    ).toThrow("unknown note: H2");
  });
});

describe("stringFor", () => {
  test("picks the usual string for each open-position note", () => {
    expect(
      ["E1", "G1", "A1", "C2", "D2", "F2", "G2", "A2"].map((name) => {
        const [note] = scheduleChart(
          { notes: [{ beat: 0, note: name }], title: "" },
          { bpm: 60, startMs: 0 }
        );
        return stringFor(note?.midi ?? 0);
      })
    ).toEqual(["E", "E", "A", "A", "D", "D", "G", "G"]);
  });
});

describe("circleX", () => {
  const layout = highwayLayout(800);

  test("puts a circle exactly on the target outline at its target time", () => {
    for (const targetMs of [0, 1234.5, 98_765.4321]) {
      expect(circleX(targetMs, targetMs, layout)).toBe(layout.targetX);
    }
  });

  test("starts a circle just off the right edge one approach time early", () => {
    expect(circleX(5000, 5000 - layout.approachMs, layout)).toBe(
      800 + CIRCLE_RADIUS
    );
  });

  test("moves at a steady speed and keeps going past the target", () => {
    const halfway = circleX(5000, 5000 - layout.approachMs / 2, layout);
    const after = circleX(5000, 5000 + layout.approachMs / 2, layout);

    expect(halfway).toBeCloseTo((layout.targetX + 800 + CIRCLE_RADIUS) / 2, 6);
    expect(after).toBeCloseTo(
      layout.targetX - (800 + CIRCLE_RADIUS - layout.targetX) / 2,
      6
    );
  });

  test("keeps the target on screen on narrow phones", () => {
    expect(highwayLayout(300).targetX).toBe(2 * CIRCLE_RADIUS);
  });
});

describe("summarize", () => {
  test("counts ratings, scores them and averages hit timing", () => {
    const summary = summarize([
      {
        index: 0,
        offsetMs: 10,
        playedMidi: 28,
        rating: "perfect",
        reason: null,
      },
      { index: 1, offsetMs: -90, playedMidi: 28, rating: "good", reason: null },
      {
        index: 2,
        offsetMs: 150,
        playedMidi: 33,
        rating: "miss",
        reason: "late",
      },
      undefined,
    ]);

    expect(summary).toEqual({
      averageOffsetMs: -40,
      counts: { good: 1, miss: 1, perfect: 1 },
      judged: 3,
      score: 150,
    });
  });

  test("has no average when nothing was hit", () => {
    expect(summarize([]).averageOffsetMs).toBeNull();
  });
});

describe("the whole loop, from audio to score", () => {
  test("judges a synthesized performance the way it was played", async () => {
    const notes = scheduleChart(WARM_UP, { bpm: 70, startMs: 1000 });
    const plucks = demoPerformance(notes);
    const clip = generatePlucks(
      plucks.map(({ midi, timeMs }, index) => ({
        frequency: midiToFrequency(midi),
        phase: index,
        time: timeMs / 1000,
      })),
      {
        duration: (notes.at(-1)?.targetMs ?? 0) / 1000 + 1.5,
        harmonics: BASS_HARMONICS,
        noise: 0.003,
        sampleRate: 48_000,
      }
    );
    const source = createSampleSource(clip);
    const judge = createJudge(notes);
    detectPlayedNotes(source, {
      onNote: ({ note, onsetMs }) => {
        judge.judgeHit({ midi: note?.midi ?? null, onsetMs });
      },
    });

    await source.start();
    judge.closeWindows(Number.POSITIVE_INFINITY);
    const judgments = judge.judgments();

    expect(judgments.map((judgment) => judgment?.rating)).toEqual([
      "perfect",
      "perfect",
      "perfect",
      "good",
      "good",
      "miss",
      "miss",
      "miss",
      "perfect",
      "perfect",
      "perfect",
      "good",
      "perfect",
      "perfect",
      "perfect",
      "perfect",
    ]);
    expect(judgments.slice(5, 8).map((judgment) => judgment?.reason)).toEqual([
      "wrong-note",
      "not-played",
      "late",
    ]);

    // Every timed hit lands within 4 ms of how it was played.
    const played = [
      0,
      25,
      -30,
      80,
      -90,
      null,
      null,
      160,
      0,
      10,
      -15,
      60,
      0,
      -40,
      5,
      0,
    ];
    for (const [index, expected] of played.entries()) {
      if (expected !== null) {
        const offset = judgments[index]?.offsetMs ?? Number.NaN;
        expect(offset - expected).toBeGreaterThanOrEqual(-0.1);
        expect(offset - expected).toBeLessThan(4);
      }
    }

    expect(summarize(judgments).counts).toEqual({
      good: 3,
      miss: 3,
      perfect: 10,
    });
  });
});
