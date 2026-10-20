"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  clearLocalData,
  collectLocalData,
  replaceLocalData,
} from "@/account/local-data";
import { reportAchievement } from "@/game/achievements";
import {
  EMPTY_SAVED_DATA,
  mergeSavedData,
  parseSavedData,
  type SavedData,
} from "@/game/saved-data";
import { LOCAL_CHANGE_EVENT } from "@/game/storage-events";
import { authClient } from "@/lib/auth-client";

/** How long after a change to wait before saving it, in ms. */
const SAVE_DELAY_MS = 1500;

export type SyncStatus =
  | { kind: "error"; message: string }
  | { kind: "idle" }
  | { at: Date; kind: "saved" }
  | { kind: "saving" };

export interface Account {
  /** True until we know whether someone is signed in. */
  loading: boolean;
  /**
   * Saves any last changes, signs out and clears this browser's copy of the
   * progress. If the save fails it stays signed in and returns false, unless
   * told to sign out anyway.
   */
  signOut: (anyway?: boolean) => Promise<boolean>;
  status: SyncStatus;
  /** Saves this browser's progress to the account now. */
  syncNow: () => Promise<void>;
  user: { email: string; id: string; name: string } | null;
}

const AccountContext = createContext<Account>({
  loading: true,
  signOut: () => Promise.resolve(false),
  status: { kind: "idle" },
  syncNow: () => Promise.resolve(),
  user: null,
});

/** The signed-in player, if any, and the state of their saved progress. */
export function useAccount() {
  return useContext(AccountContext);
}

/** JSON with object keys sorted, to compare two copies of saved data. */
function sortedJson(value: unknown) {
  return JSON.stringify(value, (_key, inner: unknown) =>
    inner && typeof inner === "object" && !Array.isArray(inner)
      ? Object.fromEntries(
          Object.entries(inner).sort(([a], [b]) => a.localeCompare(b))
        )
      : inner
  );
}

async function requestPlayerData(init?: RequestInit): Promise<SavedData> {
  const response = await fetch("/api/player-data", {
    ...init,
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) {
    throw new Error(`The server said ${response.status}.`);
  }
  return parseSavedData(await response.json()) ?? EMPTY_SAVED_DATA;
}

/**
 * Keeps a signed-in player's progress in their account. On sign-in it merges
 * the account with this browser's progress (keeping the best of both), then
 * saves each change a moment after it happens. Guests keep playing from the
 * browser alone, as before.
 */
export function AccountProvider({ children }: { children: ReactNode }) {
  const { data, isPending } = authClient.useSession();
  const user = data?.user ?? null;
  const userId = user?.id ?? null;
  const [status, setStatus] = useState<SyncStatus>({ kind: "idle" });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const save = useCallback(async (merge: boolean): Promise<boolean> => {
    setStatus({ kind: "saving" });
    try {
      const local = collectLocalData();
      const base = merge
        ? mergeSavedData(await requestPlayerData(), local)
        : local;
      const saved = await requestPlayerData({
        body: JSON.stringify(base),
        method: "PUT",
      });
      // Only touch this browser's copy if the account had something newer.
      if (sortedJson(saved) !== sortedJson(local)) {
        replaceLocalData(saved);
      }
      if (merge) {
        reportAchievement({ kind: "signed-in" });
      }
      setStatus({ at: new Date(), kind: "saved" });
      return true;
    } catch (error) {
      setStatus({
        kind: "error",
        message: error instanceof Error ? error.message : "Couldn't save.",
      });
      return false;
    }
  }, []);

  // On sign-in, or on loading the page signed in: merge and save.
  useEffect(() => {
    if (userId) {
      save(true).catch(() => undefined);
    } else {
      setStatus({ kind: "idle" });
    }
  }, [save, userId]);

  // Then save each change a moment after it happens.
  useEffect(() => {
    if (!userId) {
      return;
    }
    const onChange = () => {
      if (timer.current) {
        clearTimeout(timer.current);
      }
      timer.current = setTimeout(() => {
        save(false).catch(() => undefined);
      }, SAVE_DELAY_MS);
    };
    window.addEventListener(LOCAL_CHANGE_EVENT, onChange);
    return () => {
      window.removeEventListener(LOCAL_CHANGE_EVENT, onChange);
      if (timer.current) {
        clearTimeout(timer.current);
      }
    };
  }, [save, userId]);

  const signOut = useCallback(
    async (anyway = false) => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      if (!((await save(false)) || anyway)) {
        return false;
      }
      await authClient.signOut();
      clearLocalData();
      return true;
    },
    [save]
  );

  const syncNow = useCallback(async () => {
    await save(true);
  }, [save]);

  const value = useMemo<Account>(
    () => ({
      loading: isPending,
      signOut,
      status,
      syncNow,
      user: user ? { email: user.email, id: user.id, name: user.name } : null,
    }),
    [isPending, signOut, status, syncNow, user]
  );

  return (
    <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
  );
}
