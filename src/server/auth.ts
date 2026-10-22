import { type BetterAuthOptions, betterAuth } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { nextCookies } from "better-auth/next-js";
import { username } from "better-auth/plugins";
import { USERNAME } from "@/config/username";
import { getDatabase } from "./db";
import { createFriendshipTable } from "./friends";
import { createPlayerDataTable } from "./player-data";

/**
 * Accounts, with Better Auth: email and password sign-up, hashed passwords,
 * cookie sessions, and usernames for finding friends (letters, numbers, _
 * and ., unique ignoring case). Reads BETTER_AUTH_SECRET and BETTER_AUTH_URL from the
 * environment (see .env.example).
 */
const options = {
  database: getDatabase(),
  emailAndPassword: {
    enabled: true,
    maxPasswordLength: 128,
    minPasswordLength: 8,
  },
  plugins: [
    username({
      maxUsernameLength: USERNAME.maxLength,
      minUsernameLength: USERNAME.minLength,
    }),
    nextCookies(),
  ],
} satisfies BetterAuthOptions;

export const auth = betterAuth(options);

let ready: Promise<void> | null = null;

/**
 * Creates any missing tables, once per server start: Better Auth's own, and
 * the ones for saved progress and friends.
 */
export function ensureDatabase() {
  ready ??= (async () => {
    const { runMigrations } = await getMigrations(options);
    await runMigrations();
    createPlayerDataTable(getDatabase());
    createFriendshipTable(getDatabase());
  })();
  return ready;
}

/** The signed-in user for a request, or null. */
export async function currentUser(request: Request) {
  await ensureDatabase();
  const session = await auth.api.getSession({ headers: request.headers });
  return session?.user ?? null;
}
