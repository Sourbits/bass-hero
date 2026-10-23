import { type Clock, createAudioClock } from "@/audio/audio-clock";
import type { AudioSource } from "@/audio/audio-source";
import { createMicrophoneSource } from "@/audio/microphone-source";
import { clickAt, pluckAt } from "@/audio/play-note";
import { createPluckSource } from "@/audio/pluck-source";
import { debugLog, r } from "@/debug/debug-log";
import type { DemoPluck } from "@/game/demo";
import { midiToFrequency } from "@/pitch/notes";

export interface AudioSession {
  /** Plays metronome clicks at times on the game clock. */
  click: (beats: { accent: boolean; timeMs: number }[]) => void;
  /** The game clock: AudioContext time in ms. */
  clock: Clock;
  /**
   * Plays notes out loud at times on the game clock: the guide tone. The mic
   * hears it too, so it's meant for headphones.
   */
  playAloud: (plucks: DemoPluck[]) => void;
  /** In demo mode, schedules synthesized plucks; null with a real mic. */
  schedulePlucks: ((plucks: DemoPluck[]) => void) | null;
  stop: () => Promise<void>;
}

export interface AudioSessionOptions {
  /** Use the silent synthesized bass instead of the mic. */
  demo: boolean;
  /** Subscribes detectors to the source; returns a function that unsubscribes. */
  listen: (source: AudioSource) => () => void;
}

/**
 * Opens one AudioContext for the input and the game clock, so pluck times
 * and the screen share a clock. Call it from a click: the AudioContext is
 * created before anything is awaited, while the click still counts.
 */
export async function startAudioSession({
  demo,
  listen,
}: AudioSessionOptions): Promise<AudioSession> {
  const context = new AudioContext({ latencyHint: "interactive" });
  const plucks = demo ? createPluckSource({ context }) : null;
  const source = plucks ?? createMicrophoneSource({ context });
  const stopListening = listen(source);

  let stopped = false;
  const stop = async () => {
    if (stopped) {
      return;
    }
    stopped = true;
    stopListening();
    await source.stop();
    await context.close();
  };

  try {
    await source.start();
  } catch (error) {
    await stop();
    throw error;
  }
  debugLog("audio", {
    baseLatencyMs: r(context.baseLatency * 1000),
    demo,
    outputLatencyMs: r(context.outputLatency * 1000),
    sampleRate: context.sampleRate,
  });

  return {
    click: (beats) => {
      for (const { accent, timeMs } of beats) {
        clickAt(context, timeMs / 1000, accent);
      }
    },
    clock: createAudioClock(context),
    playAloud: (aloud) => {
      for (const { midi, timeMs } of aloud) {
        pluckAt(context, midi, timeMs / 1000);
      }
    },
    schedulePlucks: plucks
      ? (demoPlucks) =>
          plucks.schedule(
            demoPlucks.map(({ midi, timeMs }) => ({
              frequency: midiToFrequency(midi),
              timeMs,
            }))
          )
      : null,
    stop,
  };
}

/** Whether the page was opened with ?demo. */
export function isDemoMode() {
  return new URLSearchParams(window.location.search).has("demo");
}
