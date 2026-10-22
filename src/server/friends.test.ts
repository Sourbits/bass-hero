import { Database } from "bun:sqlite";
import { describe, expect, test } from "bun:test";
import {
  createFriendshipTable,
  findPlayer,
  friendLists,
  removeFriendship,
  requestFriend,
} from "./friends";

/** A database with three players, shaped like Better Auth's user table. */
function players() {
  const db = new Database(":memory:");
  db.exec(`CREATE TABLE "user" (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, username TEXT UNIQUE,
    displayUsername TEXT)`);
  const add = db.prepare(
    `INSERT INTO "user" (id, name, username, displayUsername) VALUES (?, ?, ?, ?)`
  );
  add.run("a", "Alex", "bassalex", "BassAlex");
  add.run("b", "Sam", "sam.low", "sam.low");
  add.run("c", "Kim", "kim_e", "Kim_E");
  createFriendshipTable(db);
  return db;
}

const names = (people: { username: string }[]) =>
  people.map(({ username }) => username);

describe("friends", () => {
  test("finds players by username, ignoring case and a leading @", () => {
    const db = players();
    expect(findPlayer(db, "@BASSALEX")).toEqual({
      id: "a",
      username: "BassAlex",
    });
    expect(findPlayer(db, "nobody")).toBeNull();
  });

  test("a request waits until the other player accepts", () => {
    const db = players();
    expect(requestFriend(db, "a", "sam.low", 1).result).toBe("requested");
    expect(names(friendLists(db, "a").outgoing)).toEqual(["sam.low"]);
    expect(names(friendLists(db, "b").incoming)).toEqual(["BassAlex"]);
    expect(friendLists(db, "a").friends).toEqual([]);

    expect(requestFriend(db, "b", "BassAlex", 2).result).toBe("accepted");
    expect(friendLists(db, "a")).toEqual({
      friends: [{ id: "b", since: 2, username: "sam.low" }],
      incoming: [],
      outgoing: [],
    });
    expect(names(friendLists(db, "b").friends)).toEqual(["BassAlex"]);
  });

  test("says why a request can't be sent", () => {
    const db = players();
    expect(requestFriend(db, "a", "ghost", 1).result).toBe("not-found");
    expect(requestFriend(db, "a", "bassalex", 1).result).toBe("self");
    requestFriend(db, "a", "kim_e", 1);
    expect(requestFriend(db, "a", "kim_e", 2).result).toBe("already-requested");
    requestFriend(db, "c", "bassalex", 3);
    expect(requestFriend(db, "a", "kim_e", 4).result).toBe("already-friends");
  });

  test("removing ends a friendship, a request, or an invite", () => {
    const db = players();
    requestFriend(db, "a", "sam.low", 1);
    requestFriend(db, "b", "bassalex", 2);
    requestFriend(db, "c", "bassalex", 3);

    expect(removeFriendship(db, "b", "a")).toBe(true);
    expect(removeFriendship(db, "a", "c")).toBe(true);
    expect(removeFriendship(db, "a", "c")).toBe(false);
    expect(friendLists(db, "a")).toEqual({
      friends: [],
      incoming: [],
      outgoing: [],
    });
  });

  test("lists friends alphabetically", () => {
    const db = players();
    requestFriend(db, "a", "sam.low", 1);
    requestFriend(db, "a", "kim_e", 1);
    requestFriend(db, "b", "bassalex", 2);
    requestFriend(db, "c", "bassalex", 2);
    expect(names(friendLists(db, "a").friends)).toEqual(["Kim_E", "sam.low"]);
  });
});
