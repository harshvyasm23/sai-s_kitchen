package me.saiskitchen.app

import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate

/** What one chat message created, so /undo can remove exactly that (and put back anything it replaced). */
data class Batch(val tiffinIds: List<String>, val orderIds: List<String>, val customerIds: List<String>, val replaced: List<TiffinEntry> = emptyList()) {
    fun toJson(): String = JSONObject().put("t", JSONArray(tiffinIds)).put("o", JSONArray(orderIds)).put("c", JSONArray(customerIds))
        .put("r", JSONArray(replaced.map { JSONObject().put("id", it.id).put("date", it.date.toString()).put("cust", it.customerId).put("n", it.noonQty)
            .put("e", it.eveningQty).put("p", it.unitPrice).put("d", it.deliveryCharge).put("notes", it.notes) })).toString()
    companion object {
        fun fromJson(s: String?): Batch? = runCatching {
            val j = JSONObject(s!!)
            fun ids(k: String) = (0 until j.getJSONArray(k).length()).map { j.getJSONArray(k).getString(it) }
            val r = j.optJSONArray("r")
            val rep = if (r == null) emptyList() else (0 until r.length()).map { val o = r.getJSONObject(it)
                TiffinEntry(id = o.getString("id"), date = LocalDate.parse(o.getString("date")), customerId = o.getString("cust"), noonQty = o.getDouble("n"),
                    eveningQty = o.getDouble("e"), unitPrice = o.getDouble("p"), deliveryCharge = o.getDouble("d"), notes = o.optString("notes")) }
            Batch(ids("t"), ids("o"), ids("c"), rep)
        }.getOrNull()
    }
}

/** Saves a finished plan into the store without any UI (used by the Telegram bot). */
object EntryWriter {
    fun applyPlan(store: KitchenStore, plan: EntryPlanner.Plan, date: LocalDate): Pair<String, Batch> {
        val cur = store.settings.currency
        val created = mutableMapOf<String, Customer>()
        val lines = mutableListOf<String>()
        val tIds = mutableListOf<String>()
        val oIds = mutableListOf<String>()
        val replaced = mutableListOf<TiffinEntry>()
        var total = 0.0

        fun customerFor(l: EntryPlanner.Line): Pair<Customer, Boolean> {
            l.customer?.let { return Pair(it, false) }
            val name = l.newName ?: "Customer"
            val key = WhatsAppParser.norm(name).trim()
            created[key]?.let { return Pair(it, false) }
            store.customers.firstOrNull { WhatsAppParser.norm(it.name).trim() == key }?.let { return Pair(it, false) }
            val c = Customer(name = name, phone = "")
            store.addCustomer(c); created[key] = c
            return Pair(c, true)
        }

        for (l in plan.lines) {
            if (l.status != "save") {
                lines.add("↷ " + (l.customer?.name ?: l.tiffin?.name ?: l.order?.name ?: l.raw) + ": " + l.notes.joinToString("; "))
                continue
            }
            val (c, isNew) = customerFor(l)
            val extra = l.notes.toMutableList()
            if (isNew) extra.add("new customer - add phone in Customers")
            if (l.kind == "tiffin") {
                val t = l.tiffin!!
                l.replace.forEach { old -> store.deleteTiffin(old); replaced.add(old) }
                val e = TiffinEntry(date = date, customerId = c.id, noonQty = t.noon, eveningQty = t.evening,
                    unitPrice = t.price, deliveryCharge = l.delivery, notes = "Telegram • ${l.placeLabel}")
                store.addTiffins(listOf(e)); tIds.add(e.id); total += e.total
                val q = t.noon + t.evening
                if (l.replace.isNotEmpty()) extra.add("replaced the earlier entry")
                lines.add("✓ ${c.name}: ${q.clean()} tiffin, ${l.placeLabel} (${Fmt.currency(q * t.price, cur)}" +
                    (if (l.delivery > 0) " + ${Fmt.currency(l.delivery, cur)} delivery" else ", no delivery") + ") = ${Fmt.currency(e.total, cur)}" +
                    if (extra.isNotEmpty()) "\n   ⚠ " + extra.joinToString("; ") else "")
            } else {
                val o = l.order!!
                val order = CateringOrder(date = date, customerId = c.id, deliveryCharge = l.delivery,
                    notes = (if (o.kind == "catering") "Catering" else "À la carte") + (o.place?.let { " • $it" } ?: ""),
                    items = o.items.map { CateringItem(itemName = it.name, qty = it.qty, unitPrice = it.price) })
                store.addCateringOrders(listOf(order)); oIds.add(order.id); total += order.total
                lines.add("✓ ${c.name} - ${if (o.kind == "catering") "catering" else "à la carte"}: " +
                    o.items.joinToString(", ") { it.name } + " = ${Fmt.currency(order.total, cur)}" +
                    if (extra.isNotEmpty()) "\n   ⚠ " + extra.joinToString("; ") else "")
            }
        }
        val saved = tIds.size + oIds.size
        val head = if (saved == 0) "Nothing saved." else "Saved $saved for ${Fmt.displayDate(date)} - total ${Fmt.currency(total, cur)}:"
        val tail = if (saved == 0) "" else "\n\nSend /undo to remove this whole batch."
        return Pair("$head\n" + lines.joinToString("\n") + tail, Batch(tIds, oIds, created.values.map { it.id }, replaced))
    }

    fun undo(store: KitchenStore, b: Batch): String {
        b.tiffinIds.forEach { id -> store.tiffins.firstOrNull { it.id == id }?.let { store.deleteTiffin(it) } }
        b.orderIds.forEach { id -> store.cateringOrders.firstOrNull { it.id == id }?.let { store.deleteCateringOrder(it) } }
        if (b.replaced.isNotEmpty()) store.addTiffins(b.replaced)
        b.customerIds.forEach { id ->
            val used = store.tiffins.any { it.customerId == id } || store.cateringOrders.any { it.customerId == id }
            if (!used) store.customers.firstOrNull { it.id == id }?.let { store.deleteCustomer(it) }
        }
        return "Removed ${b.tiffinIds.size} tiffin entries and ${b.orderIds.size} orders from the last message." +
            if (b.replaced.isNotEmpty()) " Put back ${b.replaced.size} earlier entries." else ""
    }
}
