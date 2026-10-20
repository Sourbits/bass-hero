import { auth, ensureDatabase } from "@/server/auth";

/** Every Better Auth endpoint: sign up, sign in, sign out, session. */
async function handle(request: Request) {
  await ensureDatabase();
  return auth.handler(request);
}

export { handle as GET, handle as POST };
