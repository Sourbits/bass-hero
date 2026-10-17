import { CUSTOM_SET_ID, NOTE_SETS } from "./note-sets";

const STORAGE_KEY = "bass-hero:practice";

export interface PracticeSetting {
  /** Picked positions for the custom set, as keys such as "E3". */
  customKeys: string[];
  /** Which note set to play. */
  setId: string;
}

const DEFAULT: PracticeSetting = {
  customKeys: ["E0", "A0", "D0", "G0"],
  setId: NOTE_SETS[0]?.id ?? "warm-up",
};

const POSITION_KEY = /^[EADG]\d{1,2}$/;

/** The note set last picked in this browser, or the warm-up song. */
export function loadPractice(): PracticeSetting {
  try {
    const saved = JSON.parse(
      window.localStorage.getItem(STORAGE_KEY) ?? "null"
    ) as Partial<PracticeSetting> | null;
    const knownSet =
      saved?.setId === CUSTOM_SET_ID ||
      NOTE_SETS.some((set) => set.id === saved?.setId);
    return {
      customKeys: Array.isArray(saved?.customKeys)
        ? saved.customKeys.filter(
            (key): key is string =>
              typeof key === "string" && POSITION_KEY.test(key)
          )
        : DEFAULT.customKeys,
      setId: knownSet && saved?.setId ? saved.setId : DEFAULT.setId,
    };
  } catch {
    return DEFAULT;
  }
}

export function savePractice(setting: PracticeSetting) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(setting));
  } catch {
    // Not saving is fine; it only saves picking the set again.
  }
}
