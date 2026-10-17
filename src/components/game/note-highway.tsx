"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { drawHighway, type HighwayGem } from "@/components/game/draw-highway";
import { highwayGeometry, laneX } from "@/game/layout";
import type { BassString } from "@/game/positions";

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
  /** Where to draw beat lines, on the game clock. */
  beatTimesMs: number[];
  feedback: HighwayFeedback | null;
  gems: HighwayGem[];
  /** The game clock, or null when nothing is playing. */
  getNow: (() => number) | null;
  /** Called every animation frame with the clock time used to draw it. */
  onFrame?: (nowMs: number) => void;
  /** Draw a lane and target ring per string. Off for any-string bars. */
  showLanes?: boolean;
}

/** Half the width that feedback text may need, in px. */
const FEEDBACK_HALF_WIDTH = 64;

const TONE_CLASSES: Record<HighwayFeedback["tone"], string> = {
  good: "text-sky-400",
  miss: "text-red-400",
  neutral: "text-white",
  perfect: "text-emerald-400",
};

/**
 * The note highway, drawn on a canvas. Every animation frame, each note is
 * placed from the game clock with projectNote(), so it's exactly on the
 * strike line at its target time.
 */
export function NoteHighway({
  beatTimesMs,
  feedback,
  gems,
  getNow,
  onFrame,
  showLanes = true,
}: NoteHighwayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ height: 0, width: 0 });
  const latest = useRef({ beatTimesMs, gems, onFrame, showLanes });
  const burstStarts = useRef(new Map<string, number>());
  latest.current = { beatTimesMs, gems, onFrame, showLanes };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
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
      drawHighway(context, highwayGeometry(size.width, size.height), {
        ...latest.current,
        burstStarts: burstStarts.current,
        fontFamily: getComputedStyle(canvas).fontFamily,
        nowMs,
      });
      if (nowMs !== null && containerRef.current) {
        containerRef.current.dataset.nowMs = nowMs.toFixed(3);
      }
    },
    [size]
  );

  useEffect(() => {
    if (!getNow) {
      burstStarts.current.clear();
      draw(null);
      return;
    }
    let frame = 0;
    const tick = () => {
      const now = getNow();
      draw(now);
      latest.current.onFrame?.(now);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [draw, getNow]);

  const geometry = highwayGeometry(size.width, size.height);
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
      className="relative h-[26rem] overflow-hidden rounded-2xl bg-zinc-950 sm:h-[30rem]"
      ref={containerRef}
    >
      <canvas
        aria-label="Note highway: notes come toward you, one lane per string"
        className="absolute inset-0 h-full w-full"
        ref={canvasRef}
        role="img"
      />
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
          <span className={`font-bold text-xl ${TONE_CLASSES[feedback.tone]}`}>
            {feedback.label}
          </span>
          <span className="text-xs text-zinc-300 tabular-nums">
            {feedback.detail}
          </span>
        </div>
      ) : null}
    </div>
  );
}
