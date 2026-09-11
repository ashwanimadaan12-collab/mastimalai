package com.mastimalai.ott.ui.screens

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
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
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.NavController
import com.mastimalai.ott.data.Plan
import com.mastimalai.ott.di.ServiceLocator
import com.mastimalai.ott.ui.components.Loading
import com.mastimalai.ott.ui.components.rupees
import com.mastimalai.ott.ui.theme.Accent
import com.mastimalai.ott.ui.theme.CardBg
import com.mastimalai.ott.ui.theme.Muted
import kotlinx.coroutines.launch

@Composable
fun SubscriptionScreen(nav: NavController) {
    val repo = ServiceLocator.repository
    val scope = rememberCoroutineScope()
    var plans by remember { mutableStateOf<List<Plan>?>(null) }
    var message by remember { mutableStateOf<String?>(null) }
    var busyId by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) { plans = runCatching { repo.plans() }.getOrDefault(emptyList()) }

    val list = plans
    if (list == null) { Loading(); return }

    LazyColumn(Modifier.fillMaxSize().padding(16.dp), verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item {
            Text("Get Masti Premium", color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Black)
            Text("Sabhi movies aur series unlock karein.", color = Muted, fontSize = 13.sp)
        }
        message?.let { item { Text(it, color = Accent) } }
        items(list, key = { it.id }) { plan ->
            Card(
                colors = CardDefaults.cardColors(containerColor = CardBg),
                modifier = Modifier.fillMaxWidth().let {
                    if (plan.isRecommended) it.border(2.dp, Accent, RoundedCornerShape(12.dp)) else it
                },
            ) {
                Column(Modifier.padding(16.dp)) {
                    if (plan.isRecommended) Text("MOST POPULAR", color = Accent, fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    Text(plan.name, color = Color.White, fontSize = 18.sp, fontWeight = FontWeight.Bold)
                    Row0(plan)
                    plan.features.forEach { f -> Text("✓ $f", color = Color(0xFFD1D5DB), fontSize = 13.sp) }
                    Button(
                        onClick = {
                            busyId = plan.id; message = null
                            scope.launch {
                                val ok = runCatching { repo.subscribe(plan.id) }.getOrDefault(false)
                                busyId = null
                                message = if (ok) "Masti Premium activated! 🎉" else "Payment failed."
                            }
                        },
                        enabled = busyId == null,
                        modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
                    ) { Text(if (busyId == plan.id) "Processing…" else "Get Premium") }
                }
            }
        }
        item {
            Text(
                "Local sandbox: no real payment is processed.",
                color = Muted, fontSize = 11.sp, modifier = Modifier.padding(top = 8.dp),
            )
        }
    }
}

@Composable
private fun Row0(plan: Plan) {
    androidx.compose.foundation.layout.Row(
        verticalAlignment = androidx.compose.ui.Alignment.Bottom,
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        modifier = Modifier.padding(vertical = 6.dp),
    ) {
        Text(rupees(plan.priceInPaise), color = Color.White, fontSize = 24.sp, fontWeight = FontWeight.Black)
        plan.compareAtPriceInPaise?.let {
            if (it > plan.priceInPaise) Text(
                rupees(it), color = Muted, fontSize = 14.sp,
                textDecoration = TextDecoration.LineThrough,
            )
        }
        Text("/ ${plan.durationDays}d", color = Muted, fontSize = 13.sp)
    }
}
