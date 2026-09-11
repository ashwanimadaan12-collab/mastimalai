package com.mastimalai.ott.data

import kotlinx.serialization.Serializable

// DTOs mirroring the backend API. `ignoreUnknownKeys` is on, so extra fields are safe
// and one flexible class can represent both movie and series cards.

@Serializable
data class Genre(val id: String, val name: String, val slug: String = "")

@Serializable
data class Language(val id: String, val name: String, val code: String = "")

@Serializable
data class CastMember(
    val id: String,
    val name: String,
    val character: String? = null,
    val role: String = "ACTOR",
    val order: Int = 0,
)

@Serializable
data class CatalogCard(
    val id: String,
    val slug: String,
    val title: String,
    val poster: String? = null,
    val backdrop: String? = null,
    val year: Int? = null,
    val access: String = "FREE",
    val kind: String = "movie", // "movie" | "series"
)

@Serializable
data class HeroTarget(val kind: String, val slug: String)

@Serializable
data class HeroItem(
    val id: String,
    val title: String,
    val subtitle: String? = null,
    val description: String? = null,
    val backdrop: String? = null,
    val poster: String? = null,
    val trailerUrl: String? = null,
    val ctaLabel: String? = null,
    val target: HeroTarget? = null,
)

@Serializable
data class ContinueContent(
    val id: String,
    val resumeKind: String = "movie", // "movie" | "episode"
    val title: String? = null,
    val poster: String? = null,
    val backdrop: String? = null,
    val thumbnail: String? = null,
    val number: Int? = null,
    val seriesSlug: String? = null,
    val seriesTitle: String? = null,
)

@Serializable
data class ContinueItem(
    val id: String,
    val positionSec: Int,
    val durationSec: Int,
    val updatedAt: String? = null,
    val content: ContinueContent,
)

@Serializable
data class HomeSection(
    val id: String,
    val title: String,
    val type: String,
    val items: List<CatalogCard> = emptyList(),
    val hero: List<HeroItem> = emptyList(),
    val continueWatching: List<ContinueItem> = emptyList(),
)

@Serializable
data class HomeResponse(val sections: List<HomeSection> = emptyList())

@Serializable
data class MovieDetail(
    val id: String,
    val slug: String,
    val title: String,
    val description: String? = null,
    val poster: String? = null,
    val backdrop: String? = null,
    val trailerUrl: String? = null,
    val year: Int? = null,
    val durationSec: Int? = null,
    val ageRating: String? = null,
    val rating: Double? = null,
    val access: String = "FREE",
    val genres: List<Genre> = emptyList(),
    val language: Language? = null,
    val cast: List<CastMember> = emptyList(),
    val related: List<CatalogCard> = emptyList(),
    val hasVideo: Boolean = false,
)

@Serializable
data class Episode(
    val id: String,
    val title: String,
    val number: Int,
    val description: String? = null,
    val thumbnail: String? = null,
    val durationSec: Int? = null,
    val access: String = "PREMIUM",
    val hasVideo: Boolean = false,
)

@Serializable
data class Season(
    val id: String,
    val number: Int,
    val title: String? = null,
    val episodes: List<Episode> = emptyList(),
)

@Serializable
data class SeriesDetail(
    val id: String,
    val slug: String,
    val title: String,
    val description: String? = null,
    val poster: String? = null,
    val backdrop: String? = null,
    val access: String = "PREMIUM",
    val genres: List<Genre> = emptyList(),
    val language: Language? = null,
    val seasons: List<Season> = emptyList(),
)

@Serializable
data class Paginated<T>(
    val items: List<T> = emptyList(),
    val page: Int = 1,
    val limit: Int = 24,
    val total: Int = 0,
)

@Serializable
data class SearchResponse(
    val movies: List<CatalogCard> = emptyList(),
    val series: List<CatalogCard> = emptyList(),
    val people: List<String> = emptyList(),
)

// ---- Auth / user ----
@Serializable
data class SendOtpBody(val mobile: String)

@Serializable
data class SendOtpResponse(val sent: Boolean = true, val otp: String? = null)

@Serializable
data class VerifyOtpBody(val mobile: String, val otp: String)

@Serializable
data class Profile(
    val id: String,
    val name: String,
    val isKids: Boolean = false,
    val avatar: String? = null,
    val language: String? = null,
)

@Serializable
data class AuthUser(
    val id: String,
    val mobile: String,
    val email: String? = null,
    val profiles: List<Profile> = emptyList(),
)

@Serializable
data class VerifyOtpResponse(
    val accessToken: String,
    val refreshToken: String,
    val user: AuthUser,
)

@Serializable
data class RefreshBody(val refreshToken: String)

@Serializable
data class RefreshResponse(val accessToken: String, val refreshToken: String)

@Serializable
data class Subscription(
    val status: String = "EXPIRED",
    val planName: String? = null,
    val expiresAt: String? = null,
    val isActive: Boolean = false,
)

@Serializable
data class Me(
    val id: String,
    val mobile: String,
    val email: String? = null,
    val profiles: List<Profile> = emptyList(),
    val subscription: Subscription = Subscription(),
)

// ---- Billing ----
@Serializable
data class Plan(
    val id: String,
    val name: String,
    val priceInPaise: Int,
    val compareAtPriceInPaise: Int? = null,
    val currency: String = "INR",
    val durationDays: Int,
    val description: String? = null,
    val features: List<String> = emptyList(),
    val isRecommended: Boolean = false,
    val displayOrder: Int = 0,
)

@Serializable
data class PlansResponse(val items: List<Plan> = emptyList())

@Serializable
data class CreateOrderBody(val planId: String)

@Serializable
data class CreateOrderResponse(val orderId: String, val amount: Int, val currency: String = "INR")

@Serializable
data class VerifyPaymentBody(val orderId: String, val sandboxApprove: Boolean = true)

// ---- Watch / playback ----
@Serializable
data class ProgressBody(
    val movieId: String? = null,
    val episodeId: String? = null,
    val positionSec: Int,
    val durationSec: Int,
)

@Serializable
data class PlaybackBody(val movieId: String? = null, val episodeId: String? = null)

@Serializable
data class PlaybackTicket(
    val streamUrl: String,
    val token: String,
    val expiresInSec: Int,
    val startPositionSec: Int = 0,
)

@Serializable
data class WatchlistBody(val movieId: String? = null, val seriesId: String? = null)

@Serializable
data class WatchlistEntry(val id: String, val content: CatalogCard)

@Serializable
data class WatchlistResponse(val items: List<WatchlistEntry> = emptyList())

@Serializable
data class ContinueResponse(val items: List<ContinueItem> = emptyList())

@Serializable
data class OkResponse(val ok: Boolean = true)
