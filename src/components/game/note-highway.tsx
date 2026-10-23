"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { drawHighway, type HighwayGem } from "@/components/game/draw-highway";
import { useSettings } from "@/components/settings-provider";
import { debugLog, r } from "@/debug/debug-log";
import { highwayGeometry, laneX } from "@/game/layout";
import type { BassString } from "@/instrument/bass";

export interface HighwayFeedback {
  detail: string;
  /** Changes for every new piece of feedback, so it animates again. */
  key: string;
  label: string;
  /** Shown above this lane, or in the middle for null. */
  lane: BassString | null;
  tone: "good" | "miss" | "neutral" | "perfect";
}

interface NoteHighwayProps {
  /** Lanes this run uses; the others are drawn dim. Defaults to all four. */
  activeLanes?: ReadonlySet<BassString>;
  /** Where to draw beat lines, on the game clock. */
  beatTimesMs: number[];
  /** The current combo, shown in the corner; at the top multiplier, on fire. */
  combo?: { multiplier: number; onFire: boolean; streak: number };
  /** Count 3, 2, 1 down to the first note. Off when the gems are a count-in. */
  countdown?: boolean;
  feedback: HighwayFeedback | null;
  gems: HighwayGem[];
  /** The game clock, or null when nothing is playing. */
  getNow: ((at?: number) => number) | null;
  /** Called every animation frame with the clock time used to draw it. */
  onFrame?: (nowMs: number) => void;
  /** Draw a lane and target ring per string. Off for any-string bars. */
  showLanes?: boolean;
}

/** A frame later than this, in ms, is logged as a stutter. */
const SLOW_FRAME_MS = 50;

/** Half the width that feedback text may need, in px. */
const FEEDBACK_HALF_WIDTH = 64;

const TONE_CLASSES: Record<HighwayFeedback["tone"], string> = {
  good: "text-cool [text-shadow:0_0_12px_var(--cool)]",
  miss: "text-bad",
  neutral: "text-white",
  perfect: "text-good [text-shadow:0_0_12px_var(--good)]",
};

/**
 * The note highway, drawn on a canvas. Every animation frame, each note is
 * placed from the game clock with projectNote(), so it's exactly on the
 * strike line at its target time.
 */
export function NoteHighway({
  activeLanes,
  combo,
  beatTimesMs,
  countdown = true,
  feedback,
  gems,
  getNow,
  onFrame,
  showLanes = true,
}: NoteHighwayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ height: 0, width: 0 });
  const { leftHanded } = useSettings().settings;
  const onFire = combo?.onFire ?? false;
  const latest = useRef({
    activeLanes,
    beatTimesMs,
    countdown,
    gems,
    onFire,
    onFrame,
    showLanes,
  });
  const burstStarts = useRef(new Map<string, number>());
  // Looked up once: reading styles every frame can force a style recalc.
  const fontFamily = useRef("sans-serif");
  const displayFont = useRef("sans-serif");
  latest.current = {
    activeLanes,
    beatTimesMs,
    countdown,
    gems,
    onFire,
    onFrame,
    showLanes,
  };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const style = getComputedStyle(container);
    fontFamily.current = style.fontFamily;
    displayFont.current =
      style.getPropertyValue("--font-display").trim() || style.fontFamily;
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        height: entry?.contentRect.height ?? 0,
        width: entry?.contentRect.width ?? 0,
      });
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  const draw = useCallback(
    (nowMs: number | null) => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!(canvas && context) || size.width === 0) {
        return;
      }
      const ratio = window.devicePixelRatio || 1;
      if (canvas.width !== Math.round(size.width * ratio)) {
        canvas.width = Math.round(size.width * ratio);
        canvas.height = Math.round(size.height * ratio);
      }
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      drawHighway(
        context,
        highwayGeometry(size.width, size.height, leftHanded),
        {
          ...latest.current,
          burstStarts: burstStarts.current,
          displayFont: displayFont.current,
          fontFamily: fontFamily.current,
          nowMs,
        }
      );
      if (nowMs !== null && containerRef.current) {
        containerRef.current.dataset.nowMs = nowMs.toFixed(3);
      }
    },
    [leftHanded, size]
  );

  useEffect(() => {
    if (!getNow) {
      burstStarts.current.clear();
      draw(null);
      return;
    }
    let frame = 0;
    let previous = 0;
    // The frame's own timestamp is steady, so notes move evenly.
    const tick = (frameTime: number) => {
      const now = getNow(frameTime);
      // A frame that came late is a stutter you'd see: worth a log entry.
      if (previous > 0 && frameTime - previous > SLOW_FRAME_MS) {
        debugLog("slow-frame", {
          gapMs: r(frameTime - previous),
          nowMs: r(now),
        });
      }
      previous = frameTime;
      draw(now);
      latest.current.onFrame?.(now);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [draw, getNow]);

  const geometry = highwayGeometry(size.width, size.height, leftHanded);
  // Under the lane's ring, kept clear of the edges so long text fits.
  const feedbackX = Math.min(
    Math.max(
      feedback?.lane ? laneX(feedback.lane, 1, geometry) : geometry.centerX,
      FEEDBACK_HALF_WIDTH
    ),
    size.width - FEEDBACK_HALF_WIDTH
  );

  return (
    <div
      className="relative h-[26rem] overflow-hidden rounded-3xl bg-stage shadow-[0_24px_70px_-24px_rgb(0_0_0/0.9)] ring-1 ring-white/8 sm:h-[30rem]"
      ref={containerRef}
    >
      <canvas
        aria-label="Note highway: notes come toward you, one lane per string"
        className="absolute inset-0 h-full w-full"
        ref={canvasRef}
        role="img"
      />
      {combo && combo.streak > 0 ? (
        <div
          className="pointer-events-none absolute top-3 left-4 flex flex-col"
          key={combo.multiplier}
        >
          <span
            className={`fade-in zoom-in-50 animate-in font-extrabold font-heading text-5xl tabular-nums leading-none duration-300 ${
              combo.onFire
                ? "text-stage-gradient"
                : "text-white [text-shadow:0_0_12px_rgb(255_255_255/0.35)]"
            }`}
          >
            ×{combo.multiplier}
          </span>
          <span className="mt-1 font-medium text-muted-foreground text-xs tabular-nums">
            {combo.streak} in a row
            {combo.onFire ? (
              <span className="text-gold"> · on fire!</span>
            ) : null}
          </span>
        </div>
      ) : null}
      {feedback ? (
        <div
          aria-live="polite"
          className="fade-in zoom-in-90 absolute flex -translate-x-1/2 animate-in flex-col items-center whitespace-nowrap duration-150"
          key={feedback.key}
          style={{
            left: feedbackX,
            top: geometry.strikeY + geometry.radius + 26,
          }}
        >
          <span
            className={`font-extrabold font-heading text-2xl ${TONE_CLASSES[feedback.tone]}`}
          >
            {feedback.label}
          </span>
          <span className="text-muted-foreground text-xs tabular-nums">
            {feedback.detail}
          </span>
        </div>
      ) : null}
    </div>
  );
}
