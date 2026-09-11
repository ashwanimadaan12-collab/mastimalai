package com.mastimalai.ott.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.mastimalai.ott.data.Me
import com.mastimalai.ott.di.ServiceLocator
import com.mastimalai.ott.ui.theme.Accent
import com.mastimalai.ott.ui.theme.Muted
import kotlinx.coroutines.launch

@Composable
fun ProfileScreen(nav: NavController) {
    val repo = ServiceLocator.repository
    val scope = rememberCoroutineScope()
    var me by remember { mutableStateOf<Me?>(null) }

    LaunchedEffect(Unit) { me = runCatching { repo.me() }.getOrNull() }

    Column(Modifier.fillMaxSize().padding(24.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        Text("Profile", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Black)
        me?.let { m ->
            Text("Mobile: ${m.mobile}", color = Color(0xFFD1D5DB))
            m.profiles.firstOrNull()?.let { Text("Profile: ${it.name}", color = Color(0xFFD1D5DB)) }
            if (m.subscription.isActive) {
                Text("Masti Premium: ${m.subscription.planName} (active)", color = Accent, fontWeight = FontWeight.Bold)
            } else {
                Text("No active subscription", color = Muted)
                Button(onClick = { nav.navigate("subscription") }, modifier = Modifier.fillMaxWidth()) {
                    Text("Get Premium")
                }
            }
        }
        OutlinedButton(
            onClick = {
                scope.launch {
                    repo.logout()
                    nav.navigate("login") { popUpTo(0) }
                }
            },
            modifier = Modifier.fillMaxWidth(),
        ) { Text("Log out", color = Color.Red) }
    }
}
