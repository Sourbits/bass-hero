"use client";

import { memo, useCallback } from "react";
import { STRING_COLORS } from "@/components/string-colors";
import { type Position, positionKey, positionName } from "@/game/positions";
import { type BassString, STRINGS } from "@/instrument/bass";

/** Fret markers on most basses: single dots, and a double dot at 12. */
const MARKERS: Record<number, string> = {
  3: "•",
  5: "•",
  7: "•",
  9: "•",
  12: "••",
};

interface FretboardProps {
  /** Highest fret to show. */
  frets: number;
  /** Positions shown in color; the rest are faint. Leave out to color all. */
  highlighted?: Set<string>;
  /** Called when a note is tapped. Leave out for a fretboard you only read. */
  onTap?: (position: Position) => void;
  /** What tapping does, for screen readers: "toggle" marks notes as picked. */
  tapMode?: "hear" | "toggle";
}

function NoteCell({
  highlighted,
  onTap,
  position,
  tapMode,
}: {
  highlighted: boolean;
  onTap?: (position: Position) => void;
  position: Position;
  tapMode: "hear" | "toggle";
}) {
  const name = positionName(position);
  const letter = name.slice(0, 1);
  const rest = name.slice(1).replace("#", "♯");
  const where = position.fret === 0 ? "open" : `fret ${position.fret}`;
  const tap = useCallback(() => onTap?.(position), [onTap, position]);

  // Natural notes are solid; sharps are outlined, so the seven plain note
  // names stand out.
  const color = STRING_COLORS[position.string];
  const sharp = name.includes("#");
  let style: React.CSSProperties = { borderColor: "transparent" };
  if (highlighted) {
    style = sharp
      ? { borderColor: color, color }
      : { backgroundColor: color, borderColor: color, color: "#ffffff" };
  }
  const pill = (
    <span
      className={`inline-flex h-8 min-w-9 items-center justify-center rounded-full border-2 bg-background px-1.5 font-semibold text-sm tabular-nums ${
        highlighted ? "" : "text-muted-foreground"
      }`}
      style={style}
    >
      {letter}
      <span className="text-[0.7em]">{rest}</span>
    </span>
  );

  if (!onTap) {
    return pill;
  }
  return (
    <button
      aria-label={`${name}, ${position.string} string, ${where}`}
      aria-pressed={tapMode === "toggle" ? highlighted : undefined}
      className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onClick={tap}
      type="button"
    >
      {pill}
    </button>
  );
}

/**
 * A bass neck drawn the way tab is written: the G string on top, E at the
 * bottom, the nut on the left. Each note is colored by its string, matching
 * the lanes on the highway.
 */
function FretboardView({
  frets,
  highlighted,
  onTap,
  tapMode = "hear",
}: FretboardProps) {
  const columns = Array.from({ length: frets + 1 }, (_, fret) => fret);
  const rows: BassString[] = [...STRINGS].reverse();

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-center">
        <tbody>
          {rows.map((string) => (
            <tr key={string}>
              <th
                className="sticky left-0 z-10 bg-background pr-2 text-left font-medium text-sm sm:w-16"
                scope="row"
              >
                <span style={{ color: STRING_COLORS[string] }}>{string}</span>
                <span className="hidden text-muted-foreground text-xs sm:inline">
                  {" "}
                  string
                </span>
              </th>
              {columns.map((fret) => {
                const position = { fret, string };
                return (
                  <td
                    className={`relative min-w-11 py-1 ${fret === 0 ? "border-foreground border-r-4" : "border-border border-r"}`}
                    key={fret}
                  >
                    <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
                    <div className="relative">
                      <NoteCell
                        highlighted={
                          highlighted
                            ? highlighted.has(positionKey(position))
                            : true
                        }
                        onTap={onTap}
                        position={position}
                        tapMode={tapMode}
                      />
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
          <tr className="text-muted-foreground text-xs">
            <th
              className="sticky left-0 z-10 bg-background pr-2 text-left font-normal"
              scope="row"
            >
              Fret
            </th>
            {columns.map((fret) => (
              <td className="pt-1" key={fret}>
                <div>{fret === 0 ? "open" : String(fret)}</div>
                <div className="h-3 leading-3">{MARKERS[fret] ?? ""}</div>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/**
 * Only redraws when its notes change, not on every score update while a run
 * is playing.
 */
export const Fretboard = memo(FretboardView);
