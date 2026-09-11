import Link from "next/link";
import type { CatalogCard } from "@masti/types";

export function PremiumBadge({ access }: { access: "FREE" | "PREMIUM" }) {
  if (access === "FREE")
    return (
      <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold text-white">
        FREE
      </span>
    );
  return (
    <span className="rounded bg-accent/90 px-1.5 py-0.5 text-[10px] font-semibold text-black">
      PREMIUM 🔒
    </span>
  );
}

export function ContentCard({ item }: { item: CatalogCard }) {
  const href = item.kind === "movie" ? `/movie/${item.slug}` : `/series/${item.slug}`;
  return (
    <Link
      href={href}
      className="group block w-[150px] shrink-0 sm:w-[170px]"
    >
      <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-card ring-1 ring-white/5 transition group-hover:ring-accent/60">
        {item.poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.poster}
            alt={item.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-muted">
            {item.title}
          </div>
        )}
        <div className="absolute left-1.5 top-1.5">
          <PremiumBadge access={item.access} />
        </div>
        {item.kind === "series" && (
          <span className="absolute right-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px]">
            SERIES
          </span>
        )}
      </div>
      <p className="mt-1.5 truncate text-sm text-gray-200 group-hover:text-white">
        {item.title}
      </p>
    </Link>
  );
}
