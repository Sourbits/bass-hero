import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AccountProvider } from "@/components/account/account-provider";
import { AchievementToasts } from "@/components/achievement-toasts";
import { SiteNav } from "@/components/site-nav";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  description: "A rhythm game you play with a real bass.",
  title: "Bass Hero",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      lang="en"
    >
      <body className="flex min-h-full flex-col">
        <AccountProvider>
          <SiteNav />
          {children}
          <AchievementToasts />
        </AccountProvider>
      </body>
    </html>
  );
}
