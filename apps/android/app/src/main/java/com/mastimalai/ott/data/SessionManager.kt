package com.mastimalai.ott.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking

private val Context.dataStore by preferencesDataStore(name = "masti_session")

// Holds the auth token + active profile. In-memory copies are read synchronously by
// the OkHttp interceptor/authenticator; the DataStore persists them across launches.
class SessionManager(private val context: Context) {

    @Volatile var accessToken: String? = null
        private set
    @Volatile var refreshToken: String? = null
        private set
    @Volatile var profileId: String? = null
        private set

    val isLoggedIn: Boolean get() = accessToken != null

    suspend fun load() {
        val prefs = context.dataStore.data.first()
        accessToken = prefs[ACCESS]
        refreshToken = prefs[REFRESH]
        profileId = prefs[PROFILE]
    }

    suspend fun saveTokens(access: String, refresh: String) {
        accessToken = access
        refreshToken = refresh
        context.dataStore.edit {
            it[ACCESS] = access
            it[REFRESH] = refresh
        }
    }

    // Called from the OkHttp authenticator thread (no coroutine context).
    fun saveTokensBlocking(access: String, refresh: String) = runBlocking { saveTokens(access, refresh) }

    suspend fun setProfile(id: String) {
        profileId = id
        context.dataStore.edit { it[PROFILE] = id }
    }

    suspend fun clear() {
        accessToken = null
        refreshToken = null
        profileId = null
        context.dataStore.edit { it.clear() }
    }

    companion object {
        private val ACCESS = stringPreferencesKey("access")
        private val REFRESH = stringPreferencesKey("refresh")
        private val PROFILE = stringPreferencesKey("profile")
    }
}
