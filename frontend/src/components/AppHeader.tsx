"use client";

/**
 * Kurinda - shared header for the three role-gated views (dashboard, chw,
 * alerts). Keeps the eyebrow/title/subtitle + home/user/logout pattern in
 * one place instead of duplicated per page.
 */
import Link from "next/link";

interface AppHeaderProps {
  eyebrow: string;
  title: string;
  subtitle?: string;
  userName: string;
  onLogout: () => void;
}

export default function AppHeader({
  eyebrow,
  title,
  subtitle,
  userName,
  onLogout,
}: AppHeaderProps) {
  return (
    <header className="px-6 py-5 border-b border-neutral-800 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-xs uppercase tracking-widest text-neutral-500 mb-1">
          {eyebrow}
        </p>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && (
          <p className="text-sm text-neutral-400 mt-1 max-w-2xl">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-4 text-sm shrink-0">
        <Link
          href="/"
          className="text-neutral-500 hover:text-neutral-300 transition-colors"
        >
          Home
        </Link>
        <span className="text-neutral-400">{userName}</span>
        <button
          type="button"
          onClick={onLogout}
          className="text-neutral-500 hover:text-red-400 transition-colors"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
