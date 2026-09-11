"use client";
import { useEffect, useState } from "react";
import type { HomeSection, ContinueWatchingItem } from "@masti/types";
import { useAuth } from "@/lib/auth";
import { Hero } from "@/components/Hero";
import { Row } from "@/components/Row";
import { ContinueRow } from "@/components/ContinueRow";

type Section = HomeSection & { continueWatching?: ContinueWatchingItem[] };

export default function HomePage() {
  const { authFetch, loading: authLoading } = useAuth();
  const [sections, setSections] = useState<Section[] | null>(null);

  useEffect(() => {
    if (authLoading) return;
    authFetch("/home")
      .then((r) => r.json())
      .then((d) => setSections(d.sections ?? []))
      .catch(() => setSections([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading]);

  if (!sections) {
    return (
      <div className="space-y-6 p-8">
        <div className="h-[50vh] animate-pulse rounded-xl bg-surface" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            {[0, 1, 2, 3, 4, 5].map((j) => (
              <div
                key={j}
                className="h-56 w-[150px] shrink-0 animate-pulse rounded-lg bg-surface"
              />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="pb-8">
      {sections.map((s) => {
        if (s.type === "HERO")
          return <Hero key={s.id} items={s.hero ?? []} />;
        if (s.type === "CONTINUE_WATCHING")
          return (
            <ContinueRow
              key={s.id}
              title={s.title}
              items={s.continueWatching ?? (s.items as unknown as ContinueWatchingItem[])}
            />
          );
        return (
          <Row
            key={s.id}
            title={s.title}
            items={s.items}
            numbered={s.type === "TOP10"}
          />
        );
      })}
    </div>
  );
}
