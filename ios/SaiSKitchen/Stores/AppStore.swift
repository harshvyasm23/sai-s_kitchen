import Foundation
import SwiftUI

@Observable
final class KitchenStore {
    var customers: [Customer] = []
    var tiffins: [TiffinEntry] = []
    var cateringOrders: [CateringOrder] = []
    var payments: [Payment] = []
    var settings: AppSettings = .default
    var schedules: [Schedule] = []
    var skips: [Skip] = []
    var delivered: [String] = []
    var menu: [String: String] = DefaultMenu.days
    var themeMode: ThemeMode = .auto

    private let customersKey = "sai_kitchen_ios_customers"
    private let tiffinsKey = "sai_kitchen_ios_tiffins"
    private let cateringKey = "sai_kitchen_ios_catering"
    private let paymentsKey = "sai_kitchen_ios_payments"
    private let settingsKey = "sai_kitchen_ios_settings"
    private let themeKey = "sai_kitchen_ios_theme"
    private let schedulesKey = "sai_kitchen_ios_schedules"
    private let skipsKey = "sai_kitchen_ios_skips"
    private let deliveredKey = "sai_kitchen_ios_delivered"
    private let menuKey = "sai_kitchen_ios_menu"

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
        schedules = load([Schedule].self, key: schedulesKey) ?? []
        skips = load([Skip].self, key: skipsKey) ?? []
        delivered = load([String].self, key: deliveredKey) ?? []
        var m = DefaultMenu.days
        for (k, v) in (load([String: String].self, key: menuKey) ?? [:]) { m[k] = v }
        menu = m
    }

    // MARK: daily plan - weekly schedules, skipped days, delivered ticks, weekly menu
    static func dayKey(_ d: Date) -> String {
        let c = Calendar.current.dateComponents([.year, .month, .day], from: d)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }
    static func isoWeekday(_ d: Date) -> Int { let w = Calendar.current.component(.weekday, from: d); return w == 1 ? 7 : w - 1 }

    func schedule(for customerId: String) -> Schedule? { schedules.first { $0.customerId == customerId } }
    func setSchedule(_ s: Schedule) {
        schedules.removeAll { $0.customerId == s.customerId }
        schedules.append(s)
        save(schedules, key: schedulesKey)
    }
    func removeSchedule(_ customerId: String) {
        schedules.removeAll { $0.customerId == customerId }
        save(schedules, key: schedulesKey)
    }
    func isSkipped(_ customerId: String, _ date: Date) -> Bool {
        let k = Self.dayKey(date)
        return skips.contains { $0.day == k && ($0.customerId == customerId || $0.customerId.isEmpty) }
    }
    func isHoliday(_ date: Date) -> Bool { let k = Self.dayKey(date); return skips.contains { $0.day == k && $0.customerId.isEmpty } }
    func setSkip(_ customerId: String, _ date: Date, on: Bool) {
        let k = Self.dayKey(date)
        skips.removeAll { $0.customerId == customerId && $0.day == k }
        if on { skips.append(Skip(customerId: customerId, day: k)) }
        save(skips, key: skipsKey)
    }
    func isDelivered(_ customerId: String, _ date: Date) -> Bool { delivered.contains("\(Self.dayKey(date))|\(customerId)") }
    func toggleDelivered(_ customerId: String, _ date: Date) {
        let k = "\(Self.dayKey(date))|\(customerId)"
        if let i = delivered.firstIndex(of: k) { delivered.remove(at: i) } else { delivered.append(k) }
        save(delivered, key: deliveredKey)
    }
    func saveMenu(_ m: [String: String]) { menu = m; save(m, key: menuKey) }

    /// Everyone expected on [date] (from weekly schedules) plus anyone who already has an entry that day.
    func plannedFor(_ date: Date) -> [Planned] {
        let cal = Calendar.current
        let dayEntries = tiffins.filter { cal.isDate($0.date, inSameDayAs: date) }
        var out: [Planned] = []
        var seen = Set<String>()
        let wd = Self.isoWeekday(date)
        for s in schedules {
            guard let c = customers.first(where: { $0.id == s.customerId && $0.isActive }), s.days.contains(wd) else { continue }
            seen.insert(c.id)
            out.append(Planned(customer: c, noon: s.noon, evening: s.evening, place: s.place, entry: dayEntries.first { $0.customerId == c.id },
                               skipped: isSkipped(c.id, date), scheduled: true))
        }
        for e in dayEntries {
            guard let c = customers.first(where: { $0.id == e.customerId }), !seen.contains(c.id) else { continue }
            seen.insert(c.id)
            let rate = e.deliveryCharge / max(e.quantity, 1)
            let place = e.deliveryCharge == 0 ? "home" : (abs(rate - 1.0) < 0.01 ? "omena" : "other")
            out.append(Planned(customer: c, noon: e.noonQty, evening: e.eveningQty, place: place, entry: e, skipped: false, scheduled: false))
        }
        return out.sorted { $0.customer.name.localizedCaseInsensitiveCompare($1.customer.name) == .orderedAscending }
    }

    /// Creates the tiffin entry for a planned line. Never creates a second entry on the same day.
    @discardableResult
    func confirmPlanned(_ p: Planned, _ date: Date) -> Bool {
        if p.entry != nil || p.skipped || p.qty <= 0 { return false }
        if tiffins.contains(where: { $0.customerId == p.customer.id && Calendar.current.isDate($0.date, inSameDayAs: date) }) { return false }
        let rate = WhatsAppParser.places.first { $0.key == p.place }?.rate ?? settings.defaultDeliveryCharge
        addMultipleTiffins([TiffinEntry(date: date, customerId: p.customer.id, noonQty: p.noon, eveningQty: p.evening,
                                        unitPrice: settings.defaultTiffinPrice, deliveryCharge: (rate * p.qty).roundedToCents, notes: "Scheduled")])
        return true
    }

    func persistAll() {
        save(customers, key: customersKey)
        save(tiffins, key: tiffinsKey)
        save(cateringOrders, key: cateringKey)
        save(payments, key: paymentsKey)
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
        return ImportSummary(customers: newCustomers.count, tiffins: newTiffins.count, orders: newOrders.count, payments: newPayments.count, skipped: found - added, notes: parsed.notes)
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
        schedules = []; skips = []; delivered = []
        save(schedules, key: schedulesKey); save(skips, key: skipsKey); save(delivered, key: deliveredKey)
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
