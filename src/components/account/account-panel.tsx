"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { type SyncStatus, useAccount } from "./account-provider";

type Mode = "sign-in" | "sign-up";

const MIN_PASSWORD = 8;

function statusText(status: SyncStatus) {
  switch (status.kind) {
    case "saving":
      return "Saving…";
    case "saved":
      return `All progress saved, at ${status.at.toLocaleTimeString()}.`;
    case "error":
      return `Couldn't save: ${status.message}`;
    default:
      return "Your progress saves on its own as you play.";
  }
}

function SignedIn() {
  const { signOut, status, syncNow, user } = useAccount();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  const leave = useCallback(
    async (anyway: boolean) => {
      setBusy(true);
      const done = await signOut(anyway);
      setBusy(false);
      setFailed(!done);
    },
    [signOut]
  );
  const onSignOut = useCallback(() => leave(false), [leave]);
  const onSignOutAnyway = useCallback(() => leave(true), [leave]);
  const onSave = useCallback(() => syncNow(), [syncNow]);

  return (
    <section className="flex flex-col gap-4 rounded-xl border p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold text-xl">Hi, {user?.name}</h2>
        <p className="text-muted-foreground text-sm">
          Signed in as {user?.email}.
        </p>
      </div>
      <p
        aria-live="polite"
        className={
          status.kind === "error" ? "text-destructive text-sm" : "text-sm"
        }
      >
        {statusText(status)}
      </p>
      <p className="text-muted-foreground text-sm">
        Saved to your account: level stars and bests, where you are in each
        tier, the heat map and Practice settings. Latency calibration stays with
        each device, since it depends on its mic and speakers.
      </p>
      {failed ? (
        <p className="text-destructive text-sm">
          Your latest progress isn&apos;t saved yet. Signing out now would lose
          it from this browser.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button nativeButton={false} render={<Link href="/game" />}>
          Play
        </Button>
        <Button
          disabled={busy || status.kind === "saving"}
          onClick={onSave}
          variant="outline"
        >
          Save now
        </Button>
        {failed ? (
          <Button disabled={busy} onClick={onSignOutAnyway} variant="outline">
            Sign out anyway
          </Button>
        ) : (
          <Button disabled={busy} onClick={onSignOut} variant="outline">
            Sign out
          </Button>
        )}
      </div>
    </section>
  );
}

function SignInForm() {
  const [mode, setMode] = useState<Mode>("sign-in");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const signingUp = mode === "sign-up";

  const showSignIn = useCallback(() => {
    setMode("sign-in");
    setError(null);
  }, []);
  const showSignUp = useCallback(() => {
    setMode("sign-up");
    setError(null);
  }, []);

  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = new FormData(event.currentTarget);
      const email = String(form.get("email") ?? "").trim();
      const password = String(form.get("password") ?? "");
      const name = String(form.get("name") ?? "").trim();
      setBusy(true);
      setError(null);
      const result = signingUp
        ? await authClient.signUp.email({ email, name, password })
        : await authClient.signIn.email({ email, password });
      setBusy(false);
      if (result.error) {
        setError(result.error.message ?? "That didn't work. Try again.");
      }
    },
    [signingUp]
  );

  return (
    <section className="flex flex-col gap-5 rounded-xl border p-5">
      <div className="flex gap-1 rounded-lg bg-muted p-1" role="tablist">
        <button
          aria-selected={!signingUp}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm ${
            signingUp ? "text-muted-foreground" : "bg-background font-medium"
          }`}
          onClick={showSignIn}
          role="tab"
          type="button"
        >
          Sign in
        </button>
        <button
          aria-selected={signingUp}
          className={`flex-1 rounded-md px-3 py-1.5 text-sm ${
            signingUp ? "bg-background font-medium" : "text-muted-foreground"
          }`}
          onClick={showSignUp}
          role="tab"
          type="button"
        >
          Create account
        </button>
      </div>
      <form className="flex flex-col gap-4" onSubmit={submit}>
        {signingUp ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="account-name">Name</Label>
            <Input
              autoComplete="nickname"
              id="account-name"
              name="name"
              required
            />
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          <Label htmlFor="account-email">Email</Label>
          <Input
            autoComplete="email"
            id="account-email"
            name="email"
            required
            type="email"
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="account-password">Password</Label>
          <Input
            autoComplete={signingUp ? "new-password" : "current-password"}
            id="account-password"
            minLength={MIN_PASSWORD}
            name="password"
            required
            type="password"
          />
          {signingUp ? (
            <p className="text-muted-foreground text-xs">
              At least {MIN_PASSWORD} characters.
            </p>
          ) : null}
        </div>
        {error ? (
          <p className="text-destructive text-sm" role="alert">
            {error}
          </p>
        ) : null}
        <Button disabled={busy} type="submit">
          {signingUp ? "Create account" : "Sign in"}
        </Button>
      </form>
      <p className="text-muted-foreground text-sm">
        Progress you made here as a guest is added to your account when you sign
        in, keeping the best of both.
      </p>
    </section>
  );
}

/** Sign in or create an account, or see the signed-in account. */
export function AccountPanel() {
  const { loading, user } = useAccount();
  if (loading) {
    return <p className="text-muted-foreground">Checking…</p>;
  }
  return user ? <SignedIn /> : <SignInForm />;
}
