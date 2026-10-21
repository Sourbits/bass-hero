import type { Metadata } from "next";
import { SettingsPanel } from "@/components/settings-panel";

export const metadata: Metadata = {
  description: "Left-handed mode, game options and keyboard shortcuts.",
  title: "Settings | Bass Hero",
};

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-semibold text-3xl">Settings</h1>
        <p className="text-muted-foreground">
          Saved as you change them, and to your account when you&apos;re signed
          in.
        </p>
      </header>
      <SettingsPanel />
    </main>
  );
}
