"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  DEBUG_CHANGED_EVENT,
  isDebugLogOn,
  sendDebugLogNow,
  setDebugLogOn,
} from "@/debug/debug-log";

/**
 * A small red "Debug log on" badge, so it's clear when the game is writing
 * down what it hears. Also sends the last of the log when the page closes,
 * and turns the log on or off for a link ending in ?debug=on or ?debug=off.
 */
export function DebugBadge() {
  const [on, setOn] = useState(false);

  useEffect(() => {
    // A link with ?debug=on (or off) switches the log, for easy testing.
    const asked = new URLSearchParams(window.location.search).get("debug");
    if (asked === "on" || asked === "off") {
      setDebugLogOn(asked === "on");
    }
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
