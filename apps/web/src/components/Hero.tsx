"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { HeroItem } from "@masti/types";

export function Hero({ items }: { items: HeroItem[] }) {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 6000);
    return () => clearInterval(t);
  }, [items.length]);

  if (!items || items.length === 0) return null;
  const h = items[idx];
  const href = h.target
    ? h.target.kind === "movie"
      ? `/movie/${h.target.slug}`
      : `/series/${h.target.slug}`
    : "#";

  return (
    <div className="relative h-[62vh] min-h-[420px] w-full overflow-hidden">
      {h.backdrop && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={h.backdrop}
          alt={h.title}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-base via-base/60 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-base/90 to-transparent" />
      <div className="relative flex h-full flex-col justify-end gap-3 px-4 pb-14 sm:px-8 sm:pb-20">
        {h.subtitle && (
          <p className="text-sm font-semibold uppercase tracking-wide text-accent-2">
            {h.subtitle}
          </p>
        )}
        <h1 className="max-w-2xl text-3xl font-black text-white drop-shadow sm:text-5xl">
          {h.title}
        </h1>
        {h.description && (
          <p className="max-w-xl text-sm text-gray-200 sm:text-base">
            {h.description}
          </p>
        )}
        <div className="mt-2 flex gap-3">
          <Link
            href={href}
            className="rounded-md bg-accent px-6 py-2.5 font-bold text-black transition hover:bg-accent-2"
          >
            ▶ {h.ctaLabel ?? "Watch Now"}
          </Link>
          <Link
            href={href}
            className="rounded-md bg-white/15 px-6 py-2.5 font-semibold text-white backdrop-blur transition hover:bg-white/25"
          >
            + More Info
          </Link>
        </div>
        {items.length > 1 && (
          <div className="mt-3 flex gap-1.5">
            {items.map((_, i) => (
              <button
                key={i}
                aria-label={`Slide ${i + 1}`}
                onClick={() => setIdx(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === idx ? "w-6 bg-accent" : "w-3 bg-white/30"
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
