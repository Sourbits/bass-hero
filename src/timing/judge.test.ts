import { describe, expect, test } from "bun:test";
import { TIMING } from "@/config/timing";
import { parseNote } from "@/pitch/notes";
import { createJudge, type ExpectedNote, rateOffset } from "./judge";

function midi(note: string) {
  const value = parseNote(note);
  if (value === null) {
    throw new Error(`Not a note: ${note}`);
  }
  return value;
}

/** E1 at 1 s, A1 at 2 s, D2 at 3 s. */
const CHART: ExpectedNote[] = [
  { midi: midi("E1"), targetMs: 1000 },
  { midi: midi("A1"), targetMs: 2000 },
  { midi: midi("D2"), targetMs: 3000 },
];

function hitE1(onsetMs: number, latencyOffsetMs = 0) {
  return createJudge(CHART, { latencyOffsetMs }).judgeHit({
    midi: midi("E1"),
    onsetMs,
  });
}

describe("rateOffset", () => {
  test("uses the windows from the config file", () => {
    expect(TIMING.perfectWindowMs).toBe(50);
    expect(TIMING.goodWindowMs).toBe(120);
  });

  test("includes the edges of each window", () => {
    expect(rateOffset(-50).rating).toBe("perfect");
    expect(rateOffset(50).rating).toBe("perfect");
    expect(rateOffset(-120).rating).toBe("good");
    expect(rateOffset(120).rating).toBe("good");
    expect(rateOffset(120.4).rating).toBe("good");
    expect(rateOffset(-121)).toEqual({ rating: "miss", reason: "early" });
    expect(rateOffset(121)).toEqual({ rating: "miss", reason: "late" });
  });
});

describe("createJudge", () => {
  test("Perfect, right on time", () => {
    expect(hitE1(1000)).toEqual({
      index: 0,
      offsetMs: 0,
      playedMidi: midi("E1"),
      rating: "perfect",
      reason: null,
    });
  });

  test("Perfect, a little early or late, with the offset recorded", () => {
    expect(hitE1(965)).toMatchObject({ offsetMs: -35, rating: "perfect" });
    expect(hitE1(1040)).toMatchObject({ offsetMs: 40, rating: "perfect" });
  });

  test("Good, early", () => {
    expect(hitE1(920)).toMatchObject({ offsetMs: -80, rating: "good" });
  });

  test("Good, late", () => {
    expect(hitE1(1110)).toMatchObject({ offsetMs: 110, rating: "good" });
  });

  test("Miss, too early", () => {
    expect(hitE1(850)).toMatchObject({
      offsetMs: -150,
      rating: "miss",
      reason: "early",
    });
  });

  test("Miss, too late", () => {
    expect(hitE1(1180)).toMatchObject({
      offsetMs: 180,
      rating: "miss",
      reason: "late",
    });
  });

  test("a wrong note in the window is a Miss", () => {
    const judge = createJudge(CHART);

    const judgment = judge.judgeHit({ midi: midi("F1"), onsetMs: 1010 });

    expect(judgment).toEqual({
      index: 0,
      offsetMs: 10,
      playedMidi: midi("F1"),
      rating: "miss",
      reason: "wrong-note",
    });
    // The note is used up: playing the right one afterwards doesn't count.
    expect(judge.judgeHit({ midi: midi("E1"), onsetMs: 1030 })).toBeNull();
  });

  test("the right note an octave off is wrong, unless octaves are ignored", () => {
    const strict = createJudge(CHART);
    const relaxed = createJudge(CHART, {
      config: { ...TIMING, ignoreOctave: true },
    });

    expect(strict.judgeHit({ midi: midi("E2"), onsetMs: 1000 })?.reason).toBe(
      "wrong-note"
    );
    expect(relaxed.judgeHit({ midi: midi("E2"), onsetMs: 1000 })?.rating).toBe(
      "perfect"
    );
  });

  test("a note not played is a Miss once its window closes", () => {
    const judge = createJudge(CHART);
    const closesAt = 1000 + TIMING.missWindowMs + TIMING.identifyGraceMs;

    expect(judge.closeWindows(closesAt)).toEqual([]);
    expect(judge.closeWindows(closesAt + 1)).toEqual([
      {
        index: 0,
        offsetMs: null,
        playedMidi: null,
        rating: "miss",
        reason: "not-played",
      },
    ]);
    expect(judge.closeWindows(closesAt + 2)).toEqual([]);
  });

  test("waits long enough for a late pluck to be named", () => {
    const judge = createJudge(CHART);

    // A pluck 110 ms late is named about 100 ms later.
    expect(judge.closeWindows(1210)).toEqual([]);
    expect(judge.judgeHit({ midi: midi("E1"), onsetMs: 1110 })?.rating).toBe(
      "good"
    );
  });

  test("ignores plucks with no clear pitch", () => {
    expect(
      createJudge(CHART).judgeHit({ midi: null, onsetMs: 1000 })
    ).toBeNull();
  });

  test("ignores plucks nowhere near a note", () => {
    const judge = createJudge(CHART);

    expect(judge.judgeHit({ midi: midi("E1"), onsetMs: 1500 })).toBeNull();
    expect(judge.judgeHit({ midi: midi("G2"), onsetMs: 1150 })).toBeNull();
    expect(judge.judgments().every((judgment) => !judgment)).toBe(true);
  });

  test("a second pluck of an already-judged note is ignored", () => {
    const judge = createJudge(CHART);
    judge.judgeHit({ midi: midi("E1"), onsetMs: 1000 });

    expect(judge.judgeHit({ midi: midi("E1"), onsetMs: 1060 })).toBeNull();
  });

  test("matches the nearest note of that pitch when windows overlap", () => {
    const judge = createJudge([
      { midi: midi("A1"), targetMs: 1000 },
      { midi: midi("A1"), targetMs: 1250 },
    ]);

    expect(judge.judgeHit({ midi: midi("A1"), onsetMs: 1200 })).toMatchObject({
      index: 1,
      offsetMs: -50,
    });
  });

  test("reports when every note is judged", () => {
    const judge = createJudge(CHART);
    judge.judgeHit({ midi: midi("E1"), onsetMs: 1000 });
    judge.judgeHit({ midi: midi("A1"), onsetMs: 2000 });

    expect(judge.isComplete()).toBe(false);
    judge.closeWindows(10_000);
    expect(judge.isComplete()).toBe(true);
    expect(judge.judgments().map((judgment) => judgment?.rating)).toEqual([
      "perfect",
      "perfect",
      "miss",
    ]);
  });
});

describe("createJudge with a calibration offset", () => {
  test("subtracts the offset from every hit", () => {
    // The system reports plucks 100 ms late; this one was really 30 ms late.
    expect(hitE1(1130, 100)).toMatchObject({ offsetMs: 30, rating: "perfect" });
  });

  test("turns a reported-late pluck into an early one when it was early", () => {
    expect(hitE1(1000, 100)).toMatchObject({ offsetMs: -100, rating: "good" });
  });

  test("handles a negative offset", () => {
    expect(hitE1(960, -40)).toMatchObject({ offsetMs: 0, rating: "perfect" });
  });

  test("moves the window to match", () => {
    // 1250 ms is outside the miss window without the offset, inside with it.
    expect(hitE1(1250)).toBeNull();
    expect(hitE1(1250, 100)).toMatchObject({ offsetMs: 150, reason: "late" });
  });

  test("waits the offset longer before calling a note not played", () => {
    const judge = createJudge(CHART, { latencyOffsetMs: 100 });
    const closesAt = 1000 + TIMING.missWindowMs + TIMING.identifyGraceMs;

    expect(judge.closeWindows(closesAt + 50)).toEqual([]);
    expect(judge.closeWindows(closesAt + 101)).toHaveLength(1);
  });
});

describe("createJudge with fret buzz", () => {
  const buzzy = TIMING.buzzThresholdDb + 5;
  const clean = TIMING.buzzThresholdDb - 15;

  test("a right note that buzzes is a Miss", () => {
    const judgment = createJudge(CHART).judgeHit({
      buzzDb: buzzy,
      midi: midi("E1"),
      onsetMs: 1010,
    });

    expect(judgment).toMatchObject({
      offsetMs: 10,
      rating: "miss",
      reason: "buzz",
    });
  });

  test("a clean note, or one with no measurement, is judged as usual", () => {
    for (const buzzDb of [clean, null, undefined]) {
      expect(
        createJudge(CHART).judgeHit({ buzzDb, midi: midi("E1"), onsetMs: 1010 })
          ?.rating
      ).toBe("perfect");
    }
  });

  test("can be switched off", () => {
    const judge = createJudge(CHART, {
      config: { ...TIMING, countBuzz: false },
    });

    expect(
      judge.judgeHit({ buzzDb: buzzy, midi: midi("E1"), onsetMs: 1010 })?.rating
    ).toBe("perfect");
  });

  test("a buzzing note that's also too late is still marked late", () => {
    expect(
      createJudge(CHART).judgeHit({
        buzzDb: buzzy,
        midi: midi("E1"),
        onsetMs: 1180,
      })?.reason
    ).toBe("late");
  });
});
