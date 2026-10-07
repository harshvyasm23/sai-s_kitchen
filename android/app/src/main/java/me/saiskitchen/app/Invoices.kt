package me.saiskitchen.app

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.PictureAsPdf
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.io.File
import java.time.LocalDate

@Composable
fun InvoicesScreen(onOpen: (String) -> Unit) {
    TabScreen("Invoices") {
        ActionCard(Icons.Default.PictureAsPdf, "Generate Invoice", "Create a PDF invoice for a customer and share it", Brand.primary) { onOpen("invoice") }
        ActionCard(Icons.Default.Share, "Bulk Invoices", "Make everyone's invoice at once, then send them one by one or all together", Brand.primary) { onOpen("bulk") }
        ActionCard(Icons.Default.Description, "Outstanding Report", "See what each customer owes for a month", Brand.secondary) { onOpen("outstanding") }
    }
}

fun KitchenStore.invoiceFor(c: Customer, kind: InvoiceKind, start: LocalDate, end: LocalDate) = InvoiceSummary(
    c, kind, start, end, tiffins(c.id, start, end), catering(c.id, start, end), settings,
    previousBalance = previousDue(c.id, start, end), paidInPeriod = paid(c.id, start, end),
)

/** Lets you add (or remove) a previous unpaid amount for one customer in a period. Nothing is added automatically. */
@Composable
fun PreviousDueDialog(store: KitchenStore, c: Customer, start: LocalDate, end: LocalDate, onDone: () -> Unit) {
    var amount by remember { mutableStateOf("") }
    val entries = store.previousDueEntries(c.id, start, end)
    AlertDialog(
        onDismissRequest = onDone,
        title = { Text("Previous unpaid: ${c.name}") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Add an unpaid amount from an earlier month. It will show on this period's invoice and report.", fontSize = 12.sp)
                NumberField("Amount", amount, { amount = it })
                entries.forEach { p ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                        Text("Added: ${Fmt.currency(-p.amount, store.settings.currency)}", fontSize = 13.sp)
                        TextButton(onClick = { store.deletePayment(p); onDone() }) { Text("Remove") }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = {
                val a = amount.replace(',', '.').toDoubleOrNull()
                if (a != null && a > 0) store.addPayment(Payment(customerId = c.id, date = start, amount = -a, note = "Previous due"))
                onDone()
            }) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDone) { Text("Cancel") } },
    )
}

fun shareMany(context: android.content.Context, files: List<File>, text: String) {
    val uris = ArrayList(files.map { androidx.core.content.FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", it) })
    val send = android.content.Intent(android.content.Intent.ACTION_SEND_MULTIPLE).apply {
        type = "application/pdf"
        putParcelableArrayListExtra(android.content.Intent.EXTRA_STREAM, uris)
        putExtra(android.content.Intent.EXTRA_TEXT, text)
        clipData = android.content.ClipData.newRawUri("invoices", uris[0]).also { cd -> uris.drop(1).forEach { cd.addItem(android.content.ClipData.Item(it)) } }
        addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.packageManager.queryIntentActivities(send, 0).forEach { ri -> uris.forEach {
        context.grantUriPermission(ri.activityInfo.packageName, it, android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION) } }
    context.startActivity(android.content.Intent.createChooser(send, "Send invoices").addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK))
}

@Composable
fun BulkInvoicesScreen(store: KitchenStore, onClose: () -> Unit) {
    val context = LocalContext.current
    var start by remember { mutableStateOf(Fmt.startOfMonth()) }
    var end by remember { mutableStateOf(LocalDate.now()) }
    var q by remember { mutableStateOf("") }
    var unselected by remember { mutableStateOf(setOf<String>()) }
    var message by remember { mutableStateOf<String?>(null) }
    var dueFor by remember { mutableStateOf<Customer?>(null) }
    val cur = store.settings.currency
    val rows = store.customers.map { c -> c to store.invoiceFor(c, InvoiceKind.Combined, start, end) }
        .filter { (_, s) -> s.tiffins.isNotEmpty() || s.orders.isNotEmpty() }
        .filter { (c, _) -> q.isBlank() || c.name.contains(q, true) || c.phone.contains(q, true) }
        .sortedBy { it.first.name.lowercase() }
    val chosen = rows.filter { it.first.id !in unselected }
    OverlayScaffold("Bulk Invoices", onClose) {
        AppCard {
            Text("Period", fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                DateField("From", start, { start = it; if (end.isBefore(it)) end = it }, Modifier.weight(1f))
                DateField("To", end, { end = it }, Modifier.weight(1f))
            }
            Row {
                TextButton(onClick = { val p = start.minusMonths(1); start = Fmt.startOfMonth(p); end = Fmt.endOfMonth(p) }) { Text("Last month") }
                TextButton(onClick = { start = Fmt.startOfMonth(); end = LocalDate.now() }) { Text("This month") }
            }
        }
        SearchField(q, { q = it }, "Search customer...")
        Row {
            TextButton(onClick = { unselected = emptySet() }) { Text("Select all") }
            TextButton(onClick = { unselected = rows.map { it.first.id }.toSet() }) { Text("Select none") }
        }
        rows.forEach { (c, s) ->
            val due = (s.previousBalance + s.tiffinTotal + s.cateringTotal - s.paidInPeriod)
            Row(Modifier.fillMaxWidth(), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                Checkbox(checked = c.id !in unselected, onCheckedChange = { on -> unselected = if (on) unselected - c.id else unselected + c.id })
                Column(Modifier.weight(1f)) {
                    Text(c.name, fontWeight = FontWeight.SemiBold)
                    Text("${s.tiffins.size} tiffin days, ${s.orders.size} orders", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text(Fmt.currency(due, cur), fontWeight = FontWeight.Bold, color = Brand.primary)
                TextButton(onClick = { dueFor = c }) { Text("+ due") }
            }
        }
        if (rows.isEmpty()) Text("No entries in this period.", color = MaterialTheme.colorScheme.onSurfaceVariant)
        else {
            val label = "${start}_${end}"
            val msg = { "Hello, here is your Sai's Kitchen invoice for ${Fmt.displayDate(start)} - ${Fmt.displayDate(end)}. Thank you! 🙏" }
            AppCard {
                Text("${chosen.size} invoices selected  •  total ${Fmt.currency(chosen.sumOf { it.second.tiffinTotal + it.second.cateringTotal }, cur)}", fontWeight = FontWeight.Bold)
            }
            Button(modifier = Modifier.fillMaxWidth(), enabled = chosen.isNotEmpty(), onClick = {
                runCatching { InvoicePdf.makeEach(context, chosen.map { it.second }) }
                    .onSuccess { shareMany(context, it, msg()) }.onFailure { message = "Could not create invoices: ${it.message}" }
            }) { Icon(Icons.Default.Share, null); Spacer(Modifier.width(8.dp)); Text("Send all invoices (separate PDFs)") }
            OutlinedButton(modifier = Modifier.fillMaxWidth(), enabled = chosen.isNotEmpty(), onClick = {
                runCatching { InvoicePdf.makeEach(context, chosen.map { it.second }) }.onSuccess { files ->
                    val ok = files.count { InvoicePdf.saveToDownloads(context, it) }
                    message = "Saved $ok of ${files.size} invoices to your Downloads folder."
                }.onFailure { message = "Could not create invoices: ${it.message}" }
            }) { Text("Save all to Downloads") }
            OutlinedButton(modifier = Modifier.fillMaxWidth(), enabled = chosen.isNotEmpty(), onClick = {
                runCatching { InvoicePdf.makeCombined(context, chosen.map { it.second }, label) }
                    .onSuccess { InvoicePdf.share(context, it) }.onFailure { message = "Could not create PDF: ${it.message}" }
            }) { Text("One combined PDF (all customers)") }
            Text("Tip: with separate PDFs, pick WhatsApp or Telegram and send; each customer gets only their own invoice when you forward it.",
                fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text("Per customer WhatsApp", fontWeight = FontWeight.Bold)
            chosen.forEach { (c, s) ->
                OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = {
                    runCatching { InvoicePdf.make(context, s) }.onSuccess { f -> InvoicePdf.share(context, f) }
                }) { Text("Send ${c.name}'s invoice") }
            }
        }
    }
    dueFor?.let { PreviousDueDialog(store, it, start, end) { dueFor = null } }
    message?.let {
        AlertDialog(onDismissRequest = { message = null }, confirmButton = { TextButton(onClick = { message = null }) { Text("OK") } }, text = { Text(it) })
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GenerateInvoiceScreen(store: KitchenStore, onClose: () -> Unit) {
    val context = LocalContext.current
    var customerId by remember { mutableStateOf<String?>(null) }
    var kind by remember { mutableStateOf(InvoiceKind.Combined) }
    var start by remember { mutableStateOf(Fmt.startOfMonth()) }
    var end by remember { mutableStateOf(LocalDate.now()) }
    var file by remember { mutableStateOf<File?>(null) }
    var message by remember { mutableStateOf<String?>(null) }
    var menu by remember { mutableStateOf(false) }
    val customer = store.customers.firstOrNull { it.id == customerId }
    val cur = store.settings.currency

    OverlayScaffold("Generate Invoice", onClose) {
        AppCard {
            Text("Customer", fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            var q by remember { mutableStateOf("") }
            if (customer != null) Text("Selected: ${customer.name}", fontWeight = FontWeight.Bold, color = Brand.primary)
            SearchField(q, { q = it }, "Search customer by name or phone...")
            store.customers.filter { q.isBlank() || it.name.contains(q, true) || it.phone.contains(q, true) }.take(if (q.isBlank()) 6 else 10).forEach { c ->
                TextButton(onClick = { customerId = c.id; file = null; q = "" }, modifier = Modifier.fillMaxWidth()) {
                    Text(c.name + if (c.phone.isNotBlank()) "  •  ${c.phone}" else "", modifier = Modifier.fillMaxWidth())
                }
            }
        }
        AppCard {
            Text("Invoice Type", fontWeight = FontWeight.Bold)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                InvoiceKind.values().forEach {
                    FilterChip(selected = kind == it, onClick = { kind = it; file = null }, label = { Text(it.label) })
                }
            }
        }
        AppCard {
            Text("Period", fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                DateField("From", start, { start = it; if (end.isBefore(it)) end = it; file = null }, Modifier.weight(1f))
                DateField("To", end, { end = it; file = null }, Modifier.weight(1f))
            }
        }
        if (customer != null) {
            val t = store.tiffins(customer.id, start, end)
            val o = store.catering(customer.id, start, end)
            val summary = store.invoiceFor(customer, kind, start, end)
            AppCard {
                Text(customer.name, fontWeight = FontWeight.Bold)
                SummaryRow("Tiffin Entries", "${t.size}")
                SummaryRow("Tiffin Total", Fmt.currency(summary.tiffinTotal, cur))
                SummaryRow("Catering Orders", "${o.size}")
                SummaryRow("Catering Total", Fmt.currency(summary.cateringTotal, cur))
                SummaryRow("Grand Total", Fmt.currency(summary.grandTotal, cur), isTotal = true)
            }
            var dueDialog by remember { mutableStateOf(false) }
            OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = { dueDialog = true }) {
                Text(if (summary.previousBalance > 0) "Previous unpaid: ${Fmt.currency(summary.previousBalance, cur)} (edit)" else "Add previous unpaid amount")
            }
            if (dueDialog) PreviousDueDialog(store, customer, start, end) { dueDialog = false; file = null }
            Button(modifier = Modifier.fillMaxWidth(), onClick = {
                if (t.isEmpty() && o.isEmpty()) {
                    message = "No entries for this customer in the selected period."
                } else {
                    runCatching { InvoicePdf.make(context, summary) }
                        .onSuccess { file = it; message = "Invoice created. Tap Download PDF to save it to your phone, or Share." }
                        .onFailure { message = "Could not create invoice: ${it.message}" }
                }
            }) { Icon(Icons.Default.PictureAsPdf, null); Spacer(Modifier.width(8.dp)); Text("Generate PDF Invoice") }
            file?.let { f ->
                Button(modifier = Modifier.fillMaxWidth(), onClick = {
                    message = if (InvoicePdf.saveToDownloads(context, f)) "Saved to your Downloads folder:\n${f.name}"
                    else "Could not save to Downloads on this phone. Use Share and choose Save to Drive / Files."
                }) { Icon(Icons.Default.PictureAsPdf, null); Spacer(Modifier.width(8.dp)); Text("Download PDF") }
                OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = { InvoicePdf.share(context, f) }) {
                    Icon(Icons.Default.Share, null); Spacer(Modifier.width(8.dp)); Text("Share Invoice")
                }
            }
        }
    }
    message?.let {
        AlertDialog(onDismissRequest = { message = null }, confirmButton = { TextButton(onClick = { message = null }) { Text("OK") } },
            text = { Text(it) })
    }
}
