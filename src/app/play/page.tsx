import type { Metadata } from "next";
import Link from "next/link";
import { PlayGame } from "@/components/game/play-game";

export const metadata: Metadata = {
  description: "Play bass notes in time as they come down the highway.",
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
        <h1 className="font-semibold text-3xl">Play</h1>
        <p className="text-muted-foreground">
          Notes come toward you, one lane per string: E, A, D, G from left to
          right. Play each one as it reaches the ring at the bottom.
        </p>
      </header>
      <PlayGame />
    </main>
  );
}
