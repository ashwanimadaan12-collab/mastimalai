package com.mastimalai.ott.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import coil.compose.AsyncImage
import com.mastimalai.ott.data.MovieDetail
import com.mastimalai.ott.di.ServiceLocator
import com.mastimalai.ott.ui.components.Loading
import com.mastimalai.ott.ui.components.SectionRow
import com.mastimalai.ott.ui.theme.Accent
import com.mastimalai.ott.ui.theme.Muted
import kotlinx.coroutines.launch

@Composable
fun DetailScreen(nav: NavController, slug: String) {
    val repo = ServiceLocator.repository
    val scope = rememberCoroutineScope()
    var movie by remember { mutableStateOf<MovieDetail?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var toast by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(slug) {
        try { movie = repo.movie(slug) } catch (e: Exception) { error = e.message }
    }

    val m = movie
    if (error != null) { Box(Modifier.fillMaxSize().padding(24.dp)) { Text(error!!, color = Muted) }; return }
    if (m == null) { Loading(); return }

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        Box(Modifier.fillMaxWidth().height(240.dp)) {
            AsyncImage(
                model = m.backdrop ?: m.poster,
                contentDescription = m.title,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
            Box(Modifier.fillMaxSize().background(
                Brush.verticalGradient(listOf(Color.Transparent, Color(0xFF0B0B0F)))
            ))
        }
        Column(Modifier.padding(16.dp)) {
            Text(m.title, color = Color.White, fontSize = 26.sp, fontWeight = FontWeight.Black)
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                m.year?.let { Text(it.toString(), color = Muted, fontSize = 13.sp) }
                m.durationSec?.let { Text("${it / 60} min", color = Muted, fontSize = 13.sp) }
                m.ageRating?.let { Text(it, color = Muted, fontSize = 13.sp) }
                m.language?.let { Text(it.name, color = Muted, fontSize = 13.sp) }
                if (m.access == "PREMIUM") Text("PREMIUM", color = Accent, fontSize = 13.sp, fontWeight = FontWeight.Bold)
            }
            m.description?.let {
                Text(it, color = Color(0xFFD1D5DB), fontSize = 14.sp, modifier = Modifier.padding(top = 12.dp))
            }
            Row(Modifier.padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                if (m.hasVideo) {
                    Button(onClick = { nav.navigate("watch/movie/${m.id}") }) { Text("▶  Play") }
                } else {
                    Text("Not ready to stream", color = Muted, modifier = Modifier.padding(12.dp))
                }
                OutlinedButton(
                    onClick = {
                        scope.launch {
                            try { repo.addToList(movieId = m.id); toast = "Added to My List ✓" }
                            catch (e: Exception) { toast = "Could not add" }
                        }
                    },
                    colors = ButtonDefaults.outlinedButtonColors(contentColor = Color.White),
                ) { Text("+ My List") }
            }
            toast?.let { Text(it, color = Accent, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp)) }
            if (m.cast.isNotEmpty()) {
                Text(
                    "Cast: " + m.cast.filter { it.role == "ACTOR" }.joinToString { it.name },
                    color = Muted, fontSize = 13.sp, modifier = Modifier.padding(top = 14.dp),
                )
            }
        }
        SectionRow("More Like This", m.related) { openCard(nav, it) }
    }
}
