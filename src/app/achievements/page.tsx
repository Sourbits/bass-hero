import type { Metadata } from "next";
import { AchievementsList } from "@/components/achievements-list";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  description: "Every Bass Hero achievement, and how close you are to each.",
  title: "Achievements | Bass Hero",
};

export default function AchievementsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:py-10">
      <PageHeader title="Achievements">
        Goals to chase as you learn the neck. They unlock as you play, in any
        mode.
      </PageHeader>
      <AchievementsList />
    </main>
  );
}
