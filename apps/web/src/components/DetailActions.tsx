"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAuth } from "@/lib/auth";

export function DetailActions({
  kind,
  contentId,
  firstEpisodeId,
  hasVideo,
}: {
  kind: "movie" | "series";
  contentId: string;
  firstEpisodeId?: string | null;
  hasVideo: boolean;
}) {
  const { loggedIn, authFetch } = useAuth();
  const router = useRouter();
  const [msg, setMsg] = useState("");
  const [adding, setAdding] = useState(false);

  const playHref =
    kind === "movie"
      ? `/watch/movie/${contentId}`
      : firstEpisodeId
        ? `/watch/episode/${firstEpisodeId}`
        : null;

  const addToList = async () => {
    if (!loggedIn) return router.push("/login");
    setAdding(true);
    const body = kind === "movie" ? { movieId: contentId } : { seriesId: contentId };
    const res = await authFetch("/watchlist", {
      method: "POST",
      body: JSON.stringify(body),
    });
    setAdding(false);
    setMsg(res.ok ? "Added to My List ✓" : "Could not add");
    setTimeout(() => setMsg(""), 2500);
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {hasVideo && playHref ? (
        <button
          onClick={() => router.push(playHref)}
          className="rounded-md bg-accent px-6 py-2.5 font-bold text-black transition hover:bg-accent-2"
        >
          ▶ Play
        </button>
      ) : (
        <span className="rounded-md bg-white/10 px-6 py-2.5 text-sm text-muted">
          Not ready to stream yet
        </span>
      )}
      <button
        onClick={addToList}
        disabled={adding}
        className="rounded-md bg-white/15 px-6 py-2.5 font-semibold text-white transition hover:bg-white/25 disabled:opacity-50"
      >
        + My List
      </button>
      {msg && <span className="text-sm text-accent-2">{msg}</span>}
    </div>
  );
}
