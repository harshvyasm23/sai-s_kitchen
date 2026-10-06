package me.saiskitchen.app

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Fastfood
import androidx.compose.material.icons.filled.Restaurant
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.LocalDate

@Composable
fun NewEntryScreen(onOpen: (String) -> Unit) {
    TabScreen("New Entry") {
        ActionCard(Icons.Default.Fastfood, "Tiffin Entry", "Record daily tiffin delivery with noon and evening quantities", Brand.primary) { onOpen("tiffin") }
        ActionCard(Icons.Default.Restaurant, "Catering Order", "Create party or catering orders with multiple items", Brand.secondary) { onOpen("catering") }
        ActionCard(Icons.AutoMirrored.Filled.List, "View All Entries", "Browse all tiffin and catering records", Brand.info) { onOpen("all") }
    }
}

@Composable
fun ActionCard(icon: ImageVector, title: String, subtitle: String, color: Color, onClick: () -> Unit) {
    AppCard(onClick = onClick) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Icon(icon, null, tint = color, modifier = Modifier.size(36.dp))
            Spacer(Modifier.width(14.dp))
            Column {
                Text(title, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
            }
        }
    }
}

@Composable
fun AddTiffinScreen(store: KitchenStore, onClose: () -> Unit) {
    var selected by remember { mutableStateOf(setOf<String>()) }
    var date by remember { mutableStateOf(LocalDate.now()) }
    var noon by remember { mutableStateOf("0") }
    var evening by remember { mutableStateOf("1") }
    var price by remember { mutableStateOf(store.settings.defaultTiffinPrice.clean()) }
    var delivery by remember { mutableStateOf(store.settings.defaultDeliveryCharge.toString()) }
    var notes by remember { mutableStateOf("") }
    var error by remember { mutableStateOf(false) }
    val perCustomer = (noon.dec() + evening.dec()) * price.dec() + delivery.dec()
    val cur = store.settings.currency

    fun save() {
        if (selected.isEmpty() || noon.dec() + evening.dec() <= 0) { error = true; return }
        store.addTiffins(selected.map {
            TiffinEntry(date = date, customerId = it, noonQty = noon.dec(), eveningQty = evening.dec(),
                unitPrice = price.dec(), deliveryCharge = delivery.dec(), notes = notes)
        })
        onClose()
    }

    OverlayScaffold("Add Tiffin Entry", onClose, actions = {
        TextButton(onClick = { save() }) { Text(if (selected.size > 1) "Add Entries" else "Add", fontWeight = FontWeight.Bold) }
    }) {
        AppCard {
            Text("Customers (${selected.size} selected)", fontWeight = FontWeight.Bold)
            if (store.customers.isEmpty()) Text("Add a customer first (Customers tab).", color = MaterialTheme.colorScheme.onSurfaceVariant)
            store.customers.forEach { c ->
                CustomerPickRow(c, c.id in selected) { selected = if (c.id in selected) selected - c.id else selected + c.id }
            }
        }
        AppCard {
            Text("Entry Details", fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            DateField("Date", date, { date = it }, Modifier.fillMaxWidth())
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                NumberField("Noon Qty", noon, { noon = it }, Modifier.weight(1f))
                NumberField("Evening Qty", evening, { evening = it }, Modifier.weight(1f))
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                NumberField("Unit Price (€)", price, { price = it }, Modifier.weight(1f))
                NumberField("Delivery (€)", delivery, { delivery = it }, Modifier.weight(1f))
            }
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(notes, { notes = it }, label = { Text("Notes") }, modifier = Modifier.fillMaxWidth())
        }
        AppCard {
            SummaryRow(if (selected.size > 1) "Per Customer" else "Total", Fmt.currency(perCustomer, cur), isTotal = true)
            if (selected.size > 1) SummaryRow("Total (${selected.size} customers)", Fmt.currency(perCustomer * selected.size, cur), isTotal = true)
        }
    }
    if (error) AlertDialog(
        onDismissRequest = { error = false }, confirmButton = { TextButton(onClick = { error = false }) { Text("OK") } },
        title = { Text("Cannot Add Entry") }, text = { Text("Select at least one customer and enter at least one quantity.") },
    )
}

internal class DraftItem(val key: Int) {
    var name by mutableStateOf("")
    var qty by mutableStateOf("0")
    var unitPrice by mutableStateOf("0")
}

@Composable
fun AddCateringScreen(store: KitchenStore, onClose: () -> Unit) {
    var selected by remember { mutableStateOf(setOf<String>()) }
    var date by remember { mutableStateOf(LocalDate.now()) }
    var delivery by remember { mutableStateOf("0") }
    var notes by remember { mutableStateOf("") }
    var counter by remember { mutableIntStateOf(1) }
    val items = remember { mutableStateListOf(DraftItem(0)) }
    var error by remember { mutableStateOf(false) }
    val itemsTotal = items.sumOf { it.qty.dec() * it.unitPrice.dec() }
    val perCustomer = itemsTotal + delivery.dec()
    val cur = store.settings.currency

    fun save() {
        val valid = items.filter { it.name.isNotBlank() && it.qty.dec() > 0 }
        if (selected.isEmpty() || valid.isEmpty()) { error = true; return }
        store.addCateringOrders(selected.map {
            CateringOrder(date = date, customerId = it, deliveryCharge = delivery.dec(), notes = notes,
                items = valid.map { d -> CateringItem(itemName = d.name.trim(), qty = d.qty.dec(), unitPrice = d.unitPrice.dec()) })
        })
        onClose()
    }

    OverlayScaffold("Add Catering Order", onClose, actions = {
        TextButton(onClick = { save() }) { Text(if (selected.size > 1) "Add Orders" else "Add", fontWeight = FontWeight.Bold) }
    }) {
        AppCard {
            Text("Customers (${selected.size} selected)", fontWeight = FontWeight.Bold)
            if (store.customers.isEmpty()) Text("Add a customer first (Customers tab).", color = MaterialTheme.colorScheme.onSurfaceVariant)
            store.customers.forEach { c ->
                CustomerPickRow(c, c.id in selected) { selected = if (c.id in selected) selected - c.id else selected + c.id }
            }
        }
        AppCard {
            Text("Order Details", fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(8.dp))
            DateField("Date", date, { date = it }, Modifier.fillMaxWidth())
            Spacer(Modifier.height(8.dp))
            NumberField("Delivery Charge (€)", delivery, { delivery = it })
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(notes, { notes = it }, label = { Text("Notes") }, modifier = Modifier.fillMaxWidth())
        }
        AppCard {
            Text("Items", fontWeight = FontWeight.Bold)
            items.forEach { d ->
                key(d.key) {
                    Spacer(Modifier.height(8.dp))
                    OutlinedTextField(d.name, { d.name = it }, label = { Text("Item name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                        NumberField("Qty", d.qty, { d.qty = it }, Modifier.weight(1f))
                        NumberField("Unit Price", d.unitPrice, { d.unitPrice = it }, Modifier.weight(1f))
                        if (items.size > 1) IconButton(onClick = { items.remove(d) }) { Icon(Icons.Default.Delete, "Remove item", tint = Brand.error) }
                    }
                }
            }
            TextButton(onClick = { items.add(DraftItem(counter++)) }) { Icon(Icons.Default.Add, null); Spacer(Modifier.width(6.dp)); Text("Add Item") }
        }
        AppCard {
            SummaryRow("Items Total", Fmt.currency(itemsTotal, cur))
            SummaryRow(if (selected.size > 1) "Per Customer" else "Grand Total", Fmt.currency(perCustomer, cur), isTotal = true)
            if (selected.size > 1) SummaryRow("Total (${selected.size} customers)", Fmt.currency(perCustomer * selected.size, cur), isTotal = true)
        }
    }
    if (error) AlertDialog(
        onDismissRequest = { error = false }, confirmButton = { TextButton(onClick = { error = false }) { Text("OK") } },
        title = { Text("Cannot Add Order") }, text = { Text("Select at least one customer and add at least one valid item.") },
    )
}
