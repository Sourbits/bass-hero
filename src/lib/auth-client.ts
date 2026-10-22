import { usernameClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

/** Sign up, sign in, sign out and the current session, in the browser. */
export const authClient = createAuthClient({ plugins: [usernameClient()] });
