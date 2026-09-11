package com.mastimalai.ott.di

import android.content.Context
import com.mastimalai.ott.data.ApiService
import com.mastimalai.ott.data.Network
import com.mastimalai.ott.data.Repository
import com.mastimalai.ott.data.SessionManager

// Manual dependency container — simpler than Hilt for a hand-built project and
// avoids annotation processing. Initialised once from the Application.
object ServiceLocator {
    lateinit var session: SessionManager
        private set
    lateinit var repository: Repository
        private set

    fun init(context: Context) {
        session = SessionManager(context.applicationContext)
        val api: ApiService = Network.create(session)
        repository = Repository(api, session)
    }
}
