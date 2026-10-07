package me.saiskitchen.app

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/** Finds the problems that cause wrong bills: the same customer saved twice, and the same day entered twice. */
@Composable
fun DataCheckScreen(store: KitchenStore, onClose: () -> Unit) {
    val cur = store.settings.currency
    val dups = store.duplicateCustomerGroups()
    val days = store.sameDayGroups()
    OverlayScaffold("Data Check", onClose) {
        if (dups.isEmpty() && days.isEmpty()) {
            AppCard { Text("All good ✓", fontWeight = FontWeight.Bold, fontSize = 18.sp); Text("No duplicate customers and no doubled entries found.") }
        }
        if (dups.isNotEmpty()) {
            Text("Same customer saved more than once", fontWeight = FontWeight.Bold, fontSize = 17.sp)
            Text("Their entries are split, so a bill misses some days. Merge them into one.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        dups.forEach { g ->
            AppCard {
                g.forEach { c ->
                    val n = store.tiffins.count { it.customerId == c.id }
                    val o = store.cateringOrders.count { it.customerId == c.id }
                    Text("${c.name}", fontWeight = FontWeight.SemiBold)
                    Text("${c.phone.ifBlank { "no phone" }} • $n tiffin entries" + if (o > 0) ", $o orders" else "", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Spacer(Modifier.height(4.dp))
                }
                Spacer(Modifier.height(4.dp))
                Text("Keep which name?", fontSize = 12.sp)
                g.forEach { keep ->
                    OutlinedButton(modifier = Modifier.fillMaxWidth(), onClick = { store.mergeCustomers(keep, g) }) {
                        Text("Merge all into \"${keep.name}\"", maxLines = 1)
                    }
                }
            }
        }
        if (days.isNotEmpty()) {
            Text("Same customer, same day, entered twice", fontWeight = FontWeight.Bold, fontSize = 17.sp)
            Text("If the customer really had two tiffins, keep both. If it was typed twice, delete the extra.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        days.forEach { g ->
            AppCard {
                Text(store.customers.firstOrNull { it.id == g[0].customerId }?.name ?: "Customer", fontWeight = FontWeight.SemiBold)
                Text(Fmt.displayDate(g[0].date), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                g.forEach { t ->
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                        Text("Noon ${t.noonQty.clean()}, Evening ${t.eveningQty.clean()} × ${Fmt.currency(t.unitPrice, cur)} + ${Fmt.currency(t.deliveryCharge, cur)} = ${Fmt.currency(t.total, cur)}", fontSize = 13.sp, modifier = Modifier.weight(1f))
                        TextButton(onClick = { store.deleteTiffin(t) }) { Text("Delete") }
                    }
                }
            }
        }
    }
}
