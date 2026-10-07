import Foundation
import SwiftUI

@Observable
final class KitchenStore {
    var customers: [Customer] = []
    var tiffins: [TiffinEntry] = []
    var cateringOrders: [CateringOrder] = []
    var payments: [Payment] = []
    var settings: AppSettings = .default
    var themeMode: ThemeMode = .auto

    private let customersKey = "sai_kitchen_ios_customers"
    private let tiffinsKey = "sai_kitchen_ios_tiffins"
    private let cateringKey = "sai_kitchen_ios_catering"
    private let paymentsKey = "sai_kitchen_ios_payments"
    private let settingsKey = "sai_kitchen_ios_settings"
    private let themeKey = "sai_kitchen_ios_theme"

    init() {
        loadAll()
    }

    func loadAll() {
        customers = load([Customer].self, key: customersKey) ?? []
        tiffins = load([TiffinEntry].self, key: tiffinsKey) ?? []
        cateringOrders = load([CateringOrder].self, key: cateringKey) ?? []
        payments = load([Payment].self, key: paymentsKey) ?? []
        settings = load(AppSettings.self, key: settingsKey) ?? .default
        themeMode = load(ThemeMode.self, key: themeKey) ?? .auto
    }

    func addPayment(_ payment: Payment) {
        payments.append(payment)
        payments.sort { $0.date < $1.date }
        save(payments, key: paymentsKey)
    }

    func deletePayment(_ payment: Payment) {
        payments.removeAll { $0.id == payment.id }
        save(payments, key: paymentsKey)
    }

    func addCustomer(_ customer: Customer) {
        customers.append(customer)
        save(customers, key: customersKey)
    }

    func updateCustomer(_ customer: Customer) {
        guard let index = customers.firstIndex(where: { $0.id == customer.id }) else { return }
        var updated = customer
        updated.updatedAt = Date()
        customers[index] = updated
        save(customers, key: customersKey)
    }

    func deleteCustomer(_ customer: Customer) {
        customers.removeAll { $0.id == customer.id }
        save(customers, key: customersKey)
    }

    func addMultipleTiffins(_ entries: [TiffinEntry]) {
        tiffins.append(contentsOf: entries)
        tiffins.sort { lhs, rhs in
            if Calendar.current.isDate(lhs.date, inSameDayAs: rhs.date) { return lhs.createdAt < rhs.createdAt }
            return lhs.date < rhs.date
        }
        save(tiffins, key: tiffinsKey)
    }

    func updateTiffin(_ entry: TiffinEntry) {
        guard let index = tiffins.firstIndex(where: { $0.id == entry.id }) else { return }
        var updated = entry
        updated.updatedAt = Date()
        tiffins[index] = updated
        save(tiffins, key: tiffinsKey)
    }

    func deleteTiffin(_ entry: TiffinEntry) {
        tiffins.removeAll { $0.id == entry.id }
        save(tiffins, key: tiffinsKey)
    }

    func addCateringOrders(_ orders: [CateringOrder]) {
        cateringOrders.append(contentsOf: orders)
        cateringOrders.sort { lhs, rhs in
            if Calendar.current.isDate(lhs.date, inSameDayAs: rhs.date) { return lhs.createdAt < rhs.createdAt }
            return lhs.date < rhs.date
        }
        save(cateringOrders, key: cateringKey)
    }

    func updateCatering(_ order: CateringOrder) {
        guard let index = cateringOrders.firstIndex(where: { $0.id == order.id }) else { return }
        var updated = order
        updated.updatedAt = Date()
        cateringOrders[index] = updated
        save(cateringOrders, key: cateringKey)
    }

    /// Adds records from a backup file (old Expo app, Android or iPhone export). Existing ids are skipped; nothing is overwritten.
    func importData(_ data: Data) throws -> ImportSummary {
        let parsed = try DataExchange.parse(data)
        let haveCustomers = Set(customers.map(\.id))
        let haveTiffins = Set(tiffins.map(\.id))
        let haveOrders = Set(cateringOrders.map(\.id))
        let havePayments = Set(payments.map(\.id))
        let newPayments = parsed.payments.filter { !havePayments.contains($0.id) }
        if !newPayments.isEmpty {
            payments.append(contentsOf: newPayments)
            payments.sort { $0.date < $1.date }
            save(payments, key: paymentsKey)
        }
        let newCustomers = parsed.customers.filter { !haveCustomers.contains($0.id) }
        let newTiffins = parsed.tiffins.filter { !haveTiffins.contains($0.id) }
        let newOrders = parsed.orders.filter { !haveOrders.contains($0.id) }
        if !newCustomers.isEmpty {
            customers.append(contentsOf: newCustomers)
            save(customers, key: customersKey)
        }
        if !newTiffins.isEmpty { addMultipleTiffins(newTiffins) }
        if !newOrders.isEmpty { addCateringOrders(newOrders) }
        let found = parsed.customers.count + parsed.tiffins.count + parsed.orders.count + parsed.payments.count
        let added = newCustomers.count + newTiffins.count + newOrders.count + newPayments.count
        return ImportSummary(customers: newCustomers.count, tiffins: newTiffins.count, orders: newOrders.count, payments: newPayments.count, skipped: found - added)
    }

    func deleteCateringOrder(_ order: CateringOrder) {
        cateringOrders.removeAll { $0.id == order.id }
        save(cateringOrders, key: cateringKey)
    }

    func updateSettings(_ newSettings: AppSettings) {
        settings = newSettings
        save(settings, key: settingsKey)
    }

    func updateTheme(_ mode: ThemeMode) {
        themeMode = mode
        save(themeMode, key: themeKey)
    }

    func seedSampleData() {
        let sampleCustomers: [Customer] = [
            Customer(name: "Rajesh Kumar", phone: "+31612345678", address: "Amsterdam Centrum", type: .regular),
            Customer(name: "Priya Sharma", phone: "+31687654321", address: "Rotterdam Zuid", type: .regular),
            Customer(name: "Amit Patel", phone: "+31698765432", address: "Utrecht Oost", type: .occasional)
        ]
        customers.append(contentsOf: sampleCustomers)
        var newTiffins: [TiffinEntry] = []
        var newOrders: [CateringOrder] = []
        for customer in sampleCustomers {
            for offset in 0..<5 {
                let date = Calendar.current.date(byAdding: .day, value: -offset, to: Date()) ?? Date()
                newTiffins.append(TiffinEntry(date: date, customerId: customer.id, noonQty: Double((offset % 2) + 1), eveningQty: 1, unitPrice: settings.defaultTiffinPrice, deliveryCharge: settings.defaultDeliveryCharge, notes: offset == 0 ? "Extra spicy" : ""))
            }
        }
        if let first = sampleCustomers.first {
            newOrders.append(CateringOrder(date: Date(), customerId: first.id, deliveryCharge: 5, notes: "Party order", items: [
                CateringItem(itemName: "Biryani", qty: 10, unitPrice: 15, note: "Chicken"),
                CateringItem(itemName: "Paneer Tikka", qty: 5, unitPrice: 12),
                CateringItem(itemName: "Naan", qty: 20, unitPrice: 2)
            ]))
        }
        tiffins.append(contentsOf: newTiffins)
        cateringOrders.append(contentsOf: newOrders)
        save(customers, key: customersKey)
        save(tiffins, key: tiffinsKey)
        save(cateringOrders, key: cateringKey)
    }

    func clearAllData() {
        customers = []
        tiffins = []
        cateringOrders = []
        payments = []
        save(payments, key: paymentsKey)
        save(customers, key: customersKey)
        save(tiffins, key: tiffinsKey)
        save(cateringOrders, key: cateringKey)
    }

    func customerName(for id: String) -> String {
        customers.first(where: { $0.id == id })?.name ?? "Unknown Customer"
    }

    func tiffins(customerId: String, start: Date, end: Date) -> [TiffinEntry] {
        tiffins.filter { $0.customerId == customerId && AppFormatters.isDate($0.date, between: start, and: end) }.sorted { $0.date < $1.date }
    }

    func catering(customerId: String, start: Date, end: Date) -> [CateringOrder] {
        cateringOrders.filter { $0.customerId == customerId && AppFormatters.isDate($0.date, between: start, and: end) }.sorted { $0.date < $1.date }
    }

    func metrics(start: Date, end: Date) -> DashboardMetrics {
        let filteredTiffins = tiffins.filter { AppFormatters.isDate($0.date, between: start, and: end) }
        let filteredOrders = cateringOrders.filter { AppFormatters.isDate($0.date, between: start, and: end) }
        let tiffinRevenue = filteredTiffins.reduce(0) { $0 + $1.total }
        let cateringRevenue = filteredOrders.reduce(0) { $0 + $1.total }
        let deliveryTotal = filteredTiffins.reduce(0) { $0 + $1.deliveryCharge } + filteredOrders.reduce(0) { $0 + $1.deliveryCharge }
        return DashboardMetrics(totalTiffins: filteredTiffins.reduce(0) { $0 + $1.quantity }, totalRevenue: tiffinRevenue + cateringRevenue, deliveryTotal: deliveryTotal, cateringOrders: filteredOrders.count, cateringRevenue: cateringRevenue)
    }

    private func load<T: Decodable>(_ type: T.Type, key: String) -> T? {
        guard let data = UserDefaults.standard.data(forKey: key) else { return nil }
        do {
            return try JSONDecoder().decode(T.self, from: data)
        } catch {
            return nil
        }
    }

    private func save<T: Encodable>(_ value: T, key: String) {
        do {
            let data = try JSONEncoder().encode(value)
            UserDefaults.standard.set(data, forKey: key)
        } catch {
            assertionFailure("Failed to save data for key: \(key)")
        }
    }
}
