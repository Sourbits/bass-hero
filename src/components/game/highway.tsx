"use client";

import { useEffect, useRef, useState } from "react";
import { CIRCLE_RADIUS, circleX, highwayLayout } from "@/game/layout";

export interface HighwayNote {
  color: string;
  key: string;
  label: string;
  /** "hit" circles pop and vanish; "missed" ones fade and slide on. */
  state: "hit" | "missed" | "upcoming";
  targetMs: number;
}

export interface HighwayFeedback {
  detail: string;
  /** Changes for every new piece of feedback, so it animates again. */
  key: string;
  label: string;
  tone: "good" | "miss" | "neutral" | "perfect";
}

interface HighwayProps {
  feedback: HighwayFeedback | null;
  /** The game clock, or null when nothing is playing. */
  getNow: (() => number) | null;
  notes: HighwayNote[];
  /** Called every animation frame with the clock time used to draw it. */
  onFrame?: (nowMs: number) => void;
}

const TONE_CLASSES: Record<HighwayFeedback["tone"], string> = {
  good: "text-sky-600",
  miss: "text-red-600",
  neutral: "text-foreground",
  perfect: "text-emerald-600",
};

const STATE_CLASSES: Record<HighwayNote["state"], string> = {
  hit: "scale-150 opacity-0",
  missed: "opacity-35 grayscale",
  upcoming: "",
};

/**
 * Circles slide right to left into a fixed target outline. Every animation
 * frame, each circle is placed from the game clock with circleX(), so its
 * center is on the outline exactly at its target time.
 */
export function Highway({ feedback, getNow, notes, onFrame }: HighwayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const onFrameRef = useRef(onFrame);
  const widthRef = useRef(0);
  const [width, setWidth] = useState(0);

  onFrameRef.current = onFrame;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      widthRef.current = entry?.contentRect.width ?? 0;
      setWidth(widthRef.current);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!getNow) {
      return;
    }
    let frame = 0;
    const draw = () => {
      const now = getNow();
      const layout = highwayLayout(widthRef.current);
      const container = containerRef.current;
      if (container) {
        container.dataset.nowMs = now.toFixed(3);
        container.dataset.targetX = String(layout.targetX);
      }
      const circles =
        container?.querySelectorAll<HTMLElement>("[data-target-ms]") ?? [];
      for (const circle of circles) {
        const x = circleX(Number(circle.dataset.targetMs), now, layout);
        const onScreen =
          x > -2 * CIRCLE_RADIUS && x < layout.width + 2 * CIRCLE_RADIUS;
        circle.style.transform = `translate3d(${x - CIRCLE_RADIUS}px, 0, 0)`;
        circle.style.visibility = onScreen ? "visible" : "hidden";
      }
      onFrameRef.current?.(now);
      frame = requestAnimationFrame(draw);
    };
    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [getNow]);

  const { targetX } = highwayLayout(width);

  return (
    <div
      className="relative h-40 overflow-hidden rounded-2xl border bg-muted/40"
      ref={containerRef}
    >
      <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
      <div
        className="absolute top-1/2 rounded-full border-4 border-foreground/70"
        data-target-outline
        style={{
          height: 2 * CIRCLE_RADIUS,
          left: targetX - CIRCLE_RADIUS,
          marginTop: -CIRCLE_RADIUS,
          width: 2 * CIRCLE_RADIUS,
        }}
      />
      {getNow
        ? notes.map((note) => (
            <div
              className={`absolute top-1/2 left-0 flex items-center justify-center rounded-full font-semibold text-sm text-white shadow-sm transition-[opacity,scale,filter] duration-200 ${STATE_CLASSES[note.state]}`}
              data-target-ms={note.targetMs}
              key={note.key}
              style={{
                backgroundColor: note.color,
                height: 2 * CIRCLE_RADIUS,
                marginTop: -CIRCLE_RADIUS,
                visibility: "hidden",
                width: 2 * CIRCLE_RADIUS,
              }}
            >
              {note.label}
            </div>
          ))
        : null}
      {feedback ? (
        <div
          aria-live="polite"
          className="fade-in zoom-in-90 absolute top-2 flex -translate-x-1/2 animate-in flex-col items-center whitespace-nowrap duration-150"
          key={feedback.key}
          style={{ left: targetX }}
        >
          <span className={`font-bold text-lg ${TONE_CLASSES[feedback.tone]}`}>
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
