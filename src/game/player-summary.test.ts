import { describe, expect, test } from "bun:test";
import { summarizePlayer } from "./player-summary";
import { recordRun } from "./progress";
import { EMPTY_SAVED_DATA } from "./saved-data";

describe("summarizePlayer", () => {
  test("a new player has nothing yet", () => {
    const summary = summarizePlayer(EMPTY_SAVED_DATA, new Date(2026, 9, 22));
    expect(summary).toMatchObject({
      achievements: [],
      achievementsTotal: 39,
      furthest: null,
      lastPlayedAt: null,
      levelsCleared: 0,
      notesKnown: { current: 0, target: 52 },
      stars: { current: 0, target: 120 },
    });
  });

  test("adds up stars, clears and achievements", () => {
    let { progress } = EMPTY_SAVED_DATA;
    progress = recordRun(
      progress,
      { level: 1, tier: "easy" },
      {
        hitRate: 1,
        score: 1000,
      }
    );
    progress = recordRun(
      progress,
      { level: 3, tier: "medium" },
      {
        hitRate: 0.7,
        score: 800,
      }
    );
    progress = recordRun(
      progress,
      { level: 4, tier: "medium" },
      {
        hitRate: 0.3,
        score: 100,
      }
    );
    const summary = summarizePlayer(
      {
        ...EMPTY_SAVED_DATA,
        achievements: {
          stats: {
            ...EMPTY_SAVED_DATA.achievements.stats,
            notesPlayed: 340,
            playDays: ["2026-10-20", "2026-10-21"],
          },
          unlocked: { "first-note": 10, "spot-on": 30 },
        },
        noteStats: { E0: { attempts: 5, hits: 5, mastery: 0.9 } },
        progress,
        updatedAt: 500,
      },
      new Date(2026, 9, 22, 9)
    );
    expect(summary).toMatchObject({
      achievements: [
        { at: 30, id: "spot-on" },
        { at: 10, id: "first-note" },
      ],
      dayStreak: 2,
      furthest: { level: 3, tier: "medium" },
      lastPlayedAt: 500,
      levelsCleared: 2,
      notesKnown: { current: 1, target: 52 },
      notesPlayed: 340,
      stars: { current: 4, target: 120 },
    });
  });
});
