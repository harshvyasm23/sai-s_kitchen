package me.saiskitchen.app

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.util.Locale

private val WARN = Color(0xFFD97706)

/** Paste (or share from WhatsApp) a day's message; check the preview; save all entries at once. */
@Composable
fun WhatsAppScreen(store: KitchenStore, initialText: String, onClose: () -> Unit) {
    var text by remember { mutableStateOf(initialText) }
    var monthFirst by remember { mutableStateOf(false) }
    val clipboard = LocalClipboardManager.current
    val cur = store.settings.currency
    val parsed = remember(text, monthFirst, store.settings.defaultTiffinPrice) {
        WhatsAppParser.parse(text, monthFirst, store.settings.defaultTiffinPrice)
    }
    val date = parsed.date ?: LocalDate.now()

    val tMatches = parsed.tiffins.map { WhatsAppParser.matchCustomer(it.name, store.customers) }
    val oMatches = parsed.orders.map { WhatsAppParser.matchCustomer(it.name, store.customers) }
    val tDup = parsed.tiffins.mapIndexed { i, _ ->
        val c = tMatches[i].second
        c != null && store.tiffins.any { it.customerId == c.id && it.date == date }
    }
    val tOff = remember(text, monthFirst) { mutableStateMapOf<Int, Boolean>() }
    val oOff = remember(text, monthFirst) { mutableStateMapOf<Int, Boolean>() }
    fun tOn(i: Int) = !(tOff[i] ?: tDup[i])
    fun oOn(i: Int) = !(oOff[i] ?: false)
    val count = parsed.tiffins.indices.count { tOn(it) } + parsed.orders.indices.count { oOn(it) }
    var done by remember { mutableStateOf<String?>(null) }

    fun customerFor(name: String, match: Pair<String, Customer?>, created: MutableMap<String, Customer>): Customer {
        match.second?.let { return it }
        val key = WhatsAppParser.norm(name).trim()
        return created.getOrPut(key) {
            Customer(name = name.split(" ").joinToString(" ") { w -> w.replaceFirstChar { it.uppercase() } }, phone = "")
                .also { store.addCustomer(it) }
        }
    }

    fun save() {
        val created = mutableMapOf<String, Customer>()
        val tiffins = parsed.tiffins.mapIndexedNotNull { i, t ->
            if (!tOn(i)) null else {
                val c = customerFor(t.name, tMatches[i], created)
                TiffinEntry(date = date, customerId = c.id, noonQty = t.noon, eveningQty = t.evening,
                    unitPrice = t.price, deliveryCharge = t.delivery, notes = t.place?.let { "WhatsApp • $it" } ?: "WhatsApp")
            }
        }
        val orders = parsed.orders.mapIndexedNotNull { i, o ->
            if (!oOn(i) || o.items.isEmpty()) null else {
                val c = customerFor(o.name, oMatches[i], created)
                CateringOrder(date = date, customerId = c.id, deliveryCharge = o.delivery,
                    notes = (if (o.kind == "catering") "Catering" else "À la carte") + (o.place?.let { " • $it" } ?: ""),
                    items = o.items.map { CateringItem(itemName = it.name, qty = it.qty, unitPrice = it.price) })
            }
        }
        if (tiffins.isNotEmpty()) store.addTiffins(tiffins)
        if (orders.isNotEmpty()) store.addCateringOrders(orders)
        done = "Saved ${tiffins.size} tiffin entries and ${orders.size} orders" +
            (if (created.isNotEmpty()) ", added ${created.size} new customers." else ".")
    }

    OverlayScaffold("WhatsApp Entry", onClose, actions = {
        TextButton(onClick = { save() }, enabled = count > 0) { Text("Save ($count)", fontWeight = FontWeight.Bold) }
    }) {
        AppCard {
            Text("Paste your WhatsApp message", fontWeight = FontWeight.Bold)
            Text("Tip: in WhatsApp, long-press the message → Share → Sai's Kitchen.", fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(text, { text = it }, modifier = Modifier.fillMaxWidth().heightIn(min = 160.dp),
                placeholder = { Text("Date - 10.06.26\ndaily tiffins\n1. Pranav 1 tiffin at pasila") })
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = { clipboard.getText()?.text?.let { text = it } }) { Text("Paste") }
                TextButton(onClick = { text = "" }) { Text("Clear") }
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Switch(monthFirst, { monthFirst = it })
                Spacer(Modifier.width(8.dp))
                Text("Read date as month.day", fontSize = 13.sp)
            }
        }
        if (text.isNotBlank()) {
            AppCard {
                Text("Date: " + date.format(DateTimeFormatter.ofPattern("EEE d MMM yyyy", Locale.ENGLISH)), fontWeight = FontWeight.Bold)
                parsed.warnings.forEach { Text("⚠ $it", color = WARN, fontSize = 12.sp) }
            }
            parsed.tiffins.forEachIndexed { i, t ->
                val (status, cust) = tMatches[i]
                val total = ((t.noon + t.evening) * t.price + t.delivery)
                AppCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(tOn(i), { tOff[i] = !it })
                        Column(Modifier.weight(1f)) {
                            Text(cust?.name ?: t.name, fontWeight = FontWeight.Bold)
                            Text(statusText(status, cust, t.name), fontSize = 12.sp, color = statusColor(status))
                            Text("Tiffin • Noon ${t.noon.clean()}, Evening ${t.evening.clean()} • ${t.place ?: "no place"} • delivery ${Fmt.currency(t.delivery, cur)}",
                                fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            if (tDup[i]) Text("⚠ Already has a tiffin on this date (unticked)", color = WARN, fontSize = 12.sp)
                            t.warnings.forEach { Text("⚠ $it", color = WARN, fontSize = 12.sp) }
                        }
                        Text(Fmt.currency(total, cur), fontWeight = FontWeight.Bold)
                    }
                }
            }
            parsed.orders.forEachIndexed { i, o ->
                val (status, cust) = oMatches[i]
                val total = o.items.sumOf { it.qty * it.price } + o.delivery
                AppCard {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Checkbox(oOn(i), { oOff[i] = !it })
                        Column(Modifier.weight(1f)) {
                            Text(cust?.name ?: o.name, fontWeight = FontWeight.Bold)
                            Text(statusText(status, cust, o.name), fontSize = 12.sp, color = statusColor(status))
                            Text((if (o.kind == "catering") "Catering (self pickup)" else "À la carte") +
                                (o.place?.let { " • $it" } ?: "") + " • delivery ${Fmt.currency(o.delivery, cur)}",
                                fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                            o.items.forEach { Text("• ${it.name}  ${it.qty.clean()} × ${Fmt.currency(it.price, cur)}", fontSize = 12.sp) }
                            o.warnings.forEach { Text("⚠ $it", color = WARN, fontSize = 12.sp) }
                        }
                        Text(Fmt.currency(total, cur), fontWeight = FontWeight.Bold)
                    }
                }
            }
            if (parsed.tiffins.isEmpty() && parsed.orders.isEmpty()) {
                Text("Nothing recognised yet. Check the message format.", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
    done?.let {
        AlertDialog(
            onDismissRequest = { done = null; onClose() },
            confirmButton = { TextButton(onClick = { done = null; onClose() }) { Text("OK") } },
            title = { Text("Done") }, text = { Text(it) },
        )
    }
}

private fun statusText(status: String, c: Customer?, typed: String) = when (status) {
    "matched" -> "✓ Existing customer" + if (c != null && WhatsAppParser.norm(c.name) != WhatsAppParser.norm(typed)) " (from \"$typed\")" else ""
    "ambiguous" -> "⚠ Several customers match \"$typed\" – using ${c?.name}"
    else -> "+ New customer will be added"
}

private fun statusColor(status: String) = when (status) {
    "matched" -> Color(0xFF10B981)
    "ambiguous" -> WARN
    else -> Color(0xFF3B82F6)
}
