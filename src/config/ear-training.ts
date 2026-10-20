/** Ear training settings, all in one place to tune. */
export const EAR_TRAINING = {
  /** First-try answers in a row that raise the multiplier by one. */
  comboStep: 3,
  /**
   * After playing a note, how long to wait before listening, in ms, so the
   * mic doesn't take the game's own note for your answer.
   */
  listenAfterMs: 1100,
  maxMultiplier: 4,
  /** Tries per note before the answer is shown. */
  maxTries: 3,
  /** Points for getting it on the 1st, 2nd and 3rd try. */
  points: [100, 50, 25],
  /** Notes per round. */
  prompts: 10,
};
