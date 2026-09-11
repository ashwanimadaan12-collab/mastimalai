"use client";
import { useEffect, useState } from "react";
import type { CatalogCard, Genre, Language, Paginated } from "@masti/types";
import { API_BASE, PLATFORM_HEADERS } from "@/lib/api";
import { ContentCard } from "./Card";

export function BrowseGrid({
  kind,
  title,
}: {
  kind: "movies" | "series";
  title: string;
}) {
  const [items, setItems] = useState<CatalogCard[] | null>(null);
  const [genres, setGenres] = useState<Genre[]>([]);
  const [languages, setLanguages] = useState<Language[]>([]);
  const [genre, setGenre] = useState("");
  const [language, setLanguage] = useState("");
  const [access, setAccess] = useState("");

  useEffect(() => {
    fetch(`${API_BASE}/genres`, { headers: PLATFORM_HEADERS }).then((r) => r.json()).then((d) => setGenres(d.items));
    fetch(`${API_BASE}/languages`, { headers: PLATFORM_HEADERS }).then((r) => r.json()).then((d) => setLanguages(d.items));
  }, []);

  useEffect(() => {
    const qs = new URLSearchParams();
    if (genre) qs.set("genre", genre);
    if (language) qs.set("language", language);
    if (access) qs.set("access", access);
    qs.set("limit", "48");
    setItems(null);
    fetch(`${API_BASE}/${kind}?${qs.toString()}`, { headers: PLATFORM_HEADERS })
      .then((r) => r.json())
      .then((d: Paginated<CatalogCard>) => setItems(d.items))
      .catch(() => setItems([]));
  }, [kind, genre, language, access]);

  const Select = ({
    value,
    onChange,
    children,
  }: {
    value: string;
    onChange: (v: string) => void;
    children: React.ReactNode;
  }) => (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md bg-surface px-3 py-1.5 text-sm ring-1 ring-white/10"
    >
      {children}
    </select>
  );

  return (
    <div className="px-4 py-6 sm:px-8">
      <h1 className="mb-4 text-2xl font-black">{title}</h1>
      <div className="mb-6 flex flex-wrap gap-2">
        <Select value={genre} onChange={setGenre}>
          <option value="">All Genres</option>
          {genres.map((g) => (
            <option key={g.id} value={g.slug}>{g.name}</option>
          ))}
        </Select>
        <Select value={language} onChange={setLanguage}>
          <option value="">All Languages</option>
          {languages.map((l) => (
            <option key={l.id} value={l.code}>{l.name}</option>
          ))}
        </Select>
        <Select value={access} onChange={setAccess}>
          <option value="">Free & Premium</option>
          <option value="FREE">Free</option>
          <option value="PREMIUM">Premium</option>
        </Select>
      </div>

      {!items ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="aspect-[2/3] animate-pulse rounded-lg bg-surface" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="py-16 text-center text-muted">Abhi yahan kuch nahi hai.</p>
      ) : (
        <div className="flex flex-wrap gap-4">
          {items.map((item) => (
            <ContentCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
