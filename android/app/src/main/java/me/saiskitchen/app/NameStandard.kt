package me.saiskitchen.app

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

@Composable
fun StandardizeNamesScreen(store: KitchenStore, onClose: () -> Unit) {
    val parsed = remember { store.customers.associate { it.id to NameStd.parse(it.name, it.address) } }
    val male = remember { mutableStateMapOf<String, Boolean>().apply { parsed.forEach { (id, p) -> put(id, p.male == true) } } }
    val place = remember { mutableStateMapOf<String, String>().apply { parsed.forEach { (id, p) -> put(id, p.place) } } }
    val sure = remember { store.customers.associate { it.id to NameStd.isSure(it.name) } }

    val groups = store.customers.groupBy { NameStd.core(parsed[it.id]!!.base) }
    fun needsPlace(c: Customer) = (groups[NameStd.core(parsed[c.id]!!.base)]?.size ?: 1) > 1
    fun newName(c: Customer) = NameStd.build(parsed[c.id]!!.base, if (needsPlace(c)) place[c.id].orEmpty() else "", male[c.id] == true)

    val names = store.customers.map { newName(it).lowercase() }
    val clash = names.groupingBy { it }.eachCount().filter { it.value > 1 }.keys
    val missing = store.customers.count { needsPlace(it) && place[it.id].orEmpty().isBlank() }
    val changes = store.customers.count { newName(it) != it.name }
    var done by remember { mutableStateOf<Int?>(null) }

    OverlayScaffold("Standardize Names", onClose) {
        done?.let {
            AppCard { Text("Done ✓", fontWeight = FontWeight.Bold, fontSize = 18.sp); Text("$it customer names updated.") }
            Button(onClick = onClose, modifier = Modifier.fillMaxWidth()) { Text("Close") }
            return@OverlayScaffold
        }
        Text("Gents become \"Name Bhai ${NameStd.SUFFIX}\", ladies \"Name ${NameStd.SUFFIX}\". If two different people have the same name, the place is added (Manish Kamppi, Manish Pasila). Check each line, then tap Apply.", fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        if (store.duplicateCustomerGroups().isNotEmpty())
            AppCard { Text("⚠ Some customers are saved twice (same phone). Merge them first in Settings → Data Check, so the same person doesn't get two names.", fontSize = 13.sp) }
        Button(onClick = {
            var n = 0
            store.customers.forEach { c -> val nn = newName(c); if (nn != c.name) { store.updateCustomer(c.copy(name = nn)); n++ } }
            done = n
        }, enabled = missing == 0 && clash.isEmpty() && changes > 0, modifier = Modifier.fillMaxWidth()) {
            Text(if (changes == 0) "All names already standard ✓" else "Apply to $changes customers")
        }
        if (missing > 0) Text("$missing need a place (red below).", color = Brand.error, fontSize = 13.sp)
        if (clash.isNotEmpty()) Text("Two customers would get the same name. Add a place to tell them apart.", color = Brand.error, fontSize = 13.sp)
        store.customers.forEach { c ->
            val need = needsPlace(c)
            val bad = (need && place[c.id].orEmpty().isBlank()) || newName(c).lowercase() in clash
            AppCard {
                Text(c.name + if (c.phone.isNotBlank()) "  •  ${c.phone}" else "", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text(newName(c), fontWeight = FontWeight.Bold, fontSize = 16.sp, color = if (bad) Brand.error else Brand.primary)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(selected = male[c.id] == true, onClick = { male[c.id] = true }, label = { Text("Gents (Bhai)") })
                    FilterChip(selected = male[c.id] == false, onClick = { male[c.id] = false }, label = { Text("Ladies") })
                }
                if (sure[c.id] != true) Text("Not sure if gents or ladies - please check", fontSize = 12.sp, color = Brand.error)
                if (need) OutlinedTextField(
                    value = place[c.id].orEmpty(), onValueChange = { place[c.id] = it }, singleLine = true, isError = bad,
                    label = { Text("Place (same name as another customer)") }, modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}
