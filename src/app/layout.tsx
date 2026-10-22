import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import { AccountProvider } from "@/components/account/account-provider";
import { AchievementToasts } from "@/components/achievement-toasts";
import { SettingsProvider } from "@/components/settings-provider";
import { SiteNav } from "@/components/site-nav";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-sans",
});

/** Headings and the logo: bold and a little playful. */
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800"],
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  description: "A rhythm game you play with a real bass.",
  title: "Bass Hero",
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#0d0c1d",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      className={`${geistSans.variable} ${geistMono.variable} ${display.variable} dark h-full antialiased`}
      lang="en"
    >
      <body className="flex min-h-full flex-col">
        <AccountProvider>
          <SettingsProvider>
            <SiteNav />
            {children}
            <AchievementToasts />
          </SettingsProvider>
        </AccountProvider>
      </body>
    </html>
  );
}
