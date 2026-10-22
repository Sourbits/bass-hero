import { summarizePlayer } from "@/game/player-summary";
import { currentUser } from "@/server/auth";
import { getDatabase } from "@/server/db";
import {
  findPlayer,
  friendLists,
  type RequestResult,
  removeFriendship,
  requestFriend,
} from "@/server/friends";
import { loadPlayerData } from "@/server/player-data";

const signInFirst = () =>
  Response.json({ error: "Sign in first." }, { status: 401 });

/** The username sent in a request's body, or null if there isn't one. */
async function usernameFrom(request: Request) {
  try {
    const { username } = (await request.json()) as { username?: unknown };
    return typeof username === "string" && username.length <= 40
      ? username
      : null;
  } catch {
    return null;
  }
}

/**
 * The signed-in player's friends, each with their overall stats and
 * achievements, and the friend requests waiting on either side. With
 * ?only=requests, just how many requests are waiting for them. Nothing
 * else about anyone is sent: no emails or ids.
 */
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) {
    return signInFirst();
  }
  const db = getDatabase();
  const { friends, incoming, outgoing } = friendLists(db, user.id);
  // Just the number of requests waiting, for the badge on the Friends tab.
  if (new URL(request.url).searchParams.get("only") === "requests") {
    return Response.json({ incoming: incoming.length });
  }
  const now = new Date();
  return Response.json({
    friends: friends.map(({ id, since, username }) => ({
      since,
      summary: summarizePlayer(loadPlayerData(db, id), now),
      username,
    })),
    incoming: incoming.map(({ at, username }) => ({ at, username })),
    outgoing: outgoing.map(({ at, username }) => ({ at, username })),
  });
}

const ANSWERS: Record<RequestResult, { message: string; status: number }> = {
  accepted: { message: "You're now friends with {name}.", status: 200 },
  "already-friends": {
    message: "You're already friends with {name}.",
    status: 200,
  },
  "already-requested": {
    message: "Already asked. Waiting for {name} to accept.",
    status: 200,
  },
  "not-found": { message: "No player goes by that username.", status: 404 },
  requested: {
    message:
      "Friend request sent. Once {name} accepts, you'll see each other's stats.",
    status: 200,
  },
  self: { message: "That's you!", status: 400 },
};

/**
 * Sends a friend request to a username, or accepts theirs if they asked
 * first. Your own username has to be set, so they can see who's asking.
 */
export async function POST(request: Request) {
  const user = await currentUser(request);
  if (!user) {
    return signInFirst();
  }
  if (!user.username) {
    return Response.json(
      { error: "Pick a username first, on the Account page." },
      { status: 400 }
    );
  }
  const username = await usernameFrom(request);
  if (!username) {
    return Response.json({ error: "Type a username." }, { status: 400 });
  }
  const { person, result } = requestFriend(
    getDatabase(),
    user.id,
    username,
    Date.now()
  );
  const { message, status } = ANSWERS[result];
  const text = message.replace("{name}", person?.username ?? username);
  return status === 200
    ? Response.json({ message: text, result })
    : Response.json({ error: text }, { status });
}

/** Unfriends someone, declines their request, or cancels yours. */
export async function DELETE(request: Request) {
  const user = await currentUser(request);
  if (!user) {
    return signInFirst();
  }
  const username = await usernameFrom(request);
  const db = getDatabase();
  const person = username ? findPlayer(db, username) : null;
  if (!person) {
    return Response.json(
      { error: "No player goes by that username." },
      { status: 404 }
    );
  }
  return Response.json({ removed: removeFriendship(db, user.id, person.id) });
}
