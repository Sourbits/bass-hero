import { createNoise } from "@/audio/tones";
import {
  LEVELS_PER_TIER,
  STAR_THRESHOLDS,
  STRING_CHANGE_COST,
  TIERS,
  type TierId,
} from "@/config/difficulty";
import { STRINGS } from "@/instrument/bass";
import type { Chart } from "./chart";
import { type Position, positionKey, positionName } from "./positions";

export interface Level {
  /** 1 to 10. */
  level: number;
  tier: TierId;
}

export interface LevelSettings {
  bpm: number;
  /** The furthest one note may be from the next (see neckDistance). */
  maxJump: number;
  /** The closest one note may be to the next; 0 allows repeats. */
  minJump: number;
  notes: number;
  positions: Position[];
  showFretboard: boolean;
  showFretHints: boolean;
}

/** Every position a tier uses. */
export function tierPositions(tier: TierId): Position[] {
  const { maxFret, naturalsOnly, strings } = TIERS[tier];
  return strings.flatMap((string) =>
    Array.from({ length: maxFret + 1 }, (_, fret) => ({ fret, string })).filter(
      (position) => !(naturalsOnly && positionName(position).includes("#"))
    )
  );
}

/**
 * How far apart two notes are on the neck: frets moved, plus a cost for each
 * string crossed.
 */
export function neckDistance(a: Position, b: Position) {
  const strings = Math.abs(
    STRINGS.indexOf(a.string) - STRINGS.indexOf(b.string)
  );
  return Math.abs(a.fret - b.fret) + STRING_CHANGE_COST * strings;
}

function widestJump(positions: Position[]) {
  let widest = 0;
  for (const a of positions) {
    for (const b of positions) {
      widest = Math.max(widest, neckDistance(a, b));
    }
  }
  return widest;
}

/**
 * The settings for one level. Within a tier, higher levels let notes jump
 * further, and from level 6 they force them to: level 1 stays on neighboring
 * notes (and may repeat them), level 10 leaps anywhere on the tier's neck.
 */
export function levelSettings({ level, tier }: Level): LevelSettings {
  const config = TIERS[tier];
  const positions = tierPositions(tier);
  const step =
    (Math.min(Math.max(level, 1), LEVELS_PER_TIER) - 1) / (LEVELS_PER_TIER - 1);
  const widest = widestJump(positions);
  const [slowest, fastest] = config.bpm;

  let minJump = 0;
  if (level >= 6) {
    minJump = Math.round(((level - 5) / 5) * widest * 0.4);
  } else if (level >= 3) {
    minJump = 1;
  }

  return {
    bpm: Math.round(slowest + step * (fastest - slowest)),
    maxJump: Math.max(2, Math.round(2 + step * (widest - 2))),
    minJump,
    notes: config.notes,
    positions,
    showFretboard: config.showFretboard,
    showFretHints: config.showFretHints,
  };
}

/**
 * A run for a level: each note within the level's jump range of the one
 * before. Notes played less so far are more likely, so a run covers the
 * tier's neck instead of circling a few spots.
 */
export function generateLevelChart(
  level: Level,
  { seed = (Date.now() % 2_147_483_646) + 1 }: { seed?: number } = {}
): Chart {
  const settings = levelSettings(level);
  const random = createNoise(seed);
  const pick = <T>(items: T[], weights: number[]) => {
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let target = ((random() + 1) / 2) * total;
    for (const [index, item] of items.entries()) {
      target -= weights[index] ?? 0;
      if (target <= 0) {
        return item;
      }
    }
    return items.at(-1);
  };

  const uses = new Map<string, number>();
  const weightOf = (position: Position) =>
    1 / (1 + (uses.get(positionKey(position)) ?? 0));
  const picked: Position[] = [];

  while (picked.length < settings.notes) {
    const previous = picked.at(-1);
    let candidates = previous
      ? settings.positions.filter((position) => {
          const distance = neckDistance(previous, position);
          return distance >= settings.minJump && distance <= settings.maxJump;
        })
      : settings.positions;
    if (candidates.length === 0) {
      candidates = settings.positions;
    }
    const next = pick(candidates, candidates.map(weightOf));
    if (next) {
      picked.push(next);
      uses.set(positionKey(next), (uses.get(positionKey(next)) ?? 0) + 1);
    }
  }

  return {
    notes: picked.map((position, beat) => ({
      beat,
      note: positionName(position),
      string: position.string,
    })),
    title: `${TIERS[level.tier].name} ${level.level}`,
  };
}

/** Stars for a run, 0 to 3, from its hit rate (Perfect and Good). */
export function starsFor(hitRate: number) {
  return STAR_THRESHOLDS.filter((threshold) => hitRate >= threshold).length;
}
