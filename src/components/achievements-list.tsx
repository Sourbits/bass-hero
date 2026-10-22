"use client";

import { LockIcon, TrophyIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
  ACHIEVEMENT_GROUPS,
  ACHIEVEMENTS,
  type Achievement,
  type World,
} from "@/game/achievement-list";
import {
  type AchievementRecord,
  EMPTY_ACHIEVEMENTS,
  loadAchievements,
  onAchievementsUnlocked,
} from "@/game/achievements";
import { loadNoteStats } from "@/game/note-stats";
import { loadProgress, NEW_PROGRESS } from "@/game/progress";
import { onDataReplaced } from "@/game/storage-events";

interface Saved {
  record: AchievementRecord;
  world: World;
}

const NOTHING_YET: Saved = {
  record: EMPTY_ACHIEVEMENTS,
  world: {
    noteStats: {},
    now: new Date(0),
    progress: NEW_PROGRESS,
    stats: EMPTY_ACHIEVEMENTS.stats,
  },
};

function load(): Saved {
  const record = loadAchievements();
  return {
    record,
    world: {
      noteStats: loadNoteStats(),
      now: new Date(),
      progress: loadProgress(),
      stats: record.stats,
    },
  };
}

function GoalBar({
  achievement,
  world,
}: {
  achievement: Achievement;
  world: World;
}) {
  const goal = achievement.progress?.(world);
  if (!goal) {
    return null;
  }
  const current = Math.min(goal.current, goal.target);
  return (
    <div className="mt-1 flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-foreground/60"
          style={{ width: `${(current / goal.target) * 100}%` }}
        />
      </div>
      <span className="text-muted-foreground text-xs tabular-nums">
        {current.toLocaleString("en-US")} /{" "}
        {goal.target.toLocaleString("en-US")}
      </span>
    </div>
  );
}

/**
 * One achievement: unlocked with its date, or locked with a progress bar
 * when a world (your own saved data) is given to measure it against.
 */
export function AchievementCard({
  achievement,
  unlockedAt,
  world,
}: {
  achievement: Achievement;
  unlockedAt: number | undefined;
  world?: World;
}) {
  return (
    <li
      className={`flex items-start gap-3 rounded-xl border p-4 ${
        unlockedAt
          ? "border-gold/40 bg-gold/8 shadow-[0_0_30px_-18px_var(--gold)]"
          : "bg-card"
      }`}
    >
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
          unlockedAt ? "bg-gold/15 text-gold" : "bg-muted text-muted-foreground"
        }`}
      >
        {unlockedAt ? (
          <TrophyIcon aria-hidden className="size-5" />
        ) : (
          <LockIcon aria-hidden className="size-4" />
        )}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className={unlockedAt ? "font-semibold" : "font-medium"}>
          {achievement.name}
          <span className="sr-only">
            {unlockedAt ? " (unlocked)" : " (locked)"}
          </span>
        </p>
        <p className="text-muted-foreground text-sm">
          {achievement.description}
        </p>
        {unlockedAt ? (
          <p className="text-gold text-xs">
            Unlocked{" "}
            {new Date(unlockedAt).toLocaleDateString(undefined, {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </p>
        ) : null}
        {!unlockedAt && world ? (
          <GoalBar achievement={achievement} world={world} />
        ) : null}
      </div>
    </li>
  );
}

/** Every achievement, grouped, with what's unlocked and how close the rest are. */
export function AchievementsList() {
  const [saved, setSaved] = useState<Saved>(NOTHING_YET);

  // Saved in the browser, so read after hydration, and again on changes.
  useEffect(() => {
    const reload = () => setSaved(load());
    reload();
    const stopReplaced = onDataReplaced(reload);
    const stopUnlocked = onAchievementsUnlocked(reload);
    return () => {
      stopReplaced();
      stopUnlocked();
    };
  }, []);

  const { record, world } = saved;
  const unlockedCount = ACHIEVEMENTS.filter(
    ({ id }) => record.unlocked[id]
  ).length;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-2">
        <p className="font-bold font-heading text-lg">
          {unlockedCount} of {ACHIEVEMENTS.length} unlocked
        </p>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-gold"
            style={{ width: `${(unlockedCount / ACHIEVEMENTS.length) * 100}%` }}
          />
        </div>
      </section>
      {unlockedCount === 0 ? (
        <EmptyState
          action={
            <Button
              nativeButton={false}
              render={<Link href="/game" />}
              variant="stage"
            >
              Play your first level
            </Button>
          }
          icon={TrophyIcon}
          title="Your first one is a note away"
        >
          Hit a single note in any mode to unlock First Note. A handful more
          come in your first few sessions.
        </EmptyState>
      ) : null}
      {ACHIEVEMENT_GROUPS.map((group) => {
        const inGroup = ACHIEVEMENTS.filter(
          (achievement) => achievement.group === group
        );
        const done = inGroup.filter(({ id }) => record.unlocked[id]).length;
        return (
          <section className="flex flex-col gap-3" key={group}>
            <h2 className="flex items-baseline justify-between font-semibold text-lg">
              {group}
              <span className="font-normal text-muted-foreground text-sm">
                {done} / {inGroup.length}
              </span>
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2">
              {inGroup.map((achievement) => (
                <AchievementCard
                  achievement={achievement}
                  key={achievement.id}
                  unlockedAt={record.unlocked[achievement.id]}
                  world={world}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
