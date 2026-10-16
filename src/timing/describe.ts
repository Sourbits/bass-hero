import { midiToName } from "@/pitch/notes";
import type { Judgment } from "./judge";

const RATING_LABELS = {
  good: "Good",
  miss: "Miss",
  perfect: "Perfect",
} as const;

/** "Early −35 ms", "Late +80 ms" or "On time", rounded to the nearest ms. */
export function describeOffset(offsetMs: number) {
  const rounded = Math.round(offsetMs);
  if (rounded === 0) {
    return "On time";
  }
  return rounded < 0 ? `Early −${-rounded} ms` : `Late +${rounded} ms`;
}

/** The feedback text for a judgment: a label, plus a line of detail. */
export function describeJudgment({
  offsetMs,
  playedMidi,
  rating,
  reason,
}: Judgment) {
  let detail = "";
  if (reason === "wrong-note" && playedMidi !== null) {
    detail = `Wrong note: ${midiToName(playedMidi)}`;
  } else if (reason === "not-played" || offsetMs === null) {
    detail = "Not played";
  } else {
    detail = describeOffset(offsetMs);
  }
  return { detail, label: RATING_LABELS[rating] };
}
