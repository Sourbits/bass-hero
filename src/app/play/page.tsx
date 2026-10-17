import type { Metadata } from "next";
import { PlayGame } from "@/components/game/play-game";

export const metadata: Metadata = {
  description: "Play bass notes in time as they come down the highway.",
  title: "Practice | Bass Hero",
};

export default function PlayPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-semibold text-3xl">Practice</h1>
        <p className="text-muted-foreground">
          Free play: pick any set of notes and a tempo. Notes come toward you,
          one lane per string: E, A, D, G from left to right.
        </p>
      </header>
      <PlayGame />
    </main>
  );
}
