package me.saiskitchen.app

import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.People
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun CustomersScreen(store: KitchenStore) {
    var search by remember { mutableStateOf("") }
    var editing by remember { mutableStateOf<Customer?>(null) }
    var adding by remember { mutableStateOf(false) }
    var deleting by remember { mutableStateOf<Customer?>(null) }
    val list = store.customers.filter {
        search.isBlank() || it.name.contains(search, true) || it.phone.contains(search, true)
    }

    TabScreen("Customers") {
        Button(onClick = { adding = true }, modifier = Modifier.fillMaxWidth()) {
            Icon(Icons.Default.Add, null); Spacer(Modifier.width(8.dp)); Text("Add Customer")
        }
        SearchField(search, { search = it }, "Search by name or phone...")
        if (list.isEmpty()) {
            EmptyState(Icons.Default.People, "No customers", "Add your first customer to get started")
        }
        list.forEach { c ->
            AppCard {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(c.name, fontWeight = FontWeight.Bold, fontSize = 17.sp)
                        Text(c.phone, color = MaterialTheme.colorScheme.onSurfaceVariant)
                        if (c.address.isNotBlank()) Text(c.address, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
                        Text(c.type, color = Brand.primary, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    }
                    IconButton(onClick = { editing = c }) { Icon(Icons.Default.Edit, "Edit", tint = Brand.primary) }
                    IconButton(onClick = { deleting = c }) { Icon(Icons.Default.Delete, "Delete", tint = Brand.error) }
                }
            }
        }
    }

    if (adding) CustomerDialog(null, { adding = false }) { store.addCustomer(it); adding = false }
    editing?.let { c -> CustomerDialog(c, { editing = null }) { store.updateCustomer(it); editing = null } }
    deleting?.let { c ->
        AlertDialog(
            onDismissRequest = { deleting = null },
            title = { Text("Delete ${c.name}?") },
            text = { Text("Their past entries stay in your records but will show as \"Unknown Customer\".") },
            confirmButton = { TextButton(onClick = { store.deleteCustomer(c); deleting = null }) { Text("Delete", color = Brand.error) } },
            dismissButton = { TextButton(onClick = { deleting = null }) { Text("Cancel") } },
        )
    }
}

@Composable
private fun CustomerDialog(existing: Customer?, onDismiss: () -> Unit, onSave: (Customer) -> Unit) {
    var name by remember { mutableStateOf(existing?.name ?: "") }
    var phone by remember { mutableStateOf(existing?.phone ?: "") }
    var address by remember { mutableStateOf(existing?.address ?: "") }
    var type by remember { mutableStateOf(existing?.type ?: "Regular") }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(if (existing == null) "Add Customer" else "Edit Customer") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(name, { name = it }, label = { Text("Name") }, singleLine = true)
                OutlinedTextField(phone, { phone = it }, label = { Text("Phone") }, singleLine = true,
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Phone))
                OutlinedTextField(address, { address = it }, label = { Text("Address") })
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("Regular", "Occasional").forEach {
                        FilterChip(selected = type == it, onClick = { type = it }, label = { Text(it) })
                    }
                }
            }
        },
        confirmButton = {
            TextButton(enabled = name.isNotBlank(), onClick = {
                onSave((existing ?: Customer(name = "", phone = "")).copy(name = name.trim(), phone = phone.trim(), address = address.trim(), type = type))
            }) { Text("Save") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
