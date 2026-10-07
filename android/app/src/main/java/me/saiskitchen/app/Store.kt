package me.saiskitchen.app

import android.content.Context
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate

/** All data is stored on the phone (SharedPreferences, JSON). No server, no account. */
class KitchenStore(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences("sai_kitchen_android", Context.MODE_PRIVATE)

    var customers by mutableStateOf(listOf<Customer>()); private set
    var tiffins by mutableStateOf(listOf<TiffinEntry>()); private set
    var cateringOrders by mutableStateOf(listOf<CateringOrder>()); private set
    var payments by mutableStateOf(listOf<Payment>()); private set
    var settings by mutableStateOf(AppSettings()); private set
    var themeMode by mutableStateOf(ThemeMode.Auto); private set

    init { loadAll() }

    private fun loadAll() {
        try {
            customers = JSONArray(prefs.getString(K_CUSTOMERS, "[]")).map { customerFrom(it) }
            payments = JSONArray(prefs.getString(K_PAYMENTS, "[]")).map { paymentFrom(it) }
            tiffins = JSONArray(prefs.getString(K_TIFFINS, "[]")).map { tiffinFrom(it) }
            cateringOrders = JSONArray(prefs.getString(K_CATERING, "[]")).map { orderFrom(it) }
            prefs.getString(K_SETTINGS, null)?.let { settings = settingsFrom(JSONObject(it)) }
            themeMode = runCatching { ThemeMode.valueOf(prefs.getString(K_THEME, "Auto")!!) }.getOrDefault(ThemeMode.Auto)
        } catch (e: Exception) {
            // corrupted data: start empty rather than crash
        }
    }

    private fun saveCustomers() = prefs.edit().putString(K_CUSTOMERS, JSONArray(customers.map { it.toJson() }).toString()).apply()
    private fun savePayments() = prefs.edit().putString(K_PAYMENTS, JSONArray(payments.map { it.toJson() }).toString()).apply()
    private fun saveTiffins() = prefs.edit().putString(K_TIFFINS, JSONArray(tiffins.map { it.toJson() }).toString()).apply()
    private fun saveCatering() = prefs.edit().putString(K_CATERING, JSONArray(cateringOrders.map { it.toJson() }).toString()).apply()

    fun addPayment(p: Payment) { payments = (payments + p).sortedBy { it.date }; savePayments() }
    fun addPayments(list: List<Payment>) { payments = (payments + list).sortedBy { it.date }; savePayments() }
    fun deletePayment(p: Payment) { payments = payments.filter { it.id != p.id }; savePayments() }

    // ---- ledger: what each customer was billed, paid and still owes ----
    fun billed(customerId: String, start: LocalDate?, end: LocalDate): Double =
        tiffins.filter { it.customerId == customerId && (start == null || !it.date.isBefore(start)) && !it.date.isAfter(end) }.sumOf { it.total } +
            cateringOrders.filter { it.customerId == customerId && (start == null || !it.date.isBefore(start)) && !it.date.isAfter(end) }.sumOf { it.total }

    /** Money received (positive payments only). */
    fun paid(customerId: String, start: LocalDate?, end: LocalDate): Double =
        payments.filter { it.customerId == customerId && it.amount > 0 && (start == null || !it.date.isBefore(start)) && !it.date.isAfter(end) }.sumOf { it.amount }

    /** Previous unpaid amount that YOU added by hand for this period (stored as a negative payment). */
    fun previousDue(customerId: String, start: LocalDate, end: LocalDate): Double =
        -payments.filter { it.customerId == customerId && it.amount < 0 && !it.date.isBefore(start) && !it.date.isAfter(end) }.sumOf { it.amount }

    fun previousDueEntries(customerId: String, start: LocalDate, end: LocalDate): List<Payment> =
        payments.filter { it.customerId == customerId && it.amount < 0 && !it.date.isBefore(start) && !it.date.isAfter(end) }

    /** One row per customer billed in the period or with a previous due added; balance = previous + billed - paid. */
    fun outstandingRows(start: LocalDate, end: LocalDate): List<OutstandingRow> =
        customers.map { c ->
            OutstandingRow(
                customerId = c.id, name = c.name, phone = c.phone,
                tiffin = tiffins(c.id, start, end).sumOf { it.total }.cents(),
                catering = catering(c.id, start, end).sumOf { it.total }.cents(),
                previous = previousDue(c.id, start, end).cents(), paid = paid(c.id, start, end).cents(),
            )
        }.filter { it.tiffin + it.catering > 0 || it.previous > 0 || it.paid > 0 }.sortedBy { it.name.lowercase() }

    // ---- data check: duplicate customers and doubled entries ----
    private fun phoneKey(p: String): String { val d = p.filter { it.isDigit() }; return if (d.length >= 7) d.takeLast(8) else "" }

    /** Groups of customer records that are probably the same person (same phone number or same name). */
    fun duplicateCustomerGroups(): List<List<Customer>> {
        val parent = HashMap<String, String>()
        fun find(x: String): String { var r = x; while (parent[r] != null && parent[r] != r) r = parent[r]!!; return r }
        fun union(a: String, b: String) { val ra = find(a); val rb = find(b); if (ra != rb) parent[ra] = rb }
        customers.forEach { parent[it.id] = it.id }
        val byKey = HashMap<String, String>()
        customers.forEach { c ->
            val keys = listOfNotNull(phoneKey(c.phone).takeIf { it.isNotEmpty() }?.let { "p$it" }, "n" + WhatsAppParser.norm(c.name).trim().replace(Regex("\\s+"), " "))
            keys.forEach { k -> byKey[k]?.let { union(c.id, it) } ?: run { byKey[k] = c.id } }
        }
        return customers.groupBy { find(it.id) }.values.filter { it.size > 1 }.map { g -> g.sortedByDescending { c -> tiffins.count { it.customerId == c.id } } }
    }

    /** Moves every entry of [others] to [keep] and removes the extra customer records. */
    fun mergeCustomers(keep: Customer, others: List<Customer>) {
        val ids = others.map { it.id }.toSet() - keep.id
        if (ids.isEmpty()) return
        tiffins = tiffins.map { if (it.customerId in ids) it.copy(customerId = keep.id, updatedAt = System.currentTimeMillis()) else it }; saveTiffins()
        cateringOrders = cateringOrders.map { if (it.customerId in ids) it.copy(customerId = keep.id, updatedAt = System.currentTimeMillis()) else it }; saveCatering()
        payments = payments.map { if (it.customerId in ids) it.copy(customerId = keep.id) else it }; savePayments()
        customers = customers.filter { it.id !in ids }; saveCustomers()
    }

    /** Same customer with more than one tiffin entry on the same day (possible double billing). */
    fun sameDayGroups(): List<List<TiffinEntry>> =
        tiffins.groupBy { it.customerId to it.date }.values.filter { it.size > 1 }.sortedByDescending { it[0].date }

    fun addCustomer(c: Customer) { customers = customers + c; saveCustomers() }
    fun updateCustomer(c: Customer) {
        customers = customers.map { if (it.id == c.id) c.copy(updatedAt = System.currentTimeMillis()) else it }; saveCustomers()
    }
    fun deleteCustomer(c: Customer) { customers = customers.filter { it.id != c.id }; saveCustomers() }

    fun addTiffins(entries: List<TiffinEntry>) {
        tiffins = (tiffins + entries).sortedWith(compareBy<TiffinEntry> { it.date }.thenBy { it.createdAt }); saveTiffins()
    }
    fun updateTiffin(e: TiffinEntry) {
        tiffins = tiffins.map { if (it.id == e.id) e.copy(updatedAt = System.currentTimeMillis()) else it }
            .sortedWith(compareBy<TiffinEntry> { it.date }.thenBy { it.createdAt }); saveTiffins()
    }
    fun updateCateringOrder(o: CateringOrder) {
        cateringOrders = cateringOrders.map { if (it.id == o.id) o.copy(updatedAt = System.currentTimeMillis()) else it }
            .sortedWith(compareBy<CateringOrder> { it.date }.thenBy { it.createdAt }); saveCatering()
    }
    fun deleteTiffin(e: TiffinEntry) { tiffins = tiffins.filter { it.id != e.id }; saveTiffins() }

    fun addCateringOrders(orders: List<CateringOrder>) {
        cateringOrders = (cateringOrders + orders).sortedWith(compareBy<CateringOrder> { it.date }.thenBy { it.createdAt }); saveCatering()
    }
    fun deleteCateringOrder(o: CateringOrder) { cateringOrders = cateringOrders.filter { it.id != o.id }; saveCatering() }

    fun updateSettings(s: AppSettings) { settings = s; prefs.edit().putString(K_SETTINGS, s.toJson().toString()).apply() }
    fun updateTheme(m: ThemeMode) { themeMode = m; prefs.edit().putString(K_THEME, m.name).apply() }

    /** Adds records from a backup file (Expo-app or native format). Existing ids are skipped, nothing is overwritten. */
    fun importJson(text: String): ImportResult {
        val parsed = DataIo.parse(text)
        val haveC = customers.map { it.id }.toSet()
        val haveT = tiffins.map { it.id }.toSet()
        val haveO = cateringOrders.map { it.id }.toSet()
        val newC = parsed.customers.filter { it.id !in haveC }
        val newT = parsed.tiffins.filter { it.id !in haveT }
        val newO = parsed.orders.filter { it.id !in haveO }
        if (newC.isNotEmpty()) { customers = customers + newC; saveCustomers() }
        if (newT.isNotEmpty()) addTiffins(newT)
        if (newO.isNotEmpty()) addCateringOrders(newO)
        val haveP = payments.map { it.id }.toSet()
        val newP = parsed.payments.filter { it.id !in haveP }
        if (newP.isNotEmpty()) addPayments(newP)
        val found = parsed.customers.size + parsed.tiffins.size + parsed.orders.size + parsed.payments.size
        return ImportResult(newC.size, newT.size, newO.size, found - newC.size - newT.size - newO.size - newP.size, newP.size, parsed.notes)
    }

    fun clearAllData() {
        customers = emptyList(); tiffins = emptyList(); cateringOrders = emptyList(); payments = emptyList()
        saveCustomers(); saveTiffins(); saveCatering(); savePayments()
    }

    fun seedSampleData() {
        val samples = listOf(
            Customer(name = "Rajesh Kumar", phone = "+31612345678", address = "Amsterdam Centrum"),
            Customer(name = "Priya Sharma", phone = "+31687654321", address = "Rotterdam Zuid"),
            Customer(name = "Amit Patel", phone = "+31698765432", address = "Utrecht Oost", type = "Occasional"),
        )
        customers = customers + samples
        val newTiffins = samples.flatMap { c ->
            (0 until 5).map { offset ->
                TiffinEntry(
                    date = LocalDate.now().minusDays(offset.toLong()), customerId = c.id,
                    noonQty = ((offset % 2) + 1).toDouble(), eveningQty = 1.0,
                    unitPrice = settings.defaultTiffinPrice, deliveryCharge = settings.defaultDeliveryCharge,
                    notes = if (offset == 0) "Extra spicy" else "",
                )
            }
        }
        val order = CateringOrder(
            customerId = samples.first().id, deliveryCharge = 5.0, notes = "Party order",
            items = listOf(
                CateringItem(itemName = "Biryani", qty = 10.0, unitPrice = 15.0, note = "Chicken"),
                CateringItem(itemName = "Paneer Tikka", qty = 5.0, unitPrice = 12.0),
                CateringItem(itemName = "Naan", qty = 20.0, unitPrice = 2.0),
            ),
        )
        tiffins = (tiffins + newTiffins).sortedWith(compareBy<TiffinEntry> { it.date }.thenBy { it.createdAt })
        cateringOrders = cateringOrders + order
        saveCustomers(); saveTiffins(); saveCatering()
    }

    fun customerName(id: String): String = customers.firstOrNull { it.id == id }?.name ?: "Unknown Customer"

    fun tiffins(customerId: String, start: LocalDate, end: LocalDate): List<TiffinEntry> =
        tiffins.filter { it.customerId == customerId && Fmt.inRange(it.date, start, end) }.sortedBy { it.date }

    fun catering(customerId: String, start: LocalDate, end: LocalDate): List<CateringOrder> =
        cateringOrders.filter { it.customerId == customerId && Fmt.inRange(it.date, start, end) }.sortedBy { it.date }

    fun metrics(start: LocalDate, end: LocalDate): DashboardMetrics {
        val t = tiffins.filter { Fmt.inRange(it.date, start, end) }
        val o = cateringOrders.filter { Fmt.inRange(it.date, start, end) }
        val tiffinRevenue = t.sumOf { it.total }
        val cateringRevenue = o.sumOf { it.total }
        return DashboardMetrics(
            totalTiffins = t.sumOf { it.quantity },
            totalRevenue = tiffinRevenue + cateringRevenue,
            deliveryTotal = t.sumOf { it.deliveryCharge } + o.sumOf { it.deliveryCharge },
            cateringOrders = o.size,
            cateringRevenue = cateringRevenue,
        )
    }

    companion object {
        @Volatile private var inst: KitchenStore? = null
        /** One shared store so the UI and the background Telegram check never disagree. */
        fun get(context: Context): KitchenStore =
            inst ?: synchronized(this) { inst ?: KitchenStore(context.applicationContext).also { inst = it } }
        private const val K_CUSTOMERS = "customers"
        private const val K_TIFFINS = "tiffins"
        private const val K_PAYMENTS = "payments"
        private const val K_CATERING = "catering"
        private const val K_SETTINGS = "settings"
        private const val K_THEME = "theme"
    }
}

private fun <T> JSONArray.map(f: (JSONObject) -> T): List<T> = (0 until length()).map { f(getJSONObject(it)) }

private fun Customer.toJson() = JSONObject().put("id", id).put("name", name).put("phone", phone).put("address", address)
    .put("type", type).put("createdAt", createdAt).put("updatedAt", updatedAt).put("isActive", isActive)

private fun customerFrom(o: JSONObject) = Customer(
    id = o.getString("id"), name = o.getString("name"), phone = o.optString("phone"), address = o.optString("address"),
    type = o.optString("type", "Regular"), createdAt = o.optLong("createdAt"), updatedAt = o.optLong("updatedAt"),
    isActive = o.optBoolean("isActive", true),
)

private fun Payment.toJson() = JSONObject().put("id", id).put("customerId", customerId).put("date", date.toString())
    .put("amount", amount).put("note", note).put("createdAt", createdAt)

private fun paymentFrom(o: JSONObject) = Payment(
    id = o.getString("id"), customerId = o.getString("customerId"), date = LocalDate.parse(o.getString("date")),
    amount = o.optDouble("amount"), note = o.optString("note"), createdAt = o.optLong("createdAt"),
)

private fun TiffinEntry.toJson() = JSONObject().put("id", id).put("date", date.toString()).put("customerId", customerId)
    .put("noonQty", noonQty).put("eveningQty", eveningQty).put("unitPrice", unitPrice).put("deliveryCharge", deliveryCharge)
    .put("notes", notes).put("createdAt", createdAt).put("updatedAt", updatedAt)

private fun tiffinFrom(o: JSONObject) = TiffinEntry(
    id = o.getString("id"), date = LocalDate.parse(o.getString("date")), customerId = o.getString("customerId"),
    noonQty = o.optDouble("noonQty"), eveningQty = o.optDouble("eveningQty"), unitPrice = o.optDouble("unitPrice"),
    deliveryCharge = o.optDouble("deliveryCharge"), notes = o.optString("notes"),
    createdAt = o.optLong("createdAt"), updatedAt = o.optLong("updatedAt"),
)

private fun CateringOrder.toJson() = JSONObject().put("id", id).put("date", date.toString()).put("customerId", customerId)
    .put("deliveryCharge", deliveryCharge).put("notes", notes).put("createdAt", createdAt).put("updatedAt", updatedAt)
    .put("items", JSONArray(items.map {
        JSONObject().put("id", it.id).put("itemName", it.itemName).put("qty", it.qty).put("unitPrice", it.unitPrice).put("note", it.note)
    }))

private fun orderFrom(o: JSONObject) = CateringOrder(
    id = o.getString("id"), date = LocalDate.parse(o.getString("date")), customerId = o.getString("customerId"),
    deliveryCharge = o.optDouble("deliveryCharge"), notes = o.optString("notes"),
    items = o.getJSONArray("items").map {
        CateringItem(it.getString("id"), it.optString("itemName"), it.optDouble("qty"), it.optDouble("unitPrice"), it.optString("note"))
    },
    createdAt = o.optLong("createdAt"), updatedAt = o.optLong("updatedAt"),
)

private fun AppSettings.toJson() = JSONObject().put("currency", currency).put("defaultTiffinPrice", defaultTiffinPrice)
    .put("defaultDeliveryCharge", defaultDeliveryCharge).put("companyName", companyName)
    .put("companyPhone", companyPhone).put("companyAddress", companyAddress)

private fun settingsFrom(o: JSONObject): AppSettings {
    val d = AppSettings()
    return AppSettings(
        o.optString("currency", d.currency), o.optDouble("defaultTiffinPrice", d.defaultTiffinPrice),
        o.optDouble("defaultDeliveryCharge", d.defaultDeliveryCharge), o.optString("companyName", d.companyName),
        o.optString("companyPhone", d.companyPhone), o.optString("companyAddress", d.companyAddress),
    )
}

data class ImportResult(val customers: Int, val tiffins: Int, val orders: Int, val skipped: Int, val payments: Int = 0, val notes: List<String> = emptyList()) {
    val total get() = customers + tiffins + orders + payments
    fun message(): String = if (total == 0) {
        if (skipped > 0) "Nothing new: all $skipped records are already in the app." else "No records found in that file."
    } else buildString {
        append("Imported:\n")
        if (customers > 0) append("• $customers customers\n")
        if (tiffins > 0) append("• $tiffins tiffin entries\n")
        if (orders > 0) append("• $orders catering orders\n")
        if (payments > 0) append("• $payments payments\n")
        if (skipped > 0) append("($skipped already existed and were skipped)")
        if (notes.isNotEmpty()) append("\n\nCheck these dates:\n" + notes.take(12).joinToString("\n") { "• $it" } + if (notes.size > 12) "\n…and ${notes.size - 12} more" else "")
    }
}
