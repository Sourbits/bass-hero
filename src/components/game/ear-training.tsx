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
import {
  ResultStat,
  ResultsCard,
  UnlockedAchievements,
} from "@/components/game/results";
import { Kbd } from "@/components/kbd";
import { useSettings } from "@/components/settings-provider";
import { STRING_COLORS } from "@/components/string-colors";
import { Button } from "@/components/ui/button";
import { releaseFocus, useShortcuts } from "@/components/use-shortcuts";
import type { TierId } from "@/config/difficulty";
import { EAR_LEVELS, EAR_TRAINING } from "@/config/ear-training";
import { KEYS } from "@/config/shortcuts";
import { debugLog, r } from "@/debug/debug-log";
import { reportAchievement } from "@/game/achievements";
import {
  type EarPrompt,
  type EarResult,
  earLevelPositions,
  earOutcomes,
  earPrompts,
  judgeAnswer,
  scoreEar,
} from "@/game/ear-training";
import { saveOutcomes } from "@/game/note-stats";
import { type Position, positionKey, positionMidi } from "@/game/positions";
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
        className={`font-bold text-2xl ${found ? "text-good" : "text-foreground"}`}
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

function Results({
  results,
  unlocked,
}: {
  results: EarResult[];
  unlocked: string[];
}) {
  const score = scoreEar(results);
  const toWork = results.filter(({ solved, tries }) => !solved || tries > 1);
  return (
    <ResultsCard>
      <div className="flex flex-col items-center gap-2 text-center">
        <h2 className="font-semibold text-muted-foreground text-sm uppercase tracking-wide">
          Round complete
        </h2>
        <p className="font-extrabold font-heading text-5xl text-gold tabular-nums">
          {score.score.toLocaleString("en-US")}
        </p>
      </div>
      <dl className="grid grid-cols-3 gap-2">
        <ResultStat
          label="First try"
          tone="text-good"
          value={`${score.firstTry} / ${results.length}`}
        />
        <ResultStat
          label="Found"
          value={`${results.filter(({ solved }) => solved).length} / ${results.length}`}
        />
        <ResultStat label="Longest streak" value={score.maxStreak} />
      </dl>
      <UnlockedAchievements ids={unlocked} />
      {toWork.length > 0 ? (
        <div className="flex flex-col items-center gap-2">
          <h3 className="font-semibold text-sm">Listen to these again</h3>
          <ul className="flex flex-wrap justify-center gap-2">
            {toWork.map(({ prompt }, index) => (
              <ReplayChip
                key={`${positionKey(prompt.position)}-${String(index)}`}
                prompt={prompt}
              />
            ))}
          </ul>
        </div>
      ) : (
        <p className="text-center font-semibold text-good">
          All on the first try!
        </p>
      )}
    </ResultsCard>
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

/** Why ear training ignored a pluck, for the debug log. */
function ignoredReason(
  hasNote: boolean,
  listening: boolean,
  onsetMs: number,
  listenFromMs: number
) {
  if (!hasNote) {
    return "no clear note";
  }
  if (!listening) {
    return "not listening";
  }
  return onsetMs < listenFromMs
    ? "before listening started: maybe the game's own note"
    : "no prompt";
}

function EarLevelButton({
  level,
  onChoose,
  selected,
}: {
  level: number;
  onChoose: (level: number) => void;
  selected: boolean;
}) {
  const choose = useCallback(() => onChoose(level), [level, onChoose]);
  const config = EAR_LEVELS[level - 1];
  return (
    <button
      aria-label={`Ear level ${level}: ${config?.name ?? ""}`}
      aria-pressed={selected}
      className={`rounded-xl border py-2 font-bold font-heading transition-colors ${
        selected
          ? "border-gold bg-gold/12 ring-1 ring-gold/50"
          : "bg-card hover:bg-secondary"
      }`}
      onClick={choose}
      type="button"
    >
      {level}
    </button>
  );
}

/** Ear training's own ten levels, from open strings to the whole neck. */
function EarLevelPicker({
  disabled,
  level,
  onChoose,
}: {
  disabled: boolean;
  level: number;
  onChoose: (level: number) => void;
}) {
  const config = EAR_LEVELS[level - 1];
  const notes = earLevelPositions(level).length;
  return (
    <fieldset className="flex flex-col gap-3" disabled={disabled}>
      <legend className="sr-only">Ear training level</legend>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-10">
        {EAR_LEVELS.map((entry, index) => (
          <EarLevelButton
            key={entry.name}
            level={index + 1}
            onChoose={onChoose}
            selected={index + 1 === level}
          />
        ))}
      </div>
      {config ? (
        <p className="text-sm">
          <span className="font-bold font-heading">{config.name}</span>{" "}
          <span className="text-muted-foreground">
            · {config.description} {notes} notes. No names, no map: just your
            ears.
          </span>
        </p>
      ) : null}
    </fieldset>
  );
}

/**
 * Ear training: the game plays a note, then listens while you find it on
 * your bass. Hints say higher or lower; after three tries it shows where the
 * note is. It starts listening just after its own note, once the mic has
 * heard it, so it works without headphones.
 */
export function EarTraining() {
  const { settings, update: updateSettings } = useSettings();
  const { earLevel } = settings;
  const [view, setView] = useState<View>(START_VIEW);
  const [error, setError] = useState("");

  const sessionRef = useRef<AudioSession | null>(null);
  const promptsRef = useRef<EarPrompt[]>([]);
  const viewRef = useRef<View>(START_VIEW);
  const listenFromRef = useRef(Number.POSITIVE_INFINITY);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const demoRef = useRef<boolean>(false);
  /** Achievements the last round unlocked, for its results. */
  const [unlocked, setUnlocked] = useState<string[]>([]);
  /** The tier the round's notes came from, for achievements. */
  const tierRef = useRef<TierId>("easy");
  const onNoteRef = useRef<(played: PlayedNote) => void>(() => undefined);

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
    debugLog("ear-prompt", {
      index: viewRef.current.index,
      listenFromMs: r(listenFromRef.current),
      note: midiToName(prompt.midi),
      playedAtMs: r(at),
      where: whereText(prompt.position),
    });
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
        const found = reportAchievement({
          at: new Date(),
          firstTries: finished.map(
            (result) => result.solved && result.tries === 1
          ),
          kind: "ear-round",
          tier: tierRef.current,
        });
        setUnlocked(found);
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

  onNoteRef.current = (played: PlayedNote) => {
    const { note, onsetMs } = played;
    const { current } = viewRef;
    const prompt = promptsRef.current[current.index];
    const listening = current.stage === "listen" || current.stage === "prompt";
    const heard = {
      buzzDb: r(played.buzzDb),
      heard: note ? `${note.name}${note.octave}` : null,
      hz: r(note?.frequency, 2),
      onsetMs: r(onsetMs),
      peak: r(played.peak, 3),
      prompt: prompt ? midiToName(prompt.midi) : null,
    };
    if (!(note && prompt && listening) || onsetMs < listenFromRef.current) {
      debugLog("ear-pluck", {
        ...heard,
        ignored: ignoredReason(
          Boolean(note),
          listening,
          onsetMs,
          listenFromRef.current
        ),
      });
      return;
    }
    const tries = current.tries + 1;
    const verdict = judgeAnswer(prompt.midi, note.midi);
    debugLog("ear-pluck", { ...heard, try: tries, verdict });
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
    releaseFocus();
    setError("");
    setUnlocked([]);
    tierRef.current = EAR_LEVELS[earLevel - 1]?.tier ?? "easy";
    promptsRef.current = earPrompts(
      earLevelPositions(earLevel),
      EAR_TRAINING.prompts
    );
    debugLog("ear-start", {
      level: `ear ${earLevel}`,
      prompts: promptsRef.current.map(({ midi }) => midiToName(midi)),
    });
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
  }, [earLevel, playPrompt, stopAll, update]);

  const stop = useCallback(async () => {
    await stopAll();
    update(START_VIEW);
  }, [stopAll, update]);

  const chooseLevel = useCallback(
    (level: number) => updateSettings({ earLevel: level }),
    [updateSettings]
  );

  const { hint, index, results, stage, tries } = view;
  const running = !["done", "error", "idle"].includes(stage);
  const prompt = promptsRef.current[index];
  const score = scoreEar(results);

  useShortcuts({
    [KEYS.hearAgain]: stage === "listen" && playPrompt,
    [KEYS.start]: !running && stage !== "starting" && start,
    [KEYS.stop]: running && stop,
  });

  return (
    <div className="flex flex-col gap-6">
      <EarLevelPicker
        disabled={running}
        level={earLevel}
        onChoose={chooseLevel}
      />

      <section className="flex min-h-72 flex-col items-center justify-center gap-4 rounded-3xl border bg-card p-6 text-center">
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
          variant={running ? "outline" : "stage"}
        >
          {running ? "Stop" : "Start a round"}
          <Kbd>{running ? "Esc" : "Space"}</Kbd>
        </Button>
        {stage === "listen" ? (
          <Button onClick={playPrompt} size="lg" variant="outline">
            🔊 Hear it again
            <Kbd>R</Kbd>
          </Button>
        ) : null}
      </div>
      {stage === "error" ? (
        <p className="text-center text-destructive text-sm" role="alert">
          {error}
        </p>
      ) : null}
      {stage === "done" ? (
        <Results results={results} unlocked={unlocked} />
      ) : null}
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
        <p className="font-semibold text-gold text-lg">{hint}</p>
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
