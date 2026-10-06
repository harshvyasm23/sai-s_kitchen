package me.saiskitchen.app

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.LocalDate

private fun rowDate(r: Any): LocalDate = if (r is TiffinEntry) r.date else (r as CateringOrder).date
private fun rowId(r: Any): String = if (r is TiffinEntry) r.id else (r as CateringOrder).id

/** List of tiffin entries / catering orders (newest first) with edit and delete. */
@Composable
fun EntryRows(store: KitchenStore, tiffins: List<TiffinEntry>, orders: List<CateringOrder>) {
    val cur = store.settings.currency
    val rows = (tiffins + orders).sortedByDescending { rowDate(it) }
    var editT by remember { mutableStateOf<TiffinEntry?>(null) }
    var editO by remember { mutableStateOf<CateringOrder?>(null) }
    var delete by remember { mutableStateOf<Any?>(null) }

    if (rows.isEmpty()) {
        Text("No entries for this selection.", color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
    LazyColumn(verticalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.fillMaxSize()) {
        items(rows, key = { rowId(it) }) { r ->
            if (r is TiffinEntry) {
                EntryCard(store.customerName(r.customerId),
                    "${Fmt.displayDate(r.date)} • Noon ${r.noonQty.clean()}, Evening ${r.eveningQty.clean()}" + if (r.notes.isNotBlank()) " • ${r.notes}" else "",
                    Fmt.currency(r.total, cur), Brand.primary) {
                    Row {
                        IconButton(onClick = { editT = r }) { Icon(Icons.Default.Edit, "Edit", tint = Brand.primary) }
                        IconButton(onClick = { delete = r }) { Icon(Icons.Default.Delete, "Delete", tint = Brand.error) }
                    }
                }
            } else if (r is CateringOrder) {
                EntryCard(store.customerName(r.customerId),
                    "${Fmt.displayDate(r.date)} • Catering: " + r.items.joinToString { it.itemName },
                    Fmt.currency(r.total, cur), Brand.secondary) {
                    Row {
                        IconButton(onClick = { editO = r }) { Icon(Icons.Default.Edit, "Edit", tint = Brand.primary) }
                        IconButton(onClick = { delete = r }) { Icon(Icons.Default.Delete, "Delete", tint = Brand.error) }
                    }
                }
            }
        }
    }

    editT?.let { t -> EditTiffinDialog(t, { editT = null }) { store.updateTiffin(it); editT = null } }
    editO?.let { o -> EditCateringDialog(o, { editO = null }) { store.updateCateringOrder(it); editO = null } }
    delete?.let { d ->
        AlertDialog(
            onDismissRequest = { delete = null }, title = { Text("Delete this entry?") }, text = { Text("This cannot be undone.") },
            confirmButton = {
                TextButton(onClick = {
                    if (d is TiffinEntry) store.deleteTiffin(d) else if (d is CateringOrder) store.deleteCateringOrder(d)
                    delete = null
                }) { Text("Delete", color = Brand.error) }
            },
            dismissButton = { TextButton(onClick = { delete = null }) { Text("Cancel") } },
        )
    }
}

@Composable
fun MonthlyEntriesScreen(store: KitchenStore, onClose: () -> Unit) {
    var month by remember { mutableStateOf(LocalDate.now()) }
    var type by remember { mutableStateOf("All") }
    val s = Fmt.startOfMonth(month)
    val e = Fmt.endOfMonth(month)
    val t = if (type == "Catering") emptyList() else store.tiffins.filter { Fmt.inRange(it.date, s, e) }
    val o = if (type == "Tiffin") emptyList() else store.cateringOrders.filter { Fmt.inRange(it.date, s, e) }
    val cur = store.settings.currency

    OverlayScaffold("Monthly Entries", onClose, scrollable = false) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
            TextButton(onClick = { month = month.minusMonths(1) }) { Text("‹ Prev") }
            Text("${month.month.name.lowercase().replaceFirstChar { it.uppercase() }} ${month.year}", fontWeight = FontWeight.Bold, fontSize = 17.sp)
            TextButton(onClick = { month = month.plusMonths(1) }) { Text("Next ›") }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("All", "Tiffin", "Catering").forEach { FilterChip(selected = type == it, onClick = { type = it }, label = { Text(it) }) }
        }
        Text("${t.size + o.size} entries • ${Fmt.currency(t.sumOf { it.total } + o.sumOf { it.total }, cur)}",
            color = MaterialTheme.colorScheme.onSurfaceVariant)
        Box(Modifier.weight(1f)) { EntryRows(store, t, o) }
    }
}

@Composable
fun AllEntriesScreen(store: KitchenStore, onClose: () -> Unit) {
    var start by remember { mutableStateOf(LocalDate.now().minusMonths(1)) }
    var end by remember { mutableStateOf(LocalDate.now()) }
    var search by remember { mutableStateOf("") }
    val match = { cid: String -> search.isBlank() || store.customerName(cid).contains(search, true) }
    val t = store.tiffins.filter { Fmt.inRange(it.date, start, end) && match(it.customerId) }
    val o = store.cateringOrders.filter { Fmt.inRange(it.date, start, end) && match(it.customerId) }

    OverlayScaffold("All Entries", onClose, scrollable = false) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            DateField("From", start, { start = it; if (end.isBefore(it)) end = it }, Modifier.weight(1f))
            DateField("To", end, { end = it }, Modifier.weight(1f))
        }
        SearchField(search, { search = it }, "Filter by customer name...")
        Text("${t.size} tiffin • ${o.size} catering", color = MaterialTheme.colorScheme.onSurfaceVariant)
        Box(Modifier.weight(1f)) { EntryRows(store, t, o) }
    }
}

@Composable
fun EditTiffinDialog(entry: TiffinEntry, onDismiss: () -> Unit, onSave: (TiffinEntry) -> Unit) {
    var date by remember { mutableStateOf(entry.date) }
    var noon by remember { mutableStateOf(entry.noonQty.clean()) }
    var evening by remember { mutableStateOf(entry.eveningQty.clean()) }
    var price by remember { mutableStateOf(entry.unitPrice.clean()) }
    var delivery by remember { mutableStateOf(entry.deliveryCharge.clean()) }
    var notes by remember { mutableStateOf(entry.notes) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Edit Tiffin Entry") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                DateField("Date", date, { date = it }, Modifier.fillMaxWidth())
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    NumberField("Noon", noon, { noon = it }, Modifier.weight(1f))
                    NumberField("Evening", evening, { evening = it }, Modifier.weight(1f))
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    NumberField("Price (€)", price, { price = it }, Modifier.weight(1f))
                    NumberField("Delivery (€)", delivery, { delivery = it }, Modifier.weight(1f))
                }
                OutlinedTextField(notes, { notes = it }, label = { Text("Notes") }, modifier = Modifier.fillMaxWidth())
            }
        },
        confirmButton = {
            TextButton(enabled = noon.dec() + evening.dec() > 0, onClick = {
                onSave(entry.copy(date = date, noonQty = noon.dec(), eveningQty = evening.dec(), unitPrice = price.dec(),
                    deliveryCharge = delivery.dec(), notes = notes))
            }) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}

@Composable
fun EditCateringDialog(order: CateringOrder, onDismiss: () -> Unit, onSave: (CateringOrder) -> Unit) {
    var date by remember { mutableStateOf(order.date) }
    var delivery by remember { mutableStateOf(order.deliveryCharge.clean()) }
    var notes by remember { mutableStateOf(order.notes) }
    var counter by remember { mutableIntStateOf(order.items.size) }
    val items = remember {
        mutableStateListOf<DraftItem>().apply {
            order.items.forEachIndexed { i, it ->
                add(DraftItem(i).also { d -> d.name = it.itemName; d.qty = it.qty.clean(); d.unitPrice = it.unitPrice.clean() })
            }
        }
    }
    val valid = items.filter { it.name.isNotBlank() && it.qty.dec() > 0 }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Edit Catering Order") },
        text = {
            Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                DateField("Date", date, { date = it }, Modifier.fillMaxWidth())
                NumberField("Delivery (€)", delivery, { delivery = it })
                OutlinedTextField(notes, { notes = it }, label = { Text("Notes") }, modifier = Modifier.fillMaxWidth())
                Text("Items", fontWeight = FontWeight.Bold)
                items.forEach { d ->
                    key(d.key) {
                        OutlinedTextField(d.name, { d.name = it }, label = { Text("Item name") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                            NumberField("Qty", d.qty, { d.qty = it }, Modifier.weight(1f))
                            NumberField("Price", d.unitPrice, { d.unitPrice = it }, Modifier.weight(1f))
                            if (items.size > 1) IconButton(onClick = { items.remove(d) }) { Icon(Icons.Default.Delete, "Remove", tint = Brand.error) }
                        }
                    }
                }
                TextButton(onClick = { items.add(DraftItem(counter++)) }) { Icon(Icons.Default.Add, null); Spacer(Modifier.width(6.dp)); Text("Add Item") }
            }
        },
        confirmButton = {
            TextButton(enabled = valid.isNotEmpty(), onClick = {
                onSave(order.copy(date = date, deliveryCharge = delivery.dec(), notes = notes,
                    items = valid.map { CateringItem(itemName = it.name.trim(), qty = it.qty.dec(), unitPrice = it.unitPrice.dec()) }))
            }) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
