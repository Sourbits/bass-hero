import { type HighwayGem, splitNoteName } from "@/components/game/draw-highway";
import type { HighwayFeedback } from "@/components/game/note-highway";
import { STRING_COLORS } from "@/components/string-colors";
import type { ScheduledNote } from "@/game/chart";
import type { ScoreSummary } from "@/game/score";
import { describeJudgment } from "@/timing/describe";
import type { Judgment } from "@/timing/judge";

/** Highway notes for a run, styled by how each was judged. */
export function toGems(
  notes: ScheduledNote[],
  judgments: (Judgment | undefined)[],
  { fretHints = false }: { fretHints?: boolean } = {}
): HighwayGem[] {
  return notes.map((note, index) => {
    const judgment = judgments[index];
    let state: HighwayGem["state"] = "upcoming";
    if (judgment) {
      state = judgment.rating === "miss" ? "missed" : "hit";
    }
    let hint: string | undefined;
    if (fretHints) {
      hint = note.fret === 0 ? "open" : `fret ${note.fret}`;
    }
    return {
      color: STRING_COLORS[note.string],
      hint,
      key: String(index),
      lane: note.string,
      state,
      targetMs: note.targetMs,
      ...splitNoteName(note.name),
    };
  });
}

/** Every beat of a run, on the game clock, for the highway's beat lines. */
export function beatTimes(notes: ScheduledNote[], bpm: number) {
  const [first] = notes;
  const last = notes.at(-1);
  if (!(first && last)) {
    return [];
  }
  const beatMs = 60_000 / bpm;
  const startMs = first.targetMs - first.beat * beatMs;
  return Array.from(
    { length: Math.floor(last.beat) + 2 },
    (_, beat) => startMs + beat * beatMs
  );
}

export function toFeedback(
  judgment: Judgment,
  notes: ScheduledNote[]
): HighwayFeedback {
  const { detail, label } = describeJudgment(judgment);
  return {
    detail,
    key: `${judgment.index}-${judgment.rating}`,
    label,
    lane: notes[judgment.index]?.string ?? null,
    tone: judgment.rating,
  };
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="font-semibold text-xl tabular-nums sm:text-2xl">
        {value}
      </span>
      <span className="text-muted-foreground text-xs">{label}</span>
    </div>
  );
}

/** The running score and the count of each rating. */
export function ScoreBar({ summary }: { summary: ScoreSummary }) {
  return (
    <div className="grid grid-cols-4 gap-2 rounded-2xl border p-4">
      <Stat label="Score" value={summary.score.toLocaleString("en-US")} />
      <Stat label="Perfect" value={summary.counts.perfect} />
      <Stat label="Good" value={summary.counts.good} />
      <Stat label="Miss" value={summary.counts.miss} />
    </div>
  );
}
