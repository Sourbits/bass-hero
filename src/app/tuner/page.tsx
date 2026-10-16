import type { Metadata } from "next";
import Link from "next/link";
import { Tuner } from "@/components/tuner";

export const metadata: Metadata = {
  description: "A chromatic tuner for bass that listens through your mic.",
  title: "Tuner | Bass Hero",
};

export default function TunerPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <Link
          className="text-muted-foreground text-sm hover:text-foreground"
          href="/"
        >
          ← Bass Hero
        </Link>
        <h1 className="font-semibold text-3xl">Tuner</h1>
        <p className="text-muted-foreground">
          Play one note at a time. It hears down to a 5-string's low B.
        </p>
      </header>
      <Tuner />
    </main>
  );
}
