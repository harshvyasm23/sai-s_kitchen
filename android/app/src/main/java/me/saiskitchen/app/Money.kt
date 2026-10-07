package me.saiskitchen.app

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.KeyboardArrowLeft
import androidx.compose.material.icons.filled.KeyboardArrowRight
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.LocalDate

/** Money overview: income, unpaid, best customers, busiest days, quiet customers, one-tap reminders. */
@Composable
fun MoneyScreen(store: KitchenStore, onOpen: (String) -> Unit, onClose: () -> Unit) {
    var month by remember { mutableStateOf(LocalDate.now()) }
    val context = LocalContext.current
    val cur = store.settings.currency
    val start = Fmt.startOfMonth(month); val end = Fmt.endOfMonth(month)
    val rows = store.outstandingRows(start, end)
    val billed = rows.sumOf { it.billed }; val paid = rows.sumOf { it.paid }
    val due = rows.filter { it.balance > 0.005 }.sortedByDescending { it.balance }
    val label = "${month.month.name.lowercase().replaceFirstChar { it.uppercase() }} ${month.year}"
    val monthTiffins = store.tiffins.filter { Fmt.inRange(it.date, start, end) }
    val byDay = (1..7).map { d -> monthTiffins.filter { it.date.dayOfWeek.value == d }.sumOf { it.quantity } }
    val maxDay = (byDay.maxOrNull() ?: 0.0).coerceAtLeast(1.0)
    val label2 = label

    OverlayScaffold("Money Overview", onClose) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = { month = month.minusMonths(1) }) { Icon(Icons.Default.KeyboardArrowLeft, "Previous month") }
            Text(label, fontWeight = FontWeight.SemiBold, modifier = Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            IconButton(onClick = { month = month.plusMonths(1) }) { Icon(Icons.Default.KeyboardArrowRight, "Next month") }
        }
        AppCard {
            SummaryRow("Billed this month", Fmt.currency(billed, cur))
            SummaryRow("Received", Fmt.currency(paid, cur))
            SummaryRow("Still to collect", Fmt.currency(due.sumOf { it.balance }, cur), isTotal = true)
            Text("${due.size} customers have not fully paid", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Text("Who owes money", fontWeight = FontWeight.Bold, fontSize = 17.sp)
        if (due.isEmpty()) AppCard { Text("Everyone is paid up ✓", color = Brand.success, fontWeight = FontWeight.SemiBold) }
        due.forEach { r ->
            AppCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(r.name, fontWeight = FontWeight.SemiBold)
                        Text(if (r.paid <= 0) "Nothing paid yet" else "Paid ${Fmt.currency(r.paid, cur)} of ${Fmt.currency(r.previous + r.billed, cur)}", fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Text(Fmt.currency(r.balance, cur), fontWeight = FontWeight.Bold, color = Brand.error)
                }
                Spacer(Modifier.height(6.dp))
                OutlinedButton(onClick = { openWhatsApp(context, r.phone, reminderText(r, label2, cur)) }) { Text("WhatsApp reminder") }
            }
        }
        OutlinedButton(onClick = { onOpen("outstanding") }, modifier = Modifier.fillMaxWidth()) { Text("Open full Outstanding Report (PDF, record payments)") }

        Text("Best customers", fontWeight = FontWeight.Bold, fontSize = 17.sp)
        AppCard {
            val top = rows.sortedByDescending { it.billed }.take(5)
            if (top.isEmpty()) Text("No entries this month.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            top.forEachIndexed { i, r -> SummaryRow("${i + 1}. ${r.name}", Fmt.currency(r.billed, cur)) }
        }
        Text("Busiest days (tiffins)", fontWeight = FontWeight.Bold, fontSize = 17.sp)
        AppCard {
            (1..7).forEach { d ->
                Row(Modifier.fillMaxWidth().padding(vertical = 3.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(dayName(d), Modifier.width(40.dp), fontSize = 13.sp)
                    Box(Modifier.weight(1f).height(12.dp).clip(RoundedCornerShape(6.dp)).background(MaterialTheme.colorScheme.outlineVariant)) {
                        Box(Modifier.fillMaxWidth((byDay[d - 1] / maxDay).toFloat().coerceIn(0.02f, 1f)).fillMaxHeight().background(Brand.primary))
                    }
                    Text(byDay[d - 1].clean(), Modifier.width(44.dp), fontSize = 13.sp, textAlign = androidx.compose.ui.text.style.TextAlign.End)
                }
            }
        }
        // regulars who stopped ordering
        val today = LocalDate.now()
        val quiet = store.customers.filter { c ->
            val mine = store.tiffins.filter { it.customerId == c.id }
            val last = mine.maxOfOrNull { it.date }
            last != null && last.isBefore(today.minusDays(14)) && mine.count { it.date.isAfter(last.minusDays(60)) } >= 5
        }
        if (quiet.isNotEmpty()) {
            Text("Quiet regulars (no tiffin for 14+ days)", fontWeight = FontWeight.Bold, fontSize = 17.sp)
            AppCard {
                quiet.forEach { c ->
                    val last = store.tiffins.filter { it.customerId == c.id }.maxOf { it.date }
                    SummaryRow(c.name, "last ${Fmt.displayDate(last)}")
                }
            }
        }
    }
}
