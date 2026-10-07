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

/** Turns a typed phone number into digits for wa.me (Finnish numbers starting with 0 become 358...). */
fun waNumber(phone: String): String {
    var d = phone.filter { it.isDigit() || it == '+' }
    if (d.startsWith("+")) return d.drop(1).filter { it.isDigit() }
    d = d.filter { it.isDigit() }
    return when {
        d.startsWith("00") -> d.drop(2)
        d.startsWith("0") -> "358" + d.drop(1)
        else -> d
    }
}

fun openWhatsApp(context: android.content.Context, phone: String, text: String) {
    val num = waNumber(phone)
    val uri = android.net.Uri.parse("https://wa.me/" + (if (num.isNotBlank()) num else "") + "?text=" + android.net.Uri.encode(text))
    runCatching { context.startActivity(android.content.Intent(android.content.Intent.ACTION_VIEW, uri).addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK)) }
}

fun reminderText(r: OutstandingRow, label: String, cur: String): String =
    "Hello ${r.name.trim().split(" ").first()}, this is Sai's Kitchen. Your balance for $label is ${Fmt.currency(r.balance, cur)}. " +
        "Please pay by bank transfer: IBAN ${PaymentDetails.IBAN}, BIC ${PaymentDetails.BIC}. Thank you! 🙏"

@Composable
fun OutstandingScreen(store: KitchenStore, onClose: () -> Unit) {
    var month by remember { mutableStateOf(LocalDate.now()) }
    var payFor by remember { mutableStateOf<OutstandingRow?>(null) }
    var showOnlyDue by remember { mutableStateOf(true) }
    val cur = store.settings.currency
    val context = androidx.compose.ui.platform.LocalContext.current
    val label = "${month.month.name.lowercase().replaceFirstChar { it.uppercase() }} ${month.year}"
    val s = Fmt.startOfMonth(month)
    val e = Fmt.endOfMonth(month)
    val all = store.outstandingRows(s, e)
    val rows = if (showOnlyDue) all.filter { it.balance > 0.004 } else all
    OverlayScaffold("Outstanding Report", onClose) {
        AppCard {
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                TextButton(onClick = { month = month.minusMonths(1) }) { Text("‹ Prev") }
                Text(label, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 12.dp))
                TextButton(onClick = { month = month.plusMonths(1) }) { Text("Next ›") }
            }
        }
        AppCard {
            Text("Total Outstanding Amount", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(Fmt.currency(all.sumOf { maxOf(it.balance, 0.0) }, cur), fontSize = 32.sp, fontWeight = FontWeight.Bold, color = Brand.primary)
            Text("${all.count { it.balance > 0.004 }} customers still owe  •  billed ${Fmt.currency(all.sumOf { it.billed }, cur)}  •  received ${Fmt.currency(all.sumOf { it.paid }, cur)}",
                fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Row(verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
            Switch(checked = showOnlyDue, onCheckedChange = { showOnlyDue = it })
            Spacer(Modifier.width(8.dp)); Text("Show only customers who owe")
        }
        rows.forEach { r ->
            AppCard {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column(Modifier.weight(1f)) {
                        Text(r.name, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Text("Billed ${Fmt.currency(r.billed, cur)}" + (if (r.previous > 0.004) " + earlier ${Fmt.currency(r.previous, cur)}" else "") +
                            (if (r.paid > 0) " − paid ${Fmt.currency(r.paid, cur)}" else ""), fontSize = 12.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant)
                    }
                    Text(if (r.balance <= 0.004) "PAID" else Fmt.currency(r.balance, cur), fontWeight = FontWeight.Bold, fontSize = 17.sp,
                        color = if (r.balance <= 0.004) Brand.secondary else Brand.primary)
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { payFor = r }) { Text("Record payment") }
                    if (r.balance > 0.004) OutlinedButton(onClick = { openWhatsApp(context, r.phone, reminderText(r, label, cur)) }) { Text("WhatsApp reminder") }
                }
            }
        }
        if (all.isEmpty()) Text("No entries for this month.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        else {
            var saved by remember { mutableStateOf<String?>(null) }
            Button(modifier = Modifier.fillMaxWidth(), onClick = {
                runCatching { ReportPdf.outstanding(context, label, all, store.settings) }
                    .onSuccess { f ->
                        saved = if (InvoicePdf.saveToDownloads(context, f)) "Saved to your Downloads folder:\n${f.name}" else "Could not save to Downloads. Use Share."
                    }
            }) { Text("Download PDF") }
            OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = {
                runCatching { ReportPdf.outstanding(context, label, all, store.settings) }.onSuccess { ReportPdf.share(context, it) }
            }) { Text("Share PDF") }
            saved?.let { m ->
                AlertDialog(onDismissRequest = { saved = null }, confirmButton = { TextButton(onClick = { saved = null }) { Text("OK") } }, text = { Text(m) })
            }
        }
    }
    payFor?.let { r ->
        var amount by remember(r.customerId) { mutableStateOf(if (r.balance > 0) "%.2f".format(java.util.Locale.US, r.balance) else "") }
        var note by remember(r.customerId) { mutableStateOf("") }
        val recent = store.payments.filter { it.customerId == r.customerId }.takeLast(3)
        AlertDialog(
            onDismissRequest = { payFor = null },
            title = { Text("Payment from ${r.name}") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Balance now: ${Fmt.currency(r.balance, cur)}")
                    NumberField("Amount received", amount, { amount = it })
                    OutlinedTextField(note, { note = it }, label = { Text("Note (bank / cash)") }, singleLine = true)
                    recent.forEach { p ->
                        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text("${Fmt.displayDate(p.date)}  ${Fmt.currency(p.amount, cur)}", fontSize = 12.sp)
                            TextButton(onClick = { store.deletePayment(p); payFor = null }) { Text("Delete") }
                        }
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    val a = amount.replace(',', '.').toDoubleOrNull()
                    if (a != null && a > 0) store.addPayment(Payment(customerId = r.customerId, date = minOf(LocalDate.now(), e), amount = a, note = note.trim()))
                    payFor = null
                }) { Text("Save") }
            },
            dismissButton = { TextButton(onClick = { payFor = null }) { Text("Cancel") } },
        )
    }
}
