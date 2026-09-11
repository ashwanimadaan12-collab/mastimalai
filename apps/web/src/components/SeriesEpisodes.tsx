"use client";
import { useState } from "react";
import Link from "next/link";
import type { SeasonSummary } from "@masti/types";
import { PremiumBadge } from "./Card";
import { fmtDuration } from "@/lib/api";

export function SeriesEpisodes({ seasons }: { seasons: SeasonSummary[] }) {
  const [active, setActive] = useState(0);
  if (seasons.length === 0) return null;
  const season = seasons[active];

  return (
    <div className="px-4 py-8 sm:px-8">
      <div className="mb-4 flex flex-wrap gap-2">
        {seasons.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setActive(i)}
            className={`rounded-md px-4 py-1.5 text-sm font-semibold transition ${
              i === active ? "bg-accent text-black" : "bg-surface text-gray-300"
            }`}
          >
            {s.title ?? `Season ${s.number}`}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {season.episodes.map((e) => (
          <Link
            key={e.id}
            href={`/watch/episode/${e.id}`}
            className="group flex gap-4 rounded-lg bg-surface p-3 ring-1 ring-white/5 transition hover:ring-accent/50"
          >
            <div className="relative aspect-video w-40 shrink-0 overflow-hidden rounded-md bg-card">
              {e.thumbnail && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.thumbnail} alt={e.title} className="h-full w-full object-cover" />
              )}
              <div className="absolute inset-0 grid place-items-center bg-black/20 opacity-0 transition group-hover:opacity-100">
                <span className="grid h-9 w-9 place-items-center rounded-full bg-accent text-black">▶</span>
              </div>
              {e.progress && e.progress.durationSec > 0 && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                  <div
                    className="h-full bg-accent"
                    style={{
                      width: `${Math.min(100, (e.progress.positionSec / e.progress.durationSec) * 100)}%`,
                    }}
                  />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold">
                  {e.number}. {e.title}
                </span>
                <PremiumBadge access={e.access} />
                {e.durationSec && (
                  <span className="text-xs text-muted">{fmtDuration(e.durationSec)}</span>
                )}
              </div>
              {e.description && (
                <p className="mt-1 line-clamp-2 text-sm text-muted">{e.description}</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
