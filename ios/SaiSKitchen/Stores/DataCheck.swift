import SwiftUI

/// Problems that cause wrong bills: the same customer saved twice, and the same day entered twice.
extension KitchenStore {
    private func phoneKey(_ p: String) -> String {
        let d = p.filter { $0.isNumber }
        return d.count >= 7 ? String(d.suffix(8)) : ""
    }

    /// Groups of customer records that are probably the same person (same phone number or same name).
    func duplicateCustomerGroups() -> [[Customer]] {
        var parent: [String: String] = [:]
        func find(_ x: String) -> String { var r = x; while let p = parent[r], p != r { r = p }; return r }
        func union(_ a: String, _ b: String) { let ra = find(a), rb = find(b); if ra != rb { parent[ra] = rb } }
        for c in customers { parent[c.id] = c.id }
        var byKey: [String: String] = [:]
        for c in customers {
            var keys: [String] = []
            let pk = phoneKey(c.phone)
            if !pk.isEmpty { keys.append("p" + pk) }
            keys.append("n" + WhatsAppParser.norm(c.name).split(separator: " ").joined(separator: " "))
            for k in keys {
                if let other = byKey[k] { union(c.id, other) } else { byKey[k] = c.id }
            }
        }
        let groups = Dictionary(grouping: customers) { find($0.id) }.values.filter { $0.count > 1 }
        return groups.map { g in g.sorted { a, b in tiffins.filter { $0.customerId == a.id }.count > tiffins.filter { $0.customerId == b.id }.count } }
    }

    /// Moves every entry of `others` to `keep` and removes the extra customer records.
    func mergeCustomers(keep: Customer, others: [Customer]) {
        let ids = Set(others.map(\.id)).subtracting([keep.id])
        if ids.isEmpty { return }
        for i in tiffins.indices where ids.contains(tiffins[i].customerId) { tiffins[i].customerId = keep.id; tiffins[i].updatedAt = Date() }
        for i in cateringOrders.indices where ids.contains(cateringOrders[i].customerId) { cateringOrders[i].customerId = keep.id; cateringOrders[i].updatedAt = Date() }
        for i in payments.indices where ids.contains(payments[i].customerId) { payments[i].customerId = keep.id }
        customers.removeAll { ids.contains($0.id) }
        persistAll()
    }

    /// Same customer with more than one tiffin entry on the same day (possible double billing).
    func sameDayGroups() -> [[TiffinEntry]] {
        let cal = Calendar.current
        let groups = Dictionary(grouping: tiffins) { "\($0.customerId)|\(cal.startOfDay(for: $0.date).timeIntervalSince1970)" }.values.filter { $0.count > 1 }
        return groups.sorted { $0[0].date > $1[0].date }
    }
}

struct DataCheckView: View {
    @Environment(KitchenStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var scheme
    private let theme = AppTheme()

    var body: some View {
        let dups = store.duplicateCustomerGroups()
        let days = store.sameDayGroups()
        let cur = store.settings.currency
        NavigationStack {
            ZStack {
                theme.background(scheme).ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 14) {
                        if dups.isEmpty && days.isEmpty {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("All good ✓").font(.title3.bold())
                                Text("No duplicate customers and no doubled entries found.")
                            }.padding(16).frame(maxWidth: .infinity, alignment: .leading).appCardStyle(scheme)
                        }
                        if !dups.isEmpty {
                            Text("Same customer saved more than once").font(.headline)
                            Text("Their entries are split, so a bill misses some days. Merge them into one.").font(.footnote).foregroundStyle(theme.secondaryText(scheme))
                        }
                        ForEach(Array(dups.enumerated()), id: \.offset) { _, g in
                            VStack(alignment: .leading, spacing: 8) {
                                ForEach(g) { c in
                                    VStack(alignment: .leading) {
                                        Text(c.name).fontWeight(.semibold)
                                        let n = store.tiffins.filter { $0.customerId == c.id }.count
                                        Text("\(c.phone.isEmpty ? "no phone" : c.phone) \u{2022} \(n) tiffin entries").font(.caption).foregroundStyle(theme.secondaryText(scheme))
                                    }
                                }
                                Text("Keep which name?").font(.caption)
                                ForEach(g) { keep in
                                    Button { store.mergeCustomers(keep: keep, others: g) } label: { Text("Merge all into \"\(keep.name)\"").frame(maxWidth: .infinity) }
                                        .buttonStyle(.bordered).tint(theme.primary)
                                }
                            }
                            .padding(14).frame(maxWidth: .infinity, alignment: .leading).appCardStyle(scheme)
                        }
                        if !days.isEmpty {
                            Text("Same customer, same day, entered twice").font(.headline)
                            Text("If the customer really had two tiffins, keep both. If it was typed twice, delete the extra.").font(.footnote).foregroundStyle(theme.secondaryText(scheme))
                        }
                        ForEach(Array(days.enumerated()), id: \.offset) { _, g in
                            VStack(alignment: .leading, spacing: 8) {
                                Text(store.customerName(for: g[0].customerId)).fontWeight(.semibold)
                                Text(AppFormatters.displayDate(g[0].date)).font(.caption).foregroundStyle(theme.secondaryText(scheme))
                                ForEach(g) { t in
                                    HStack {
                                        Text("Noon \(t.noonQty.clean), Evening \(t.eveningQty.clean) \u{00D7} \(AppFormatters.currency(t.unitPrice, code: cur)) + \(AppFormatters.currency(t.deliveryCharge, code: cur)) = \(AppFormatters.currency(t.total, code: cur))").font(.footnote)
                                        Spacer()
                                        Button("Delete", role: .destructive) { store.deleteTiffin(t) }.buttonStyle(.borderless)
                                    }
                                }
                            }
                            .padding(14).frame(maxWidth: .infinity, alignment: .leading).appCardStyle(scheme)
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Data Check")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
        }
    }
}
