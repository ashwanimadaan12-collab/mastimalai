"use client";
import Link from "next/link";
import type { ContinueWatchingItem } from "@masti/types";

function pct(p: number, d: number) {
  return d > 0 ? Math.min(100, Math.round((p / d) * 100)) : 0;
}
function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function ContinueRow({
  title,
  items,
}: {
  title: string;
  items: ContinueWatchingItem[];
}) {
  if (!items || items.length === 0) return null;
  return (
    <section className="py-4">
      <h2 className="mb-2 px-4 text-lg font-bold sm:px-8 sm:text-xl">{title}</h2>
      <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 sm:px-8">
        {items.map((it) => {
          const c = it.content;
          const href =
            c.resumeKind === "movie"
              ? `/watch/movie/${c.id}`
              : `/watch/episode/${c.id}`;
          const img =
            c.resumeKind === "movie" ? c.backdrop || c.poster : c.thumbnail;
          const label =
            c.resumeKind === "movie"
              ? c.title
              : `${c.seriesTitle} · E${c.number}`;
          return (
            <Link
              key={it.id}
              href={href}
              className="group w-[240px] shrink-0"
            >
              <div className="relative aspect-video overflow-hidden rounded-lg bg-card ring-1 ring-white/5 group-hover:ring-accent/60">
                {img && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={img} alt={label} className="h-full w-full object-cover" />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 transition group-hover:opacity-100">
                  <span className="grid h-11 w-11 place-items-center rounded-full bg-accent text-black">
                    ▶
                  </span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                  <div
                    className="h-full bg-accent"
                    style={{ width: `${pct(it.positionSec, it.durationSec)}%` }}
                  />
                </div>
              </div>
              <p className="mt-1.5 truncate text-sm">{label}</p>
              <p className="text-xs text-muted">Resume from {fmt(it.positionSec)}</p>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
