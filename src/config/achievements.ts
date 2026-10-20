/** Achievement goals, all in one place to tune. */
export const ACHIEVEMENT_GOALS = {
  /** Notes played in all, for Century and Marathon. */
  centuryNotes: 100,
  /** Days in a row, for Daily Practice and Weekly Habit. */
  dailyPracticeDays: 3,
  /** First-try ear training answers in a row, across rounds. */
  earStreak: 25,
  marathonNotes: 1000,
  /** Metronome: average this close to the beat, in ms, over this many hits. */
  metronomeMaxMs: 5,
  metronomeMinHits: 30,
  /** Night Owl: finish between midnight and this hour. */
  nightOwlBeforeHour: 4,
  /** No Weak Spots: hit rate needed in a Weak spots run. */
  noWeakSpotsHitRate: 0.9,
  /** Star Collector: stars needed. */
  starCollector: 30,
  /** In a row, for Unstoppable. Warmed Up and On Fire follow the combo. */
  unstoppableStreak: 50,
  weeklyHabitDays: 7,
};

/** How long an unlock pop-up stays up, in ms. */
export const ACHIEVEMENT_TOAST_MS = 6000;
/** More unlocks than this at once show as one pop-up. */
export const ACHIEVEMENT_TOAST_MAX = 3;
