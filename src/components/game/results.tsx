"use client";

import { TrophyIcon } from "lucide-react";
import { type ReactNode, useEffect, useRef } from "react";
import { STAR_THRESHOLDS } from "@/config/difficulty";
import { findAchievement } from "@/game/achievement-list";
import type { ScoreSummary } from "@/game/score";
import { describeOffset } from "@/timing/describe";

/**
 * Three stars, the earned ones popping in one after another. Read out as
 * "2 of 3 stars".
 */
export function Stars({
  animate = true,
  className = "text-5xl",
  count,
}: {
  animate?: boolean;
  className?: string;
  count: number;
}) {
  return (
    <span
      aria-label={`${count} of 3 stars`}
      className={`inline-flex gap-1.5 leading-none ${className}`}
      role="img"
    >
      {[0, 1, 2].map((index) => (
        <span
          aria-hidden
          className={
            index < count
              ? "text-gold drop-shadow-[0_0_12px_var(--gold)]"
              : "text-white/12"
          }
          key={index}
          style={
            index < count && animate
              ? {
                  animation: `star-pop 520ms cubic-bezier(0.2, 0.8, 0.3, 1.25) ${250 + index * 260}ms both`,
                }
              : undefined
          }
        >
          ★
        </span>
      ))}
    </span>
  );
}

/** What it takes to earn the next star, or null at three. */
export function nextStarText(stars: number) {
  const threshold = STAR_THRESHOLDS[stars];
  if (threshold === undefined) {
    return null;
  }
  const plural = stars + 1 === 1 ? "star" : "stars";
  return `Hit ${Math.round(threshold * 100)}% for ${stars + 1} ${plural}.`;
}

/** A gold badge with a light sweeping across it. */
export function NewBest() {
  return (
    <span
      className="rounded-full px-3 py-1 font-bold text-primary-foreground text-xs uppercase tracking-wide"
      style={{
        animation: "shine 2.4s linear infinite",
        backgroundImage:
          "linear-gradient(110deg, var(--gold) 40%, #fff7d6 50%, var(--gold) 60%)",
        backgroundSize: "200% 100%",
      }}
    >
      New best!
    </span>
  );
}

/** One number on a results card. */
export function ResultStat({
  label,
  tone = "",
  value,
}: {
  label: string;
  tone?: string;
  value: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 rounded-xl bg-muted/60 px-2 py-2.5">
      <dd className={`font-bold font-heading text-xl tabular-nums ${tone}`}>
        {value}
      </dd>
      <dt className="text-muted-foreground text-xs">{label}</dt>
    </div>
  );
}

/** Achievements a run unlocked, as gold chips. Nothing if there were none. */
export function UnlockedAchievements({ ids }: { ids: string[] }) {
  const achievements = ids.flatMap((id) => findAchievement(id) ?? []);
  if (achievements.length === 0) {
    return null;
  }
  return (
    <div className="flex flex-col items-center gap-2">
      <h3 className="font-semibold text-sm">Unlocked this run</h3>
      <ul className="flex flex-wrap justify-center gap-2">
        {achievements.map(({ id, name }) => (
          <li
            className="flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 font-medium text-sm"
            key={id}
          >
            <TrophyIcon aria-hidden className="size-4 text-gold" />
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The card a run ends on. It slides up and scrolls its top into view, below
 * the sticky header, since it appears under the highway.
 */
export function ResultsCard({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);
  return (
    <section
      className="fade-in slide-in-from-bottom-6 flex animate-in scroll-mt-32 flex-col gap-5 rounded-3xl border bg-card p-5 duration-500 sm:p-7"
      ref={ref}
    >
      {children}
    </section>
  );
}

/**
 * The results of a Practice or Weak spots run: score, ratings, timing and
 * any achievements unlocked.
 */
export function RunResults({
  demo,
  summary,
  title,
  total,
  unlocked,
}: {
  demo: boolean;
  summary: ScoreSummary;
  title: string;
  total: number;
  unlocked: string[];
}) {
  const average = summary.averageOffsetMs;
  const suggestCalibrating =
    !demo && average !== null && Math.abs(average) > 30;
  const hit = summary.counts.perfect + summary.counts.good;
  return (
    <ResultsCard>
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="font-semibold text-muted-foreground text-sm uppercase tracking-wide">
          {title}
        </h2>
        <p className="font-extrabold font-heading text-5xl text-gold tabular-nums">
          {summary.score.toLocaleString("en-US")}
        </p>
        {summary.fullCombo ? (
          <span className="rounded-full border border-neon/50 px-3 py-1 font-bold text-neon text-xs uppercase tracking-wide">
            Full combo!
          </span>
        ) : null}
      </div>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ResultStat
          label="Notes hit"
          value={`${total > 0 ? Math.round((hit / total) * 100) : 0}%`}
        />
        <ResultStat
          label="Perfect"
          tone="text-good"
          value={summary.counts.perfect}
        />
        <ResultStat label="Good" tone="text-cool" value={summary.counts.good} />
        <ResultStat label="Longest streak" value={summary.maxStreak} />
      </dl>
      <p className="text-center text-muted-foreground text-sm">
        {average === null
          ? "No notes were hit, so there's no average timing."
          : `Your hits averaged ${describeOffset(average)}.`}
        {suggestCalibrating
          ? " If most hits lean the same way, try calibrating."
          : ""}
        {demo ? " (Demo mode.)" : ""}
      </p>
      <UnlockedAchievements ids={unlocked} />
    </ResultsCard>
  );
}
