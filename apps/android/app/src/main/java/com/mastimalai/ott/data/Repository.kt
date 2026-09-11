package com.mastimalai.ott.data

import com.mastimalai.ott.BuildConfig

// Thin repository over the API. ViewModels call these suspend functions and handle
// exceptions for error state. Business rules live in the backend.
class Repository(
    val api: ApiService,
    val session: SessionManager,
) {
    private val apiBase = BuildConfig.API_BASE_URL.trimEnd('/')

    // The API returns a relative playback path; resolve it against our API base so
    // it points at the right host (10.0.2.2 on emulator, LAN IP / domain on device).
    private fun absoluteStream(url: String): String =
        if (url.startsWith("/")) "$apiBase$url" else url
    // ---- Auth ----
    suspend fun sendOtp(mobile: String): String? = api.sendOtp(SendOtpBody(mobile)).otp

    suspend fun verifyOtp(mobile: String, otp: String): AuthUser {
        val res = api.verifyOtp(VerifyOtpBody(mobile, otp))
        session.saveTokens(res.accessToken, res.refreshToken)
        res.user.profiles.firstOrNull()?.let { session.setProfile(it.id) }
        return res.user
    }

    suspend fun me(): Me = api.me()

    suspend fun logout() = session.clear()

    // ---- Catalog ----
    suspend fun home(): List<HomeSection> = api.home().sections
    suspend fun movie(slug: String): MovieDetail = api.movie(slug)
    suspend fun series(slug: String): SeriesDetail = api.series(slug)
    suspend fun search(q: String): SearchResponse = api.search(q)
    suspend fun movies(): List<CatalogCard> = api.movies().items

    // ---- Watch ----
    suspend fun playback(movieId: String? = null, episodeId: String? = null): PlaybackTicket {
        val t = api.playbackToken(PlaybackBody(movieId, episodeId))
        return t.copy(streamUrl = absoluteStream(t.streamUrl))
    }

    suspend fun saveProgress(movieId: String?, episodeId: String?, positionSec: Int, durationSec: Int) {
        api.saveProgress(ProgressBody(movieId, episodeId, positionSec, durationSec))
    }

    suspend fun continueWatching(): List<ContinueItem> = api.continueWatching().items

    // ---- Watchlist ----
    suspend fun watchlist(sort: String = "recent"): List<WatchlistEntry> = api.watchlist(sort).items
    suspend fun addToList(movieId: String? = null, seriesId: String? = null) {
        api.addWatchlist(WatchlistBody(movieId, seriesId))
    }
    suspend fun removeFromList(id: String) { api.removeWatchlist(id) }

    // ---- Billing ----
    suspend fun plans(): List<Plan> = api.plans().items

    suspend fun subscribe(planId: String): Boolean {
        val order = api.createOrder(CreateOrderBody(planId))
        // Local sandbox: explicit approval, verified server-side.
        return api.verifyPayment(VerifyPaymentBody(order.orderId, sandboxApprove = true)).ok
    }
}
