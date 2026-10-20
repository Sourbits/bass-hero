import { MAX_SAVED_DATA_BYTES, parseSavedData } from "@/game/saved-data";
import { currentUser } from "@/server/auth";
import { getDatabase } from "@/server/db";
import { loadPlayerData, savePlayerData } from "@/server/player-data";

const signInFirst = () =>
  Response.json({ error: "Sign in first." }, { status: 401 });

/** The signed-in player's saved progress. */
export async function GET(request: Request) {
  const user = await currentUser(request);
  if (!user) {
    return signInFirst();
  }
  return Response.json(loadPlayerData(getDatabase(), user.id));
}

/**
 * Saves the signed-in player's progress. It's merged with what's already
 * saved, and the merged result is sent back.
 */
export async function PUT(request: Request) {
  const user = await currentUser(request);
  if (!user) {
    return signInFirst();
  }
  const body = await request.text();
  if (body.length > MAX_SAVED_DATA_BYTES) {
    return Response.json({ error: "Too much data." }, { status: 413 });
  }
  let incoming: ReturnType<typeof parseSavedData> = null;
  try {
    incoming = parseSavedData(JSON.parse(body));
  } catch {
    incoming = null;
  }
  if (!incoming) {
    return Response.json({ error: "That isn't saved data." }, { status: 400 });
  }
  return Response.json(savePlayerData(getDatabase(), user.id, incoming));
}
