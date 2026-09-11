package com.mastimalai.ott

import android.app.Application
import com.mastimalai.ott.di.ServiceLocator
import kotlinx.coroutines.runBlocking

class MastiApp : Application() {
    override fun onCreate() {
        super.onCreate()
        ServiceLocator.init(this)
        // Load persisted tokens before the first screen renders.
        runBlocking { ServiceLocator.session.load() }
    }
}
