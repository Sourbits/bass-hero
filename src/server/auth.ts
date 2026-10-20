import { type BetterAuthOptions, betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { nextCookies } from "better-auth/next-js";
import { getDatabase } from "./db";
import { createPlayerDataTable } from "./player-data";

/**
 * Accounts, with Better Auth: email and password sign-up, hashed passwords,
 * and cookie sessions. Reads BETTER_AUTH_SECRET and BETTER_AUTH_URL from the
 * environment (see .env.example).
 */
const options = {
  database: getDatabase(),
  emailAndPassword: {
    enabled: true,
    maxPasswordLength: 128,
    minPasswordLength: 8,
  },
  plugins: [nextCookies()],
} satisfies BetterAuthOptions;

export const auth = betterAuth(options);

let ready: Promise<void> | null = null;

/**
 * Creates any missing tables, once per server start: Better Auth's own, and
 * the one for saved progress.
 */
export function ensureDatabase() {
  ready ??= (async () => {
    const { runMigrations } = await getMigrations(options);
    await runMigrations();
    createPlayerDataTable(getDatabase());
  })();
  return ready;
}

/** The signed-in user for a request, or null. */
export async function currentUser(request: Request) {
  await ensureDatabase();
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user ?? null;
}
