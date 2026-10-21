/**
 * Keyboard shortcuts, by KeyboardEvent.key (letters in lower case). The
 * Settings page lists them from SHORTCUT_HELP, so keep the two in step.
 */
export const KEYS = {
  /** Ear training: play the note again. */
  hearAgain: "r",
  /** Levels: the level before or after the picked one. Practice: tempo. */
  left: "ArrowLeft",
  /** Levels: the level after this one, from the results. */
  nextAfterRun: "Enter",
  right: "ArrowRight",
  /** Start a run, or play again. In the tuner, start or stop listening. */
  start: " ",
  stop: "Escape",
  /** Tuner: let it detect the string. Letters e, a, d, g pick one. */
  tunerAuto: "0",
} as const;

export interface ShortcutHelp {
  /** What it does. */
  action: string;
  /** The keys, as written on the keyboard. */
  keys: string[];
}

export const SHORTCUT_HELP: { items: ShortcutHelp[]; where: string }[] = [
  {
    items: [
      { action: "Start, or play again", keys: ["Space"] },
      { action: "Stop", keys: ["Esc"] },
    ],
    where: "Levels, Weak spots, Ear training, Practice and Calibrate",
  },
  {
    items: [
      { action: "Pick the level before or after", keys: ["←", "→"] },
      { action: "Next level, after a run", keys: ["Enter"] },
    ],
    where: "Levels",
  },
  {
    items: [{ action: "Slower or faster", keys: ["←", "→"] }],
    where: "Practice",
  },
  {
    items: [{ action: "Hear the note again", keys: ["R"] }],
    where: "Ear training",
  },
  {
    items: [
      { action: "Start or stop listening", keys: ["Space"] },
      { action: "Tune that string", keys: ["E", "A", "D", "G"] },
      { action: "Detect the string", keys: ["0"] },
    ],
    where: "Tuner",
  },
];
