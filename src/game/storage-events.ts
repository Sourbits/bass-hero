/**
 * Signals between the saved-data modules and the account sync, so neither
 * has to know about the other.
 */

/** Saved data changed here: a run finished or a setting changed. */
export const LOCAL_CHANGE_EVENT = "bass-hero:local-change";
/** Saved data was replaced from the account, so screens should reload it. */
export const DATA_REPLACED_EVENT = "bass-hero:data-replaced";
/** When this browser's saved data last changed, in ms since 1970. */
export const UPDATED_AT_KEY = "bass-hero:updated-at";

/** Notes that saved data changed here. Call after every save. */
export function markLocalChange() {
  if (typeof window === "undefined") {
    return;
  }
  try {
    window.localStorage.setItem(UPDATED_AT_KEY, String(Date.now()));
  } catch {
    // Storage can be blocked, for example in a private window.
  }
  window.dispatchEvent(new Event(LOCAL_CHANGE_EVENT));
}

/** Calls back whenever saved data is replaced from the account. */
export function onDataReplaced(callback: () => void) {
  window.addEventListener(DATA_REPLACED_EVENT, callback);
  return () => window.removeEventListener(DATA_REPLACED_EVENT, callback);
}
