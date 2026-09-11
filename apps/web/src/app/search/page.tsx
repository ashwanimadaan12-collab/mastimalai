"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import type { MovieSummary, SeriesSummary } from "@masti/types";
import { API_BASE, PLATFORM_HEADERS } from "@/lib/api";
import { ContentCard } from "@/components/Card";

function SearchResults() {
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const [data, setData] = useState<{
    movies: MovieSummary[];
    series: SeriesSummary[];
    people: string[];
  } | null>(null);

  useEffect(() => {
    if (!q) return;
    setData(null);
    fetch(`${API_BASE}/search?q=${encodeURIComponent(q)}`, { headers: PLATFORM_HEADERS })
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ movies: [], series: [], people: [] }));
  }, [q]);

  if (!q)
    return <p className="p-8 text-muted">Type something to search.</p>;
  if (!data) return <p className="p-8 text-muted">Searching “{q}”…</p>;

  const results = [...data.movies, ...data.series];
  return (
    <div className="px-4 py-6 sm:px-8">
      <h1 className="mb-4 text-2xl font-black">Results for “{q}”</h1>
      {data.people.length > 0 && (
        <p className="mb-4 text-sm text-muted">
          People: {data.people.join(", ")}
        </p>
      )}
      {results.length === 0 ? (
        <p className="py-16 text-center text-muted">
          Koi result nahi mila. Try another search.
        </p>
      ) : (
        <div className="flex flex-wrap gap-4">
          {results.map((item) => (
            <ContentCard key={`${item.kind}-${item.id}`} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<p className="p-8 text-muted">Loading…</p>}>
      <SearchResults />
    </Suspense>
  );
}
