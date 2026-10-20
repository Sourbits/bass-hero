"use client";

import { useCallback, useEffect, useState } from "react";
import { playNote } from "@/audio/play-note";
import { Fretboard } from "@/components/fretboard";
import { HeatMap } from "@/components/heat-map";
import { loadNoteStats, type NoteStats } from "@/game/note-stats";
import { type Position, positionMidi } from "@/game/positions";
import { onDataReplaced } from "@/game/storage-events";

const hear = (position: Position) => playNote(positionMidi(position));

/**
 * The full neck, up to the 12th fret. Tapping a note plays it. It can also
 * show your heat map: how well you know each note.
 */
export function LearnFretboard() {
  const [showHeat, setShowHeat] = useState(false);
  const [stats, setStats] = useState<NoteStats>({});

  // Stats live in the browser, so read them after hydration, and again
  // whenever they're replaced from the account.
  useEffect(() => {
    const load = () => setStats(loadNoteStats());
    load();
    return onDataReplaced(load);
  }, []);

  const toggle = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) =>
      setShowHeat(event.target.checked),
    []
  );

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-sm">
        <input
          checked={showHeat}
          className="accent-foreground"
          onChange={toggle}
          type="checkbox"
        />
        Show how well I know each note (my heat map)
      </label>
      {showHeat ? (
        <HeatMap onTap={hear} stats={stats} />
      ) : (
        <Fretboard frets={12} onTap={hear} tapMode="hear" />
      )}
    </div>
  );
}
