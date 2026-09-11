package com.mastimalai.ott.data

import com.mastimalai.ott.BuildConfig
import kotlinx.serialization.json.Json
import okhttp3.Authenticator
import okhttp3.Interceptor
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import okhttp3.Route
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory

object Network {

    val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        encodeDefaults = true
    }

    fun create(session: SessionManager): ApiService {
        val base = BuildConfig.API_BASE_URL.trimEnd('/') + "/"

        // Tags every request as the Android platform (for content/plan filtering) and
        // adds Authorization + X-Profile-Id when present.
        val authInterceptor = Interceptor { chain ->
            val builder = chain.request().newBuilder()
            builder.header("X-Platform", "android")
            session.accessToken?.let { builder.header("Authorization", "Bearer $it") }
            session.profileId?.let { builder.header("X-Profile-Id", it) }
            chain.proceed(builder.build())
        }

        // On 401, refresh the access token once and retry.
        val refreshClient = OkHttpClient.Builder().build()
        val authenticator = Authenticator { _: Route?, response: Response ->
            if (responseCount(response) >= 2) return@Authenticator null
            val refresh = session.refreshToken ?: return@Authenticator null
            val body = json.encodeToString(RefreshBody.serializer(), RefreshBody(refresh))
                .toRequestBody("application/json".toMediaType())
            val req = Request.Builder().url(base + "auth/refresh").post(body).build()
            val resp = try {
                refreshClient.newCall(req).execute()
            } catch (e: Exception) {
                return@Authenticator null
            }
            resp.use {
                val text = it.body?.string()
                if (!it.isSuccessful || text == null) return@Authenticator null
                val tokens = try {
                    json.decodeFromString(RefreshResponse.serializer(), text)
                } catch (e: Exception) {
                    return@Authenticator null
                }
                session.saveTokensBlocking(tokens.accessToken, tokens.refreshToken)
                response.request.newBuilder()
                    .header("Authorization", "Bearer ${tokens.accessToken}")
                    .build()
            }
        }

        val logging = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BASIC
            else HttpLoggingInterceptor.Level.NONE
        }

        val client = OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(logging)
            .authenticator(authenticator)
            .build()

        return Retrofit.Builder()
            .baseUrl(base)
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(ApiService::class.java)
    }

    private fun responseCount(response: Response): Int {
        var count = 1
        var prior = response.priorResponse
        while (prior != null) {
            count++
            prior = prior.priorResponse
        }
        return count
    }
}
