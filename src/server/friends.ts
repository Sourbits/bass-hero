import type { Sqlite } from "./player-data";

/** Another player, as friends see them. */
export interface Person {
  id: string;
  /** As they typed it, such as "BassAlex". */
  username: string;
}

export interface FriendLists {
  friends: (Person & { since: number })[];
  /** Requests sent to you, waiting for your answer. */
  incoming: (Person & { at: number })[];
  /** Requests you sent, waiting for theirs. */
  outgoing: (Person & { at: number })[];
}

export type RequestResult =
  | "accepted"
  | "already-friends"
  | "already-requested"
  | "not-found"
  | "requested"
  | "self";

/**
 * Friendships: one row per pair. It starts "pending", from the player who
 * asked; the other one accepting makes it "accepted", for both.
 */
export function createFriendshipTable(db: Sqlite) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS friendship (
      requester_id TEXT NOT NULL,
      addressee_id TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (requester_id, addressee_id)
    )
  `);
}

const LEADING_AT = /^@/;

/** Usernames match ignoring case, and with or without a leading @. */
function normalize(username: string) {
  return username.trim().replace(LEADING_AT, "").toLowerCase();
}

/** The player with this username, or null. */
export function findPlayer(db: Sqlite, username: string): Person | null {
  const row = db
    .prepare(
      `SELECT id, coalesce(displayUsername, username) AS username
       FROM "user" WHERE username = ?`
    )
    .get(normalize(username)) as Person | undefined;
  return row ?? null;
}

interface FriendshipRow {
  addressee_id: string;
  requester_id: string;
  status: "accepted" | "pending";
}

function friendshipBetween(db: Sqlite, a: string, b: string) {
  return db
    .prepare(
      `SELECT requester_id, addressee_id, status FROM friendship
       WHERE (requester_id = ? AND addressee_id = ?)
          OR (requester_id = ? AND addressee_id = ?)`
    )
    .get(a, b, b, a) as FriendshipRow | undefined;
}

/**
 * Asks another player, by username, to be friends. If they had already
 * asked you, this accepts instead.
 */
export function requestFriend(
  db: Sqlite,
  fromId: string,
  toUsername: string,
  now: number
): { person: Person | null; result: RequestResult } {
  const person = findPlayer(db, toUsername);
  if (!person) {
    return { person, result: "not-found" };
  }
  if (person.id === fromId) {
    return { person, result: "self" };
  }
  const existing = friendshipBetween(db, fromId, person.id);
  if (existing?.status === "accepted") {
    return { person, result: "already-friends" };
  }
  if (existing?.requester_id === fromId) {
    return { person, result: "already-requested" };
  }
  if (existing) {
    db.prepare(
      `UPDATE friendship SET status = 'accepted', updated_at = ?
       WHERE requester_id = ? AND addressee_id = ?`
    ).run(now, person.id, fromId);
    return { person, result: "accepted" };
  }
  db.prepare(
    `INSERT INTO friendship
       (requester_id, addressee_id, status, created_at, updated_at)
     VALUES (?, ?, 'pending', ?, ?)`
  ).run(fromId, person.id, now, now);
  return { person, result: "requested" };
}

/**
 * Ends whatever is between two players: unfriends, declines their request,
 * or cancels yours. Returns whether there was anything.
 */
export function removeFriendship(db: Sqlite, userId: string, otherId: string) {
  const existing = friendshipBetween(db, userId, otherId);
  if (!existing) {
    return false;
  }
  db.prepare(
    "DELETE FROM friendship WHERE requester_id = ? AND addressee_id = ?"
  ).run(existing.requester_id, existing.addressee_id);
  return true;
}

/** A player's friends and open requests, in alphabetical order. */
export function friendLists(db: Sqlite, userId: string): FriendLists {
  const rows = db
    .prepare(
      `SELECT f.requester_id, f.status, f.created_at, f.updated_at, u.id,
              coalesce(u.displayUsername, u.username, u.name) AS username
       FROM friendship f
       JOIN "user" u ON u.id = CASE WHEN f.requester_id = ?
                                    THEN f.addressee_id ELSE f.requester_id END
       WHERE f.requester_id = ? OR f.addressee_id = ?
       ORDER BY lower(username)`
    )
    .all(userId, userId, userId) as (FriendshipRow & {
    created_at: number;
    id: string;
    updated_at: number;
    username: string;
  })[];

  const lists: FriendLists = { friends: [], incoming: [], outgoing: [] };
  for (const row of rows) {
    const person = { id: row.id, username: row.username };
    if (row.status === "accepted") {
      lists.friends.push({ ...person, since: Number(row.updated_at) });
    } else if (row.requester_id === userId) {
      lists.outgoing.push({ ...person, at: Number(row.created_at) });
    } else {
      lists.incoming.push({ ...person, at: Number(row.created_at) });
    }
  }
  return lists;
}
