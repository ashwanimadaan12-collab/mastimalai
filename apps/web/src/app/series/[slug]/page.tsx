import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { SeriesDetail } from "@masti/types";
import { apiGet } from "@/lib/api";
import { PremiumBadge } from "@/components/Card";
import { DetailActions } from "@/components/DetailActions";
import { SeriesEpisodes } from "@/components/SeriesEpisodes";

async function getSeries(slug: string): Promise<SeriesDetail | null> {
  try {
    return await apiGet<SeriesDetail>(`/series/${slug}`);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const s = await getSeries(params.slug);
  if (!s) return { title: "Not found" };
  return {
    title: s.title,
    description: s.description ?? undefined,
    openGraph: {
      title: s.title,
      description: s.description ?? undefined,
      images: s.backdrop ? [s.backdrop] : undefined,
    },
  };
}

export default async function SeriesPage({
  params,
}: {
  params: { slug: string };
}) {
  const s = await getSeries(params.slug);
  if (!s) notFound();
  const firstEpisode = s.seasons[0]?.episodes[0];

  return (
    <div>
      <div className="relative h-[52vh] min-h-[360px] w-full overflow-hidden">
        {s.backdrop && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={s.backdrop} alt={s.title} className="absolute inset-0 h-full w-full object-cover" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-base via-base/70 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-end gap-3 p-4 sm:p-8">
          <h1 className="text-3xl font-black sm:text-4xl">{s.title}</h1>
          <div className="flex flex-wrap items-center gap-3 text-sm text-muted">
            <PremiumBadge access={s.access} />
            {s.year && <span>{s.year}</span>}
            {s.language && <span>{s.language.name}</span>}
            <span>{s.seasons.length} season{s.seasons.length > 1 ? "s" : ""}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {s.genres.map((g) => (
              <span key={g.id} className="rounded-full bg-white/10 px-3 py-1 text-xs">
                {g.name}
              </span>
            ))}
          </div>
          {s.description && <p className="max-w-2xl text-gray-200">{s.description}</p>}
          <div className="mt-2">
            <DetailActions
              kind="series"
              contentId={s.id}
              firstEpisodeId={firstEpisode?.id}
              hasVideo={!!firstEpisode?.hasVideo}
            />
          </div>
        </div>
      </div>

      <h2 className="px-4 pt-8 text-2xl font-bold sm:px-8">Episodes</h2>
      <SeriesEpisodes seasons={s.seasons} />
    </div>
  );
}
