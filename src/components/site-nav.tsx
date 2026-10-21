"use client";

import { SettingsIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAccount } from "@/components/account/account-provider";

const TABS = [
  { href: "/game", label: "Game" },
  { href: "/play", label: "Practice" },
  { href: "/notes", label: "Learn" },
  { href: "/achievements", label: "Achievements" },
  { href: "/tuner", label: "Tuner" },
  { href: "/calibrate", label: "Calibrate" },
] as const;

/** The tabs along the top of every page. */
export function SiteNav() {
  const pathname = usePathname();
  const { loading, user } = useAccount();
  const onAccount = pathname === "/account";
  const onSettings = pathname === "/settings";
  return (
    <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
      <nav
        aria-label="Main"
        className="mx-auto flex w-full max-w-3xl items-center gap-1 overflow-x-auto px-4"
      >
        <Link className="mr-2 shrink-0 py-3 font-bold" href="/game">
          Bass Hero
        </Link>
        {TABS.map(({ href, label }) => {
          const active = pathname === href;
          return (
            <Link
              aria-current={active ? "page" : undefined}
              className={`shrink-0 border-b-2 px-2.5 py-3 text-sm transition-colors ${
                active
                  ? "border-foreground font-semibold"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
              href={href}
              key={href}
            >
              {label}
            </Link>
          );
        })}
        <Link
          aria-current={onSettings ? "page" : undefined}
          aria-label="Settings"
          className={`ml-auto shrink-0 rounded-full p-1.5 transition-colors ${
            onSettings
              ? "bg-foreground text-background"
              : "text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
          href="/settings"
          title="Settings"
        >
          <SettingsIcon aria-hidden className="size-4" />
        </Link>
        <Link
          aria-current={onAccount ? "page" : undefined}
          className={`shrink-0 rounded-full border px-3 py-1 text-sm transition-colors ${
            onAccount ? "bg-foreground text-background" : "hover:bg-muted"
          } ${loading ? "invisible" : ""}`}
          href="/account"
        >
          {user ? user.name : "Sign in"}
        </Link>
      </nav>
    </header>
  );
}
