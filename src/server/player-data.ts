import {
  EMPTY_SAVED_DATA,
  mergeSavedData,
  parseSavedData,
  type SavedData,
} from "@/game/saved-data";

/**
 * The parts of a SQLite database this module uses. Node's built-in SQLite
 * on the server and Bun's in tests both fit it.
 */
export interface Sqlite {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    get: (...params: string[]) => unknown;
    run: (...params: string[]) => unknown;
  };
}

/** Creates the table for saved progress, if it isn't there yet. */
export function createPlayerDataTable(db: Sqlite) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS player_data (
      user_id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
}

/** A player's saved progress, or empty progress if they have none yet. */
export function loadPlayerData(db: Sqlite, userId: string): SavedData {
  const row = db
    .prepare("SELECT data FROM player_data WHERE user_id = ?")
    .get(userId) as { data: string } | undefined;
  if (!row) {
    return EMPTY_SAVED_DATA;
  }
  try {
    return parseSavedData(JSON.parse(row.data)) ?? EMPTY_SAVED_DATA;
  } catch {
    return EMPTY_SAVED_DATA;
  }
}

/**
 * Merges incoming progress into what's saved, so nothing from another device
 * is lost, then saves and returns the result.
 */
export function savePlayerData(
  db: Sqlite,
  userId: string,
  incoming: SavedData
): SavedData {
  const merged = mergeSavedData(loadPlayerData(db, userId), incoming);
  db.prepare(
    `INSERT INTO player_data (user_id, data, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
  ).run(userId, JSON.stringify(merged), String(merged.updatedAt));
  return merged;
}
