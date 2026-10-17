import { describe, expect, test } from "bun:test";
import { describeJudgment, describeOffset } from "./describe";

describe("describeOffset", () => {
  test("says early or late, with a sign, in whole ms", () => {
    expect(describeOffset(80.4)).toBe("Late +80 ms");
    expect(describeOffset(-35.6)).toBe("Early −36 ms");
    expect(describeOffset(0.3)).toBe("On time");
  });
});

describe("describeJudgment", () => {
  test("shows the rating and the timing", () => {
    expect(
      describeJudgment({
        index: 0,
        offsetMs: 80,
        playedMidi: 28,
        rating: "good",
        reason: null,
      })
    ).toEqual({ detail: "Late +80 ms", label: "Good" });
  });

  test("shows timing for a right note played too early", () => {
    expect(
      describeJudgment({
        index: 0,
        offsetMs: -150,
        playedMidi: 28,
        rating: "miss",
        reason: "early",
      })
    ).toEqual({ detail: "Early −150 ms", label: "Miss" });
  });

  test("names the wrong note", () => {
    expect(
      describeJudgment({
        index: 0,
        offsetMs: 5,
        playedMidi: 29,
        rating: "miss",
        reason: "wrong-note",
      })
    ).toEqual({ detail: "Wrong note: F1", label: "Miss" });
  });

  test("says when nothing was played", () => {
    expect(
      describeJudgment({
        index: 0,
        offsetMs: null,
        playedMidi: null,
        rating: "miss",
        reason: "not-played",
      })
    ).toEqual({ detail: "Not played", label: "Miss" });
  });

  test("says when a note buzzed", () => {
    expect(
      describeJudgment({
        index: 0,
        offsetMs: 3,
        playedMidi: 28,
        rating: "miss",
        reason: "buzz",
      })
    ).toEqual({ detail: "Buzzing: fret it cleanly", label: "Miss" });
  });
});
