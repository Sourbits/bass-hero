import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { SettingsPanel } from "@/components/settings-panel";

export const metadata: Metadata = {
  description: "Left-handed mode, game options and keyboard shortcuts.",
  title: "Settings | Bass Hero",
};

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8 sm:py-10">
      <PageHeader title="Settings">
        Saved as you go, and to your account when you&apos;re signed in.
      </PageHeader>
      <SettingsPanel />
    </main>
  );
}
