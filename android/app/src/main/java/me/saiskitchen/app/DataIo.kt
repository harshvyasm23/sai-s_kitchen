package me.saiskitchen.app

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.Instant
import java.time.LocalDate

data class ParsedData(val customers: List<Customer>, val tiffins: List<TiffinEntry>, val orders: List<CateringOrder>, val payments: List<Payment> = emptyList(), val notes: List<String> = emptyList())

/**
 * Backup file format shared with the old Expo app and the iPhone app:
 * { "customers": [...], "tiffins": [...], "catering": [...], "exportDate": "..." }
 * dates are "YYYY-MM-DD", timestamps are ISO strings, customers use "active".
 */
object DataIo {
    private fun iso(ms: Long) = Instant.ofEpochMilli(ms).toString()
    private fun ms(s: String?): Long = try {
        if (s.isNullOrBlank()) System.currentTimeMillis() else Instant.parse(s).toEpochMilli()
    } catch (e: Exception) { System.currentTimeMillis() }

    private fun customerJson(c: Customer) = JSONObject().put("id", c.id).put("name", c.name).put("phone", c.phone)
        .put("address", c.address).put("type", c.type).put("createdAt", iso(c.createdAt)).put("updatedAt", iso(c.updatedAt))
        .put("active", c.isActive)

    private fun tiffinJson(t: TiffinEntry) = JSONObject().put("id", t.id).put("date", t.date.toString()).put("customerId", t.customerId)
        .put("noonQty", t.noonQty).put("eveningQty", t.eveningQty).put("unitPrice", t.unitPrice)
        .put("deliveryCharge", t.deliveryCharge).put("notes", t.notes)
        .put("createdAt", iso(t.createdAt)).put("updatedAt", iso(t.updatedAt))

    private fun orderJson(o: CateringOrder) = JSONObject().put("id", o.id).put("date", o.date.toString()).put("customerId", o.customerId)
        .put("deliveryCharge", o.deliveryCharge).put("notes", o.notes)
        .put("createdAt", iso(o.createdAt)).put("updatedAt", iso(o.updatedAt))
        .put("items", JSONArray(o.items.map {
            JSONObject().put("id", it.id).put("cateringOrderId", o.id).put("itemName", it.itemName)
                .put("qty", it.qty).put("unitPrice", it.unitPrice).put("note", it.note)
        }))

    /** kind: customers | tiffins | catering | all */
    fun build(store: KitchenStore, kind: String): String {
        val o = JSONObject()
        if (kind == "customers" || kind == "all") o.put("customers", JSONArray(store.customers.map { customerJson(it) }))
        if (kind == "tiffins" || kind == "all") o.put("tiffins", JSONArray(store.tiffins.map { tiffinJson(it) }))
        if (kind == "catering" || kind == "all") o.put("catering", JSONArray(store.cateringOrders.map { orderJson(it) }))
        if (kind == "payments" || kind == "all") o.put("payments", JSONArray(store.payments.map {
            JSONObject().put("id", it.id).put("customerId", it.customerId).put("date", it.date.toString())
                .put("amount", it.amount).put("note", it.note).put("createdAt", iso(it.createdAt))
        }))
        o.put("exportDate", Instant.now().toString())
        return o.toString(2)
    }

    fun parse(text: String): ParsedData {
        val root = JSONObject(text)
        val customers = root.optJSONArray("customers").objects().mapNotNull { o ->
            val id = o.optString("id"); val name = o.optString("name")
            if (id.isBlank() || name.isBlank()) null else Customer(
                id = id, name = name, phone = o.optString("phone"), address = o.optString("address"),
                type = o.optString("type", "Regular").ifBlank { "Regular" },
                createdAt = ms(o.optString("createdAt")), updatedAt = ms(o.optString("updatedAt")),
                isActive = o.optBoolean("active", o.optBoolean("isActive", true)),
            )
        }
        val notes = mutableListOf<String>()
        val nameOf = customers.associate { it.id to it.name }
        val tiffins = root.optJSONArray("tiffins").objects().mapNotNull { o ->
            val id = o.optString("id"); val cid = o.optString("customerId")
            val fixed = DateRepair.parse(o.optString("date"), ms(o.optString("createdAt")).takeIf { it > 0 })
            val date = fixed?.date
            if (fixed == null && id.isNotBlank()) notes.add("NOT imported (date unreadable \"${o.optString("date")}\"): ${nameOf[cid] ?: cid}")
            else if (fixed?.note != null) notes.add("${nameOf[cid] ?: cid}: ${fixed.note}")
            if (id.isBlank() || cid.isBlank() || date == null) null else TiffinEntry(
                id = id, date = date, customerId = cid, noonQty = o.optDouble("noonQty", 0.0), eveningQty = o.optDouble("eveningQty", 0.0),
                unitPrice = o.optDouble("unitPrice", 0.0), deliveryCharge = o.optDouble("deliveryCharge", 0.0),
                notes = o.optString("notes").ifBlank { o.optString("comment") },
                createdAt = ms(o.optString("createdAt")), updatedAt = ms(o.optString("updatedAt")),
            )
        }
        val orders = root.optJSONArray("catering").objects().mapNotNull { o ->
            val id = o.optString("id"); val cid = o.optString("customerId"); val date = parseDate(o.optString("date"))
            val items = o.optJSONArray("items").objects().map { i ->
                CateringItem(
                    id = i.optString("id").ifBlank { newId() },
                    itemName = i.optString("itemName").ifBlank { i.optString("name") },
                    qty = i.optDouble("qty", 0.0), unitPrice = i.optDouble("unitPrice", 0.0), note = i.optString("note"),
                )
            }
            if (id.isBlank() || cid.isBlank() || date == null || items.isEmpty()) null else CateringOrder(
                id = id, date = date, customerId = cid, deliveryCharge = o.optDouble("deliveryCharge", 0.0),
                notes = o.optString("notes").ifBlank { o.optString("comment") }, items = items,
                createdAt = ms(o.optString("createdAt")), updatedAt = ms(o.optString("updatedAt")),
            )
        }
        val payments = root.optJSONArray("payments").objects().mapNotNull { o ->
            val id = o.optString("id"); val cid = o.optString("customerId"); val date = parseDate(o.optString("date"))
            if (id.isBlank() || cid.isBlank() || date == null) null else
                Payment(id = id, customerId = cid, date = date, amount = o.optDouble("amount", 0.0), note = o.optString("note"), createdAt = ms(o.optString("createdAt")))
        }
        return ParsedData(customers, tiffins, orders, payments, notes)
    }

    private fun parseDate(s: String): LocalDate? = try { LocalDate.parse(s.take(10)) } catch (e: Exception) { null }

    private fun JSONArray?.objects(): List<JSONObject> =
        if (this == null) emptyList() else (0 until length()).mapNotNull { optJSONObject(it) }

    fun share(context: Context, store: KitchenStore, kind: String) {
        val dir = File(context.cacheDir, "exports").apply { mkdirs() }
        val name = when (kind) {
            "customers" -> "sai-kitchen-customers"; "tiffins" -> "sai-kitchen-tiffins"
            "catering" -> "sai-kitchen-catering"; else -> "sai-kitchen-backup"
        } + "-${LocalDate.now()}.json"
        val file = File(dir, name).apply { writeText(build(store, kind)) }
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val send = Intent(Intent.ACTION_SEND).apply {
            type = "application/json"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(send, "Export data").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }
}
