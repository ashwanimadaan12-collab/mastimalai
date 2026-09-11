package com.mastimalai.ott.ui.screens

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.navigation.NavController
import com.mastimalai.ott.data.SearchResponse
import com.mastimalai.ott.di.ServiceLocator
import com.mastimalai.ott.ui.components.SectionRow
import com.mastimalai.ott.ui.theme.Muted
import kotlinx.coroutines.delay

@Composable
fun SearchScreen(nav: NavController) {
    val repo = ServiceLocator.repository
    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf<SearchResponse?>(null) }

    // Debounced search.
    LaunchedEffect(query) {
        if (query.trim().length < 2) { results = null; return@LaunchedEffect }
        delay(300)
        results = runCatching { repo.search(query.trim()) }.getOrNull()
    }

    Column(Modifier.fillMaxSize().padding(top = 12.dp)) {
        OutlinedTextField(
            value = query,
            onValueChange = { query = it },
            label = { Text("Search movies, series…") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp),
        )
        val r = results
        LazyColumn(Modifier.fillMaxSize()) {
            if (r != null) {
                item { SectionRow("Movies", r.movies) { openCard(nav, it) } }
                item { SectionRow("Series", r.series) { openCard(nav, it) } }
                if (r.movies.isEmpty() && r.series.isEmpty()) {
                    item { Text("Koi result nahi mila.", color = Muted, modifier = Modifier.padding(24.dp)) }
                }
                if (r.people.isNotEmpty()) {
                    item { Text("People: " + r.people.joinToString(), color = Muted, modifier = Modifier.padding(16.dp)) }
                }
            }
        }
    }
}
