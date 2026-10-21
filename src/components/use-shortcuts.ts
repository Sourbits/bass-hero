"use client";

import { useEffect, useRef } from "react";

/** Where typing goes; shortcuts stay out of the way there. */
const TYPING = "input, textarea, select, [contenteditable]";
/** What Space and Enter press when focused, as usual. */
const PRESSABLE = "button, a, summary, [role='button'], [role='tab']";

/** Whether a key press belongs to something else: typing, or a button. */
function leaveAlone(event: KeyboardEvent) {
  if (
    event.repeat ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    event.defaultPrevented
  ) {
    return true;
  }
  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest(TYPING)) {
    return true;
  }
  const pressKey = event.key === " " || event.key === "Enter";
  return pressKey && Boolean(target?.closest(PRESSABLE));
}

/** Actions by KeyboardEvent.key, with letters in lower case. */
export type Shortcuts = Partial<Record<string, (() => void) | false | null>>;

/**
 * Runs an action when its key is pressed anywhere on the page. Leave an
 * action out, or make it false or null, when it doesn't apply right now.
 * Keys held down, and keys pressed with Ctrl, Cmd or Alt, are left alone.
 */
export function useShortcuts(shortcuts: Shortcuts) {
  const latest = useRef(shortcuts);
  latest.current = shortcuts;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (leaveAlone(event)) {
        return;
      }
      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const action = latest.current[key];
      if (!action) {
        return;
      }
      event.preventDefault();
      action();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

/**
 * Takes focus off the button just clicked. Call it as a run starts, so
 * pressing Space (the start key) mid-run can't press the Stop button that
 * now has focus.
 */
export function releaseFocus() {
  if (document.activeElement instanceof HTMLElement) {
    document.activeElement.blur();
  }
}
