package com.mastimalai.ott.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val Accent = Color(0xFFFF8A1E)
val Accent2 = Color(0xFFFFD15C)
val Base = Color(0xFF0B0B0F)
val Surface = Color(0xFF15151D)
val CardBg = Color(0xFF1C1C26)
val Muted = Color(0xFF9AA0AB)

private val MastiColors = darkColorScheme(
    primary = Accent,
    onPrimary = Color.Black,
    secondary = Accent2,
    background = Base,
    onBackground = Color(0xFFF3F4F6),
    surface = Surface,
    onSurface = Color(0xFFF3F4F6),
    surfaceVariant = CardBg,
)

@Composable
fun MastiMalaiTheme(content: @Composable () -> Unit) {
    // A committed dark, cinematic look regardless of system setting.
    @Suppress("UNUSED_EXPRESSION")
    isSystemInDarkTheme()
    MaterialTheme(colorScheme = MastiColors, content = content)
}
