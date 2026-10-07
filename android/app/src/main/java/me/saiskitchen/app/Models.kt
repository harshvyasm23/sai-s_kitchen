package me.saiskitchen.app

import java.time.LocalDate
import java.util.UUID

fun newId(): String = UUID.randomUUID().toString()

enum class ThemeMode(val label: String) { Light("Light"), Dark("Dark"), Auto("Auto") }
enum class InvoiceKind(val label: String) { Combined("Combined"), Tiffin("Tiffin Only"), Catering("Catering Only") }

data class Customer(
    val id: String = newId(),
    val name: String,
    val phone: String,
    val address: String = "",
    val type: String = "Regular", // Regular | Occasional
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
    val isActive: Boolean = true,
)

data class TiffinEntry(
    val id: String = newId(),
    val date: LocalDate = LocalDate.now(),
    val customerId: String,
    val noonQty: Double,
    val eveningQty: Double,
    val unitPrice: Double,
    val deliveryCharge: Double,
    val notes: String = "",
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
) {
    val quantity: Double get() = noonQty + eveningQty
    val total: Double get() = (quantity * unitPrice + deliveryCharge).cents()
}

data class CateringItem(
    val id: String = newId(),
    val itemName: String = "",
    val qty: Double = 0.0,
    val unitPrice: Double = 0.0,
    val note: String = "",
) {
    val total: Double get() = (qty * unitPrice).cents()
}

data class CateringOrder(
    val id: String = newId(),
    val date: LocalDate = LocalDate.now(),
    val customerId: String,
    val deliveryCharge: Double,
    val notes: String = "",
    val items: List<CateringItem>,
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
) {
    val itemsTotal: Double get() = items.sumOf { it.total }.cents()
    val total: Double get() = (itemsTotal + deliveryCharge).cents()
}

/** Money received from a customer. Outstanding = billed - payments. */
data class Payment(
    val id: String = newId(),
    val customerId: String,
    val date: LocalDate = LocalDate.now(),
    val amount: Double,
    val note: String = "",
    val createdAt: Long = System.currentTimeMillis(),
)

data class AppSettings(
    val currency: String = "EUR",
    val defaultTiffinPrice: Double = 8.0,
    val defaultDeliveryCharge: Double = 0.5,
    val companyName: String = "Sai's Kitchen",
    val companyPhone: String = "0442355458",
    val companyAddress: String = "Instagram: jai.sainath11 | Website: saiskitchen.me",
)

data class DashboardMetrics(
    val totalTiffins: Double,
    val totalRevenue: Double,
    val deliveryTotal: Double,
    val cateringOrders: Int,
    val cateringRevenue: Double,
)
