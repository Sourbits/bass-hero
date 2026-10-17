import type { Metadata } from "next";
import { LevelGame } from "@/components/game/level-game";

export const metadata: Metadata = {
  description:
    "Learn where every note is on the bass, and how it sounds, level by level.",
  title: "Game | Bass Hero",
};

export default function GamePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-semibold text-3xl">Game</h1>
        <p className="text-muted-foreground">
          Learn every note on the neck. Each tier adds strings and frets; each
          level 1–10 jumps around more. Play each note as it reaches the ring in
          its lane, and keep it clean.
        </p>
      </header>
      <LevelGame />
    </main>
  );
}
