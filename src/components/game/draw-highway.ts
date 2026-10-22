import { STRING_COLORS } from "@/components/string-colors";
import {
  type HighwayGeometry,
  laneIndex,
  laneX,
  projectNote,
} from "@/game/layout";
import { type BassString, STRINGS } from "@/instrument/bass";

/** One note on the highway, as the drawing needs it. */
export interface HighwayGem {
  color: string;
  /** A small hint under the note, such as "fret 3". */
  hint?: string;
  key: string;
  /** Big text on the note, such as "F" or a beat number. */
  label: string;
  /** Its lane, or null for a bar across every lane (any string will do). */
  lane: BassString | null;
  /** Small text after the label, such as "♯2" or "1". */
  small: string;
  /** "hit" notes burst and vanish; "missed" ones go grey and pass by. */
  state: "hit" | "missed" | "upcoming";
  targetMs: number;
}

const SURFACE = "#15132e";
const LANE_LINE = "#2f2b55";
const MISSED = "#4f4c6e";
/** The stage's gold, for the strike line when on fire and the countdown. */
const FIRE = "#f4c44f";
const NEON = "#ec3f97";
/** The page behind the highway, for the fog at the far end. */
const STAGE_RGB = "11, 10, 28";
const BURST_MS = 420;
/** How long the strike line glows after each beat, in ms. */
const BEAT_PULSE_MS = 240;
/** Sparks thrown out by a hit. */
const SPARKS = 10;
/** The countdown before the first note: 3, 2, 1, a second each. */
const COUNTDOWN_MS = 3000;
const ALL_LANES: ReadonlySet<BassString> = new Set(STRINGS);

/** Scale at a given height on screen: the inverse of projectNote's y. */
function scaleAtY(y: number, { farScale, farY, strikeY }: HighwayGeometry) {
  return 1 - ((strikeY - y) * (1 - farScale)) / (strikeY - farY);
}

/** 1 right on a beat, fading to 0 just after: the strike line's pulse. */
function beatPulse(beatTimesMs: number[], nowMs: number | null) {
  if (nowMs === null) {
    return 0;
  }
  let since = Number.POSITIVE_INFINITY;
  for (const beatMs of beatTimesMs) {
    const ms = nowMs - beatMs;
    if (ms >= 0 && ms < since) {
      since = ms;
    }
  }
  return Math.max(0, 1 - since / BEAT_PULSE_MS);
}

/** Splits "F#2" into the big letter and the small "♯2". */
export function splitNoteName(name: string) {
  return {
    label: name.slice(0, 1),
    small: name.slice(1).replace("#", "♯"),
  };
}

function drawSurface(
  context: CanvasRenderingContext2D,
  geometry: HighwayGeometry,
  showLanes: boolean,
  activeLanes: ReadonlySet<BassString>
) {
  const { centerX, farScale, farY, halfWidth, height } = geometry;
  const bottomScale = scaleAtY(height, geometry);
  const edge = (side: number, scale: number) =>
    centerX + side * halfWidth * scale;

  context.fillStyle = SURFACE;
  context.beginPath();
  context.moveTo(edge(-1, farScale), farY);
  context.lineTo(edge(1, farScale), farY);
  context.lineTo(edge(1, bottomScale), height);
  context.lineTo(edge(-1, bottomScale), height);
  context.closePath();
  context.fill();

  const laneWidth = (2 * halfWidth) / STRINGS.length;
  for (const string of STRINGS) {
    const left = -halfWidth + laneWidth * laneIndex(string, geometry);
    if (showLanes && activeLanes.has(string)) {
      context.fillStyle = `${STRING_COLORS[string]}22`;
      context.beginPath();
      context.moveTo(centerX + left * farScale, farY);
      context.lineTo(centerX + (left + laneWidth) * farScale, farY);
      context.lineTo(centerX + (left + laneWidth) * bottomScale, height);
      context.lineTo(centerX + left * bottomScale, height);
      context.closePath();
      context.fill();
    }
  }

  context.strokeStyle = LANE_LINE;
  for (let index = 0; index <= STRINGS.length; index += 1) {
    if (!showLanes && index > 0 && index < STRINGS.length) {
      continue;
    }
    const offset = -halfWidth + laneWidth * index;
    context.lineWidth = index === 0 || index === STRINGS.length ? 3 : 1.5;
    context.beginPath();
    context.moveTo(centerX + offset * farScale, farY);
    context.lineTo(centerX + offset * bottomScale, height);
    context.stroke();
  }
}

function drawBeatLines(
  context: CanvasRenderingContext2D,
  geometry: HighwayGeometry,
  beatTimesMs: number[],
  nowMs: number
) {
  for (const beatMs of beatTimesMs) {
    const ahead = beatMs - nowMs;
    if (ahead < -300 || ahead > geometry.approachMs) {
      continue;
    }
    const { scale, y } = projectNote(beatMs, nowMs, geometry);
    const half = geometry.halfWidth * scale;
    context.strokeStyle = `rgba(255, 255, 255, ${0.08 + 0.17 * scale})`;
    context.lineWidth = Math.max(1, 2 * scale);
    context.beginPath();
    context.moveTo(geometry.centerX - half, y);
    context.lineTo(geometry.centerX + half, y);
    context.stroke();
  }
}

function drawStrikeLine(
  context: CanvasRenderingContext2D,
  geometry: HighwayGeometry,
  { activeLanes, fontFamily, onFire, pulse, showLanes }: StrikeOptions
) {
  const { centerX, halfWidth, radius, strikeY } = geometry;
  // It flashes on every beat, and glows gold when on fire.
  context.strokeStyle = onFire
    ? FIRE
    : `rgba(255, 255, 255, ${0.5 + 0.4 * pulse})`;
  context.lineWidth = (onFire ? 5 : 3) + 2 * pulse;
  context.shadowColor = onFire ? FIRE : "#ffffff";
  context.shadowBlur = onFire ? 18 + 10 * pulse : 14 * pulse;
  context.beginPath();
  context.moveTo(centerX - halfWidth, strikeY);
  context.lineTo(centerX + halfWidth, strikeY);
  context.stroke();
  context.shadowBlur = 0;

  if (!showLanes) {
    return;
  }
  context.textAlign = "center";
  context.textBaseline = "middle";
  for (const string of STRINGS) {
    const x = laneX(string, 1, geometry);
    // Lanes this run doesn't use are drawn dim, so the eye stays on the others.
    const active = activeLanes.has(string);
    context.fillStyle = active ? `${STRING_COLORS[string]}40` : "transparent";
    context.strokeStyle = active ? "#ffffff" : LANE_LINE;
    context.lineWidth = 3 + 1.5 * pulse;
    context.shadowColor = STRING_COLORS[string];
    context.shadowBlur = active ? 10 + 12 * pulse : 0;
    context.beginPath();
    context.arc(x, strikeY, radius, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    context.shadowBlur = 0;

    const laneWidth = (2 * geometry.halfWidth) / STRINGS.length;
    context.fillStyle = active ? "#a5a3c9" : "#4a4770";
    context.font = `600 13px ${fontFamily}`;
    context.fillText(
      laneWidth >= 100 ? `${string} string` : string,
      x,
      strikeY + radius + 14
    );
  }
}

function drawLabel(
  context: CanvasRenderingContext2D,
  gem: HighwayGem,
  x: number,
  y: number,
  size: number,
  fontFamily: string
) {
  const big = `700 ${Math.round(size)}px ${fontFamily}`;
  const small = `700 ${Math.round(size * 0.55)}px ${fontFamily}`;
  context.font = big;
  const bigWidth = context.measureText(gem.label).width;
  context.font = small;
  const smallWidth = gem.small ? context.measureText(gem.small).width : 0;
  const left = x - (bigWidth + smallWidth) / 2;

  context.fillStyle = "#ffffff";
  context.textAlign = "left";
  context.textBaseline = "middle";
  context.font = big;
  context.fillText(gem.label, left, y);
  if (gem.small) {
    context.font = small;
    context.fillText(gem.small, left + bigWidth, y + size * 0.22);
  }
}

function drawGem(
  context: CanvasRenderingContext2D,
  geometry: HighwayGeometry,
  gem: HighwayGem,
  nowMs: number,
  fontFamily: string
) {
  const depth = (gem.targetMs - nowMs) / geometry.approachMs;
  const { scale, y } = projectNote(gem.targetMs, nowMs, geometry);
  const radius = geometry.radius * scale;
  if (depth > 1.02 || y - radius > geometry.height) {
    return;
  }

  // Fade in at the far end; missed notes fade further as they pass.
  let alpha = Math.min(1, (1.02 - depth) / 0.12);
  if (gem.state === "missed") {
    alpha *= depth < 0 ? Math.max(0, 0.45 + depth) : 0.45;
  }
  context.globalAlpha = Math.max(0, alpha);
  context.fillStyle = gem.state === "missed" ? MISSED : gem.color;
  context.strokeStyle = "#ffffff";
  context.lineWidth = Math.max(1, 2.5 * scale);

  if (gem.lane) {
    const x = laneX(gem.lane, scale, geometry);
    // Upcoming notes glow in their string's color.
    context.shadowColor = gem.color;
    context.shadowBlur = gem.state === "missed" ? 0 : 24 * scale;
    context.beginPath();
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();
    context.shadowBlur = 0;
    // A soft highlight, top left, so it reads as a gem rather than a dot.
    const shine = context.createRadialGradient(
      x - radius * 0.35,
      y - radius * 0.4,
      radius * 0.05,
      x,
      y,
      radius
    );
    shine.addColorStop(0, "rgba(255, 255, 255, 0.45)");
    shine.addColorStop(0.6, "rgba(255, 255, 255, 0)");
    context.fillStyle = shine;
    context.fill();
    context.stroke();
    drawLabel(context, gem, x, y, radius * 1.05, fontFamily);
    if (gem.hint && scale > 0.45) {
      context.fillStyle = "#e4e4e7";
      context.textAlign = "center";
      context.textBaseline = "top";
      context.font = `600 ${Math.round(12 * scale)}px ${fontFamily}`;
      context.fillText(gem.hint, x, y + radius + 3 * scale);
    }
  } else {
    const half = geometry.halfWidth * scale * 0.94;
    context.beginPath();
    context.roundRect(
      geometry.centerX - half,
      y - radius * 0.5,
      2 * half,
      radius,
      radius * 0.5
    );
    context.fill();
    context.stroke();
    drawLabel(context, gem, geometry.centerX, y, radius * 0.8, fontFamily);
  }
  context.globalAlpha = 1;
}

function drawSparks(
  context: CanvasRenderingContext2D,
  color: string,
  x: number,
  y: number,
  radius: number,
  progress: number
) {
  const eased = 1 - (1 - progress) ** 2;
  context.shadowColor = color;
  context.shadowBlur = 10;
  for (let spark = 0; spark < SPARKS; spark += 1) {
    const angle = (spark / SPARKS) * Math.PI * 2 + 0.3;
    const distance = radius * (1 + 1.8 * eased);
    context.fillStyle = spark % 2 === 0 ? "#ffffff" : color;
    context.beginPath();
    context.arc(
      x + Math.cos(angle) * distance,
      // Flattened, as if lying on the highway.
      y + Math.sin(angle) * distance * 0.6,
      3.5 * (1 - progress) + 0.5,
      0,
      Math.PI * 2
    );
    context.fill();
  }
  context.shadowBlur = 0;
}

function drawBurst(
  context: CanvasRenderingContext2D,
  geometry: HighwayGeometry,
  gem: HighwayGem,
  progress: number
) {
  context.globalAlpha = 1 - progress;
  context.strokeStyle = gem.color;
  context.lineWidth = 6 * (1 - progress) + 1;
  const { centerX, halfWidth, radius, strikeY } = geometry;
  if (gem.lane) {
    const x = laneX(gem.lane, 1, geometry);
    // A flash inside the ring, then a ring and sparks flying out.
    context.fillStyle = gem.color;
    context.globalAlpha = 0.5 * (1 - progress) ** 2;
    context.beginPath();
    context.arc(x, strikeY, radius, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = 1 - progress;
    drawSparks(context, gem.color, x, strikeY, radius, progress);
  }
  context.beginPath();
  if (gem.lane) {
    context.arc(
      laneX(gem.lane, 1, geometry),
      strikeY,
      radius * (1 + 0.9 * progress),
      0,
      Math.PI * 2
    );
  } else {
    const grow = radius * progress;
    context.roundRect(
      centerX - halfWidth - grow,
      strikeY - radius * 0.5 - grow,
      2 * (halfWidth + grow),
      radius + 2 * grow,
      radius
    );
  }
  context.stroke();
  context.globalAlpha = 1;
}

function drawGems(
  context: CanvasRenderingContext2D,
  geometry: HighwayGeometry,
  {
    burstStarts,
    fontFamily,
    gems,
    nowMs,
  }: Pick<DrawOptions, "burstStarts" | "fontFamily" | "gems"> & {
    nowMs: number;
  }
) {
  // Far notes first, so nearer ones are drawn on top.
  const ordered = [...gems].sort((a, b) => b.targetMs - a.targetMs);
  for (const gem of ordered) {
    if (gem.state !== "hit") {
      drawGem(context, geometry, gem, nowMs, fontFamily);
      continue;
    }
    const start = burstStarts.get(gem.key) ?? nowMs;
    burstStarts.set(gem.key, start);
    const progress = (nowMs - start) / BURST_MS;
    if (progress < 1) {
      drawBurst(context, geometry, gem, progress);
    }
  }
}

interface StrikeOptions {
  activeLanes: ReadonlySet<BassString>;
  fontFamily: string;
  onFire: boolean;
  /** 1 on a beat, fading to 0: how bright the line flashes. */
  pulse: number;
  showLanes: boolean;
}

/** 3, 2, 1, big in the middle, counting down to the first note. */
function drawCountdown(
  context: CanvasRenderingContext2D,
  geometry: HighwayGeometry,
  gems: HighwayGem[],
  nowMs: number,
  displayFont: string
) {
  let first = Number.POSITIVE_INFINITY;
  for (const gem of gems) {
    first = Math.min(first, gem.targetMs);
  }
  const remaining = first - nowMs;
  if (!(remaining > 0 && remaining <= COUNTDOWN_MS)) {
    return;
  }
  const count = Math.ceil(remaining / 1000);
  // 0 as a number appears, 1 as it goes: it lands big, then settles.
  const age = 1 - (remaining - (count - 1) * 1000) / 1000;
  const scale = 1 + 0.4 * (1 - Math.min(1, age * 4));
  context.globalAlpha = Math.min(1, (1 - age) * 3);
  context.fillStyle = FIRE;
  context.shadowColor = NEON;
  context.shadowBlur = 30;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.font = `800 ${Math.round(88 * scale)}px ${displayFont}`;
  context.fillText(String(count), geometry.centerX, geometry.strikeY * 0.45);
  context.shadowBlur = 0;
  context.globalAlpha = 1;
}

export interface DrawOptions {
  /** Lanes in use; the others are drawn dim. Defaults to all four. */
  activeLanes?: ReadonlySet<BassString>;
  beatTimesMs: number[];
  /** When each hit note was first seen as hit, to time its burst. */
  burstStarts: Map<string, number>;
  /** Count 3, 2, 1 down to the first note. */
  countdown?: boolean;
  /** For big moments, such as the countdown. */
  displayFont?: string;
  fontFamily: string;
  gems: HighwayGem[];
  /** The clock time to draw, or null to draw an empty highway. */
  nowMs: number | null;
  /** At the top combo multiplier: the strike line glows. */
  onFire?: boolean;
  showLanes: boolean;
}

/** Draws one frame of the highway. Positions all come from projectNote(). */
export function drawHighway(
  context: CanvasRenderingContext2D,
  geometry: HighwayGeometry,
  {
    activeLanes = ALL_LANES,
    beatTimesMs,
    burstStarts,
    countdown = true,
    displayFont,
    fontFamily,
    gems,
    nowMs,
    onFire = false,
    showLanes,
  }: DrawOptions
) {
  context.clearRect(0, 0, geometry.width, geometry.height);
  drawSurface(context, geometry, showLanes, activeLanes);
  if (nowMs !== null) {
    drawBeatLines(context, geometry, beatTimesMs, nowMs);
  }
  drawStrikeLine(context, geometry, {
    activeLanes,
    fontFamily,
    onFire,
    pulse: beatPulse(beatTimesMs, nowMs),
    showLanes,
  });
  if (nowMs !== null) {
    drawGems(context, geometry, { burstStarts, fontFamily, gems, nowMs });
  }

  // Fade the far end into the background, like a road into fog.
  const fog = context.createLinearGradient(0, 0, 0, geometry.strikeY * 0.45);
  fog.addColorStop(0, `rgba(${STAGE_RGB}, 1)`);
  fog.addColorStop(1, `rgba(${STAGE_RGB}, 0)`);
  context.fillStyle = fog;
  context.fillRect(0, 0, geometry.width, geometry.strikeY * 0.45);

  if (nowMs !== null && countdown) {
    drawCountdown(context, geometry, gems, nowMs, displayFont ?? fontFamily);
  }
}
