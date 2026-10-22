"use client";

import { SettingsIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "@/components/account/account-provider";
import { useWaitingRequests } from "@/components/friends/friends-api";
import { Logo } from "@/components/logo";

const TABS = [
  { href: "/game", label: "Game" },
  { href: "/play", label: "Practice" },
  { href: "/notes", label: "Learn" },
  { href: "/achievements", label: "Achievements" },
  { href: "/friends", label: "Friends" },
  { href: "/tuner", label: "Tuner" },
  { href: "/calibrate", label: "Calibrate" },
] as const;

/** Gold "Sign in" for guests, quieter once signed in, hidden while unsure. */
function accountStyle(loading: boolean, signedIn: boolean) {
  if (loading) {
    return "invisible border";
  }
  return signedIn
    ? "border bg-secondary/60 transition-colors hover:bg-secondary"
    : "bg-primary text-primary-foreground transition-colors hover:bg-primary/85";
}

/**
 * The bar along the top of every page: the logo, the tabs, settings and
 * the account. On narrow screens the tabs get a scrolling row of their own.
 */
export function SiteNav() {
  const pathname = usePathname();
  const { loading, user } = useAccount();
  const waiting = useWaitingRequests(Boolean(user?.username), pathname);
  const onAccount = pathname === "/account";
  const onSettings = pathname === "/settings";
  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur-md">
      <nav
        aria-label="Main"
        className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-2 px-4"
      >
        <Link className="shrink-0 py-2.5" href="/game">
          <Logo />
        </Link>
        <div className="order-last -mx-4 flex w-[calc(100%+2rem)] gap-1 overflow-x-auto px-4 pb-2 [scrollbar-width:none] lg:order-none lg:mx-0 lg:w-auto lg:flex-1 lg:justify-center lg:px-0 lg:pb-0">
          {TABS.map(({ href, label }) => {
            const active = pathname === href;
            return (
              <Link
                aria-current={active ? "page" : undefined}
                className={`flex shrink-0 items-center rounded-full px-3 py-1.5 font-medium text-sm transition-colors ${
                  active
                    ? "bg-secondary text-foreground shadow-[inset_0_-2px_0_var(--gold)]"
                    : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
                }`}
                href={href}
                key={href}
              >
                {label}
                {href === "/friends" && waiting > 0 ? (
                  <span className="ms-1.5 rounded-full bg-neon px-1.5 py-px font-bold text-[0.65rem] text-white tabular-nums">
                    {waiting}
                    <span className="sr-only"> friend requests waiting</span>
                  </span>
                ) : null}
              </Link>
            );
          })}
        </div>
        <div className="ms-auto flex shrink-0 items-center gap-2 lg:ms-0">
          <Link
            aria-current={onSettings ? "page" : undefined}
            aria-label="Settings"
            className={`rounded-full p-2 transition-colors ${
              onSettings
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
            href="/settings"
            title="Settings"
          >
            <SettingsIcon aria-hidden className="size-4" />
          </Link>
          <Link
            aria-current={onAccount ? "page" : undefined}
            className={`rounded-full px-3.5 py-1.5 font-semibold text-sm ${accountStyle(loading, Boolean(user))} ${onAccount ? "ring-2 ring-gold/60" : ""}`}
            href="/account"
          >
            {user ? `@${user.username ?? user.name}` : "Sign in"}
          </Link>
        </div>
      </nav>
    </header>
  );
}
