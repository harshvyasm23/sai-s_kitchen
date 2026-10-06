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
    var settings by mutableStateOf(AppSettings()); private set
    var themeMode by mutableStateOf(ThemeMode.Auto); private set

    init { loadAll() }

    companion object {
        @Volatile private var inst: KitchenStore? = null
        /** One shared store so the UI and the background Telegram check never disagree. */
        fun get(context: Context): KitchenStore =
            inst ?: synchronized(this) { inst ?: KitchenStore(context.applicationContext).also { inst = it } }
    }

    private fun loadAll() {
        try {
            customers = JSONArray(prefs.getString(K_CUSTOMERS, "[]")).map { customerFrom(it) }
            tiffins = JSONArray(prefs.getString(K_TIFFINS, "[]")).map { tiffinFrom(it) }
            cateringOrders = JSONArray(prefs.getString(K_CATERING, "[]")).map { orderFrom(it) }
            prefs.getString(K_SETTINGS, null)?.let { settings = settingsFrom(JSONObject(it)) }
            themeMode = runCatching { ThemeMode.valueOf(prefs.getString(K_THEME, "Auto")!!) }.getOrDefault(ThemeMode.Auto)
        } catch (e: Exception) {
            // corrupted data: start empty rather than crash
        }
    }

    private fun saveCustomers() = prefs.edit().putString(K_CUSTOMERS, JSONArray(customers.map { it.toJson() }).toString()).apply()
    private fun saveTiffins() = prefs.edit().putString(K_TIFFINS, JSONArray(tiffins.map { it.toJson() }).toString()).apply()
    private fun saveCatering() = prefs.edit().putString(K_CATERING, JSONArray(cateringOrders.map { it.toJson() }).toString()).apply()

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
        val found = parsed.customers.size + parsed.tiffins.size + parsed.orders.size
        return ImportResult(newC.size, newT.size, newO.size, found - newC.size - newT.size - newO.size)
    }

    fun clearAllData() {
        customers = emptyList(); tiffins = emptyList(); cateringOrders = emptyList()
        saveCustomers(); saveTiffins(); saveCatering()
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
        private const val K_CUSTOMERS = "customers"
        private const val K_TIFFINS = "tiffins"
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

data class ImportResult(val customers: Int, val tiffins: Int, val orders: Int, val skipped: Int) {
    val total get() = customers + tiffins + orders
    fun message(): String = if (total == 0) {
        if (skipped > 0) "Nothing new: all $skipped records are already in the app." else "No records found in that file."
    } else buildString {
        append("Imported:\n")
        if (customers > 0) append("• $customers customers\n")
        if (tiffins > 0) append("• $tiffins tiffin entries\n")
        if (orders > 0) append("• $orders catering orders\n")
        if (skipped > 0) append("($skipped already existed and were skipped)")
    }
}
