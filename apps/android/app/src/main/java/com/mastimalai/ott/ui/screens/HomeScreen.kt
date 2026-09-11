package com.mastimalai.ott.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavController
import coil.compose.AsyncImage
import com.mastimalai.ott.data.CatalogCard
import com.mastimalai.ott.data.ContinueItem
import com.mastimalai.ott.data.HeroItem
import com.mastimalai.ott.data.HomeSection
import com.mastimalai.ott.di.ServiceLocator
import com.mastimalai.ott.ui.components.Loading
import com.mastimalai.ott.ui.components.SectionRow
import com.mastimalai.ott.ui.theme.Accent
import kotlinx.coroutines.launch

class HomeViewModel : ViewModel() {
    var sections by mutableStateOf<List<HomeSection>?>(null)
        private set
    var error by mutableStateOf<String?>(null)
        private set

    init { load() }

    fun load() {
        viewModelScope.launch {
            try {
                sections = ServiceLocator.repository.home()
            } catch (e: Exception) {
                error = e.message ?: "Could not load home"
            }
        }
    }
}

fun openCard(nav: NavController, card: CatalogCard) {
    val route = if (card.kind == "movie") "movie/${card.slug}" else "series/${card.slug}"
    nav.navigate(route)
}

@Composable
fun HomeScreen(nav: NavController, vm: HomeViewModel = viewModel()) {
    val sections = vm.sections
    if (sections == null) { Loading(); return }

    LazyColumn(Modifier.fillMaxSize()) {
        sections.forEach { section ->
            when (section.type) {
                "HERO" -> section.hero.firstOrNull()?.let { hero ->
                    item { HeroBanner(hero) { target -> nav.navigate("${target.kind}/${target.slug}") } }
                }
                "CONTINUE_WATCHING" -> if (section.continueWatching.isNotEmpty()) {
                    item { ContinueRow(section.title, section.continueWatching, nav) }
                }
                else -> item { SectionRow(section.title, section.items) { openCard(nav, it) } }
            }
        }
    }
}

@Composable
private fun HeroBanner(hero: HeroItem, onWatch: (com.mastimalai.ott.data.HeroTarget) -> Unit) {
    Box(
        Modifier
            .fillMaxWidth()
            .height(360.dp)
    ) {
        AsyncImage(
            model = hero.backdrop ?: hero.poster,
            contentDescription = hero.title,
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize(),
        )
        Box(
            Modifier.fillMaxSize().background(
                Brush.verticalGradient(listOf(Color.Transparent, Color(0xFF0B0B0F)))
            )
        )
        Column(
            Modifier.fillMaxSize().padding(16.dp),
            verticalArrangement = Arrangement.Bottom,
        ) {
            hero.subtitle?.let { Text(it, color = Accent, fontSize = 12.sp, fontWeight = FontWeight.Bold) }
            Text(hero.title, color = Color.White, fontSize = 30.sp, fontWeight = FontWeight.Black)
            hero.description?.let {
                Text(it, color = Color(0xFFD1D5DB), fontSize = 13.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
            hero.target?.let { target ->
                Button(onClick = { onWatch(target) }, modifier = Modifier.padding(top = 10.dp)) {
                    Text("▶  ${hero.ctaLabel ?: "Watch Now"}")
                }
            }
        }
    }
}

@Composable
private fun ContinueRow(title: String, items: List<ContinueItem>, nav: NavController) {
    Column(Modifier.padding(vertical = 8.dp)) {
        Text(title, color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp))
        LazyRow(
            contentPadding = PaddingValues(horizontal = 16.dp),
            horizontalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            items(items, key = { it.id }) { item ->
                val c = item.content
                val route = if (c.resumeKind == "movie") "watch/movie/${c.id}" else "watch/episode/${c.id}"
                val label = if (c.resumeKind == "movie") (c.title ?: "") else "${c.seriesTitle} · E${c.number}"
                Column(Modifier.width(220.dp).clickable { nav.navigate(route) }) {
                    Box(
                        Modifier.fillMaxWidth().aspectRatio(16f / 9f)
                            .clip(RoundedCornerShape(10.dp)).background(Color(0xFF1C1C26))
                    ) {
                        AsyncImage(
                            model = c.backdrop ?: c.thumbnail ?: c.poster,
                            contentDescription = label,
                            contentScale = ContentScale.Crop,
                            modifier = Modifier.fillMaxSize(),
                        )
                        val pct = if (item.durationSec > 0) item.positionSec.toFloat() / item.durationSec else 0f
                        Box(
                            Modifier.align(androidx.compose.ui.Alignment.BottomStart)
                                .fillMaxWidth().height(3.dp)
                                .background(Color.White.copy(alpha = 0.25f))
                        ) {
                            Box(Modifier.fillMaxWidth(pct).height(3.dp).background(Accent))
                        }
                    }
                    Text(label, color = Color.White, fontSize = 13.sp, maxLines = 1,
                        overflow = TextOverflow.Ellipsis, modifier = Modifier.padding(top = 6.dp))
                }
            }
        }
    }
}
