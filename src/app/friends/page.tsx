import type { Metadata } from "next";
import { Suspense } from "react";
import { FriendsPanel } from "@/components/friends/friends-panel";

export const metadata: Metadata = {
  description: "Add friends by username and see their stats and achievements.",
  title: "Friends | Bass Hero",
};

export default function FriendsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-semibold text-3xl">Friends</h1>
        <p className="text-muted-foreground">
          Add friends by username. Once they accept, you can see each
          other&apos;s stars, stats and achievements.
        </p>
      </header>
      {/* The friend shown comes from the address (?user=), known only in the browser. */}
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <FriendsPanel />
      </Suspense>
    </main>
  );
}
