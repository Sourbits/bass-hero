import { createNoise } from "@/audio/tones";
import { EAR_TRAINING } from "@/config/ear-training";
import type { Outcome } from "./note-stats";
import { type Position, positionMidi } from "./positions";

export interface EarPrompt {
  midi: number;
  /** Where the note is; any place with the same pitch is also right. */
  position: Position;
}

/** "correct", or which way to go: you played too low, so go "higher". */
export type EarVerdict = "correct" | "higher" | "lower";

export interface EarResult {
  prompt: EarPrompt;
  solved: boolean;
  /** Tries used, including the right one. */
  tries: number;
}

export interface EarScore {
  /** Notes found on the first try. */
  firstTry: number;
  maxStreak: number;
  /** The multiplier the next first-try answer will get. */
  multiplier: number;
  score: number;
  /** First-try answers in a row right now. */
  streak: number;
}

/** Notes to find by ear, picked at random, never the same twice in a row. */
export function earPrompts(
  positions: Position[],
  count: number,
  seed = (Date.now() % 2_147_483_646) + 1
): EarPrompt[] {
  const random = createNoise(seed);
  const prompts: EarPrompt[] = [];
  while (prompts.length < count && positions.length > 0) {
    const index = Math.floor(((random() + 1) / 2) * positions.length);
    const position = positions[Math.min(index, positions.length - 1)];
    const previous = prompts.at(-1);
    if (
      position &&
      (positions.length === 1 ||
        !previous ||
        positionMidi(position) !== previous.midi)
    ) {
      prompts.push({ midi: positionMidi(position), position });
    }
  }
  return prompts;
}

/** Compares what you played with the note asked for. The octave counts. */
export function judgeAnswer(
  targetMidi: number,
  playedMidi: number
): EarVerdict {
  if (playedMidi === targetMidi) {
    return "correct";
  }
  return playedMidi < targetMidi ? "higher" : "lower";
}

/**
 * Points for a round: more for fewer tries, and first-try answers in a row
 * build a multiplier, like a combo in the game.
 */
export function scoreEar(
  results: EarResult[],
  config = EAR_TRAINING
): EarScore {
  let score = 0;
  let streak = 0;
  let maxStreak = 0;
  let firstTry = 0;
  const multiplierFor = (run: number) =>
    Math.min(config.maxMultiplier, 1 + Math.floor(run / config.comboStep));

  for (const { solved, tries } of results) {
    if (!solved) {
      streak = 0;
      continue;
    }
    const points = config.points[tries - 1] ?? 0;
    if (tries === 1) {
      score += points * multiplierFor(streak);
      streak += 1;
      firstTry += 1;
      maxStreak = Math.max(maxStreak, streak);
    } else {
      score += points;
      streak = 0;
    }
  }
  return {
    firstTry,
    maxStreak,
    multiplier: multiplierFor(streak),
    score,
    streak,
  };
}

/** For the heat map: a note counts as known only when found on the first try. */
export function earOutcomes(results: EarResult[]): Outcome[] {
  return results.map(({ prompt, solved, tries }) => ({
    hit: solved && tries === 1,
    position: prompt.position,
  }));
}
