import { markLocalChange } from "./storage-events";

export const SETTINGS_STORAGE_KEY = "bass-hero:settings";

/** How the player likes the game set up, wherever they play. */
export interface PlayerSettings {
  /** The ear training level picked last, 1 to 10. */
  earLevel: number;
  /**
   * Mirrors everything for a bass played left-handed: the fretboard runs
   * from the nut on the right, and the highway lanes and tuner strings go
   * G, D, A, E from left to right.
   */
  leftHanded: boolean;
}

export const DEFAULT_SETTINGS: PlayerSettings = {
  earLevel: 1,
  leftHanded: false,
};

const EAR_LEVELS_COUNT = 10;

/** Reads settings from saved JSON, with defaults for anything missing. */
export function parseSettings(value: unknown): PlayerSettings {
  const raw =
    value && typeof value === "object"
      ? (value as Partial<Record<keyof PlayerSettings, unknown>>)
      : {};
  const earLevel = Number(raw.earLevel);
  return {
    earLevel:
      Number.isInteger(earLevel) &&
      earLevel >= 1 &&
      earLevel <= EAR_LEVELS_COUNT
        ? earLevel
        : DEFAULT_SETTINGS.earLevel,
    leftHanded:
      typeof raw.leftHanded === "boolean"
        ? raw.leftHanded
        : DEFAULT_SETTINGS.leftHanded,
  };
}

/** Settings saved in this browser, or the defaults. */
export function loadSettings(): PlayerSettings {
  try {
    return parseSettings(
      JSON.parse(window.localStorage.getItem(SETTINGS_STORAGE_KEY) ?? "null")
    );
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: PlayerSettings) {
  try {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage can be blocked, for example in a private window.
  }
  markLocalChange();
}
