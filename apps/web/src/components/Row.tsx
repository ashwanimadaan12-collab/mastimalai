"use client";
import { useRef } from "react";
import type { CatalogCard } from "@masti/types";
import { ContentCard } from "./Card";

export function Row({
  title,
  items,
  numbered = false,
}: {
  title: string;
  items: CatalogCard[];
  numbered?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  if (!items || items.length === 0) return null;

  const scroll = (dir: 1 | -1) =>
    ref.current?.scrollBy({ left: dir * 600, behavior: "smooth" });

  return (
    <section className="group/row relative py-4">
      <div className="mb-2 flex items-center justify-between px-4 sm:px-8">
        <h2 className="text-lg font-bold text-white sm:text-xl">{title}</h2>
      </div>
      <div className="relative">
        <button
          aria-label="Scroll left"
          onClick={() => scroll(-1)}
          className="absolute left-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/60 p-2 text-white opacity-0 transition group-hover/row:opacity-100 sm:block"
        >
          ‹
        </button>
        <div
          ref={ref}
          className="no-scrollbar flex gap-3 overflow-x-auto scroll-smooth px-4 sm:px-8"
        >
          {items.map((item, i) => (
            <div key={`${item.kind}-${item.id}`} className="flex items-end">
              {numbered && (
                <span className="mr-[-18px] select-none text-[72px] font-black leading-none text-white/10">
                  {i + 1}
                </span>
              )}
              <ContentCard item={item} />
            </div>
          ))}
        </div>
        <button
          aria-label="Scroll right"
          onClick={() => scroll(1)}
          className="absolute right-1 top-1/2 z-10 hidden -translate-y-1/2 rounded-full bg-black/60 p-2 text-white opacity-0 transition group-hover/row:opacity-100 sm:block"
        >
          ›
        </button>
      </div>
    </section>
  );
}
