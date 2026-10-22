import type { Metadata } from "next";
import { AccountPanel } from "@/components/account/account-panel";
import { PageHeader } from "@/components/page-header";

export const metadata: Metadata = {
  description: "Sign in to keep your Bass Hero progress in an account.",
  title: "Account | Bass Hero",
};

export default function AccountPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8 sm:py-10">
      <PageHeader title="Account">
        Keep your progress safe, and play with friends. Guests can play too;
        their progress stays in this browser.
      </PageHeader>
      <AccountPanel />
    </main>
  );
}
