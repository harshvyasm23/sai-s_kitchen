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

    func paid(customerId: String, start: Date?, end: Date) -> Double {
        payments.filter { $0.customerId == customerId && inRange($0.date, start, end) }.reduce(0) { $0 + $1.amount }
    }

    /// Unpaid amount carried in from before `date` (negative = customer has credit).
    func balanceBefore(customerId: String, date: Date) -> Double {
        let dayBefore = Calendar.current.date(byAdding: .day, value: -1, to: date) ?? date
        return (billed(customerId: customerId, start: nil, end: dayBefore) - paid(customerId: customerId, start: nil, end: dayBefore)).roundedToCents
    }

    func outstandingRows(start: Date, end: Date) -> [OutstandingRow] {
        customers.map { c in
            OutstandingRow(
                customerId: c.id, name: c.name, phone: c.phone,
                tiffin: tiffins(customerId: c.id, start: start, end: end).reduce(0) { $0 + $1.total }.roundedToCents,
                catering: catering(customerId: c.id, start: start, end: end).reduce(0) { $0 + $1.total }.roundedToCents,
                previous: balanceBefore(customerId: c.id, date: start),
                paid: paid(customerId: c.id, start: start, end: end).roundedToCents)
        }
        .filter { $0.tiffin + $0.catering > 0 || abs($0.balance) > 0.004 }
        .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    func invoiceSummary(customer: Customer, kind: InvoiceKind, start: Date, end: Date) -> InvoiceSummary {
        InvoiceSummary(customer: customer, kind: kind, startDate: start, endDate: end,
                       tiffins: tiffins(customerId: customer.id, start: start, end: end),
                       cateringOrders: catering(customerId: customer.id, start: start, end: end), settings: settings,
                       previousBalance: balanceBefore(customerId: customer.id, date: start),
                       paidInPeriod: paid(customerId: customer.id, start: start, end: end).roundedToCents)
    }
}
