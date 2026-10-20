import { describe, expect, test } from "bun:test";
import type { Judgment, Rating } from "@/timing/judge";
import { ACHIEVEMENTS } from "./achievement-list";
import {
  type AchievementEvent,
  dayStreak,
  EMPTY_STATS,
  localDay,
} from "./achievement-stats";
import {
  type AchievementRecord,
  applyEvent,
  EMPTY_ACHIEVEMENTS,
  mergeAchievements,
  parseAchievements,
} from "./achievements";
import type { NoteStats } from "./note-stats";
import { NEW_PROGRESS, type Progress, recordRun } from "./progress";

const NOON = new Date(2026, 9, 20, 12);

function judged(ratings: Rating[], offsetMs = 10): Judgment[] {
  return ratings.map((rating, index) => ({
    index,
    offsetMs: rating === "miss" ? null : offsetMs,
    playedMidi: rating === "miss" ? null : 40,
    rating,
    reason: rating === "miss" ? "late" : null,
  }));
}

function run(
  ratings: Rating[],
  change: Partial<Extract<AchievementEvent, { kind: "run" }>> = {}
): AchievementEvent {
  const judgments = change.judgments ?? judged(ratings);
  return {
    at: NOON,
    countBuzz: true,
    judgments,
    kind: "run",
    level: { level: 1, tier: "easy" },
    mode: "level",
    order: judgments.map((_, index) => index),
    total: judgments.length,
    ...change,
  };
}

function ear(firstTries: boolean[], tier: "easy" | "hard" = "easy") {
  return { at: NOON, firstTries, kind: "ear-round", tier } as const;
}

function unlock(
  event: AchievementEvent,
  {
    noteStats = {},
    progress = NEW_PROGRESS,
    record = EMPTY_ACHIEVEMENTS,
  }: {
    noteStats?: NoteStats;
    progress?: Progress;
    record?: AchievementRecord;
  } = {}
) {
  return applyEvent(record, event, { noteStats, now: NOON, progress });
}

const times = (count: number, rating: Rating) =>
  Array.from({ length: count }, () => rating);

describe("the list", () => {
  test("has 39 achievements with unique ids", () => {
    const ids = ACHIEVEMENTS.map(({ id }) => id);
    expect(ids).toHaveLength(39);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("runs", () => {
  test("a first run unlocks the first-session ones", () => {
    const { unlocked } = unlock(run(["perfect", "good", "miss"]));
    expect(unlocked).toEqual(["first-note", "spot-on"]);
  });

  test("a run of nothing but misses unlocks nothing", () => {
    expect(unlock(run(times(5, "miss"))).unlocked).toEqual([]);
  });

  test("combos unlock at x2, x4 and 50 in a row", () => {
    const streak = (count: number) =>
      unlock(run([...times(count, "good"), "miss"])).unlocked;
    expect(streak(9)).not.toContain("warmed-up");
    expect(streak(10)).toContain("warmed-up");
    expect(streak(29)).not.toContain("on-fire");
    expect(streak(30)).toContain("on-fire");
    expect(streak(50)).toContain("unstoppable");
  });

  test("Full Combo and Perfectionist need a level with no misses", () => {
    expect(unlock(run(times(12, "good"))).unlocked).toContain("full-combo");
    expect(unlock(run(times(12, "good"))).unlocked).not.toContain(
      "perfectionist"
    );
    expect(unlock(run(times(12, "perfect"))).unlocked).toContain(
      "perfectionist"
    );
    expect(
      unlock(run(times(12, "perfect"), { mode: "practice" })).unlocked
    ).not.toContain("full-combo");
  });

  test("Clean Hands needs buzz checking on and 2 stars", () => {
    const clean = times(12, "good");
    expect(unlock(run(clean)).unlocked).toContain("clean-hands");
    expect(unlock(run(clean, { countBuzz: false })).unlocked).not.toContain(
      "clean-hands"
    );
    const buzzed = judged(clean);
    buzzed[3] = {
      ...judged(["miss"])[0],
      index: 3,
      reason: "buzz",
    } as Judgment;
    expect(unlock(run([], { judgments: buzzed })).unlocked).not.toContain(
      "clean-hands"
    );
    expect(unlock(run(times(12, "miss"))).unlocked).not.toContain(
      "clean-hands"
    );
  });

  test("Metronome needs 30 hits averaging within 5 ms", () => {
    const steady = (offsetMs: number, count: number) =>
      unlock(run([], { judgments: judged(times(count, "good"), offsetMs) }))
        .unlocked;
    expect(steady(-4, 30)).toContain("metronome");
    expect(steady(6, 30)).not.toContain("metronome");
    expect(steady(0, 29)).not.toContain("metronome");
  });

  test("No Weak Spots needs 90% in a Weak spots run", () => {
    const spots = (ratings: Rating[]) =>
      unlock(run(ratings, { level: null, mode: "weak-spots" })).unlocked;
    expect(spots([...times(9, "good"), "miss"])).toContain("no-weak-spots");
    expect(spots([...times(8, "good"), "miss", "miss"])).not.toContain(
      "no-weak-spots"
    );
    expect(spots(["miss"])).toContain("self-aware");
  });

  test("Night Owl is between midnight and 4 am", () => {
    const at = (hour: number) =>
      unlock(run(["good"], { at: new Date(2026, 9, 20, hour) })).unlocked;
    expect(at(1)).toContain("night-owl");
    expect(at(4)).not.toContain("night-owl");
    expect(at(23)).not.toContain("night-owl");
  });
});

describe("saved progress", () => {
  test("stars and clears unlock even from a plain check", () => {
    let progress = NEW_PROGRESS;
    for (let level = 1; level <= 10; level += 1) {
      progress = recordRun(
        progress,
        { level, tier: "easy" },
        {
          hitRate: 1,
          score: 1000,
        }
      );
    }
    const { unlocked } = unlock({ kind: "check" }, { progress });
    expect(unlocked).toEqual([
      "first-clear",
      "shining-star",
      "halfway-there",
      "easy-does-it",
      "star-collector",
    ]);
  });

  test("the heat map unlocks Open Strings and Know Your E", () => {
    const solid = { attempts: 5, hits: 5, mastery: 0.9 };
    const noteStats: NoteStats = { A0: solid, D0: solid, G0: solid };
    for (let fret = 0; fret <= 12; fret += 1) {
      noteStats[`E${fret}`] = solid;
    }
    const { unlocked } = unlock({ kind: "check" }, { noteStats });
    expect(unlocked).toEqual(["open-strings", "know-your-e"]);
  });

  test("nothing unlocks twice", () => {
    const first = unlock(run(["perfect"]));
    const second = unlock(run(["perfect"]), { record: first.record });
    expect(second.unlocked).toEqual([]);
    expect(second.record.unlocked["first-note"]).toBe(NOON.getTime());
  });
});

describe("ear training", () => {
  test("a perfect round unlocks Good Ears, and Golden Ears on Hard", () => {
    const perfect = times(10, "good").map(() => true);
    expect(unlock(ear(perfect)).unlocked).toContain("good-ears");
    expect(unlock(ear(perfect)).unlocked).not.toContain("golden-ears");
    expect(unlock(ear(perfect, "hard")).unlocked).toContain("golden-ears");
    expect(unlock(ear([...perfect.slice(1), false])).unlocked).toEqual([
      "first-note",
      "first-listen",
    ]);
  });

  test("the ear streak carries across rounds", () => {
    let record = EMPTY_ACHIEVEMENTS;
    const rounds = [
      [false, ...times(9, "good").map(() => true)],
      times(10, "good").map(() => true),
      [true, true, true, true, true, true, false, true, true, true],
    ];
    const unlocked: string[] = [];
    for (const round of rounds) {
      const { record: next, unlocked: found } = unlock(ear(round), { record });
      record = next;
      unlocked.push(...found);
    }
    expect(record.stats.bestEarStreak).toBe(25);
    expect(record.stats.earStreak).toBe(3);
    expect(unlocked).toContain("ear-streak");
  });
});

describe("habits", () => {
  test("counts notes and modes played", () => {
    let record = EMPTY_ACHIEVEMENTS;
    const unlocked: string[] = [];
    const events: AchievementEvent[] = [
      run(times(40, "good")),
      run(times(40, "miss"), { mode: "practice" }),
      run(times(20, "miss"), { mode: "weak-spots" }),
      ear([false]),
    ];
    for (const event of events) {
      const { record: next, unlocked: found } = unlock(event, { record });
      record = next;
      unlocked.push(...found);
    }
    expect(record.stats.notesPlayed).toBe(101);
    expect(unlocked).toContain("century");
    expect(unlocked).toContain("explorer");
  });

  test("days in a row", () => {
    const days = ["2026-10-17", "2026-10-18", "2026-10-19", "2026-10-20"];
    expect(dayStreak(days)).toBe(4);
    expect(dayStreak(["2026-10-15", ...days.slice(2)])).toBe(2);
    expect(dayStreak(days, new Date(2026, 9, 21, 9))).toBe(4);
    expect(dayStreak(days, new Date(2026, 9, 22, 9))).toBe(0);
    expect(dayStreak(["2026-10-31", "2026-11-01"])).toBe(2);
    expect(localDay(new Date(2026, 0, 5, 23))).toBe("2026-01-05");
  });

  test("Daily Practice after playing 3 days in a row", () => {
    const record = {
      ...EMPTY_ACHIEVEMENTS,
      stats: { ...EMPTY_STATS, playDays: ["2026-10-18", "2026-10-19"] },
    };
    expect(unlock(run(["good"]), { record }).unlocked).toContain(
      "daily-practice"
    );
  });
});

describe("saving", () => {
  test("parsing drops unknown achievements and bad stats", () => {
    expect(
      parseAchievements({
        stats: { modesPlayed: ["level", "karaoke"], notesPlayed: -3 },
        unlocked: { "first-note": 5, "made-up": 9, "spot-on": "yes" },
      })
    ).toEqual({
      stats: { ...EMPTY_STATS, modesPlayed: ["level"] },
      unlocked: { "first-note": 5 },
    });
  });

  test("merging keeps everything unlocked on either device, earliest first", () => {
    const merged = mergeAchievements(
      {
        stats: { ...EMPTY_STATS, notesPlayed: 300, playDays: ["2026-10-18"] },
        unlocked: { "first-note": 20, "spot-on": 30 },
      },
      {
        stats: { ...EMPTY_STATS, notesPlayed: 120, playDays: ["2026-10-19"] },
        unlocked: { century: 50, "first-note": 10 },
      }
    );
    expect(merged.unlocked).toEqual({
      century: 50,
      "first-note": 10,
      "spot-on": 30,
    });
    expect(merged.stats.notesPlayed).toBe(300);
    expect(merged.stats.playDays).toEqual(["2026-10-18", "2026-10-19"]);
  });
});
