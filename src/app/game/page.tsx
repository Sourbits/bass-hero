import type { Metadata } from "next";
import { GameHub } from "@/components/game/game-hub";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  description:
    "Learn where every note is on the bass, and how it sounds, level by level.",
  title: "Game | Bass Hero",
};

export default function GamePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:py-10">
      <PageHeader title="Game">
        Learn every note on the neck, by feel and by ear.
      </PageHeader>
      <GameHub />
    </main>
  );
}
