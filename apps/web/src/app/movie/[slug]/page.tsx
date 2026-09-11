import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { MovieDetail } from "@masti/types";
import { apiGet, fmtDuration } from "@/lib/api";
import { PremiumBadge } from "@/components/Card";
import { Row } from "@/components/Row";
import { DetailActions } from "@/components/DetailActions";

async function getMovie(slug: string): Promise<MovieDetail | null> {
  try {
    return await apiGet<MovieDetail>(`/movies/${slug}`);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const m = await getMovie(params.slug);
  if (!m) return { title: "Not found" };
  return {
    title: m.title,
    description: m.description ?? undefined,
    openGraph: {
      title: m.title,
      description: m.description ?? undefined,
      images: m.backdrop ? [m.backdrop] : undefined,
    },
  };
}

export default async function MoviePage({
  params,
}: {
  params: { slug: string };
}) {
  const m = await getMovie(params.slug);
  if (!m) notFound();

  return (
    <div>
      <div className="relative h-[52vh] min-h-[360px] w-full overflow-hidden">
        {m.backdrop && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.backdrop} alt={m.title} className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-base via-base/70 to-transparent" />
      </div>

      <div className="-mt-40 px-4 sm:px-8">
        <div className="flex flex-col gap-6 sm:flex-row">
          {m.poster && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={m.poster}
              alt={m.title}
              className="h-64 w-44 shrink-0 rounded-lg object-cover shadow-2xl ring-1 ring-white/10"
            />
          )}
          <div className="flex-1">
            <h1 className="text-3xl font-black sm:text-4xl">{m.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-muted">
              <PremiumBadge access={m.access} />
              {m.year && <span>{m.year}</span>}
              {m.durationSec && <span>{fmtDuration(m.durationSec)}</span>}
              {m.ageRating && (
                <span className="rounded border border-white/20 px-1.5">{m.ageRating}</span>
              )}
              {m.language && <span>{m.language.name}</span>}
              {m.rating != null && <span className="text-accent-2">★ {m.rating}</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              {m.genres.map((g) => (
                <span key={g.id} className="rounded-full bg-white/10 px-3 py-1 text-xs">
                  {g.name}
                </span>
              ))}
            </div>
            {m.description && (
              <p className="mt-4 max-w-2xl text-gray-200">{m.description}</p>
            )}
            <div className="mt-5">
              <DetailActions kind="movie" contentId={m.id} hasVideo={m.hasVideo} />
            </div>
            {m.cast.length > 0 && (
              <p className="mt-5 text-sm text-muted">
                <span className="text-gray-300">Cast: </span>
                {m.cast.filter((c) => c.role === "ACTOR").map((c) => c.name).join(", ")}
                {m.cast.some((c) => c.role === "DIRECTOR") && (
                  <>
                    {" · "}
                    <span className="text-gray-300">Director: </span>
                    {m.cast.filter((c) => c.role === "DIRECTOR").map((c) => c.name).join(", ")}
                  </>
                )}
              </p>
            )}
          </div>
        </div>
      </div>

      {m.related.length > 0 && (
        <div className="mt-10">
          <Row title="More Like This" items={m.related} />
        </div>
      )}
    </div>
  );
}
