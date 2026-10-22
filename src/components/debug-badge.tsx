"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  DEBUG_CHANGED_EVENT,
  isDebugLogOn,
  sendDebugLogNow,
} from "@/debug/debug-log";

/**
 * A small red "Debug log on" badge, so it's clear when the game is writing
 * down what it hears. Also sends the last of the log when the page closes.
 */
export function DebugBadge() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    const check = () => setOn(isDebugLogOn());
    check();
    window.addEventListener(DEBUG_CHANGED_EVENT, check);
    window.addEventListener("pagehide", sendDebugLogNow);
    return () => {
      window.removeEventListener(DEBUG_CHANGED_EVENT, check);
      window.removeEventListener("pagehide", sendDebugLogNow);
    };
  }, []);

  if (!on) {
    return null;
  }
  return (
    <Link
      className="fixed bottom-4 left-16 z-40 flex items-center gap-2 rounded-full border border-bad/50 bg-background/90 px-3 py-1.5 font-medium text-xs backdrop-blur"
      href="/settings"
      title="The game is writing down what it hears. Turn it off in Settings."
    >
      <span className="size-2 animate-pulse rounded-full bg-bad" />
      Debug log on
    </Link>
  );
}
