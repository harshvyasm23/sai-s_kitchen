package me.saiskitchen.app

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.*
import androidx.compose.ui.platform.LocalContext
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun SettingsScreen(store: KitchenStore, onOpen: (String) -> Unit) {
    val context = LocalContext.current
    var showClear by remember { mutableStateOf(false) }
    var showExport by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    val picker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            message = try {
                val text = context.contentResolver.openInputStream(uri)!!.bufferedReader().use { it.readText() }
                store.importJson(text).message()
            } catch (e: Exception) {
                "Import failed. Please choose a Sai's Kitchen backup (.json) file.\n(${e.message})"
            }
        }
    }
    val s = store.settings
    TabScreen("Settings") {
        AppCard {
            Text("Theme", fontWeight = FontWeight.Bold, fontSize = 17.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ThemeMode.values().forEach {
                    FilterChip(selected = store.themeMode == it, onClick = { store.updateTheme(it) }, label = { Text(it.label) })
                }
            }
        }
        AppCard {
            Text("Quick Actions", fontWeight = FontWeight.Bold, fontSize = 17.sp)
            Spacer(Modifier.height(4.dp))
            TextButton(onClick = { onOpen("monthly") }, modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.fillMaxWidth()) { Text("Monthly Entries"); Text("View and edit entries by month", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            }
            TextButton(onClick = { onOpen("all") }, modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.fillMaxWidth()) { Text("View All Entries"); Text("Browse entries by date range", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            }
            val issues = store.duplicateCustomerGroups().size + store.sameDayGroups().size
            TextButton(onClick = { onOpen("datacheck") }, modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.fillMaxWidth()) {
                    Text("Data Check" + if (issues > 0) "  ⚠ $issues to review" else "  ✓")
                    Text("Find duplicate customers and doubled entries", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
            TextButton(onClick = { onOpen("outstanding") }, modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.fillMaxWidth()) { Text("Outstanding Report"); Text("Check pending payments", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            }
        }
        AppCard {
            Text("Business Defaults", fontWeight = FontWeight.Bold, fontSize = 17.sp)
            Spacer(Modifier.height(8.dp))
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                SettingField("Company", s.companyName) { store.updateSettings(s.copy(companyName = it)) }
                SettingField("Phone", s.companyPhone) { store.updateSettings(s.copy(companyPhone = it)) }
                SettingField("Invoice address line", s.companyAddress) { store.updateSettings(s.copy(companyAddress = it)) }
                SettingField("Currency (e.g. EUR)", s.currency) { v ->
                    if (v.length == 3 && runCatching { java.util.Currency.getInstance(v.uppercase()) }.isSuccess) store.updateSettings(s.copy(currency = v.uppercase()))
                }
                SettingField("Default tiffin price", s.defaultTiffinPrice.clean(), decimal = true) { store.updateSettings(s.copy(defaultTiffinPrice = it.dec())) }
                SettingField("Default delivery charge", s.defaultDeliveryCharge.toString(), decimal = true) { store.updateSettings(s.copy(defaultDeliveryCharge = it.dec())) }
            }
        }
        TelegramCard(store)
        AppCard {
            Text("Data Management", fontWeight = FontWeight.Bold, fontSize = 17.sp)
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = { picker.launch(arrayOf("*/*")) }, modifier = Modifier.fillMaxWidth()) { Text("Import Data (from backup file)") }
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = { showExport = true }, modifier = Modifier.fillMaxWidth()) { Text("Export Data (backup / share)") }
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = { store.seedSampleData() }, modifier = Modifier.fillMaxWidth()) { Text("Generate Test Data") }
            Spacer(Modifier.height(8.dp))
            OutlinedButton(onClick = { showClear = true }, modifier = Modifier.fillMaxWidth()) {
                Icon(Icons.Default.Delete, null, tint = Brand.error); Spacer(Modifier.width(8.dp)); Text("Clear All Data", color = Brand.error)
            }
        }
        AppCard {
            Text("App Info", fontWeight = FontWeight.Bold, fontSize = 17.sp)
            SummaryRow("Version", BuildConfig.VERSION_NAME)
            SummaryRow("Customers", "${store.customers.size}")
            SummaryRow("Tiffin Entries", "${store.tiffins.size}")
            SummaryRow("Catering Orders", "${store.cateringOrders.size}")
        }
    }
    if (showExport) AlertDialog(
        onDismissRequest = { showExport = false }, title = { Text("Export Data") },
        text = {
            Column {
                listOf("Customers Only" to "customers", "Tiffin Entries Only" to "tiffins", "Catering Orders Only" to "catering", "Everything (Backup)" to "all").forEach { (label, kind) ->
                    TextButton(onClick = { showExport = false; DataIo.share(context, store, kind) }, modifier = Modifier.fillMaxWidth()) {
                        Text(label, modifier = Modifier.fillMaxWidth())
                    }
                }
            }
        },
        confirmButton = {}, dismissButton = { TextButton(onClick = { showExport = false }) { Text("Cancel") } },
    )
    message?.let { m ->
        AlertDialog(onDismissRequest = { message = null }, title = { Text("Import") }, text = { Text(m) },
            confirmButton = { TextButton(onClick = { message = null }) { Text("OK") } })
    }
    if (showClear) AlertDialog(
        onDismissRequest = { showClear = false }, title = { Text("Clear All Data?") },
        text = { Text("This removes customers, tiffin entries, and catering orders from this phone.") },
        confirmButton = { TextButton(onClick = { store.clearAllData(); showClear = false }) { Text("Clear", color = Brand.error) } },
        dismissButton = { TextButton(onClick = { showClear = false }) { Text("Cancel") } },
    )
}

@Composable
private fun SettingField(label: String, value: String, decimal: Boolean = false, onCommit: (String) -> Unit) {
    var text by remember { mutableStateOf(value) }
    OutlinedTextField(
        value = text, onValueChange = { text = it; onCommit(it) }, label = { Text(label) }, singleLine = true,
        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(
            keyboardType = if (decimal) androidx.compose.ui.text.input.KeyboardType.Decimal else androidx.compose.ui.text.input.KeyboardType.Text),
        modifier = Modifier.fillMaxWidth(),
    )
}
