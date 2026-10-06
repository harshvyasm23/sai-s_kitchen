package me.saiskitchen.app

import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate

/** What one chat message created, so /undo can remove exactly that. */
data class Batch(val tiffinIds: List<String>, val orderIds: List<String>, val customerIds: List<String>) {
    fun toJson(): String = JSONObject().put("t", JSONArray(tiffinIds)).put("o", JSONArray(orderIds)).put("c", JSONArray(customerIds)).toString()
    companion object {
        fun fromJson(s: String?): Batch? = runCatching {
            val j = JSONObject(s!!)
            fun ids(k: String) = (0 until j.getJSONArray(k).length()).map { j.getJSONArray(k).getString(it) }
            Batch(ids("t"), ids("o"), ids("c"))
        }.getOrNull()
    }
}

/** Saves a parsed message into the store without any UI (used by the Telegram bot). */
object EntryWriter {
    private fun pretty(name: String) = name.split(" ").filter { it.isNotEmpty() }.joinToString(" ") { w -> w.replaceFirstChar { it.uppercase() } }

    fun apply(store: KitchenStore, parsed: ParsedMessage, date: LocalDate): Pair<String, Batch> {
        val cur = store.settings.currency
        val created = mutableMapOf<String, Customer>()
        val lines = mutableListOf<String>()
        val tIds = mutableListOf<String>()
        val oIds = mutableListOf<String>()

        fun customerFor(name: String, m: Pair<String, Customer?>): Triple<Customer, Boolean, String?> {
            m.second?.let { c ->
                val note = if (m.first == "ambiguous") "several customers match \"$name\", used ${c.name}"
                else if (WhatsAppParser.norm(c.name) != WhatsAppParser.norm(name)) "\"$name\" matched to ${c.name}" else null
                return Triple(c, false, note)
            }
            val key = WhatsAppParser.norm(name).trim()
            created[key]?.let { return Triple(it, false, null) }
            val c = Customer(name = pretty(name), phone = "")
            store.addCustomer(c); created[key] = c
            return Triple(c, true, "new customer - check spelling")
        }

        parsed.tiffins.forEach { t ->
            val m = WhatsAppParser.matchCustomer(t.name, store.customers)
            if (m.second != null && store.tiffins.any { it.customerId == m.second!!.id && it.date == date }) {
                lines.add("↷ ${m.second!!.name}: skipped, already has a tiffin on this date"); return@forEach
            }
            val (c, isNew, note) = customerFor(t.name, m)
            val e = TiffinEntry(date = date, customerId = c.id, noonQty = t.noon, eveningQty = t.evening,
                unitPrice = t.price, deliveryCharge = t.delivery, notes = t.place?.let { "Telegram • $it" } ?: "Telegram")
            store.addTiffins(listOf(e)); tIds.add(e.id)
            val extra = listOfNotNull(note, *t.warnings.toTypedArray())
            lines.add("✓ ${c.name} - ${(t.noon + t.evening).clean()} tiffin" + (t.place?.let { ", $it" } ?: "") +
                " = ${Fmt.currency(e.total, cur)}" + if (extra.isNotEmpty()) "\n   ⚠ " + extra.joinToString("; ") else "")
        }
        parsed.orders.forEach { o ->
            if (o.items.isEmpty() || o.warnings.any { it.startsWith("No price") }) {
                lines.add("✗ ${o.name}: not saved - " + (o.warnings.firstOrNull { it.startsWith("No price") || it.startsWith("No items") } ?: "no items")); return@forEach
            }
            val (c, _, note) = customerFor(o.name, WhatsAppParser.matchCustomer(o.name, store.customers))
            val order = CateringOrder(date = date, customerId = c.id, deliveryCharge = o.delivery,
                notes = (if (o.kind == "catering") "Catering" else "À la carte") + (o.place?.let { " • $it" } ?: ""),
                items = o.items.map { CateringItem(itemName = it.name, qty = it.qty, unitPrice = it.price) })
            store.addCateringOrders(listOf(order)); oIds.add(order.id)
            val extra = listOfNotNull(note, *o.warnings.toTypedArray())
            lines.add("✓ ${c.name} - ${if (o.kind == "catering") "catering" else "à la carte"}: " +
                o.items.joinToString(", ") { it.name } + " = ${Fmt.currency(order.total, cur)}" +
                if (extra.isNotEmpty()) "\n   ⚠ " + extra.joinToString("; ") else "")
        }
        val total = tIds.mapNotNull { id -> store.tiffins.firstOrNull { it.id == id }?.total }.sum() +
            oIds.mapNotNull { id -> store.cateringOrders.firstOrNull { it.id == id }?.total }.sum()
        val head = if (tIds.isEmpty() && oIds.isEmpty()) "Nothing saved." else "Saved for $date (${Fmt.currency(total, cur)} total):"
        val tail = if (tIds.isEmpty() && oIds.isEmpty()) "" else "\n\nSend /undo to remove this batch."
        return Pair("$head\n" + lines.joinToString("\n") + tail, Batch(tIds, oIds, created.values.map { it.id }))
    }

    fun undo(store: KitchenStore, b: Batch): String {
        b.tiffinIds.forEach { id -> store.tiffins.firstOrNull { it.id == id }?.let { store.deleteTiffin(it) } }
        b.orderIds.forEach { id -> store.cateringOrders.firstOrNull { it.id == id }?.let { store.deleteCateringOrder(it) } }
        b.customerIds.forEach { id ->
            val used = store.tiffins.any { it.customerId == id } || store.cateringOrders.any { it.customerId == id }
            if (!used) store.customers.firstOrNull { it.id == id }?.let { store.deleteCustomer(it) }
        }
        return "Removed ${b.tiffinIds.size} tiffin entries and ${b.orderIds.size} orders from the last message."
    }
}
