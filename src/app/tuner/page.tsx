import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { Tuner } from "@/components/tuner";

export const metadata: Metadata = {
  description: "A bass tuner that tells you which way to turn each string.",
  title: "Tuner | Bass Hero",
};

export default function TunerPage() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-6 px-4 py-8 sm:py-10">
      <PageHeader title="Tuner">
        Play one open string at a time, and it tells you which way to turn the
        peg.
      </PageHeader>
      <Tuner />
    </main>
  );
}
