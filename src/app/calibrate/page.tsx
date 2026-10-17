import type { Metadata } from "next";
import { Calibration } from "@/components/game/calibration";
import { CALIBRATION } from "@/config/timing";

export const metadata: Metadata = {
  description: "Measure the delay between your bass, mic and screen.",
  title: "Calibrate | Bass Hero",
};

export default function CalibratePage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-semibold text-3xl">Calibrate</h1>
        <p className="text-muted-foreground">
          Pluck any open string each time a bar reaches the strike line: a
          count-in of {CALIBRATION.countInBeats}, then {CALIBRATION.beats} beats
          at {CALIBRATION.bpm} BPM. It measures how late your setup hears you
          and suggests an offset for the game.
        </p>
      </header>
      <Calibration />
    </main>
  );
}
