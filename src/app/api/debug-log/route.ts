import { appendFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

/** Where logs are saved, one file per day. Never committed. */
const LOG_DIR = process.env.BASS_HERO_DEBUG_DIR ?? "data/debug-logs";
const MAX_BYTES = 512 * 1024;

function today() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

/**
 * Saves debug log events, one JSON object per line, for reading while
 * testing. Only on the dev server: a built site turns it away.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return Response.json({ error: "Not here." }, { status: 404 });
  }
  const body = await request.text();
  if (body.length > MAX_BYTES) {
    return Response.json({ error: "Too much at once." }, { status: 413 });
  }
  let events: unknown[] = [];
  try {
    const parsed = JSON.parse(body) as { events?: unknown };
    events = Array.isArray(parsed.events) ? parsed.events : [];
  } catch {
    return Response.json({ error: "That isn't JSON." }, { status: 400 });
  }
  const lines = events
    .filter((event) => event && typeof event === "object")
    .map((event) => JSON.stringify(event));
  if (lines.length > 0) {
    await mkdir(LOG_DIR, { recursive: true });
    await appendFile(
      join(LOG_DIR, `${today()}.jsonl`),
      `${lines.join("\n")}\n`
    );
  }
  return Response.json({ saved: lines.length });
}
