import type { Metadata } from "next";
import { AchievementsList } from "@/components/achievements-list";

export const metadata: Metadata = {
  description: "Every Bass Hero achievement, and how close you are to each.",
  title: "Achievements | Bass Hero",
};

export default function AchievementsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-semibold text-3xl">Achievements</h1>
        <p className="text-muted-foreground">
          Goals to aim for as you learn the neck. They unlock as you play, in
          any mode.
        </p>
      </header>
      <AchievementsList />
    </main>
  );
}
