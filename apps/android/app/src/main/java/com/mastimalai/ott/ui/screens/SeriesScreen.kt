package com.mastimalai.ott.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import coil.compose.AsyncImage
import com.mastimalai.ott.data.SeriesDetail
import com.mastimalai.ott.di.ServiceLocator
import com.mastimalai.ott.ui.components.AccessBadge
import com.mastimalai.ott.ui.components.Loading
import com.mastimalai.ott.ui.theme.Accent
import com.mastimalai.ott.ui.theme.CardBg
import com.mastimalai.ott.ui.theme.Muted

@Composable
fun SeriesScreen(nav: NavController, slug: String) {
    val repo = ServiceLocator.repository
    var series by remember { mutableStateOf<SeriesDetail?>(null) }
    var error by remember { mutableStateOf<String?>(null) }
    var seasonIdx by remember { mutableIntStateOf(0) }

    LaunchedEffect(slug) {
        try { series = repo.series(slug) } catch (e: Exception) { error = e.message }
    }

    val s = series
    if (error != null) { Box(Modifier.fillMaxSize().padding(24.dp)) { Text(error!!, color = Muted) }; return }
    if (s == null) { Loading(); return }
    val season = s.seasons.getOrNull(seasonIdx)

    LazyColumn(Modifier.fillMaxSize()) {
        item {
            Box(Modifier.fillMaxWidth().height(200.dp)) {
                AsyncImage(model = s.backdrop ?: s.poster, contentDescription = s.title,
                    contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
            }
        }
        item {
            Column(Modifier.padding(16.dp)) {
                Text(s.title, color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Black)
                s.description?.let { Text(it, color = Color(0xFFD1D5DB), fontSize = 14.sp, modifier = Modifier.padding(top = 8.dp)) }
                Row(
                    Modifier.horizontalScroll(rememberScrollState()).padding(top = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    s.seasons.forEachIndexed { i, se ->
                        val selected = i == seasonIdx
                        Box(
                            Modifier.clip(RoundedCornerShape(8.dp))
                                .background(if (selected) Accent else CardBg)
                                .clickable { seasonIdx = i }
                                .padding(horizontal = 14.dp, vertical = 6.dp)
                        ) {
                            Text(se.title ?: "Season ${se.number}",
                                color = if (selected) Color.Black else Color.White, fontSize = 13.sp)
                        }
                    }
                }
            }
        }
        items(season?.episodes ?: emptyList(), key = { it.id }) { ep ->
            Row(
                Modifier.fillMaxWidth()
                    .clickable(enabled = ep.hasVideo) { nav.navigate("watch/episode/${ep.id}") }
                    .padding(16.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Box(Modifier.size(width = 130.dp, height = 74.dp).clip(RoundedCornerShape(8.dp)).background(CardBg)) {
                    AsyncImage(model = ep.thumbnail, contentDescription = ep.title,
                        contentScale = ContentScale.Crop, modifier = Modifier.fillMaxSize())
                }
                Column(Modifier.weight(1f)) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("${ep.number}. ${ep.title}", color = Color.White, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                        AccessBadge(ep.access)
                    }
                    ep.description?.let { Text(it, color = Muted, fontSize = 12.sp, maxLines = 2) }
                    if (!ep.hasVideo) Text("Not ready", color = Muted, fontSize = 11.sp)
                }
            }
        }
    }
}
