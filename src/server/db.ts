import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

/** Where the database file lives. Set BASS_HERO_DB_PATH to move it. */
const DB_PATH = process.env.BASS_HERO_DB_PATH ?? "data/bass-hero.db";

const cache = globalThis as { bassHeroDatabase?: DatabaseSync };

/**
 * The app's SQLite database: accounts, sign-in sessions and saved progress.
 * Uses Node's built-in SQLite, so there's nothing to install or compile.
 * Opened once and shared, even across hot reloads in development.
 */
export function getDatabase(): DatabaseSync {
  if (!cache.bassHeroDatabase) {
    mkdirSync(dirname(DB_PATH), { recursive: true });
    const db = new DatabaseSync(DB_PATH);
    db.exec("PRAGMA journal_mode = WAL");
    cache.bassHeroDatabase = db;
  }
  return cache.bassHeroDatabase;
}
