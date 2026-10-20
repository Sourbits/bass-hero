"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { playNote } from "@/audio/play-note";
import { describeAudioError } from "@/components/audio-errors";
import { Fretboard } from "@/components/fretboard";
import {
  type AudioSession,
  isDemoMode,
  startAudioSession,
} from "@/components/game/audio-session";
import { LevelPicker } from "@/components/game/level-game";
import { STRING_COLORS } from "@/components/string-colors";
import { Button } from "@/components/ui/button";
import { EAR_TRAINING } from "@/config/ear-training";
import { type Level, levelSettings } from "@/game/difficulty";
import {
  type EarPrompt,
  type EarResult,
  earOutcomes,
  earPrompts,
  judgeAnswer,
  scoreEar,
} from "@/game/ear-training";
import { saveOutcomes } from "@/game/note-stats";
import { type Position, positionKey, positionMidi } from "@/game/positions";
import {
  loadProgress,
  NEW_PROGRESS,
  type Progress,
  saveProgress,
} from "@/game/progress";
import { onDataReplaced } from "@/game/storage-events";
import { detectPlayedNotes, type PlayedNote } from "@/onset/played-notes";
import { midiToName } from "@/pitch/notes";

/** How long to show a found or revealed note before the next, in ms. */
const ANSWER_PAUSE_MS = 1800;
const REVEAL_PAUSE_MS = 2800;

type Stage =
  | "answered"
  | "done"
  | "error"
  | "idle"
  | "listen"
  | "prompt"
  | "revealed"
  | "starting";

interface View {
  hint: string;
  index: number;
  results: EarResult[];
  stage: Stage;
  tries: number;
}

const START_VIEW: View = {
  hint: "",
  index: 0,
  results: [],
  stage: "idle",
  tries: 0,
};

const hear = (position: Position) => playNote(positionMidi(position));

function whereText({ fret, string }: Position) {
  return `${string} string, ${fret === 0 ? "open" : `fret ${fret}`}`;
}

function NoteReveal({ prompt, found }: { found: boolean; prompt: EarPrompt }) {
  return (
    <div className="flex flex-col items-center gap-3">
      <p
        className={`font-bold text-2xl ${found ? "text-emerald-600" : "text-foreground"}`}
      >
        {found ? "✓ " : "It was "}
        <span style={{ color: STRING_COLORS[prompt.position.string] }}>
          {midiToName(prompt.midi).replace("#", "♯")}
        </span>
      </p>
      <p className="text-muted-foreground">{whereText(prompt.position)}</p>
      <Fretboard
        frets={Math.max(5, prompt.position.fret)}
        highlighted={new Set([positionKey(prompt.position)])}
        onTap={hear}
        tapMode="hear"
      />
    </div>
  );
}

function TriesDots({ tries }: { tries: number }) {
  return (
    <span>
      <span aria-hidden="true">
        {Array.from({ length: EAR_TRAINING.maxTries }, (_, index) =>
          index < tries ? "●" : "○"
        ).join(" ")}
      </span>
      <span className="sr-only">
        {tries} of {EAR_TRAINING.maxTries} tries used
      </span>
    </span>
  );
}

function Results({ results }: { results: EarResult[] }) {
  const score = scoreEar(results);
  const toWork = results.filter(({ solved, tries }) => !solved || tries > 1);
  return (
    <section className="flex flex-col gap-3 rounded-2xl border p-6">
      <h2 className="font-semibold text-xl">Round complete</h2>
      <p>
        Found {score.firstTry} of {results.length} on the first try. Score{" "}
        {score.score.toLocaleString("en-US")}, longest streak {score.maxStreak}.
      </p>
      {toWork.length > 0 ? (
        <>
          <h3 className="font-semibold">Notes to listen to again</h3>
          <ul className="flex flex-wrap gap-2">
            {toWork.map(({ prompt }, index) => (
              <ReplayChip
                key={`${positionKey(prompt.position)}-${String(index)}`}
                prompt={prompt}
              />
            ))}
          </ul>
        </>
      ) : (
        <p className="font-medium text-emerald-600">All on the first try!</p>
      )}
    </section>
  );
}

function ReplayChip({ prompt }: { prompt: EarPrompt }) {
  const listen = useCallback(() => hear(prompt.position), [prompt.position]);
  return (
    <li>
      <Button onClick={listen} size="sm" variant="outline">
        🔊 {midiToName(prompt.midi).replace("#", "♯")} ·{" "}
        {whereText(prompt.position)}
      </Button>
    </li>
  );
}

/**
 * Ear training: the game plays a note, then listens while you find it on
 * your bass. Hints say higher or lower; after three tries it shows where the
 * note is. It only listens once its own note has faded, so it works without
 * headphones.
 */
export function EarTraining() {
  const [progress, setProgress] = useState<Progress>(NEW_PROGRESS);
  const [view, setView] = useState<View>(START_VIEW);
  const [error, setError] = useState("");

  const sessionRef = useRef<AudioSession | null>(null);
  const promptsRef = useRef<EarPrompt[]>([]);
  const viewRef = useRef<View>(START_VIEW);
  const listenFromRef = useRef(Number.POSITIVE_INFINITY);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const demoRef = useRef<boolean>(false);
  const onNoteRef = useRef<(played: PlayedNote) => void>(() => undefined);

  useEffect(() => {
    const load = () => setProgress(loadProgress());
    load();
    return onDataReplaced(load);
  }, []);

  const update = useCallback((next: View) => {
    viewRef.current = next;
    setView(next);
  }, []);

  const later = useCallback((ms: number, action: () => void) => {
    timersRef.current.push(setTimeout(action, ms));
  }, []);

  const stopAll = useCallback(async () => {
    for (const timer of timersRef.current) {
      clearTimeout(timer);
    }
    timersRef.current = [];
    const session = sessionRef.current;
    sessionRef.current = null;
    await session?.stop();
  }, []);

  useEffect(
    () => () => {
      stopAll().catch(() => undefined);
    },
    [stopAll]
  );

  /** Plays the current note, then starts listening once it has faded. */
  const playPrompt = useCallback(() => {
    const session = sessionRef.current;
    const prompt = promptsRef.current[viewRef.current.index];
    if (!(session && prompt)) {
      return;
    }
    const at = session.clock.now() + 150;
    session.playAloud([{ midi: prompt.midi, timeMs: at }]);
    listenFromRef.current = at + EAR_TRAINING.listenAfterMs;
    update({ ...viewRef.current, stage: "prompt" });
    later(EAR_TRAINING.listenAfterMs + 150, () => {
      if (viewRef.current.stage === "prompt") {
        update({ ...viewRef.current, stage: "listen" });
      }
    });
    if (demoRef.current) {
      // The demo player gets every third note wrong once, then finds it.
      const answer = listenFromRef.current + 500;
      const first =
        viewRef.current.index % 3 === 2 ? prompt.midi + 2 : prompt.midi;
      session.schedulePlucks?.([
        { midi: first, timeMs: answer },
        ...(first === prompt.midi
          ? []
          : [{ midi: prompt.midi, timeMs: answer + 1200 }]),
      ]);
    }
  }, [later, update]);

  const finishRound = useCallback(
    (finished: EarResult[]) => {
      update({ ...viewRef.current, results: finished, stage: "done" });
      if (!demoRef.current) {
        saveOutcomes(earOutcomes(finished));
      }
      stopAll().catch(() => undefined);
    },
    [stopAll, update]
  );

  /** Moves on to the next note, or ends the round. */
  const advance = useCallback(
    (sofar: EarResult[]) => {
      const next = viewRef.current.index + 1;
      if (next >= promptsRef.current.length) {
        finishRound(sofar);
        return;
      }
      update({
        hint: "",
        index: next,
        results: sofar,
        stage: "prompt",
        tries: 0,
      });
      playPrompt();
    },
    [finishRound, playPrompt, update]
  );

  onNoteRef.current = ({ note, onsetMs }: PlayedNote) => {
    const { current } = viewRef;
    const prompt = promptsRef.current[current.index];
    const listening = current.stage === "listen" || current.stage === "prompt";
    if (!(note && prompt && listening) || onsetMs < listenFromRef.current) {
      return;
    }
    const tries = current.tries + 1;
    const verdict = judgeAnswer(prompt.midi, note.midi);
    if (verdict === "correct") {
      const results = [...current.results, { prompt, solved: true, tries }];
      update({ ...current, results, stage: "answered", tries });
      later(ANSWER_PAUSE_MS, () => advance(results));
      return;
    }
    if (tries >= EAR_TRAINING.maxTries) {
      const results = [...current.results, { prompt, solved: false, tries }];
      update({ ...current, results, stage: "revealed", tries });
      // Play it once more, now that you know where it is.
      sessionRef.current?.playAloud([
        {
          midi: prompt.midi,
          timeMs: (sessionRef.current?.clock.now() ?? 0) + 300,
        },
      ]);
      later(REVEAL_PAUSE_MS, () => advance(results));
      return;
    }
    const direction = verdict === "higher" ? "↑ Higher" : "↓ Lower";
    const stringHint =
      tries >= EAR_TRAINING.maxTries - 1
        ? ` · It's on the ${prompt.position.string} string`
        : "";
    update({
      ...current,
      hint: `${direction} than ${midiToName(note.midi).replace("#", "♯")}${stringHint}`,
      stage: "listen",
      tries,
    });
  };

  const start = useCallback(async () => {
    setError("");
    const { positions } = levelSettings(progress.current);
    promptsRef.current = earPrompts(positions, EAR_TRAINING.prompts);
    demoRef.current = isDemoMode();
    update({ ...START_VIEW, stage: "starting" });
    try {
      sessionRef.current = await startAudioSession({
        demo: demoRef.current,
        listen: (source) =>
          detectPlayedNotes(source, {
            onNote: (played) => onNoteRef.current(played),
            // Buzz doesn't matter here: this is about finding the note.
          }),
      });
      playPrompt();
    } catch (startError) {
      await stopAll();
      setError(describeAudioError(startError));
      update({ ...START_VIEW, stage: "error" });
    }
  }, [playPrompt, progress, stopAll, update]);

  const stop = useCallback(async () => {
    await stopAll();
    update(START_VIEW);
  }, [stopAll, update]);

  const chooseLevel = useCallback((level: Level) => {
    setProgress((previous) => {
      const next = { ...previous, current: level };
      saveProgress(next);
      return next;
    });
  }, []);

  const { hint, index, results, stage, tries } = view;
  const running = !["done", "error", "idle"].includes(stage);
  const prompt = promptsRef.current[index];
  const score = scoreEar(results);
  const poolSize = levelSettings(progress.current).positions.length;

  return (
    <div className="flex flex-col gap-6">
      <LevelPicker
        details={false}
        disabled={running}
        onChoose={chooseLevel}
        progress={progress}
      />
      <p className="text-muted-foreground text-sm">
        Notes come from the level you pick: {poolSize} of them. The game plays
        one; find it on your bass. No names, no map: just your ears.
      </p>

      <section className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-2xl border p-6 text-center">
        {running ? (
          <p className="text-muted-foreground text-sm tabular-nums">
            Note {Math.min(index + 1, promptsRef.current.length)} of{" "}
            {promptsRef.current.length} · Score{" "}
            {score.score.toLocaleString("en-US")} · ×{score.multiplier} (
            {score.streak} in a row)
          </p>
        ) : null}
        <StageView hint={hint} prompt={prompt} stage={stage} tries={tries} />
      </section>

      <div className="flex gap-3">
        <Button
          className="flex-1"
          disabled={stage === "starting"}
          onClick={running ? stop : start}
          size="lg"
          variant={running ? "outline" : "default"}
        >
          {running ? "Stop" : "Start a round"}
        </Button>
        {stage === "listen" ? (
          <Button onClick={playPrompt} size="lg" variant="outline">
            🔊 Hear it again
          </Button>
        ) : null}
      </div>
      {stage === "error" ? (
        <p className="text-center text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {stage === "done" ? <Results results={results} /> : null}
    </div>
  );
}

function StageView({
  hint,
  prompt,
  stage,
  tries,
}: {
  hint: string;
  prompt: EarPrompt | undefined;
  stage: Stage;
  tries: number;
}) {
  if (prompt && (stage === "answered" || stage === "revealed")) {
    return <NoteReveal found={stage === "answered"} prompt={prompt} />;
  }
  if (stage === "prompt") {
    return <p className="animate-pulse font-bold text-3xl">🔊 Listen…</p>;
  }
  if (stage === "listen") {
    return (
      <div aria-live="polite" className="flex flex-col items-center gap-2">
        <p className="font-bold text-2xl">Your turn: play the note you heard</p>
        <p className="font-semibold text-amber-600 text-lg">{hint}</p>
        <p className="text-muted-foreground">
          <TriesDots tries={tries} />
        </p>
      </div>
    );
  }
  if (stage === "starting") {
    return <p className="text-muted-foreground">Starting…</p>;
  }
  return (
    <p className="max-w-sm text-muted-foreground">
      Press Start. Each round is {EAR_TRAINING.prompts} notes. You get{" "}
      {EAR_TRAINING.maxTries} tries per note, with a hint after each miss.
    </p>
  );
}
