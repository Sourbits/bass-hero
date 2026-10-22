import type { Metadata } from "next";
import { PlayGame } from "@/components/game/play-game";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  description: "Play bass notes in time as they come down the highway.",
  title: "Practice | Bass Hero",
};

export default function PlayPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:py-10">
      <PageHeader title="Practice">Free play: any notes, any tempo.</PageHeader>
      <PlayGame />
    </main>
  );
}
