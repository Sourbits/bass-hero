import { TIERS } from "@/config/difficulty";
import type { Level } from "@/game/difficulty";
import type { PlayerSummary } from "@/game/player-summary";

const DAY_MS = 24 * 60 * 60 * 1000;

/** "today", "yesterday", "3 days ago", or a date for longer ago. */
export function whenText(at: number | null, now = Date.now()) {
  if (at === null) {
    return "never";
  }
  const startOfToday = new Date(now).setHours(0, 0, 0, 0);
  const days = Math.ceil((startOfToday - at) / DAY_MS);
  if (days <= 0) {
    return "today";
  }
  if (days === 1) {
    return "yesterday";
  }
  if (days < 7) {
    return `${days} days ago`;
  }
  return new Date(at).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function levelText(level: Level | null) {
  return level ? `${TIERS[level.tier].name} ${level.level}` : "None yet";
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-muted/60 p-3">
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className="font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

const count = (value: number) => value.toLocaleString("en-US");

/** The main numbers, for a friend card. */
export function ShortStats({ summary }: { summary: PlayerSummary }) {
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <Stat
        label="Stars"
        value={`★ ${summary.stars.current} / ${summary.stars.target}`}
      />
      <Stat
        label="Achievements"
        value={`${summary.achievements.length} / ${summary.achievementsTotal}`}
      />
      <Stat label="Furthest level" value={levelText(summary.furthest)} />
      <Stat label="Notes played" value={count(summary.notesPlayed)} />
    </dl>
  );
}

/** Every number there is, for a friend's profile. */
export function FullStats({ summary }: { summary: PlayerSummary }) {
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      <Stat
        label="Stars"
        value={`★ ${summary.stars.current} / ${summary.stars.target}`}
      />
      <Stat label="Levels cleared" value={`${summary.levelsCleared} / 40`} />
      <Stat label="Furthest level" value={levelText(summary.furthest)} />
      <Stat
        label="Achievements"
        value={`${summary.achievements.length} / ${summary.achievementsTotal}`}
      />
      <Stat label="Notes played" value={count(summary.notesPlayed)} />
      <Stat
        label="Notes known (green)"
        value={`${summary.notesKnown.current} / ${summary.notesKnown.target}`}
      />
      <Stat
        label="Days in a row"
        value={summary.dayStreak === 1 ? "1 day" : `${summary.dayStreak} days`}
      />
      <Stat label="Best ear streak" value={String(summary.bestEarStreak)} />
      <Stat label="Last played" value={whenText(summary.lastPlayedAt)} />
    </dl>
  );
}
