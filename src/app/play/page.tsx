import type { Metadata } from "next";
import Link from "next/link";
import { PlayGame } from "@/components/game/play-game";

export const metadata: Metadata = {
  description: "Play bass notes in time with circles sliding to a target.",
  title: "Play | Bass Hero",
};

export default function PlayPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <Link
          className="text-muted-foreground text-sm hover:text-foreground"
          href="/"
        >
          ← Bass Hero
        </Link>
        <h1 className="font-semibold text-3xl">Warm-up</h1>
        <p className="text-muted-foreground">
          16 notes on the open strings and the 3rd fret. Play each one as its
          circle reaches the outline.
        </p>
      </header>
      <PlayGame />
    </main>
  );
}
