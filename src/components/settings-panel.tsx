"use client";

import Link from "next/link";
import {
  type ChangeEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useState,
} from "react";
import { useSettings } from "@/components/settings-provider";
import { SHORTCUT_HELP } from "@/config/shortcuts";
import {
  type GameOptions,
  loadProgress,
  NEW_PROGRESS,
  saveProgress,
} from "@/game/progress";
import { onDataReplaced } from "@/game/storage-events";
import { loadLatencyOffset } from "@/timing/latency-setting";

function Toggle({
  checked,
  children,
  label,
  onChange,
}: {
  checked: boolean;
  children?: ReactNode;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  const change = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => onChange(event.target.checked),
    [onChange]
  );
  return (
    <label className="flex items-start gap-3">
      <input
        checked={checked}
        className="mt-1 size-4 shrink-0 accent-foreground"
        onChange={change}
        type="checkbox"
      />
      <span className="flex flex-col gap-0.5">
        <span className="font-medium">{label}</span>
        {children ? (
          <span className="text-muted-foreground text-sm">{children}</span>
        ) : null}
      </span>
    </label>
  );
}

function Section({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section className="flex flex-col gap-4 rounded-3xl border bg-card p-5">
      <h2 className="font-semibold text-lg">{title}</h2>
      {children}
    </section>
  );
}

function LevelOptions() {
  const [options, setOptions] = useState<GameOptions>(NEW_PROGRESS.options);

  useEffect(() => {
    const load = () => setOptions(loadProgress().options);
    load();
    return onDataReplaced(load);
  }, []);

  const set = useCallback((name: keyof GameOptions, value: boolean) => {
    const progress = loadProgress();
    const next = { ...progress.options, [name]: value };
    saveProgress({ ...progress, options: next });
    setOptions(next);
  }, []);
  const setCountBuzz = useCallback(
    (value: boolean) => set("countBuzz", value),
    [set]
  );
  const setGuideTone = useCallback(
    (value: boolean) => set("guideTone", value),
    [set]
  );
  const setShowFretboard = useCallback(
    (value: boolean) => set("showFretboardAlways", value),
    [set]
  );

  return (
    <Section title="Levels">
      <p className="text-muted-foreground text-sm">
        These are also under the level picker.
      </p>
      <Toggle
        checked={options.countBuzz}
        label="Count fret buzz as a miss"
        onChange={setCountBuzz}
      >
        Notes should ring clean. The tuner&apos;s buzz meter shows how yours
        measure.
      </Toggle>
      <Toggle
        checked={options.guideTone}
        label="Guide tone"
        onChange={setGuideTone}
      >
        Hear each note as it reaches the ring. Use headphones, or the mic will
        hear it too.
      </Toggle>
      <Toggle
        checked={options.showFretboardAlways}
        label="Always show the fretboard map"
        onChange={setShowFretboard}
      >
        Hard and Demon hide it, so you play from memory.
      </Toggle>
    </Section>
  );
}

function ThisDevice() {
  const [offsetMs, setOffsetMs] = useState<number | null>(null);
  useEffect(() => setOffsetMs(loadLatencyOffset()), []);
  return (
    <Section title="This device">
      <p className="text-sm">
        Latency offset:{" "}
        <span className="font-medium tabular-nums">
          {offsetMs === null ? "…" : `${Math.round(offsetMs)} ms`}
        </span>
        .{" "}
        <Link className="underline underline-offset-4" href="/calibrate">
          Calibrate
        </Link>
      </p>
      <p className="text-muted-foreground text-sm">
        It stays with this device instead of your account, since it depends on
        this device&apos;s mic and speakers.
      </p>
    </Section>
  );
}

function ShortcutList() {
  return (
    <Section title="Keyboard shortcuts">
      {SHORTCUT_HELP.map(({ items, where }) => (
        <div className="flex flex-col gap-2" key={where}>
          <h3 className="font-medium text-muted-foreground text-sm">{where}</h3>
          <dl className="flex flex-col gap-1.5">
            {items.map(({ action, keys }) => (
              <div
                className="flex items-center justify-between gap-4"
                key={action}
              >
                <dt className="text-sm">{action}</dt>
                <dd className="flex shrink-0 gap-1">
                  {keys.map((key) => (
                    <kbd
                      className="min-w-7 rounded border bg-muted px-1.5 py-0.5 text-center font-sans text-xs"
                      key={key}
                    >
                      {key}
                    </kbd>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
      <p className="text-muted-foreground text-sm">
        Shortcuts stay out of the way while you type in a box.
      </p>
    </Section>
  );
}

/** Everything you can set, on one page. */
export function SettingsPanel() {
  const { settings, update } = useSettings();
  const setLeftHanded = useCallback(
    (leftHanded: boolean) => update({ leftHanded }),
    [update]
  );
  return (
    <div className="flex flex-col gap-6">
      <Section title="Playing">
        <Toggle
          checked={settings.leftHanded}
          label="Left-handed mode"
          onChange={setLeftHanded}
        >
          Mirrors everything for a left-handed bass: the fretboard runs from the
          nut on the right, and the highway lanes and tuner strings go G, D, A,
          E from left to right.
        </Toggle>
      </Section>
      <LevelOptions />
      <ThisDevice />
      <ShortcutList />
    </div>
  );
}
