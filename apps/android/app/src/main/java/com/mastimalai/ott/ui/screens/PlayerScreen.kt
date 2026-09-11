package com.mastimalai.ott.ui.screens

import androidx.annotation.OptIn
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.MediaItem
import androidx.media3.common.util.UnstableApi
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import androidx.navigation.NavController
import com.mastimalai.ott.data.PlaybackTicket
import com.mastimalai.ott.di.ServiceLocator
import com.mastimalai.ott.ui.components.Loading
import com.mastimalai.ott.ui.theme.Muted
import kotlinx.coroutines.DelicateCoroutinesApi
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import retrofit2.HttpException

private sealed interface PlayState {
    data object Loading : PlayState
    data object NeedSubscription : PlayState
    data class Error(val message: String) : PlayState
    data class Ready(val ticket: PlaybackTicket) : PlayState
}

@OptIn(UnstableApi::class)
@Composable
fun PlayerScreen(nav: NavController, kind: String, id: String) {
    val repo = ServiceLocator.repository
    var state by remember { mutableStateOf<PlayState>(PlayState.Loading) }

    // 1) Request a signed playback ticket (runs the server access-control chain).
    LaunchedEffect(kind, id) {
        state = try {
            val ticket = if (kind == "movie") repo.playback(movieId = id) else repo.playback(episodeId = id)
            PlayState.Ready(ticket)
        } catch (e: HttpException) {
            if (e.code() == 402) PlayState.NeedSubscription
            else PlayState.Error("Playback unavailable (${e.code()})")
        } catch (e: Exception) {
            PlayState.Error(e.message ?: "Network error")
        }
    }

    when (val s = state) {
        is PlayState.Loading -> Loading()
        is PlayState.NeedSubscription -> Wall(
            "Masti Premium required", "Yeh premium content hai. Subscribe karke dekhiye.",
            "Get Premium"
        ) { nav.navigate("subscription") }
        is PlayState.Error -> Wall("Video load nahi ho pa raha", s.message, "Go Back") { nav.popBackStack() }
        is PlayState.Ready -> PlayerSurface(kind, id, s.ticket)
    }
}

@OptIn(UnstableApi::class, DelicateCoroutinesApi::class)
@Composable
private fun PlayerSurface(kind: String, id: String, ticket: PlaybackTicket) {
    val context = LocalContext.current
    val repo = ServiceLocator.repository

    val player = remember {
        ExoPlayer.Builder(context).build().apply {
            setMediaItem(MediaItem.fromUri(ticket.streamUrl))
            prepare()
            if (ticket.startPositionSec > 0) seekTo(ticket.startPositionSec * 1000L)
            playWhenReady = true
        }
    }

    // Persist progress every 15s while playing, and once on exit.
    LaunchedEffect(player) {
        while (true) {
            delay(15_000)
            val pos = (player.currentPosition / 1000).toInt()
            val dur = (player.duration / 1000).toInt()
            if (dur > 0) {
                runCatching {
                    if (kind == "movie") repo.saveProgress(id, null, pos, dur)
                    else repo.saveProgress(null, id, pos, dur)
                }
            }
        }
    }

    DisposableEffect(Unit) {
        onDispose {
            val pos = (player.currentPosition / 1000).toInt()
            val dur = (player.duration / 1000).toInt()
            if (dur > 0) {
                // Best-effort final save so resume is accurate even on quick exit.
                kotlinx.coroutines.GlobalScope.launch {
                    runCatching {
                        if (kind == "movie") repo.saveProgress(id, null, pos, dur)
                        else repo.saveProgress(null, id, pos, dur)
                    }
                }
            }
            player.release()
        }
    }

    AndroidView(
        factory = {
            PlayerView(it).apply {
                this.player = player
                useController = true
            }
        },
        modifier = Modifier.fillMaxSize(),
    )
}

@Composable
private fun Wall(title: String, message: String, cta: String, onClick: () -> Unit) {
    Box(Modifier.fillMaxSize().padding(24.dp), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(title, color = Color.White, fontSize = 20.sp, fontWeight = FontWeight.Bold)
            Text(message, color = Muted, fontSize = 14.sp)
            Button(onClick = onClick) { Text(cta) }
        }
    }
}
