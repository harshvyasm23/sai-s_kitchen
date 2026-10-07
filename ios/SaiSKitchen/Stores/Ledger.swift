import Foundation

/// What each customer was billed, paid, and still owes.
extension KitchenStore {
    private func inRange(_ date: Date, _ start: Date?, _ end: Date) -> Bool {
        let cal = Calendar.current
        let d = cal.startOfDay(for: date)
        if let start, d < cal.startOfDay(for: start) { return false }
        return d <= cal.startOfDay(for: end)
    }

    func billed(customerId: String, start: Date?, end: Date) -> Double {
        let t = tiffins.filter { $0.customerId == customerId && inRange($0.date, start, end) }.reduce(0) { $0 + $1.total }
        let c = cateringOrders.filter { $0.customerId == customerId && inRange($0.date, start, end) }.reduce(0) { $0 + $1.total }
        return t + c
    }

    /// Money received (positive payments only).
    func paid(customerId: String, start: Date?, end: Date) -> Double {
        payments.filter { $0.customerId == customerId && $0.amount > 0 && inRange($0.date, start, end) }.reduce(0) { $0 + $1.amount }
    }

    /// Previous unpaid amount YOU added by hand for this period (stored as a negative payment).
    func previousDue(customerId: String, start: Date, end: Date) -> Double {
        -payments.filter { $0.customerId == customerId && $0.amount < 0 && inRange($0.date, start, end) }.reduce(0) { $0 + $1.amount }
    }

    func previousDueEntries(customerId: String, start: Date, end: Date) -> [Payment] {
        payments.filter { $0.customerId == customerId && $0.amount < 0 && inRange($0.date, start, end) }
    }

    func outstandingRows(start: Date, end: Date) -> [OutstandingRow] {
        customers.map { c in
            OutstandingRow(
                customerId: c.id, name: c.name, phone: c.phone,
                tiffin: tiffins(customerId: c.id, start: start, end: end).reduce(0) { $0 + $1.total }.roundedToCents,
                catering: catering(customerId: c.id, start: start, end: end).reduce(0) { $0 + $1.total }.roundedToCents,
                previous: previousDue(customerId: c.id, start: start, end: end).roundedToCents,
                paid: paid(customerId: c.id, start: start, end: end).roundedToCents)
        }
        .filter { $0.tiffin + $0.catering > 0 || $0.previous > 0 || $0.paid > 0 }
        .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    func invoiceSummary(customer: Customer, kind: InvoiceKind, start: Date, end: Date) -> InvoiceSummary {
        InvoiceSummary(customer: customer, kind: kind, startDate: start, endDate: end,
                       tiffins: tiffins(customerId: customer.id, start: start, end: end),
                       cateringOrders: catering(customerId: customer.id, start: start, end: end), settings: settings,
                       previousBalance: previousDue(customerId: customer.id, start: start, end: end),
                       paidInPeriod: paid(customerId: customer.id, start: start, end: end).roundedToCents)
    }
}
