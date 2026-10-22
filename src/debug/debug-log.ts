/**
 * The debug log: while it's on, the game writes down what it detected
 * (plucks, notes, buzz, how each was judged, tuner readings) and sends it to
 * the dev server, which saves it under data/debug-logs/ for reading while
 * testing with a real bass. Off, it costs nothing.
 */

const STORAGE_KEY = "bass-hero:debug-log";
/** The log was turned on or off. */
export const DEBUG_CHANGED_EVENT = "bass-hero:debug-changed";
/** How often to send what's been logged, in ms. */
const SEND_EVERY_MS = 1000;
/** Most events kept waiting to send, if the server can't be reached. */
const MAX_WAITING = 2000;

let on: boolean | null = null;
let waiting: Record<string, unknown>[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

/** Whether the debug log is on in this browser. */
export function isDebugLogOn() {
  if (typeof window === "undefined") {
    return false;
  }
  if (on === null) {
    try {
      on = window.localStorage.getItem(STORAGE_KEY) === "on";
    } catch {
      on = false;
    }
  }
  return on;
}

/** Turns the debug log on or off, for this browser only. */
export function setDebugLogOn(next: boolean) {
  try {
    if (next) {
      window.localStorage.setItem(STORAGE_KEY, "on");
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Storage can be blocked; the setting then lasts until the page closes.
  }
  if (next) {
    on = true;
    debugLog("debug-on", { userAgent: navigator.userAgent });
  } else {
    debugLog("debug-off");
    send();
    on = false;
  }
  window.dispatchEvent(new Event(DEBUG_CHANGED_EVENT));
}

function send() {
  timer = null;
  if (waiting.length === 0) {
    return;
  }
  const events = waiting;
  waiting = [];
  fetch("/api/debug-log", {
    body: JSON.stringify({ events }),
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    method: "POST",
  }).catch(() => undefined);
}

/**
 * Writes down one thing that happened, such as a pluck and how it was
 * judged. Does nothing unless the debug log is on.
 */
export function debugLog(kind: string, data: Record<string, unknown> = {}) {
  if (!isDebugLogOn()) {
    return;
  }
  waiting.push({
    at: new Date().toISOString(),
    kind,
    page: window.location.pathname,
    ...data,
  });
  if (waiting.length > MAX_WAITING) {
    waiting.splice(0, waiting.length - MAX_WAITING);
  }
  timer ??= setTimeout(send, SEND_EVERY_MS);
}

/** Sends anything still waiting, for example as the page closes. */
export function sendDebugLogNow() {
  if (timer) {
    clearTimeout(timer);
  }
  send();
}

/** A number rounded for the log, or null. */
export function r(value: number | null | undefined, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return null;
  }
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}
