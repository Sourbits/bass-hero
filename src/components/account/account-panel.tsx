"use client";

import Link from "next/link";
import { type FormEvent, useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { USERNAME } from "@/config/username";
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

/** Picks or changes the username friends find you by. */
export function UsernameForm({
  current,
  onDone,
}: {
  current: string | null;
  onDone?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const value = String(
        new FormData(event.currentTarget).get("username") ?? ""
      ).trim();
      setBusy(true);
      setError(null);
      const result = await authClient.updateUser({
        displayUsername: value,
        username: value,
      });
      setBusy(false);
      if (result.error) {
        setError(result.error.message ?? "That didn't work. Try again.");
        return;
      }
      onDone?.();
    },
    [onDone]
  );

  return (
    <form className="flex flex-col gap-2" onSubmit={submit}>
      <Label htmlFor="account-username">Username</Label>
      <div className="flex gap-2">
        <UsernameInput defaultValue={current ?? ""} id="account-username" />
        <Button disabled={busy} type="submit">
          Save
        </Button>
      </div>
      {error ? (
        <p className="text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}

function UsernameInput({
  defaultValue,
  id,
}: {
  defaultValue?: string;
  id: string;
}) {
  return (
    <Input
      autoCapitalize="none"
      autoComplete="username"
      defaultValue={defaultValue}
      id={id}
      maxLength={USERNAME.maxLength}
      minLength={USERNAME.minLength}
      name="username"
      pattern={USERNAME.pattern}
      required
      spellCheck={false}
      title={`${USERNAME.minLength} to ${USERNAME.maxLength} letters, numbers, _ or .`}
    />
  );
}

function UsernameSection({ username }: { username: string | null }) {
  const [editing, setEditing] = useState(false);
  const edit = useCallback(() => setEditing(true), []);
  const done = useCallback(() => setEditing(false), []);

  if (!username) {
    return (
      <div className="flex flex-col gap-3 rounded-lg bg-muted p-4">
        <p className="text-sm">
          Pick a username so friends can find you. {USERNAME.minLength} to{" "}
          {USERNAME.maxLength} letters, numbers, _ or .
        </p>
        <UsernameForm current={null} />
      </div>
    );
  }
  if (editing) {
    return <UsernameForm current={username} onDone={done} />;
  }
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-sm">
      <span>
        Username: <span className="font-semibold">@{username}</span>. Friends
        add you with it.
      </span>
      <button
        className="text-muted-foreground underline underline-offset-4"
        onClick={edit}
        type="button"
      >
        Change
      </button>
    </p>
  );
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
    <section className="flex flex-col gap-4 rounded-3xl border bg-card p-5">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold text-xl">
          Hi, {user?.username ?? user?.name}
        </h2>
        <p className="text-muted-foreground text-sm">
          Signed in as {user?.email}.
        </p>
      </div>
      <UsernameSection username={user?.username ?? null} />
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
      const login = String(form.get("login") ?? "").trim();
      const email = String(form.get("email") ?? "").trim();
      const password = String(form.get("password") ?? "");
      const username = String(form.get("username") ?? "").trim();
      setBusy(true);
      setError(null);
      let result: { error: { message?: string } | null };
      if (signingUp) {
        result = await authClient.signUp.email({
          email,
          name: username,
          password,
          username,
        });
      } else if (login.includes("@")) {
        result = await authClient.signIn.email({ email: login, password });
      } else {
        result = await authClient.signIn.username({
          password,
          username: login,
        });
      }
      setBusy(false);
      if (result.error) {
        setError(result.error.message ?? "That didn't work. Try again.");
      }
    },
    [signingUp]
  );

  return (
    <section className="flex flex-col gap-5 rounded-3xl border bg-card p-5">
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
          <>
            <div className="flex flex-col gap-2">
              <Label htmlFor="account-username">Username</Label>
              <UsernameInput id="account-username" />
              <p className="text-muted-foreground text-xs">
                What friends find you by. {USERNAME.minLength} to{" "}
                {USERNAME.maxLength} letters, numbers, _ or .
              </p>
            </div>
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
          </>
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="account-login">Email or username</Label>
            <Input
              autoCapitalize="none"
              autoComplete="username"
              id="account-login"
              name="login"
              required
              spellCheck={false}
            />
          </div>
        )}
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
