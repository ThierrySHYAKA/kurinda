import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { THEME_INIT_SCRIPT } from "@/lib/theme";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Kurinda",
  description:
    "Machine learning early-warning system for sector-level chronic childhood stunting risk in Rwanda.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* suppressHydrationWarning: the theme-init script below sets the
          "dark" class on <html> before hydration, and browser extensions
          (e.g. Grammarly) mutate <body> after hydration - both would
          otherwise be flagged as a mismatch by React. Neither affects our
          own component markup. */}
      <body
        className="min-h-full flex flex-col bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors"
        suppressHydrationWarning
      >
        {children}
        {/* beforeInteractive: Next.js hoists this into <head> and runs it
            before hydration, so the "dark" class lands on <html> before
            first paint - see src/lib/theme.ts for why light must always be
            the default. Must be nested inside <body> as the last child
            (Next's documented placement for root-layout Application
            Scripts) - as a sibling of <body> instead, it trips React 19's
            script-hoisting heuristics and logs a spurious hydration
            warning in dev, even though the final rendered HTML is
            identical either way. */}
        <Script id="theme-init" strategy="beforeInteractive">
          {THEME_INIT_SCRIPT}
        </Script>
      </body>
    </html>
  );
}
