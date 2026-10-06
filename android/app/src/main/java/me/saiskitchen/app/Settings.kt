package me.saiskitchen.app

import androidx.compose.foundation.layout.*
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun SettingsScreen(store: KitchenStore) {
    var showClear by remember { mutableStateOf(false) }
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
        AppCard {
            Text("Data Management", fontWeight = FontWeight.Bold, fontSize = 17.sp)
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
