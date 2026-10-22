"use client";

import { useCallback, useEffect, useState } from "react";
import type { PlayerSummary } from "@/game/player-summary";

/** Friends changed here: a request sent, accepted, declined or removed. */
export const FRIENDS_CHANGED_EVENT = "bass-hero:friends-changed";

export interface Friend {
  since: number;
  summary: PlayerSummary;
  username: string;
}

export interface FriendRequest {
  at: number;
  username: string;
}

export interface FriendsData {
  friends: Friend[];
  incoming: FriendRequest[];
  outgoing: FriendRequest[];
}

async function send(method: "DELETE" | "POST", username: string) {
  const response = await fetch("/api/friends", {
    body: JSON.stringify({ username }),
    headers: { "Content-Type": "application/json" },
    method,
  });
  const body = (await response.json().catch(() => ({}))) as {
    error?: string;
    message?: string;
  };
  window.dispatchEvent(new Event(FRIENDS_CHANGED_EVENT));
  if (!response.ok) {
    throw new Error(body.error ?? `The server said ${response.status}.`);
  }
  return body.message ?? "";
}

/** Sends a friend request, or accepts theirs. Returns what happened. */
export function addFriend(username: string) {
  return send("POST", username);
}

/** Unfriends, declines a request, or cancels one. */
export async function removeFriend(username: string) {
  await send("DELETE", username);
}

/** Your friends and requests, loaded when enabled and after any change. */
export function useFriends(enabled: boolean) {
  const [data, setData] = useState<FriendsData | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const response = await fetch("/api/friends");
      if (!response.ok) {
        throw new Error(`The server said ${response.status}.`);
      }
      setData((await response.json()) as FriendsData);
      setError(null);
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : "Couldn't load."
      );
    }
  }, []);

  useEffect(() => {
    if (!enabled) {
      setData(null);
      return;
    }
    const onChange = () => {
      reload().catch(() => undefined);
    };
    onChange();
    window.addEventListener(FRIENDS_CHANGED_EVENT, onChange);
    return () => window.removeEventListener(FRIENDS_CHANGED_EVENT, onChange);
  }, [enabled, reload]);

  return { data, error };
}

/** How many friend requests are waiting, for the tab's badge. */
export function useWaitingRequests(enabled: boolean, pathname: string) {
  const [count, setCount] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: pathname is there to check again on each page change.
  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    const check = async () => {
      try {
        const response = await fetch("/api/friends?only=requests");
        if (response.ok) {
          const { incoming } = (await response.json()) as { incoming: number };
          setCount(incoming);
        }
      } catch {
        // The badge can wait for the next check.
      }
    };
    const onChange = () => {
      check().catch(() => undefined);
    };
    onChange();
    window.addEventListener(FRIENDS_CHANGED_EVENT, onChange);
    window.addEventListener("focus", onChange);
    return () => {
      window.removeEventListener(FRIENDS_CHANGED_EVENT, onChange);
      window.removeEventListener("focus", onChange);
    };
  }, [enabled, pathname]);

  return count;
}
