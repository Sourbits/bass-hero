import type { Metadata } from "next";
import Link from "next/link";
import { Calibration } from "@/components/game/calibration";
import { CALIBRATION } from "@/config/timing";

export const metadata: Metadata = {
  description: "Measure the delay between your bass, mic and screen.",
  title: "Calibrate | Bass Hero",
};

export default function CalibratePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <header className="flex flex-col gap-1">
        <Link
          className="text-muted-foreground text-sm hover:text-foreground"
          href="/"
        >
          ← Bass Hero
        </Link>
        <h1 className="font-semibold text-3xl">Calibrate</h1>
        <p className="text-muted-foreground">
          Pluck any open string each time a circle reaches the outline: a
          count-in of {CALIBRATION.countInBeats}, then {CALIBRATION.beats} beats
          at {CALIBRATION.bpm} BPM. It measures how late your setup hears you
          and suggests an offset for the game.
        </p>
      </header>
      <Calibration />
    </main>
  );
}
