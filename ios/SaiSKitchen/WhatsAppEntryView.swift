import SwiftUI
import UIKit

/// Paste a day's WhatsApp message, check the preview, save all entries at once.
struct WhatsAppEntryView: View {
    @Environment(KitchenStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @State private var text = ""
    @State private var monthFirst = false
    @State private var overrides: [String: Bool] = [:]
    @State private var doneMessage: String?

    private var parsed: ParsedMessage {
        WhatsAppParser.parse(text, monthFirst: monthFirst, defaultPrice: store.settings.defaultTiffinPrice)
    }

    private func isOn(_ key: String, dup: Bool = false) -> Bool { overrides[key] ?? !dup }

    var body: some View {
        let msg = parsed
        let date = msg.date ?? Date()
        let tMatches = msg.tiffins.map { WhatsAppParser.matchCustomer($0.name, in: store.customers) }
        let oMatches = msg.orders.map { WhatsAppParser.matchCustomer($0.name, in: store.customers) }
        let cal = Calendar.current
        let tDup: [Bool] = tMatches.map { m in
            guard let c = m.customer else { return false }
            return store.tiffins.contains { $0.customerId == c.id && cal.isDate($0.date, inSameDayAs: date) }
        }
        let count = msg.tiffins.indices.filter { isOn("t\($0)", dup: tDup[$0]) }.count
            + msg.orders.indices.filter { isOn("o\($0)") }.count

        NavigationStack {
            Form {
                Section("Paste your WhatsApp message") {
                    TextEditor(text: $text)
                        .frame(minHeight: 160)
                    HStack {
                        Button("Paste") { if let s = UIPasteboard.general.string { text = s } }
                        Spacer()
                        Button("Clear", role: .destructive) { text = "" }
                    }
                    .buttonStyle(.borderless)
                    Toggle("Read date as month.day", isOn: $monthFirst)
                }
                if !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                    Section("Date") {
                        Text(date.formatted(.dateTime.weekday().day().month().year())).font(.headline)
                        ForEach(msg.warnings, id: \.self) { Text("⚠ " + $0).font(.caption).foregroundStyle(.orange) }
                    }
                    if !msg.tiffins.isEmpty {
                        Section("Tiffins") {
                            ForEach(Array(msg.tiffins.enumerated()), id: \.offset) { i, t in
                                tiffinRow(i, t, tMatches[i], tDup[i])
                            }
                        }
                    }
                    if !msg.orders.isEmpty {
                        Section("Orders") {
                            ForEach(Array(msg.orders.enumerated()), id: \.offset) { i, o in
                                orderRow(i, o, oMatches[i])
                            }
                        }
                    }
                    if msg.tiffins.isEmpty && msg.orders.isEmpty {
                        Text("Nothing recognised yet. Check the message format.").foregroundStyle(.secondary)
                    }
                }
            }
            .navigationTitle("WhatsApp Entry")
            .navigationBarTitleDisplayMode(.inline)
            .onChange(of: text) { _, _ in overrides = [:] }
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save (\(count))") { save(msg, date, tMatches, oMatches, tDup) }.disabled(count == 0)
                }
            }
            .alert("Done", isPresented: Binding(get: { doneMessage != nil }, set: { if !$0 { doneMessage = nil; dismiss() } })) {
                Button("OK") { doneMessage = nil; dismiss() }
            } message: { Text(doneMessage ?? "") }
        }
    }

    private func money(_ v: Double) -> String { AppFormatters.currency(v, code: store.settings.currency) }

    private func statusLine(_ m: (status: String, customer: Customer?), _ typed: String) -> some View {
        let (text, color): (String, Color) = {
            switch m.status {
            case "matched":
                let same = m.customer.map { WhatsAppParser.norm($0.name) == WhatsAppParser.norm(typed) } ?? true
                return ("✓ Existing customer" + (same ? "" : " (from \"\(typed)\")"), .green)
            case "ambiguous": return ("⚠ Several customers match \"\(typed)\" – using \(m.customer?.name ?? "")", .orange)
            default: return ("+ New customer will be added", .blue)
            }
        }()
        return Text(text).font(.caption).foregroundStyle(color)
    }

    private func tiffinRow(_ i: Int, _ t: ParsedTiffin, _ m: (status: String, customer: Customer?), _ dup: Bool) -> some View {
        let key = "t\(i)"
        let total = (t.noon + t.evening) * t.price + t.delivery
        return Toggle(isOn: Binding(get: { isOn(key, dup: dup) }, set: { overrides[key] = $0 })) {
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(m.customer?.name ?? t.name).font(.headline)
                    Spacer()
                    Text(money(total)).font(.headline)
                }
                statusLine(m, t.name)
                Text("Noon \(t.noon.clean), Evening \(t.evening.clean) • \(t.place ?? "no place") • delivery \(money(t.delivery))")
                    .font(.caption).foregroundStyle(.secondary)
                if dup { Text("⚠ Already has a tiffin on this date (unticked)").font(.caption).foregroundStyle(.orange) }
                ForEach(t.warnings, id: \.self) { Text("⚠ " + $0).font(.caption).foregroundStyle(.orange) }
            }
        }
    }

    private func orderRow(_ i: Int, _ o: ParsedOrder, _ m: (status: String, customer: Customer?)) -> some View {
        let key = "o\(i)"
        let total = o.items.reduce(0) { $0 + $1.qty * $1.price } + o.delivery
        return Toggle(isOn: Binding(get: { isOn(key) }, set: { overrides[key] = $0 })) {
            VStack(alignment: .leading, spacing: 2) {
                HStack {
                    Text(m.customer?.name ?? o.name).font(.headline)
                    Spacer()
                    Text(money(total)).font(.headline)
                }
                statusLine(m, o.name)
                Text((o.kind == "catering" ? "Catering (self pickup)" : "À la carte") + (o.place.map { " • \($0)" } ?? "") + " • delivery \(money(o.delivery))")
                    .font(.caption).foregroundStyle(.secondary)
                ForEach(Array(o.items.enumerated()), id: \.offset) { _, it in
                    Text("• \(it.name)  \(it.qty.clean) × \(money(it.price))").font(.caption)
                }
                ForEach(o.warnings, id: \.self) { Text("⚠ " + $0).font(.caption).foregroundStyle(.orange) }
            }
        }
    }

    private func save(_ msg: ParsedMessage, _ date: Date, _ tM: [(status: String, customer: Customer?)],
                      _ oM: [(status: String, customer: Customer?)], _ tDup: [Bool]) {
        var created: [String: Customer] = [:]
        func customer(_ name: String, _ m: (status: String, customer: Customer?)) -> Customer {
            if let c = m.customer { return c }
            let key = WhatsAppParser.norm(name).trimmingCharacters(in: .whitespaces)
            if let c = created[key] { return c }
            let pretty = name.split(separator: " ").map { $0.prefix(1).uppercased() + $0.dropFirst() }.joined(separator: " ")
            let c = Customer(name: pretty, phone: "")
            store.addCustomer(c)
            created[key] = c
            return c
        }
        var tiffins: [TiffinEntry] = []
        for (i, t) in msg.tiffins.enumerated() where isOn("t\(i)", dup: tDup[i]) {
            let c = customer(t.name, tM[i])
            tiffins.append(TiffinEntry(date: date, customerId: c.id, noonQty: t.noon, eveningQty: t.evening,
                                       unitPrice: t.price, deliveryCharge: t.delivery,
                                       notes: t.place.map { "WhatsApp • \($0)" } ?? "WhatsApp"))
        }
        var orders: [CateringOrder] = []
        for (i, o) in msg.orders.enumerated() where isOn("o\(i)") && !o.items.isEmpty {
            let c = customer(o.name, oM[i])
            orders.append(CateringOrder(date: date, customerId: c.id, deliveryCharge: o.delivery,
                                        notes: (o.kind == "catering" ? "Catering" : "À la carte") + (o.place.map { " • \($0)" } ?? ""),
                                        items: o.items.map { CateringItem(itemName: $0.name, qty: $0.qty, unitPrice: $0.price) }))
        }
        if !tiffins.isEmpty { store.addMultipleTiffins(tiffins) }
        if !orders.isEmpty { store.addCateringOrders(orders) }
        doneMessage = "Saved \(tiffins.count) tiffin entries and \(orders.count) orders" + (created.isEmpty ? "." : ", added \(created.count) new customers.")
    }
}
