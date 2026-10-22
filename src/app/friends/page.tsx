import type { Metadata } from "next";
import { Suspense } from "react";
import { FriendsPanel } from "@/components/friends/friends-panel";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  description: "Add friends by username and see their stats and achievements.",
  title: "Friends | Bass Hero",
};

export default function FriendsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:py-10">
      <PageHeader title="Friends">
        Add friends by username and compare stars, stats and achievements.
      </PageHeader>
      {/* The friend shown comes from the address (?user=), known only in the browser. */}
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <FriendsPanel />
      </Suspense>
    </main>
  );
}
