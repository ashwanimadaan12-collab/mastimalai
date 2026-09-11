"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { ContinueWatchingItem } from "@masti/types";
import { useAuth } from "@/lib/auth";

function pct(p: number, d: number) {
  return d > 0 ? Math.min(100, Math.round((p / d) * 100)) : 0;
}

export default function ContinueWatchingPage() {
  const { authFetch, loggedIn, loading } = useAuth();
  const [items, setItems] = useState<ContinueWatchingItem[] | null>(null);

  useEffect(() => {
    if (loading || !loggedIn) return;
    authFetch("/watch/continue")
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, loggedIn]);

  if (!loading && !loggedIn)
    return <Center><Link href="/login" className="text-accent">Login</Link> to continue watching.</Center>;
  if (!items) return <div className="p-8 text-muted">Loading…</div>;
  if (items.length === 0)
    return (
      <Center>
        Start watching something awesome.
        <div className="mt-4">
          <Link href="/" className="rounded-md bg-accent px-5 py-2 font-bold text-black">Browse</Link>
        </div>
      </Center>
    );

  return (
    <div className="px-4 py-6 sm:px-8">
      <h1 className="mb-4 text-2xl font-black">Continue Watching</h1>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const c = it.content;
          const href =
            c.resumeKind === "movie" ? `/watch/movie/${c.id}` : `/watch/episode/${c.id}`;
          const img = c.resumeKind === "movie" ? c.backdrop || c.poster : c.thumbnail;
          const label =
            c.resumeKind === "movie" ? c.title : `${c.seriesTitle} · E${c.number}`;
          return (
            <Link key={it.id} href={href} className="group">
              <div className="relative aspect-video overflow-hidden rounded-lg bg-surface ring-1 ring-white/5 group-hover:ring-accent/60">
                {img && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={label} className="h-full w-full object-cover" />
                )}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                  <div className="h-full bg-accent" style={{ width: `${pct(it.positionSec, it.durationSec)}%` }} />
                </div>
              </div>
              <p className="mt-1.5 truncate">{label}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Center({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4 text-center text-muted">
      <div>{children}</div>
    </div>
  );
}
