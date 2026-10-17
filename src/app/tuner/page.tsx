import type { Metadata } from "next";
import { Tuner } from "@/components/tuner";

export const metadata: Metadata = {
  description: "A bass tuner that tells you which way to turn each string.",
  title: "Tuner | Bass Hero",
};

export default function TunerPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-semibold text-3xl">Tuner</h1>
        <p className="text-muted-foreground">
          Play one open string at a time. It finds which string you're on, or
          pick it yourself, then tells you whether to tune up or down.
        </p>
      </header>
      <Tuner />
    </main>
  );
}
