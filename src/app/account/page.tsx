import type { Metadata } from "next";
import { AccountPanel } from "@/components/account/account-panel";

export const metadata: Metadata = {
  description: "Sign in to keep your Bass Hero progress in an account.",
  title: "Account | Bass Hero",
};

export default function AccountPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <header className="flex flex-col gap-1">
        <h1 className="font-semibold text-3xl">Account</h1>
        <p className="text-muted-foreground">
          Sign in to keep your progress safe. You can always play as a guest;
          your progress then stays in this browser only.
        </p>
      </header>
      <AccountPanel />
    </main>
  );
}
