package me.saiskitchen.app

import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Euro
import androidx.compose.material.icons.filled.Fastfood
import androidx.compose.material.icons.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material.icons.filled.LocalShipping
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.LocalDate

enum class Period(val label: String) {
    Today("Today"), Yesterday("Yesterday"), Week("Week"), Month("This Month"), MonthRange("Month Range"), Custom("Custom Date")
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun DashboardScreen(store: KitchenStore) {
    var period by rememberSaveable { mutableStateOf(Period.Today) }
    var customStart by remember { mutableStateOf(LocalDate.now()) }
    var customEnd by remember { mutableStateOf(LocalDate.now()) }
    var month by remember { mutableStateOf(LocalDate.now()) }
    val today = LocalDate.now()
    val (start, end) = when (period) {
        Period.Today -> today to today
        Period.Yesterday -> today.minusDays(1) to today.minusDays(1)
        Period.Week -> Fmt.startOfWeek() to today
        Period.Month -> Fmt.startOfMonth() to today
        Period.MonthRange -> Fmt.startOfMonth(month) to Fmt.endOfMonth(month)
        Period.Custom -> customStart to customEnd
    }
    val m = store.metrics(start, end)
    val cur = store.settings.currency

    Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState())) {
        GradientBox(Modifier.fillMaxWidth().clip(RoundedCornerShape(bottomStart = 28.dp, bottomEnd = 28.dp))) {
            Column(Modifier.statusBarsPadding().padding(24.dp).padding(top = 24.dp, bottom = 12.dp)) {
                Text("Sai's Kitchen", color = Color.White, fontSize = 34.sp, fontWeight = FontWeight.Bold)
                Text("Tiffin Tracker & Invoicing", color = Color.White.copy(alpha = 0.9f), fontSize = 15.sp)
            }
        }
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            AppCard {
                Text("Period", fontWeight = FontWeight.Bold, fontSize = 17.sp)
                Spacer(Modifier.height(8.dp))
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Period.values().forEach { p ->
                        FilterChip(selected = period == p, onClick = { period = p }, label = { Text(p.label) })
                    }
                }
                Spacer(Modifier.height(8.dp))
                when (period) {
                    Period.MonthRange -> Row(verticalAlignment = Alignment.CenterVertically) {
                        IconButton(onClick = { month = month.minusMonths(1) }) { Icon(Icons.Default.KeyboardArrowLeft, "Previous month") }
                        Text("${month.month.name.lowercase().replaceFirstChar { it.uppercase() }} ${month.year}",
                            fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
                        IconButton(onClick = { month = month.plusMonths(1) }) { Icon(Icons.Default.KeyboardArrowRight, "Next month") }
                    }
                    Period.Custom -> Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        DateField("From", customStart, { customStart = it; if (customEnd.isBefore(it)) customEnd = it }, Modifier.weight(1f))
                        DateField("To", customEnd, { customEnd = it }, Modifier.weight(1f))
                    }
                    else -> Text(if (start == end) Fmt.displayDate(start) else "${Fmt.displayDate(start)} – ${Fmt.displayDate(end)}",
                        color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                MetricCard("Total Revenue", Fmt.currency(m.totalRevenue, cur), Icons.Default.Euro, Brand.success, Modifier.weight(1f))
                MetricCard("Tiffins Delivered", m.totalTiffins.clean(), Icons.Default.Fastfood, Brand.primary, Modifier.weight(1f))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                MetricCard("Catering Orders", "${m.cateringOrders}", Icons.Default.Restaurant, Brand.secondary, Modifier.weight(1f))
                MetricCard("Delivery Charges", Fmt.currency(m.deliveryTotal, cur), Icons.Default.LocalShipping, Brand.info, Modifier.weight(1f))
            }

            val tiffinRevenue = (m.totalRevenue - m.cateringRevenue).coerceAtLeast(0.0)
            AppCard {
                Text("Revenue Breakdown", fontWeight = FontWeight.Bold, fontSize = 17.sp)
                Spacer(Modifier.height(12.dp))
                if (m.totalRevenue > 0) {
                    Row(Modifier.fillMaxWidth().height(14.dp).clip(RoundedCornerShape(7.dp))) {
                        if (tiffinRevenue > 0) Box(Modifier.weight(tiffinRevenue.toFloat()).fillMaxHeight().background(Brand.primary))
                        if (m.cateringRevenue > 0) Box(Modifier.weight(m.cateringRevenue.toFloat()).fillMaxHeight().background(Brand.secondary))
                    }
                } else {
                    Box(Modifier.fillMaxWidth().height(14.dp).clip(RoundedCornerShape(7.dp)).background(MaterialTheme.colorScheme.outlineVariant))
                }
                Spacer(Modifier.height(10.dp))
                SummaryRow("Tiffin", Fmt.currency(tiffinRevenue, cur))
                SummaryRow("Catering", Fmt.currency(m.cateringRevenue, cur))
                SummaryRow("Total", Fmt.currency(m.totalRevenue, cur), isTotal = true)
            }
        }
    }
}

@Composable
private fun MetricCard(label: String, value: String, icon: ImageVector, color: Color, modifier: Modifier) {
    AppCard(modifier) {
        Box(Modifier.size(40.dp).clip(RoundedCornerShape(12.dp)).background(color.copy(alpha = 0.15f)), contentAlignment = Alignment.Center) {
            Icon(icon, null, tint = color)
        }
        Spacer(Modifier.height(10.dp))
        Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
        Text(value, fontWeight = FontWeight.Bold, fontSize = 20.sp)
    }
}
