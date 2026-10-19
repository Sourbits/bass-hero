import { createNoise } from "@/audio/tones";
import {
  LEVELS_PER_TIER,
  STAR_THRESHOLDS,
  STRING_CHANGE_COST,
  TIER_ORDER,
  TIERS,
  type TierConfig,
  type TierId,
} from "@/config/difficulty";
import { type BassString, STRINGS } from "@/instrument/bass";
import type { Chart } from "./chart";
import { type Position, positionKey, positionName } from "./positions";

export interface Level {
  /** 1 to 10. */
  level: number;
  tier: TierId;
}

export interface LevelSettings {
  /** Beats from one note to the next. */
  beatsPerNote: number;
  bpm: number;
  /** The furthest one note may be from the next (see neckDistance). */
  maxJump: number;
  /** The closest one note may be to the next; 0 allows repeats. */
  minJump: number;
  /** Notes this level adds to the ones before it, across tiers too. */
  newPositions: Position[];
  notes: number;
  positions: Position[];
  showFretboard: boolean;
  showFretHints: boolean;
  /** Tighter timing windows for this level, if any. */
  timing: TierConfig["timing"];
  /** The widest move the level's notes allow. */
  widestJump: number;
}

/** Spacings a run can use, in beats per note. */
const SPACINGS = [2, 1.5, 1, 0.75, 0.5];

function parsePositionKey(key: string): Position {
  return { fret: Number(key.slice(1)), string: key[0] as BassString };
}

/** Every note the tiers before this one reach by their level 10. */
function earlierKeys(tier: TierId) {
  return new Set(
    TIER_ORDER.slice(0, TIER_ORDER.indexOf(tier)).flatMap(
      (earlier) => TIERS[earlier].pool
    )
  );
}

/** Every position a tier uses, in the order it introduces them. */
export function tierPositions(tier: TierId): Position[] {
  return TIERS[tier].pool.map(parsePositionKey);
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

const lerp = ([start, end]: [number, number], step: number) =>
  start + step * (end - start);

const nearest = (value: number, options: number[]) =>
  options.reduce((best, option) =>
    Math.abs(option - value) < Math.abs(best - value) ? option : best
  );

function notesAtLevel(config: TierConfig, step: number) {
  return Math.round(lerp([config.startNotes, config.pool.length], step));
}

/**
 * The settings for one level. Within a tier, each level adds notes, speeds
 * up, packs notes closer together and makes them jump further.
 */
export function levelSettings({ level, tier }: Level): LevelSettings {
  const config = TIERS[tier];
  const clamped = Math.min(Math.max(level, 1), LEVELS_PER_TIER);
  const step = (clamped - 1) / (LEVELS_PER_TIER - 1);
  const previousStep = Math.max(0, clamped - 2) / (LEVELS_PER_TIER - 1);

  const all = tierPositions(tier);
  const count = notesAtLevel(config, step);
  const positions = all.slice(0, count);
  const newPositions =
    clamped === 1
      ? positions.filter(
          (position) => !earlierKeys(tier).has(positionKey(position))
        )
      : all.slice(notesAtLevel(config, previousStep), count);
  const widest = widestJump(positions);
  const maxJump = Math.max(2, Math.round(lerp(config.maxJump, step) * widest));

  return {
    beatsPerNote: nearest(lerp(config.beatsPerNote, step), SPACINGS),
    bpm: Math.round(lerp(config.bpm, step)),
    maxJump,
    minJump: Math.min(Math.round(lerp(config.minJump, step) * widest), maxJump),
    newPositions,
    notes: Math.round(lerp(config.notes, step)),
    positions,
    showFretboard: config.showFretboard,
    showFretHints: config.showFretHints,
    timing: config.timing,
    widestJump: widest,
  };
}

/** How many notes a level asks for per minute: its overall pace. */
export function notesPerMinute(level: Level) {
  const { beatsPerNote, bpm } = levelSettings(level);
  return bpm / beatsPerNote;
}

/**
 * A run for a level: each note within the level's jump range of the one
 * before, spaced by its beats per note. Notes played less so far are more
 * likely, so a run covers the level's notes instead of circling a few.
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
    notes: picked.map((position, index) => ({
      beat: index * settings.beatsPerNote,
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
