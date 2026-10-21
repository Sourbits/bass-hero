"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  DEFAULT_SETTINGS,
  loadSettings,
  type PlayerSettings,
  saveSettings,
} from "@/game/player-settings";
import { onDataReplaced } from "@/game/storage-events";

interface SettingsContextValue {
  settings: PlayerSettings;
  /** Changes some settings, and saves them. */
  update: (change: Partial<PlayerSettings>) => void;
}

const SettingsContext = createContext<SettingsContextValue>({
  settings: DEFAULT_SETTINGS,
  update: () => undefined,
});

/** The player's settings, such as left-handed mode, on any screen. */
export function useSettings() {
  return useContext(SettingsContext);
}

/** Holds the player's settings for every screen, and saves changes. */
export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);

  // Saved in the browser, so read after hydration, and again whenever the
  // account replaces it.
  useEffect(() => {
    const load = () => setSettings(loadSettings());
    load();
    return onDataReplaced(load);
  }, []);

  const update = useCallback(
    (change: Partial<PlayerSettings>) => {
      const next = { ...settings, ...change };
      saveSettings(next);
      setSettings(next);
    },
    [settings]
  );

  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}
