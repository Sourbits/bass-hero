"use client";

import { Fretboard, heatColor } from "@/components/fretboard";
import type { NoteStats } from "@/game/note-stats";
import type { Position } from "@/game/positions";

const LEGEND = [
  { label: "Often missed", mastery: 0.1 },
  { label: "Getting there", mastery: 0.55 },
  { label: "Solid", mastery: 0.95 },
];

/**
 * Your fretboard: every note colored by how well you've been playing it, in
 * every game mode. Tap a note to hear it.
 */
export function HeatMap({
  frets = 12,
  onTap,
  stats,
}: {
  frets?: number;
  onTap?: (position: Position) => void;
  stats: NoteStats;
}) {
  return (
    <div className="flex flex-col gap-2">
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
        {LEGEND.map(({ label, mastery }) => (
          <li className="flex items-center gap-1.5" key={label}>
            <span
              className="inline-block size-3 rounded-full"
              style={{ backgroundColor: heatColor(mastery) }}
            />
            {label}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span className="inline-block size-3 rounded-full border border-dashed" />
          Not played yet
        </li>
      </ul>
      <Fretboard frets={frets} heat={stats} onTap={onTap} tapMode="hear" />
    </div>
  );
}
