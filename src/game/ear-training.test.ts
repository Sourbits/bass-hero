import { describe, expect, test } from "bun:test";
import { levelSettings } from "./difficulty";
import {
  type EarPrompt,
  type EarResult,
  earLevelPositions,
  earOutcomes,
  earPrompts,
  judgeAnswer,
  scoreEar,
} from "./ear-training";
import { positionKey, positionName } from "./positions";

const PROMPT: EarPrompt = { midi: 31, position: { fret: 3, string: "E" } };
const result = (tries: number, solved = true): EarResult => ({
  prompt: PROMPT,
  solved,
  tries,
});

describe("earPrompts", () => {
  const { positions } = levelSettings({ level: 5, tier: "easy" });

  test("asks for notes from the pool, never the same twice in a row", () => {
    const prompts = earPrompts(positions, 50, 4);
    const allowed = new Set(positions.map(positionKey));

    expect(prompts).toHaveLength(50);
    for (const [index, prompt] of prompts.entries()) {
      expect(allowed.has(positionKey(prompt.position))).toBe(true);
      expect(prompt.midi).not.toBe(prompts[index - 1]?.midi);
    }
  });

  test("works with a single note", () => {
    expect(earPrompts(positions.slice(0, 1), 3, 1)).toHaveLength(3);
  });
});

describe("judgeAnswer", () => {
  test("says right, or which way to go", () => {
    expect(judgeAnswer(31, 31)).toBe("correct");
    expect(judgeAnswer(31, 28)).toBe("higher");
    expect(judgeAnswer(31, 33)).toBe("lower");
  });

  test("an octave off is still wrong", () => {
    expect(judgeAnswer(31, 43)).toBe("lower");
  });
});

describe("scoreEar", () => {
  test("gives fewer points for more tries, and nothing for unsolved", () => {
    expect(scoreEar([result(2)]).score).toBe(50);
    expect(scoreEar([result(3)]).score).toBe(25);
    expect(scoreEar([result(3, false)]).score).toBe(0);
  });

  test("builds a multiplier from first-try answers in a row", () => {
    // 3 at ×1, 3 at ×2, then a 4th-in-a-row-of-three at ×3.
    const score = scoreEar(Array.from({ length: 7 }, () => result(1)));

    expect(score.score).toBe(300 + 600 + 300);
    expect(score.firstTry).toBe(7);
    expect(score.maxStreak).toBe(7);
    expect(score.multiplier).toBe(3);
  });

  test("a second try or a miss resets the streak", () => {
    const score = scoreEar([result(1), result(1), result(2), result(1)]);

    expect(score.streak).toBe(1);
    expect(score.maxStreak).toBe(2);
  });
});

describe("earOutcomes", () => {
  test("counts a note as known only on the first try", () => {
    expect(
      earOutcomes([result(1), result(2), result(3, false)]).map(
        (outcome) => outcome.hit
      )
    ).toEqual([true, false, false]);
  });
});

describe("ear levels", () => {
  const names = (level: number) =>
    earLevelPositions(level).map((position) => positionName(position));

  test("start with the open strings", () => {
    expect(names(1)).toEqual(["E1", "A1", "D2", "G2"]);
  });

  test("level 2 is the naturals on the E and A strings to the 3rd fret", () => {
    expect(names(2).sort()).toEqual(["A1", "B1", "C2", "E1", "F1", "G1"]);
  });

  test("count each pitch once", () => {
    // Up to the 12th fret: every note from E1 to G3, 28 in all.
    expect(earLevelPositions(10)).toHaveLength(28);
    const pitches = names(10);
    expect(new Set(pitches).size).toBe(pitches.length);
  });

  test("never repeat one of the last two notes once there are four", () => {
    const prompts = earPrompts(earLevelPositions(1), 60, 7);
    for (const [index, prompt] of prompts.entries()) {
      expect(prompt.midi).not.toBe(prompts[index - 1]?.midi);
      expect(prompt.midi).not.toBe(prompts[index - 2]?.midi);
    }
  });
});
