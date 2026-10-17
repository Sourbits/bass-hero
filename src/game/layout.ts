import { type BassString, STRINGS } from "@/instrument/bass";

/**
 * A highway seen in perspective, Guitar Hero style: notes appear small at the
 * far end and come toward you, one lane per string (E, A, D, G from left to
 * right), until they reach the strike line near the bottom.
 */
export interface HighwayGeometry {
  /** How long a note takes from the far end to the strike line, in ms. */
  approachMs: number;
  centerX: number;
  /** Size of things at the far end, relative to the strike line. */
  farScale: number;
  /** Where the far end of the highway is drawn, in px from the top. */
  farY: number;
  /** Half the highway's width at the strike line, in px. */
  halfWidth: number;
  height: number;
  /** Radius of a note at the strike line, in px. */
  radius: number;
  /** Where the strike line is drawn, in px from the top. */
  strikeY: number;
  width: number;
}

/** Time on screen before reaching the strike line, in ms. */
export const APPROACH_MS = 2500;
const FAR_SCALE = 0.25;
const MAX_HALF_WIDTH = 260;
const MAX_RADIUS = 34;
/** Room under the strike line for string names and hit feedback, in px. */
const BOTTOM_SPACE = 112;

/** The highway for a drawing area of this size. */
export function highwayGeometry(
  width: number,
  height: number
): HighwayGeometry {
  const halfWidth = Math.min(width * 0.46, MAX_HALF_WIDTH);
  const laneWidth = (2 * halfWidth) / STRINGS.length;
  return {
    approachMs: APPROACH_MS,
    centerX: width / 2,
    farScale: FAR_SCALE,
    farY: 16,
    halfWidth,
    height,
    radius: Math.min(laneWidth * 0.38, MAX_RADIUS),
    strikeY: height - BOTTOM_SPACE,
    width,
  };
}

export interface Projection {
  /** Size relative to the strike line: 1 on it, smaller further away. */
  scale: number;
  /** Vertical position, in px from the top. */
  y: number;
}

/**
 * Where a note is at `nowMs`, in true perspective: it starts at the far end
 * one approach time before its target, speeds up as it comes closer, and is
 * exactly on the strike line, at full size, at its target time. After that it
 * keeps coming toward you, past the strike line.
 */
export function projectNote(
  targetMs: number,
  nowMs: number,
  { approachMs, farScale, farY, strikeY }: HighwayGeometry
): Projection {
  // Depth: 0 at the strike line, 1 at the far end. Size falls off as
  // 1 / (1 + k·depth), with k chosen so the far end is farScale.
  const k = 1 / farScale - 1;
  const depth = Math.max((targetMs - nowMs) / approachMs, -0.5 / k);
  const scale = 1 / (1 + k * depth);
  const y = strikeY - ((strikeY - farY) * (1 - scale)) / (1 - farScale);
  return { scale, y };
}

/** Center of a string's lane at a given perspective scale, in px. */
export function laneX(
  string: BassString,
  scale: number,
  { centerX, halfWidth }: HighwayGeometry
) {
  const laneWidth = (2 * halfWidth) / STRINGS.length;
  const offset = -halfWidth + laneWidth * (STRINGS.indexOf(string) + 0.5);
  return centerX + offset * scale;
}
