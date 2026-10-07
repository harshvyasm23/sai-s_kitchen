import Foundation

nonisolated enum CustomerType: String, Codable, CaseIterable, Identifiable, Sendable {
    case regular = "Regular"
    case occasional = "Occasional"

    var id: String { rawValue }
}

nonisolated enum ThemeMode: String, Codable, CaseIterable, Identifiable, Sendable {
    case light = "Light"
    case dark = "Dark"
    case auto = "Auto"

    var id: String { rawValue }
}

nonisolated enum InvoiceKind: String, CaseIterable, Identifiable, Sendable {
    case combined = "Combined"
    case tiffin = "Tiffin Only"
    case catering = "Catering Only"

    var id: String { rawValue }
}

nonisolated struct Customer: Identifiable, Codable, Hashable, Sendable {
    let id: String
    var name: String
    var phone: String
    var address: String
    var type: CustomerType
    var createdAt: Date
    var updatedAt: Date
    var isActive: Bool

    init(id: String = UUID().uuidString, name: String, phone: String, address: String = "", type: CustomerType = .regular, createdAt: Date = Date(), updatedAt: Date = Date(), isActive: Bool = true) {
        self.id = id
        self.name = name
        self.phone = phone
        self.address = address
        self.type = type
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.isActive = isActive
    }
}

nonisolated struct TiffinEntry: Identifiable, Codable, Hashable, Sendable {
    let id: String
    var date: Date
    var customerId: String
    var noonQty: Double
    var eveningQty: Double
    var unitPrice: Double
    var deliveryCharge: Double
    var notes: String
    var createdAt: Date
    var updatedAt: Date

    init(id: String = UUID().uuidString, date: Date = Date(), customerId: String, noonQty: Double, eveningQty: Double, unitPrice: Double, deliveryCharge: Double, notes: String = "", createdAt: Date = Date(), updatedAt: Date = Date()) {
        self.id = id
        self.date = date
        self.customerId = customerId
        self.noonQty = noonQty
        self.eveningQty = eveningQty
        self.unitPrice = unitPrice
        self.deliveryCharge = deliveryCharge
        self.notes = notes
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    var quantity: Double { noonQty + eveningQty }
    var total: Double { ((quantity * unitPrice) + deliveryCharge).roundedToCents }
}

nonisolated struct CateringItem: Identifiable, Codable, Hashable, Sendable {
    let id: String
    var itemName: String
    var qty: Double
    var unitPrice: Double
    var note: String

    init(id: String = UUID().uuidString, itemName: String = "", qty: Double = 0, unitPrice: Double = 0, note: String = "") {
        self.id = id
        self.itemName = itemName
        self.qty = qty
        self.unitPrice = unitPrice
        self.note = note
    }

    var total: Double { (qty * unitPrice).roundedToCents }
}

nonisolated struct CateringOrder: Identifiable, Codable, Hashable, Sendable {
    let id: String
    var date: Date
    var customerId: String
    var deliveryCharge: Double
    var notes: String
    var items: [CateringItem]
    var createdAt: Date
    var updatedAt: Date

    init(id: String = UUID().uuidString, date: Date = Date(), customerId: String, deliveryCharge: Double, notes: String = "", items: [CateringItem], createdAt: Date = Date(), updatedAt: Date = Date()) {
        self.id = id
        self.date = date
        self.customerId = customerId
        self.deliveryCharge = deliveryCharge
        self.notes = notes
        self.items = items
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }

    var itemsTotal: Double { items.reduce(0) { $0 + $1.total }.roundedToCents }
    var total: Double { (itemsTotal + deliveryCharge).roundedToCents }
}

nonisolated struct Payment: Identifiable, Codable, Hashable, Sendable {
    let id: String
    var customerId: String
    var date: Date
    var amount: Double
    var note: String
    var createdAt: Date

    init(id: String = UUID().uuidString, customerId: String, date: Date = Date(), amount: Double, note: String = "", createdAt: Date = Date()) {
        self.id = id
        self.customerId = customerId
        self.date = date
        self.amount = amount
        self.note = note
        self.createdAt = createdAt
    }
}

nonisolated struct AppSettings: Codable, Hashable, Sendable {
    var currency: String
    var defaultTiffinPrice: Double
    var defaultDeliveryCharge: Double
    var companyName: String
    var companyPhone: String
    var companyAddress: String

    static let `default` = AppSettings(
        currency: "EUR",
        defaultTiffinPrice: 20,
        defaultDeliveryCharge: 2,
        companyName: "Sai's Kitchen",
        companyPhone: "+358442355458",
        companyAddress: "Instagram: Jai.sainath11 | Website: saiskitchen.me"
    )
}

nonisolated struct DashboardMetrics: Hashable, Sendable {
    var totalTiffins: Double
    var totalRevenue: Double
    var deliveryTotal: Double
    var cateringOrders: Int
    var cateringRevenue: Double
}

nonisolated extension Double {
    var roundedToCents: Double { (self * 100).rounded() / 100 }
}
