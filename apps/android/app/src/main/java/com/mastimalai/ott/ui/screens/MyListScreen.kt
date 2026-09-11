package com.mastimalai.ott.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.mastimalai.ott.data.WatchlistEntry
import com.mastimalai.ott.di.ServiceLocator
import com.mastimalai.ott.ui.components.Loading
import com.mastimalai.ott.ui.components.PosterCard
import com.mastimalai.ott.ui.theme.Muted
import kotlinx.coroutines.launch

@Composable
fun MyListScreen(nav: NavController) {
    val repo = ServiceLocator.repository
    val scope = rememberCoroutineScope()
    var items by remember { mutableStateOf<List<WatchlistEntry>?>(null) }

    suspend fun reload() { items = runCatching { repo.watchlist() }.getOrDefault(emptyList()) }
    LaunchedEffect(Unit) { reload() }

    val list = items
    if (list == null) { Loading(); return }

    Column(Modifier.fillMaxSize().padding(16.dp)) {
        Text("My List", color = androidx.compose.ui.graphics.Color.White, fontSize = 22.sp, fontWeight = FontWeight.Black)
        if (list.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Abhi aapki list khali hai.", color = Muted)
            }
        } else {
            LazyVerticalGrid(
                columns = GridCells.Adaptive(120.dp),
                contentPadding = PaddingValues(top = 12.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(list, key = { it.id }) { entry ->
                    PosterCard(entry.content) { openCard(nav, entry.content) }
                }
            }
        }
    }
}
