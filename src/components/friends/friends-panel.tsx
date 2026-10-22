"use client";

import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { collectLocalData } from "@/account/local-data";
import { UsernameForm } from "@/components/account/account-panel";
import { useAccount } from "@/components/account/account-provider";
import { AchievementCard } from "@/components/achievements-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ACHIEVEMENT_GROUPS, ACHIEVEMENTS } from "@/game/achievement-list";
import { type PlayerSummary, summarizePlayer } from "@/game/player-summary";
import { onDataReplaced } from "@/game/storage-events";
import { FullStats, ShortStats, whenText } from "./friend-stats";
import {
  addFriend,
  type Friend,
  type FriendRequest,
  type FriendsData,
  removeFriend,
  useFriends,
} from "./friends-api";

function Card({ children }: { children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-2xl border p-5">
      {children}
    </section>
  );
}

function AddFriendForm() {
  const [message, setMessage] = useState<{
    error: boolean;
    text: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const username = String(new FormData(form).get("friend") ?? "").trim();
    setBusy(true);
    try {
      setMessage({ error: false, text: await addFriend(username) });
      form.reset();
    } catch (error) {
      setMessage({
        error: true,
        text: error instanceof Error ? error.message : "That didn't work.",
      });
    }
    setBusy(false);
  }, []);

  return (
    <form className="flex flex-col gap-2" onSubmit={submit}>
      <label className="font-semibold text-lg" htmlFor="friend-username">
        Add a friend
      </label>
      <div className="flex gap-2">
        <Input
          autoCapitalize="none"
          autoComplete="off"
          id="friend-username"
          name="friend"
          placeholder="Their username"
          required
          spellCheck={false}
        />
        <Button disabled={busy} type="submit">
          Send request
        </Button>
      </div>
      {message ? (
        <p
          className={`text-sm ${message.error ? "text-destructive" : "text-muted-foreground"}`}
          role={message.error ? "alert" : "status"}
        >
          {message.text}
        </p>
      ) : null}
    </form>
  );
}

function RequestRow({
  incoming,
  request,
}: {
  incoming: boolean;
  request: FriendRequest;
}) {
  const [busy, setBusy] = useState(false);
  const act = useCallback(
    async (action: (username: string) => Promise<unknown>) => {
      setBusy(true);
      await action(request.username).catch(() => undefined);
      setBusy(false);
    },
    [request.username]
  );
  const accept = useCallback(() => act(addFriend), [act]);
  const decline = useCallback(() => act(removeFriend), [act]);

  return (
    <li className="flex flex-wrap items-center justify-between gap-2">
      <span>
        <span className="font-medium">@{request.username}</span>{" "}
        <span className="text-muted-foreground text-sm">
          {incoming ? "wants to be friends" : "hasn't answered yet"} ·{" "}
          {whenText(request.at)}
        </span>
      </span>
      <span className="flex gap-2">
        {incoming ? (
          <Button disabled={busy} onClick={accept} size="sm">
            Accept
          </Button>
        ) : null}
        <Button disabled={busy} onClick={decline} size="sm" variant="outline">
          {incoming ? "Decline" : "Cancel"}
        </Button>
      </span>
    </li>
  );
}

function Requests({ data }: { data: FriendsData }) {
  if (data.incoming.length + data.outgoing.length === 0) {
    return null;
  }
  return (
    <Card>
      <h2 className="font-semibold text-lg">Friend requests</h2>
      <ul className="flex flex-col gap-3">
        {data.incoming.map((request) => (
          <RequestRow incoming key={request.username} request={request} />
        ))}
        {data.outgoing.map((request) => (
          <RequestRow
            incoming={false}
            key={request.username}
            request={request}
          />
        ))}
      </ul>
    </Card>
  );
}

function FriendCard({
  href,
  name,
  summary,
}: {
  href?: string;
  name: string;
  summary: PlayerSummary;
}) {
  const title = (
    <span className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="font-semibold">{name}</span>
      <span className="text-muted-foreground text-xs">
        Last played {whenText(summary.lastPlayedAt)}
      </span>
    </span>
  );
  return (
    <li className="flex flex-col gap-3 rounded-2xl border p-4">
      {href ? (
        <Link className="hover:underline" href={href}>
          {title}
        </Link>
      ) : (
        title
      )}
      <ShortStats summary={summary} />
    </li>
  );
}

/** Your own numbers, worked out from this browser, to compare with. */
function useOwnSummary() {
  const [summary, setSummary] = useState<PlayerSummary | null>(null);
  useEffect(() => {
    const load = () =>
      setSummary(summarizePlayer(collectLocalData(), new Date()));
    load();
    return onDataReplaced(load);
  }, []);
  return summary;
}

function FriendList({ data, me }: { data: FriendsData; me: string }) {
  const own = useOwnSummary();
  return (
    <Card>
      <h2 className="font-semibold text-lg">
        Friends{" "}
        <span className="font-normal text-muted-foreground text-sm">
          {data.friends.length}
        </span>
      </h2>
      {data.friends.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No friends yet. Send a request above; once they accept, you&apos;ll
          see each other&apos;s stars, stats and achievements here.
        </p>
      ) : null}
      <ul className="flex flex-col gap-3">
        {own ? <FriendCard name={`@${me} (you)`} summary={own} /> : null}
        {data.friends.map((friend) => (
          <FriendCard
            href={`/friends?user=${encodeURIComponent(friend.username)}`}
            key={friend.username}
            name={`@${friend.username}`}
            summary={friend.summary}
          />
        ))}
      </ul>
    </Card>
  );
}

function RemoveButton({ username }: { username: string }) {
  const [asking, setAsking] = useState(false);
  const ask = useCallback(() => setAsking(true), []);
  const keep = useCallback(() => setAsking(false), []);
  const router = useRouter();
  const remove = useCallback(async () => {
    await removeFriend(username).catch(() => undefined);
    router.push("/friends");
  }, [router, username]);
  if (!asking) {
    return (
      <Button onClick={ask} size="sm" variant="outline">
        Remove friend
      </Button>
    );
  }
  return (
    <span className="flex flex-wrap items-center gap-2 text-sm">
      Remove @{username}?
      <Button onClick={remove} size="sm" variant="destructive">
        Remove
      </Button>
      <Button onClick={keep} size="sm" variant="outline">
        Keep
      </Button>
    </span>
  );
}

function FriendProfile({ friend }: { friend: Friend }) {
  const { summary } = friend;
  const unlocked = new Map(summary.achievements.map(({ at, id }) => [id, at]));
  return (
    <div className="flex flex-col gap-6">
      <Link
        className="flex items-center gap-1 text-muted-foreground text-sm hover:text-foreground"
        href="/friends"
      >
        <ArrowLeftIcon aria-hidden className="size-4" /> All friends
      </Link>
      <Card>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-semibold text-2xl">@{friend.username}</h2>
          <span className="text-muted-foreground text-sm">
            Friends since {whenText(friend.since)}
          </span>
        </div>
        <FullStats summary={summary} />
      </Card>
      <Card>
        <h2 className="font-semibold text-lg">
          Achievements{" "}
          <span className="font-normal text-muted-foreground text-sm">
            {summary.achievements.length} of {summary.achievementsTotal}
          </span>
        </h2>
        {ACHIEVEMENT_GROUPS.map((group) => (
          <div className="flex flex-col gap-2" key={group}>
            <h3 className="font-medium text-muted-foreground text-sm">
              {group}
            </h3>
            <ul className="grid gap-3 sm:grid-cols-2">
              {ACHIEVEMENTS.filter(
                (achievement) => achievement.group === group
              ).map((achievement) => (
                <AchievementCard
                  achievement={achievement}
                  key={achievement.id}
                  unlockedAt={unlocked.get(achievement.id)}
                />
              ))}
            </ul>
          </div>
        ))}
      </Card>
      <div>
        <RemoveButton username={friend.username} />
      </div>
    </div>
  );
}

function FriendsHome({ me }: { me: string }) {
  const { data, error } = useFriends(true);
  const shown = useSearchParams().get("user");

  if (error && !data) {
    return (
      <p className="text-destructive">Couldn&apos;t load friends: {error}</p>
    );
  }
  if (!data) {
    return <p className="text-muted-foreground">Loading…</p>;
  }
  if (shown) {
    const friend = data.friends.find(
      ({ username }) => username.toLowerCase() === shown.toLowerCase()
    );
    if (friend) {
      return <FriendProfile friend={friend} />;
    }
  }
  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm">
        Your username is <span className="font-semibold">@{me}</span>. Friends
        add you with it.
      </p>
      <Card>
        <AddFriendForm />
      </Card>
      <Requests data={data} />
      <FriendList data={data} me={me} />
    </div>
  );
}

/**
 * Friends: add people by username, answer requests, and see your friends'
 * overall stats and achievements.
 */
export function FriendsPanel() {
  const { loading, user } = useAccount();
  if (loading) {
    return <p className="text-muted-foreground">Checking…</p>;
  }
  if (!user) {
    return (
      <Card>
        <p>Friends need an account, so you can find each other.</p>
        <div>
          <Button nativeButton={false} render={<Link href="/account" />}>
            Sign in or create an account
          </Button>
        </div>
      </Card>
    );
  }
  if (!user.username) {
    return (
      <Card>
        <p>Pick a username first, so friends can find you.</p>
        <UsernameForm current={null} />
      </Card>
    );
  }
  return <FriendsHome me={user.username} />;
}
