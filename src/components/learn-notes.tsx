"use client";

import { playNote } from "@/audio/play-note";
import { Fretboard } from "@/components/fretboard";
import { type Position, positionMidi } from "@/game/positions";

const hear = (position: Position) => playNote(positionMidi(position));

/** The full neck, up to the 12th fret. Tapping a note plays it. */
export function LearnFretboard() {
  return <Fretboard frets={12} onTap={hear} tapMode="hear" />;
}
