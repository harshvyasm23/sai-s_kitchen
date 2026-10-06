package me.saiskitchen.app

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

object Brand {
    val primary = Color(0xFFFF6B35)
    val secondary = Color(0xFFF7931E)
    val success = Color(0xFF10B981)
    val info = Color(0xFF3B82F6)
    val error = Color(0xFFEF4444)
}

private val Light = lightColorScheme(
    primary = Brand.primary, secondary = Brand.secondary, background = Color(0xFFFFF8F0),
    surface = Color.White, onSurface = Color(0xFF2D3142), onBackground = Color(0xFF2D3142),
    surfaceVariant = Color(0xFFFFF3E6), onSurfaceVariant = Color(0xFF6B7280), outlineVariant = Color(0xFFE5E7EB),
)
private val Dark = darkColorScheme(
    primary = Brand.primary, secondary = Brand.secondary, background = Color(0xFF0F1419),
    surface = Color(0xFF1A1F29), onSurface = Color(0xFFF9FAFB), onBackground = Color(0xFFF9FAFB),
    surfaceVariant = Color(0xFF242B38), onSurfaceVariant = Color(0xFF9CA3AF), outlineVariant = Color(0xFF374151),
)

@Composable
fun SaiTheme(mode: ThemeMode, content: @Composable () -> Unit) {
    val dark = when (mode) { ThemeMode.Light -> false; ThemeMode.Dark -> true; ThemeMode.Auto -> isSystemInDarkTheme() }
    MaterialTheme(colorScheme = if (dark) Dark else Light, content = content)
}
