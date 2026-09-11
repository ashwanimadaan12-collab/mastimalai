"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

const NAV = [
  { href: "/", label: "Home" },
  { href: "/movies", label: "Movies" },
  { href: "/series", label: "Web Series" },
  { href: "/my-list", label: "My List" },
];

export function Header() {
  const { loggedIn, me, profile, logout } = useAuth();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-white/5 bg-base/80 backdrop-blur">
      <div className="flex items-center gap-4 px-4 py-3 sm:px-8">
        <Link href="/" className="text-xl font-black">
          <span className="brand-gradient">Masti Malai</span>
        </Link>
        <nav className="hidden gap-5 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="text-sm text-gray-300 transition hover:text-white"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        <form onSubmit={submitSearch} className="ml-auto hidden sm:block">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search movies, series…"
            className="w-44 rounded-full bg-surface px-4 py-1.5 text-sm outline-none ring-1 ring-white/10 focus:w-64 focus:ring-accent/50"
          />
        </form>

        {loggedIn ? (
          <div className="relative">
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-sm ring-1 ring-white/10"
            >
              <span className="grid h-6 w-6 place-items-center rounded-full bg-accent text-xs font-bold text-black">
                {(profile?.name ?? me?.mobile ?? "M").slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden sm:inline">{profile?.name ?? "Profile"}</span>
            </button>
            {open && (
              <div className="absolute right-0 mt-2 w-48 rounded-lg bg-surface p-2 text-sm shadow-xl ring-1 ring-white/10">
                <div className="px-2 py-1 text-xs text-muted">{me?.mobile}</div>
                <div className="px-2 py-1 text-xs">
                  {me?.subscription.isActive ? (
                    <span className="text-accent-2">
                      {me.subscription.planName} · active
                    </span>
                  ) : (
                    <Link href="/subscription" className="text-accent">
                      Get Premium →
                    </Link>
                  )}
                </div>
                <Link href="/continue-watching" className="block rounded px-2 py-1.5 hover:bg-white/5">
                  Continue Watching
                </Link>
                <Link href="/my-list" className="block rounded px-2 py-1.5 hover:bg-white/5">
                  My List
                </Link>
                <button
                  onClick={() => {
                    logout();
                    setOpen(false);
                    router.push("/");
                  }}
                  className="mt-1 block w-full rounded px-2 py-1.5 text-left text-red-400 hover:bg-white/5"
                >
                  Log out
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="ml-auto flex items-center gap-2 sm:ml-0">
            <Link
              href="/login"
              className="rounded-md px-3 py-1.5 text-sm text-gray-200 hover:text-white"
            >
              Login
            </Link>
            <Link
              href="/subscription"
              className="rounded-md bg-accent px-4 py-1.5 text-sm font-bold text-black hover:bg-accent-2"
            >
              Subscribe
            </Link>
          </div>
        )}
      </div>
    </header>
  );
}
