import { describe, expect, test } from "bun:test";
import { recordRun } from "./progress";
import {
  EMPTY_SAVED_DATA,
  mergeNoteStats,
  mergeSavedData,
  parseSavedData,
  type SavedData,
} from "./saved-data";

const easy1 = { level: 1, tier: "easy" as const };
const easy2 = { level: 2, tier: "easy" as const };

function data(change: Partial<SavedData>): SavedData {
  return { ...EMPTY_SAVED_DATA, ...change };
}

describe("parseSavedData", () => {
  test("round-trips through JSON", () => {
    const saved = data({
      achievements: {
        stats: {
          bestEarStreak: 4,
          earStreak: 2,
          modesPlayed: ["level", "ear-training"],
          notesPlayed: 120,
          playDays: ["2026-10-19", "2026-10-20"],
        },
        unlocked: {
          century: 1_700_000_000_500,
          "first-note": 1_700_000_000_000,
        },
      },
      noteStats: { E3: { attempts: 4, hits: 3, mastery: 0.7 } },
      practice: { customKeys: ["E0", "A3"], setId: "custom" },
      progress: recordRun(EMPTY_SAVED_DATA.progress, easy1, {
        hitRate: 0.9,
        score: 1200,
      }),
      settings: { leftHanded: true },
      tempo: 85,
      updatedAt: 1_700_000_000_000,
    });

    expect(parseSavedData(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
  });

  test("rejects anything that isn't saved data", () => {
    expect(parseSavedData(null)).toBeNull();
    expect(parseSavedData("hello")).toBeNull();
    expect(parseSavedData({ version: 2 })).toBeNull();
  });

  test("drops bad entries instead of trusting them", () => {
    const parsed = parseSavedData({
      noteStats: {
        A2: { attempts: 3, hits: 2, mastery: 0.6 },
        E3: { attempts: 2, hits: 5, mastery: 0.5 },
        Z9: { attempts: 1, hits: 1, mastery: 1 },
      },
      progress: {
        current: { level: 99, tier: "nope" },
        records: {
          "easy-1": { bestHitRate: 7, bestScore: 1, stars: 1 },
          "hard-4": { bestHitRate: 0.5, bestScore: 900, stars: 0 },
        },
      },
      tempo: 999,
      updatedAt: -5,
      version: 1,
    });

    expect(Object.keys(parsed?.noteStats ?? {})).toEqual(["A2"]);
    expect(Object.keys(parsed?.progress.records ?? {})).toEqual(["hard-4"]);
    expect(parsed?.progress.current).toEqual(easy1);
    expect(parsed?.tempo).toBeNull();
    expect(parsed?.updatedAt).toBe(0);
  });
});

describe("mergeSavedData", () => {
  test("keeps the best result for every level from both copies", () => {
    const guest = data({
      progress: recordRun(
        recordRun(EMPTY_SAVED_DATA.progress, easy1, {
          hitRate: 0.97,
          score: 900,
        }),
        easy2,
        { hitRate: 0.7, score: 800 }
      ),
      updatedAt: 2,
    });
    const account = data({
      progress: recordRun(EMPTY_SAVED_DATA.progress, easy1, {
        hitRate: 0.8,
        score: 1500,
      }),
      updatedAt: 1,
    });

    const merged = mergeSavedData(account, guest);

    expect(merged.progress.records["easy-1"]).toEqual({
      bestHitRate: 0.97,
      bestScore: 1500,
      stars: 3,
    });
    expect(merged.progress.records).toMatchObject({ "easy-2": { stars: 1 } });
  });

  test("takes choices from whichever copy changed last", () => {
    const older = data({
      practice: { customKeys: [], setId: "open-strings" },
      progress: { ...EMPTY_SAVED_DATA.progress, current: easy1 },
      tempo: 60,
      updatedAt: 100,
    });
    const newer = data({
      practice: { customKeys: [], setId: "warm-up" },
      progress: { ...EMPTY_SAVED_DATA.progress, current: easy2 },
      tempo: 90,
      updatedAt: 200,
    });

    for (const merged of [
      mergeSavedData(older, newer),
      mergeSavedData(newer, older),
    ]) {
      expect(merged.progress.current).toEqual(easy2);
      expect(merged.practice?.setId).toBe("warm-up");
      expect(merged.tempo).toBe(90);
      expect(merged.updatedAt).toBe(200);
    }
  });

  test("left-handed mode comes from whichever copy set it last", () => {
    const merged = mergeSavedData(
      data({ settings: { leftHanded: true }, updatedAt: 1 }),
      data({ settings: null, updatedAt: 2 })
    );

    expect(merged.settings).toEqual({ leftHanded: true });
  });

  test("doesn't lose a setting the newer copy never had", () => {
    const merged = mergeSavedData(
      data({ tempo: 80, updatedAt: 1 }),
      data({ tempo: null, updatedAt: 2 })
    );

    expect(merged.tempo).toBe(80);
  });
});

describe("mergeNoteStats", () => {
  test("keeps, for each note, the stats with more plays behind them", () => {
    expect(
      mergeNoteStats(
        {
          A2: { attempts: 3, hits: 3, mastery: 0.8 },
          E3: { attempts: 10, hits: 4, mastery: 0.4 },
        },
        {
          D0: { attempts: 1, hits: 1, mastery: 0.65 },
          E3: { attempts: 6, hits: 6, mastery: 0.9 },
        }
      )
    ).toEqual({
      A2: { attempts: 3, hits: 3, mastery: 0.8 },
      D0: { attempts: 1, hits: 1, mastery: 0.65 },
      E3: { attempts: 10, hits: 4, mastery: 0.4 },
    });
  });
});

describe("older saved data", () => {
  test("data saved before achievements existed still loads", () => {
    const { achievements: _, ...before } = EMPTY_SAVED_DATA;
    expect(parseSavedData(before)?.achievements).toEqual(
      EMPTY_SAVED_DATA.achievements
    );
  });
});
