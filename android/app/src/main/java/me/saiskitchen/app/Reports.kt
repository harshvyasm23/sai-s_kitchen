package me.saiskitchen.app

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.PersonSearch
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.LocalDate

@Composable
fun ReportsScreen(store: KitchenStore) {
    var search by remember { mutableStateOf("") }
    var selectedId by rememberSaveable { mutableStateOf<String?>(null) }
    var start by remember { mutableStateOf(Fmt.startOfMonth()) }
    var end by remember { mutableStateOf(LocalDate.now()) }
    val selected = store.customers.firstOrNull { it.id == selectedId }
    val matches = store.customers.filter { search.isBlank() || it.name.contains(search, true) || it.phone.contains(search, true) }.take(4)
    val cur = store.settings.currency

    TabScreen("Customer Reports") {
        AppCard {
            Text("Search Customer", fontWeight = FontWeight.Bold, fontSize = 17.sp)
            Spacer(Modifier.height(8.dp))
            SearchField(search, { search = it }, "Search by name or phone...")
            if (selected != null) {
                Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Selected: ${selected.name}", color = Brand.primary, fontWeight = FontWeight.SemiBold)
                    TextButton(onClick = { selectedId = null }) { Text("Clear") }
                }
            }
            matches.forEach { c ->
                TextButton(onClick = { selectedId = c.id; search = "" }, modifier = Modifier.fillMaxWidth()) {
                    Column(Modifier.fillMaxWidth()) {
                        Text(c.name, color = MaterialTheme.colorScheme.onSurface)
                        Text(c.phone, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                }
            }
        }
        AppCard {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                DateField("From", start, { start = it; if (end.isBefore(it)) end = it }, Modifier.weight(1f))
                DateField("To", end, { end = it }, Modifier.weight(1f))
            }
        }
        if (selected == null) {
            EmptyState(Icons.Default.PersonSearch, "Select a customer", "Choose a customer to view their entries")
        } else {
            val t = store.tiffins(selected.id, start, end)
            val o = store.catering(selected.id, start, end)
            val tt = t.sumOf { it.total }
            val ct = o.sumOf { it.total }
            AppCard {
                Text(selected.name, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Spacer(Modifier.height(6.dp))
                SummaryRow("Tiffin Entries", "${t.size}")
                SummaryRow("Tiffins Delivered", t.sumOf { it.quantity }.clean())
                SummaryRow("Tiffin Total", Fmt.currency(tt, cur))
                SummaryRow("Catering Orders", "${o.size}")
                SummaryRow("Catering Total", Fmt.currency(ct, cur))
                SummaryRow("Grand Total", Fmt.currency(tt + ct, cur), isTotal = true)
            }
            t.forEach {
                EntryCard(Fmt.displayDate(it.date), "Noon ${it.noonQty.clean()}, Evening ${it.eveningQty.clean()}" +
                    if (it.notes.isNotBlank()) " • ${it.notes}" else "", Fmt.currency(it.total, cur), Brand.primary)
            }
            o.forEach {
                EntryCard(Fmt.displayDate(it.date), "${it.items.size} item(s): " + it.items.joinToString { i -> i.itemName },
                    Fmt.currency(it.total, cur), Brand.secondary)
            }
        }
    }
}

@Composable
fun OutstandingScreen(store: KitchenStore, onClose: () -> Unit) {
    var month by remember { mutableStateOf(LocalDate.now()) }
    val cur = store.settings.currency
    OverlayScaffold("Outstanding Report", onClose) {
        AppCard {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                TextButton(onClick = { month = month.minusMonths(1) }) { Text("‹ Prev") }
                Text("${month.month.name.lowercase().replaceFirstChar { it.uppercase() }} ${month.year}", fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(top = 12.dp))
                TextButton(onClick = { month = month.plusMonths(1) }) { Text("Next ›") }
            }
        }
        val s = Fmt.startOfMonth(month)
        val e = Fmt.endOfMonth(month)
        var any = false
        store.customers.forEach { c ->
            val total = store.tiffins(c.id, s, e).sumOf { it.total } + store.catering(c.id, s, e).sumOf { it.total }
            if (total > 0) { any = true; EntryCard(c.name, c.phone, Fmt.currency(total, cur), Brand.primary) }
        }
        if (!any) Text("No entries for this month.", color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}
