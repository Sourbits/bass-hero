import type { Metadata } from "next";
import { Calibration } from "@/components/game/calibration";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  description: "Measure the delay between your bass, mic and screen.",
  title: "Calibrate | Bass Hero",
};

export default function CalibratePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:py-10">
      <PageHeader title="Calibrate">
        Pluck any open string as each bar hits the line. It measures your
        setup&apos;s delay, so the game judges your timing fairly.
      </PageHeader>
      <Calibration />
    </main>
  );
}
