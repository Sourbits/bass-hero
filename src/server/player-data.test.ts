import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import { recordRun } from "@/game/progress";
import { EMPTY_SAVED_DATA, type SavedData } from "@/game/saved-data";
import {
  createPlayerDataTable,
  loadPlayerData,
  savePlayerData,
} from "./player-data";

function freshDatabase() {
  const db = new Database(":memory:");
  createPlayerDataTable(db);
  return db;
}

const easy1 = { level: 1, tier: "easy" as const };

function withRun(hitRate: number, updatedAt: number): SavedData {
  return {
    ...EMPTY_SAVED_DATA,
    progress: recordRun(EMPTY_SAVED_DATA.progress, easy1, {
      hitRate,
      score: Math.round(hitRate * 1000),
    }),
    updatedAt,
  };
}

describe("player data", () => {
  test("a new player starts empty", () => {
    expect(loadPlayerData(freshDatabase(), "nobody")).toEqual(EMPTY_SAVED_DATA);
  });

  test("saves and loads a player's progress", () => {
    const db = freshDatabase();
    savePlayerData(db, "player-1", withRun(0.9, 10));

    expect(loadPlayerData(db, "player-1").progress.records).toMatchObject({
      "easy-1": { stars: 2 },
    });
  });

  test("merges instead of overwriting, so another device's bests survive", () => {
    const db = freshDatabase();
    savePlayerData(db, "player-1", withRun(0.97, 10));
    const merged = savePlayerData(db, "player-1", withRun(0.5, 20));

    expect(merged.progress.records).toMatchObject({
      "easy-1": { bestHitRate: 0.97 },
    });
    expect(loadPlayerData(db, "player-1").updatedAt).toBe(20);
  });

  test("keeps players apart", () => {
    const db = freshDatabase();
    savePlayerData(db, "player-1", withRun(0.9, 10));

    expect(loadPlayerData(db, "player-2")).toEqual(EMPTY_SAVED_DATA);
  });
});
