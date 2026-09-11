package com.mastimalai.ott.data

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface ApiService {
    @POST("auth/send-otp")
    suspend fun sendOtp(@Body body: SendOtpBody): SendOtpResponse

    @POST("auth/verify-otp")
    suspend fun verifyOtp(@Body body: VerifyOtpBody): VerifyOtpResponse

    @GET("users/me")
    suspend fun me(): Me

    @GET("home")
    suspend fun home(): HomeResponse

    @GET("movies/{slug}")
    suspend fun movie(@Path("slug") slug: String): MovieDetail

    @GET("series/{slug}")
    suspend fun series(@Path("slug") slug: String): SeriesDetail

    @GET("movies")
    suspend fun movies(
        @Query("genre") genre: String? = null,
        @Query("language") language: String? = null,
        @Query("access") access: String? = null,
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 30,
    ): Paginated<CatalogCard>

    @GET("search")
    suspend fun search(@Query("q") q: String): SearchResponse

    @GET("plans")
    suspend fun plans(): PlansResponse

    @POST("payments/create-order")
    suspend fun createOrder(@Body body: CreateOrderBody): CreateOrderResponse

    @POST("payments/verify")
    suspend fun verifyPayment(@Body body: VerifyPaymentBody): OkResponse

    @POST("playback/token")
    suspend fun playbackToken(@Body body: PlaybackBody): PlaybackTicket

    @POST("watch/progress")
    suspend fun saveProgress(@Body body: ProgressBody): Response<Unit>

    @GET("watch/continue")
    suspend fun continueWatching(): ContinueResponse

    @GET("watchlist")
    suspend fun watchlist(@Query("sort") sort: String = "recent"): WatchlistResponse

    @POST("watchlist")
    suspend fun addWatchlist(@Body body: WatchlistBody): Response<Unit>

    @DELETE("watchlist/{id}")
    suspend fun removeWatchlist(@Path("id") id: String): Response<Unit>
}
