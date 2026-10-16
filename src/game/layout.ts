export interface HighwayLayout {
  /** How long a circle takes to slide from the right edge to the target, in ms. */
  approachMs: number;
  /** Circle radius, in px. */
  radius: number;
  /** Center of the target outline, in px from the left edge. */
  targetX: number;
  /** Width of the highway, in px. */
  width: number;
}

/** Circle radius in px. */
export const CIRCLE_RADIUS = 28;
/** Time on screen before reaching the target, in ms. */
export const APPROACH_MS = 2000;

/** The layout for a highway of this width: target outline near the left. */
export function highwayLayout(width: number): HighwayLayout {
  return {
    approachMs: APPROACH_MS,
    radius: CIRCLE_RADIUS,
    targetX: Math.max(2 * CIRCLE_RADIUS, Math.round(width * 0.18)),
    width,
  };
}

/**
 * Where a circle's center is at `nowMs`. It moves right to left at a steady
 * speed: one approach time before its target it's just off the right edge,
 * and at its target time it's exactly on the target outline. After that it
 * keeps going left.
 */
export function circleX(
  targetMs: number,
  nowMs: number,
  { approachMs, radius, targetX, width }: HighwayLayout
) {
  const spawnX = width + radius;
  return targetX + ((targetMs - nowMs) / approachMs) * (spawnX - targetX);
}
