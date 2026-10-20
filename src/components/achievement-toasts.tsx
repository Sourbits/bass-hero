"use client";

import { TrophyIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ACHIEVEMENT_TOAST_MAX,
  ACHIEVEMENT_TOAST_MS,
} from "@/config/achievements";
import { findAchievement } from "@/game/achievement-list";
import { onAchievementsUnlocked, reportAchievement } from "@/game/achievements";
import { onDataReplaced } from "@/game/storage-events";

interface Toast {
  /** The achievements it announces: one, or a batch shown together. */
  ids: string[];
  key: number;
}

function ToastCard({
  onClose,
  toast,
}: {
  onClose: (key: number) => void;
  toast: Toast;
}) {
  const close = useCallback(() => onClose(toast.key), [onClose, toast.key]);
  const achievements = toast.ids.flatMap((id) => findAchievement(id) ?? []);
  const [only] = achievements;
  const single = achievements.length === 1 && only;
  return (
    <li className="pointer-events-auto flex w-80 max-w-[calc(100vw-2rem)] items-start gap-3 rounded-xl border border-amber-500/40 bg-background p-4 shadow-lg">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600">
        <TrophyIcon aria-hidden className="size-5" />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="font-medium text-amber-600 text-xs uppercase tracking-wide">
          {single
            ? "Achievement unlocked"
            : `${achievements.length} achievements unlocked`}
        </p>
        <p className="font-semibold">
          {single ? only.name : achievements.map(({ name }) => name).join(", ")}
        </p>
        {single ? (
          <p className="text-muted-foreground text-sm">{only.description}</p>
        ) : null}
        <Link
          className="mt-1 text-sm underline underline-offset-2"
          href="/achievements"
        >
          See all achievements
        </Link>
      </div>
      <button
        aria-label="Close"
        className="text-muted-foreground hover:text-foreground"
        onClick={close}
        type="button"
      >
        <XIcon aria-hidden className="size-4" />
      </button>
    </li>
  );
}

/**
 * Pops up achievements as they're unlocked, anywhere in the game. It also
 * checks saved progress on load and whenever the account replaces it, so
 * goals already met (before achievements existed, or on another device)
 * unlock too.
 */
export function AchievementToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextKey = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const close = useCallback((key: number) => {
    setToasts((previous) => previous.filter((toast) => toast.key !== key));
  }, []);

  useEffect(() => {
    const show = (ids: string[]) => {
      // A big batch, say on first load, shows as one pop-up.
      const batches =
        ids.length > ACHIEVEMENT_TOAST_MAX ? [ids] : ids.map((id) => [id]);
      const added = batches.map((batch) => {
        nextKey.current += 1;
        return { ids: batch, key: nextKey.current };
      });
      setToasts((previous) => [...previous, ...added]);
      for (const { key } of added) {
        timers.current.push(setTimeout(() => close(key), ACHIEVEMENT_TOAST_MS));
      }
    };
    const check = () => {
      reportAchievement({ kind: "check" });
    };
    const stopListening = onAchievementsUnlocked(show);
    const stopChecking = onDataReplaced(check);
    check();
    return () => {
      stopListening();
      stopChecking();
      for (const timer of timers.current) {
        clearTimeout(timer);
      }
      timers.current = [];
    };
  }, [close]);

  return (
    <ol
      aria-live="polite"
      className="pointer-events-none fixed right-4 bottom-4 z-50 flex flex-col gap-2"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.key} onClose={close} toast={toast} />
      ))}
    </ol>
  );
}
