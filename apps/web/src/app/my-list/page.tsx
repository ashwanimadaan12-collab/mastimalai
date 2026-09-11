"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import type { CatalogCard } from "@masti/types";
import { useAuth } from "@/lib/auth";
import { ContentCard } from "@/components/Card";

type Item = { id: string; content: CatalogCard };

export default function MyListPage() {
  const { authFetch, loggedIn, loading } = useAuth();
  const [items, setItems] = useState<Item[] | null>(null);
  const [sort, setSort] = useState<"recent" | "az">("recent");

  useEffect(() => {
    if (loading || !loggedIn) return;
    authFetch(`/watchlist?sort=${sort}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, loggedIn, sort]);

  const remove = async (id: string) => {
    await authFetch(`/watchlist/${id}`, { method: "DELETE" });
    setItems((prev) => prev?.filter((i) => i.id !== id) ?? null);
  };

  if (!loading && !loggedIn)
    return (
      <Empty>
        <Link href="/login" className="text-accent">
          Login
        </Link>{" "}
        to build your list.
      </Empty>
    );

  if (!items)
    return <div className="p-8 text-muted">Loading…</div>;

  if (items.length === 0)
    return (
      <Empty>
        Abhi aapki list khali hai.
        <div className="mt-4">
          <Link href="/movies" className="rounded-md bg-accent px-5 py-2 font-bold text-black">
            Explore Movies
          </Link>
        </div>
      </Empty>
    );

  return (
    <div className="px-4 py-6 sm:px-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-black">My List</h1>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as "recent" | "az")}
          className="rounded-md bg-surface px-3 py-1.5 text-sm ring-1 ring-white/10"
        >
          <option value="recent">Recently added</option>
          <option value="az">A–Z</option>
        </select>
      </div>
      <div className="flex flex-wrap gap-4">
        {items.map((it) => (
          <div key={it.id} className="relative">
            <ContentCard item={it.content} />
            <button
              onClick={() => remove(it.id)}
              className="absolute right-1.5 top-1.5 z-10 grid h-6 w-6 place-items-center rounded-full bg-black/70 text-xs hover:bg-red-500"
              aria-label="Remove"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4 text-center text-muted">
      <div>{children}</div>
    </div>
  );
}
