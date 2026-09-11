// Shared DTO types used by both the API and the web client.
// One source of truth so clients and server never drift.

export type Access = "FREE" | "PREMIUM";
export type ContentStatus =
  | "DRAFT"
  | "PROCESSING"
  | "SCHEDULED"
  | "PUBLISHED"
  | "UNPUBLISHED"
  | "ARCHIVED";
export type SubscriptionStatus =
  | "ACTIVE"
  | "EXPIRED"
  | "CANCELLED"
  | "PENDING"
  | "FAILED";
export type HomeSectionType =
  | "HERO"
  | "CAROUSEL"
  | "TOP10"
  | "CONTINUE_WATCHING";

export interface Genre {
  id: string;
  name: string;
  slug: string;
}
export interface Language {
  id: string;
  name: string;
  code: string;
}

export interface CastMember {
  id: string;
  name: string;
  character?: string | null;
  role: string; // ACTOR | DIRECTOR | PRODUCER
  order: number;
}

export interface MovieSummary {
  id: string;
  slug: string;
  title: string;
  poster?: string | null;
  backdrop?: string | null;
  year?: number | null;
  durationSec?: number | null;
  ageRating?: string | null;
  access: Access;
  kind: "movie";
}

export interface MovieDetail extends MovieSummary {
  description?: string | null;
  trailerUrl?: string | null;
  rating?: number | null;
  genres: Genre[];
  language?: Language | null;
  cast: CastMember[];
  related: MovieSummary[];
  hasVideo: boolean;
}

export interface SeriesSummary {
  id: string;
  slug: string;
  title: string;
  poster?: string | null;
  backdrop?: string | null;
  year?: number | null;
  access: Access;
  kind: "series";
}

export interface EpisodeSummary {
  id: string;
  title: string;
  number: number;
  description?: string | null;
  thumbnail?: string | null;
  durationSec?: number | null;
  access: Access;
  hasVideo: boolean;
  progress?: { positionSec: number; durationSec: number } | null;
}

export interface SeasonSummary {
  id: string;
  number: number;
  title?: string | null;
  episodes: EpisodeSummary[];
}

export interface SeriesDetail extends SeriesSummary {
  description?: string | null;
  trailerUrl?: string | null;
  genres: Genre[];
  language?: Language | null;
  cast: CastMember[];
  seasons: SeasonSummary[];
}

export type CatalogCard = MovieSummary | SeriesSummary;

export interface HeroItem {
  id: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  backdrop?: string | null;
  poster?: string | null;
  trailerUrl?: string | null;
  ctaLabel?: string | null;
  target: { kind: "movie" | "series"; slug: string } | null;
}

export interface HomeSection {
  id: string;
  title: string;
  type: HomeSectionType;
  items: CatalogCard[];
  hero?: HeroItem[];
}

export interface ContinueWatchingItem {
  id: string; // progress id
  positionSec: number;
  durationSec: number;
  updatedAt: string;
  content:
    | (MovieSummary & { resumeKind: "movie" })
    | (EpisodeSummary & {
        resumeKind: "episode";
        seriesSlug: string;
        seriesTitle: string;
      });
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  priceInPaise: number;
  compareAtPriceInPaise?: number | null;
  currency: string;
  durationDays: number;
  description?: string | null;
  features: string[];
  isRecommended: boolean;
  displayOrder: number;
}

export interface UserProfile {
  id: string;
  name: string;
  isKids: boolean;
  avatar?: string | null;
  language?: string | null;
}

export interface Me {
  id: string;
  mobile: string;
  email?: string | null;
  profiles: UserProfile[];
  subscription: {
    status: SubscriptionStatus;
    planName?: string | null;
    expiresAt?: string | null;
    isActive: boolean;
  };
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

export interface Paginated<T> {
  items: T[];
  page: number;
  limit: number;
  total: number;
}

export interface PlaybackTicket {
  streamUrl: string;
  token: string;
  expiresInSec: number;
  startPositionSec: number;
}
