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
import java.io.File
import java.time.LocalDate

@Composable
fun InvoicesScreen(onOpen: (String) -> Unit) {
    TabScreen("Invoices") {
        ActionCard(Icons.Default.PictureAsPdf, "Generate Invoice", "Create a PDF invoice for a customer and share it", Brand.primary) { onOpen("invoice") }
        ActionCard(Icons.Default.Description, "Outstanding Report", "See what each customer owes for a month", Brand.secondary) { onOpen("outstanding") }
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
            ExposedDropdownMenuBox(expanded = menu, onExpandedChange = { menu = it }) {
                OutlinedTextField(
                    value = customer?.name ?: "Select customer...", onValueChange = {}, readOnly = true,
                    trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(menu) },
                    modifier = Modifier.menuAnchor(MenuAnchorType.PrimaryNotEditable).fillMaxWidth(),
                )
                ExposedDropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                    store.customers.forEach { c ->
                        DropdownMenuItem(text = { Text(c.name) }, onClick = { customerId = c.id; file = null; menu = false })
                    }
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
            val summary = InvoiceSummary(customer, kind, start, end, t, o, store.settings)
            AppCard {
                Text(customer.name, fontWeight = FontWeight.Bold)
                SummaryRow("Tiffin Entries", "${t.size}")
                SummaryRow("Tiffin Total", Fmt.currency(summary.tiffinTotal, cur))
                SummaryRow("Catering Orders", "${o.size}")
                SummaryRow("Catering Total", Fmt.currency(summary.cateringTotal, cur))
                SummaryRow("Grand Total", Fmt.currency(summary.grandTotal, cur), isTotal = true)
            }
            Button(modifier = Modifier.fillMaxWidth(), onClick = {
                if (t.isEmpty() && o.isEmpty()) {
                    message = "No entries for this customer in the selected period."
                } else {
                    runCatching { InvoicePdf.make(context, summary) }
                        .onSuccess { file = it; message = "Invoice created. Tap Share Invoice." }
                        .onFailure { message = "Could not create invoice: ${it.message}" }
                }
            }) { Icon(Icons.Default.PictureAsPdf, null); Spacer(Modifier.width(8.dp)); Text("Generate PDF Invoice") }
            file?.let { f ->
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
