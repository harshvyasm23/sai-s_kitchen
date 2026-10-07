package me.saiskitchen.app

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.format.TextStyle
import java.util.Locale

private val ROUTE_ORDER = listOf("omena", "pasila", "lepp", "myyr", "station", "other", "home")
private fun placeLabel(key: String) = when (key) {
    "other" -> "Other / not set"
    "home" -> "Pickup / no delivery"
    else -> WhatsAppParser.placeByKey(key)?.label ?: "Other / not set"
}
fun dayName(d: Int) = DayOfWeek.of(d).getDisplayName(TextStyle.SHORT, Locale.UK)

/** What to cook and where to deliver on a given day, with one-tap entry from weekly schedules. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
fun KitchenPlanScreen(store: KitchenStore, onOpen: (String) -> Unit, onClose: () -> Unit) {
    var date by remember { mutableStateOf(LocalDate.now()) }
    val cur = store.settings.currency
    val planned = store.plannedFor(date)
    val holiday = store.isHoliday(date)
    // lines that will actually be cooked
    val cooking = planned.filter { it.entry != null || (!it.skipped && !holiday) }
    val noon = cooking.sumOf { it.entry?.noonQty ?: it.noon }
    val eve = cooking.sumOf { it.entry?.eveningQty ?: it.evening }
    val pending = planned.filter { it.entry == null && !it.skipped && !holiday && it.qty > 0 }

    OverlayScaffold("Today's Kitchen", onClose) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            FilterChip(selected = date == LocalDate.now(), onClick = { date = LocalDate.now() }, label = { Text("Today") })
            FilterChip(selected = date == LocalDate.now().plusDays(1), onClick = { date = LocalDate.now().plusDays(1) }, label = { Text("Tomorrow") })
        }
        DateField("Date", date, { date = it }, Modifier.fillMaxWidth())
        AppCard {
            Text("${date.dayOfWeek.getDisplayName(TextStyle.FULL, Locale.UK)} menu", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(store.menu[date.dayOfWeek.value] ?: "", fontWeight = FontWeight.SemiBold)
        }
        AppCard {
            Text("To cook: ${(noon + eve).clean()} tiffins", fontWeight = FontWeight.Bold, fontSize = 22.sp, color = Brand.primary)
            Text("Noon ${noon.clean()}  •  Evening ${eve.clean()}  •  ${cooking.size} customers", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(8.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Holiday - no tiffin for anyone", modifier = Modifier.weight(1f))
                Switch(checked = holiday, onCheckedChange = { store.setSkip("", date, it) })
            }
        }
        if (pending.isNotEmpty()) {
            Button(onClick = { pending.forEach { store.confirmPlanned(it, date) } }, modifier = Modifier.fillMaxWidth()) {
                Text("Add entries for all ${pending.size} pending")
            }
        }
        if (planned.isEmpty()) {
            AppCard {
                Text("No one scheduled for this day.", fontWeight = FontWeight.SemiBold)
                Text("Set each regular customer's weekdays once, and they appear here every week.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        planned.groupBy { it.place.takeIf { k -> k in ROUTE_ORDER } ?: "other" }.toList()
            .sortedBy { ROUTE_ORDER.indexOf(it.first) }.forEach { (key, rows) ->
                val n = rows.filter { it in cooking }.sumOf { it.entry?.quantity ?: it.qty }
                Text("${placeLabel(key)}  •  ${n.clean()} tiffins", fontWeight = FontWeight.Bold, fontSize = 16.sp, color = Brand.primary)
                rows.forEach { p ->
                    val done = "$date|${p.customer.id}" in store.delivered
                    AppCard {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Column(Modifier.weight(1f)) {
                                Text(p.customer.name, fontWeight = FontWeight.SemiBold)
                                val e = p.entry
                                val q = if (e != null) "Noon ${e.noonQty.clean()} + Evening ${e.eveningQty.clean()}" else "Noon ${p.noon.clean()} + Evening ${p.evening.clean()}"
                                Text(q + if (p.customer.phone.isNotBlank()) "  •  ${p.customer.phone}" else "", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                                when {
                                    e != null -> Text("✓ Entry saved ${Fmt.currency(e.total, cur)}", fontSize = 12.sp, color = Brand.success)
                                    p.skipped || holiday -> Text("Skipped", fontSize = 12.sp, color = Brand.error)
                                    else -> Text("Pending", fontSize = 12.sp, color = Brand.secondary)
                                }
                            }
                            if (!p.skipped && !holiday) Column(horizontalAlignment = Alignment.CenterHorizontally) {
                                Checkbox(checked = done, onCheckedChange = { store.toggleDelivered(p.customer.id, date) })
                                Text("Delivered", fontSize = 10.sp)
                            }
                        }
                        if (p.entry == null && !holiday) Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (!p.skipped && p.qty > 0) Button(onClick = { store.confirmPlanned(p, date) }) { Text("Add entry") }
                            OutlinedButton(onClick = { store.setSkip(p.customer.id, date, !p.skipped) }) { Text(if (p.skipped) "Undo skip" else "Skip this day") }
                        }
                    }
                }
            }
        OutlinedButton(onClick = { onOpen("schedules") }, modifier = Modifier.fillMaxWidth()) { Text("Weekly schedules (set who comes which days)") }
        OutlinedButton(onClick = { onOpen("menu") }, modifier = Modifier.fillMaxWidth()) { Text("Weekly menu & poster") }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun SchedulesScreen(store: KitchenStore, onClose: () -> Unit) {
    var query by remember { mutableStateOf("") }
    var editing by remember { mutableStateOf<Customer?>(null) }
    OverlayScaffold("Weekly Schedules", onClose) {
        Text("Pick the days each regular customer gets tiffin. They then show up in Today's Kitchen automatically; you only confirm or skip.",
            fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        SearchField(query, { query = it }, "Search customer...")
        store.customers.filter { it.isActive && (query.isBlank() || it.name.contains(query, true)) }.sortedBy { it.name.lowercase() }.forEach { c ->
            val s = store.schedule(c.id)
            AppCard(onClick = { editing = c }) {
                Text(c.name, fontWeight = FontWeight.SemiBold)
                if (s == null) Text("Not scheduled - tap to set", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                else Text(s.days.sorted().joinToString(" ") { dayName(it) } + "  •  noon ${s.noon.clean()} / evening ${s.evening.clean()}  •  " + placeLabel(s.place),
                    fontSize = 12.sp, color = Brand.primary)
            }
        }
    }
    editing?.let { c -> ScheduleDialog(store, c) { editing = null } }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ScheduleDialog(store: KitchenStore, c: Customer, onDone: () -> Unit) {
    val old = store.schedule(c.id)
    var days by remember { mutableStateOf(old?.days ?: setOf(1, 2, 3, 4, 5)) }
    var noon by remember { mutableStateOf((old?.noon ?: 0.0).clean()) }
    var eve by remember { mutableStateOf((old?.evening ?: 1.0).clean()) }
    var place by remember { mutableStateOf(old?.place ?: "home") }
    AlertDialog(
        onDismissRequest = onDone,
        title = { Text(c.name, fontSize = 17.sp) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    (1..7).forEach { d -> FilterChip(selected = d in days, onClick = { days = if (d in days) days - d else days + d }, label = { Text(dayName(d)) }) }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    NumberField("Noon", noon, { noon = it }, Modifier.weight(1f))
                    NumberField("Evening", eve, { eve = it }, Modifier.weight(1f))
                }
                Text("Delivery place (charged per tiffin)", fontSize = 12.sp)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    WhatsAppParser.PLACES.forEach { p -> FilterChip(selected = place == p.key, onClick = { place = p.key }, label = { Text(p.label) }) }
                }
            }
        },
        confirmButton = {
            TextButton(enabled = days.isNotEmpty() && noon.dec() + eve.dec() > 0, onClick = {
                store.setSchedule(Schedule(c.id, days, noon.dec(), eve.dec(), place)); onDone()
            }) { Text("Save") }
        },
        dismissButton = {
            Row {
                if (old != null) TextButton(onClick = { store.removeSchedule(c.id); onDone() }) { Text("Remove", color = Brand.error) }
                TextButton(onClick = onDone) { Text("Cancel") }
            }
        },
    )
}
