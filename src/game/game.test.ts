import { describe, expect, test } from "bun:test";
import { createSampleSource } from "@/audio/sample-source";
import { generatePlucks } from "@/audio/tones";
import { detectPlayedNotes } from "@/onset/played-notes";
import { midiToFrequency } from "@/pitch/notes";
import { createJudge } from "@/timing/judge";
import { scheduleChart } from "./chart";
import { WARM_UP } from "./charts";
import { demoPerformance } from "./demo";
import { highwayGeometry, laneX, projectNote } from "./layout";
import { summarize } from "./score";

const BASS_HARMONICS = [0.6, 1, 0.5, 0.3, 0.15];

describe("scheduleChart", () => {
  test("puts each beat on the clock at the chosen tempo", () => {
    const notes = scheduleChart(WARM_UP, { bpm: 60, startMs: 5000 });

    expect(notes).toHaveLength(16);
    expect(notes[0]).toEqual({
      beat: 0,
      fret: 0,
      midi: 28,
      name: "E1",
      string: "E",
      targetMs: 5000,
    });
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

  test("uses the string a chart asks for, or the usual one", () => {
    const notes = scheduleChart(
      {
        notes: [
          { beat: 0, note: "A1" },
          { beat: 1, note: "A1", string: "E" },
          { beat: 2, note: "C2" },
          { beat: 3, note: "A2" },
        ],
        title: "",
      },
      { bpm: 60, startMs: 0 }
    );

    expect(notes.map(({ fret, string }) => `${string}${fret}`)).toEqual([
      "A0",
      "E5",
      "A3",
      "G2",
    ]);
  });

  test("rejects a note too low for the string it's put on", () => {
    expect(() =>
      scheduleChart(
        { notes: [{ beat: 0, note: "E1", string: "A" }], title: "Bad" },
        { bpm: 60, startMs: 0 }
      )
    ).toThrow("too low");
  });
});

describe("projectNote", () => {
  const geometry = highwayGeometry(800, 420);

  test("puts a note exactly on the strike line, full size, at its target time", () => {
    for (const targetMs of [0, 1234.5, 98_765.4321]) {
      expect(projectNote(targetMs, targetMs, geometry)).toEqual({
        scale: 1,
        y: geometry.strikeY,
      });
    }
  });

  test("starts a note small at the far end one approach time early", () => {
    const start = projectNote(5000, 5000 - geometry.approachMs, geometry);

    expect(start.y).toBeCloseTo(geometry.farY, 9);
    expect(start.scale).toBeCloseTo(geometry.farScale, 9);
  });

  test("speeds up as it comes closer, as in real perspective", () => {
    const at = (msBefore: number) =>
      projectNote(5000, 5000 - msBefore, geometry).y;
    const farStep = at(2500) - at(2000);
    const nearStep = at(500) - at(0);

    expect(at(2000)).toBeGreaterThan(at(2500));
    expect(nearStep).toBeLessThan(0);
    expect(Math.abs(nearStep)).toBeGreaterThan(Math.abs(farStep));
  });

  test("keeps coming past the strike line, without blowing up", () => {
    const after = projectNote(5000, 5000 + 400, geometry);
    const wayAfter = projectNote(5000, 5000 + 60_000, geometry);

    expect(after.y).toBeGreaterThan(geometry.strikeY);
    expect(after.scale).toBeGreaterThan(1);
    expect(Number.isFinite(wayAfter.y)).toBe(true);
  });
});

describe("laneX", () => {
  const geometry = highwayGeometry(800, 420);

  test("puts the lanes E, A, D, G left to right, centered", () => {
    const xs = (["E", "A", "D", "G"] as const).map((string) =>
      laneX(string, 1, geometry)
    );

    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(((xs[1] ?? 0) + (xs[2] ?? 0)) / 2).toBeCloseTo(400, 9);
  });

  test("draws the lanes closer together further away", () => {
    const near = laneX("G", 1, geometry) - laneX("E", 1, geometry);
    const far = laneX("G", 0.25, geometry) - laneX("E", 0.25, geometry);

    expect(far).toBeCloseTo(near / 4, 9);
  });

  test("fits a narrow phone screen", () => {
    const phone = highwayGeometry(343, 360);

    expect(laneX("E", 1, phone) - phone.radius).toBeGreaterThan(0);
    expect(laneX("G", 1, phone) + phone.radius).toBeLessThan(343);
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
