package com.mastimalai.ott

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.List
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.mastimalai.ott.di.ServiceLocator
import com.mastimalai.ott.ui.screens.DetailScreen
import com.mastimalai.ott.ui.screens.HomeScreen
import com.mastimalai.ott.ui.screens.LoginScreen
import com.mastimalai.ott.ui.screens.MyListScreen
import com.mastimalai.ott.ui.screens.PlayerScreen
import com.mastimalai.ott.ui.screens.ProfileScreen
import com.mastimalai.ott.ui.screens.SearchScreen
import com.mastimalai.ott.ui.screens.SeriesScreen
import com.mastimalai.ott.ui.screens.SubscriptionScreen
import com.mastimalai.ott.ui.theme.MastiMalaiTheme

private data class Tab(val route: String, val label: String, val icon: ImageVector)

private val TABS = listOf(
    Tab("home", "Home", Icons.Filled.Home),
    Tab("search", "Search", Icons.Filled.Search),
    Tab("mylist", "My List", Icons.Filled.List),
    Tab("profile", "Profile", Icons.Filled.Person),
)

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            MastiMalaiTheme {
                AppRoot()
            }
        }
    }
}

@Composable
private fun AppRoot() {
    val nav = rememberNavController()
    val start = if (ServiceLocator.session.isLoggedIn) "home" else "login"

    val backStack by nav.currentBackStackEntryAsState()
    val currentRoute = backStack?.destination?.route
    val showBottomBar = TABS.any { it.route == currentRoute }

    Scaffold(
        bottomBar = {
            if (showBottomBar) {
                NavigationBar {
                    val dest = backStack?.destination
                    TABS.forEach { tab ->
                        NavigationBarItem(
                            selected = dest?.hierarchy?.any { it.route == tab.route } == true,
                            onClick = {
                                nav.navigate(tab.route) {
                                    popUpTo(nav.graph.findStartDestination().id) { saveState = true }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            },
                            icon = { Icon(tab.icon, contentDescription = tab.label) },
                            label = { Text(tab.label) },
                        )
                    }
                }
            }
        }
    ) { padding ->
        NavHost(
            navController = nav,
            startDestination = start,
            modifier = Modifier.padding(padding),
        ) {
            composable("login") { LoginScreen(onLoggedIn = { nav.navigate("home") { popUpTo("login") { inclusive = true } } }) }
            composable("home") { HomeScreen(nav) }
            composable("search") { SearchScreen(nav) }
            composable("mylist") { MyListScreen(nav) }
            composable("profile") { ProfileScreen(nav) }
            composable("subscription") { SubscriptionScreen(nav) }
            composable("movie/{slug}") { DetailScreen(nav, it.arguments?.getString("slug").orEmpty()) }
            composable("series/{slug}") { SeriesScreen(nav, it.arguments?.getString("slug").orEmpty()) }
            composable("watch/{kind}/{id}") {
                PlayerScreen(
                    nav,
                    kind = it.arguments?.getString("kind").orEmpty(),
                    id = it.arguments?.getString("id").orEmpty(),
                )
            }
        }
    }
}
