import SwiftUI

func waNumber(_ phone: String) -> String {
    let trimmed = phone.trimmingCharacters(in: .whitespaces)
    let digits = trimmed.filter { $0.isNumber }
    if trimmed.hasPrefix("+") { return digits }
    if digits.hasPrefix("00") { return String(digits.dropFirst(2)) }
    if digits.hasPrefix("0") { return "358" + digits.dropFirst() }
    return digits
}

func whatsAppURL(phone: String, text: String) -> URL? {
    let enc = text.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? ""
    return URL(string: "https://wa.me/\(waNumber(phone))?text=\(enc)")
}

struct ShareSheetMany: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

/// Add (or remove) a previous unpaid amount for one customer in a period. Nothing is added automatically.
struct PreviousDueSheet: View {
    @Environment(KitchenStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let customer: Customer
    let start: Date
    let end: Date
    @State private var amount = ""

    var body: some View {
        NavigationStack {
            Form {
                Section("Previous unpaid: \(customer.name)") {
                    Text("Add an unpaid amount from an earlier month. It will show on this period's invoice and report.").font(.footnote)
                    TextField("Amount", text: $amount).keyboardType(.decimalPad)
                }
                let entries = store.previousDueEntries(customerId: customer.id, start: start, end: end)
                if !entries.isEmpty {
                    Section("Already added") {
                        ForEach(entries) { p in
                            HStack {
                                Text(AppFormatters.currency(-p.amount, code: store.settings.currency))
                                Spacer()
                                Button("Remove", role: .destructive) { store.deletePayment(p); dismiss() }.buttonStyle(.borderless)
                            }
                        }
                    }
                }
            }
            .navigationTitle("Previous due")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        if let a = Double(amount.replacingOccurrences(of: ",", with: ".")), a > 0 {
                            store.addPayment(Payment(customerId: customer.id, date: start, amount: -a, note: "Previous due"))
                        }
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium])
    }
}

struct ShareItems: Identifiable {
    let id = UUID()
    let items: [Any]
}

struct OutstandingReportView: View {
    @Environment(KitchenStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var scheme
    @Environment(\.openURL) private var openURL
    @State private var month = Date()
    @State private var onlyDue = true
    @State private var pdfFile: ExportFile?
    @State private var savePDF: ExportFile?
    @State private var payFor: OutstandingRow?
    @State private var payAmount = ""
    @State private var payNote = ""
    @State private var dueFor: Customer?
    private let theme = AppTheme()

    private var label: String { month.formatted(.dateTime.month(.wide).year()) }

    var body: some View {
        let start = AppFormatters.startOfMonth(for: month)
        let end = AppFormatters.endOfMonth(for: month)
        let all = store.outstandingRows(start: start, end: end)
        let list = onlyDue ? all.filter { $0.balance > 0.004 } : all
        let cur = store.settings.currency
        NavigationStack {
            ZStack {
                theme.background(scheme).ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 14) {
                        DatePicker("Month", selection: $month, displayedComponents: .date)
                            .padding(16)
                            .appCardStyle(scheme)
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Total Outstanding Amount").font(.subheadline).foregroundStyle(theme.secondaryText(scheme))
                            Text(AppFormatters.currency(all.reduce(0) { $0 + max($1.balance, 0) }, code: cur)).font(.system(size: 32, weight: .bold)).foregroundStyle(theme.primary)
                            Text("\(all.filter { $0.balance > 0.004 }.count) customers still owe \u{2022} billed \(AppFormatters.currency(all.reduce(0) { $0 + $1.billed }, code: cur)) \u{2022} received \(AppFormatters.currency(all.reduce(0) { $0 + $1.paid }, code: cur))")
                                .font(.caption).foregroundStyle(theme.secondaryText(scheme))
                        }
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(16)
                        .appCardStyle(scheme)
                        Toggle("Show only customers who owe", isOn: $onlyDue).tint(theme.primary)
                        ForEach(list, id: \.customerId) { row in
                            VStack(alignment: .leading, spacing: 8) {
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(row.name).font(.headline)
                                        Text(detail(row, cur)).font(.caption).foregroundStyle(theme.secondaryText(scheme))
                                    }
                                    Spacer()
                                    Text(row.balance <= 0.004 ? "PAID" : AppFormatters.currency(row.balance, code: cur))
                                        .font(.headline).foregroundStyle(row.balance <= 0.004 ? theme.secondary : theme.primary)
                                }
                                HStack {
                                    Button("Record payment") {
                                        payAmount = row.balance > 0 ? String(format: "%.2f", row.balance) : ""
                                        payNote = ""
                                        payFor = row
                                    }.buttonStyle(.bordered).tint(theme.primary)
                                    Button("+ Previous due") { dueFor = store.customers.first { $0.id == row.customerId } }.buttonStyle(.bordered).tint(theme.primary)
                                    if row.balance > 0.004 {
                                        Button("WhatsApp reminder") {
                                            if let u = whatsAppURL(phone: row.phone, text: reminder(row, cur)) { openURL(u) }
                                        }.buttonStyle(.bordered).tint(theme.primary)
                                    }
                                }
                            }
                            .padding(14)
                            .appCardStyle(scheme)
                        }
                        if all.isEmpty {
                            Text("No entries for this month.").foregroundStyle(theme.secondaryText(scheme))
                        } else {
                            Button { makePDF(all, save: true) } label: {
                                Label("Download PDF (Save to Files)", systemImage: "arrow.down.doc.fill").frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.borderedProminent)
                            .tint(theme.primary)
                            Button { makePDF(all, save: false) } label: {
                                Label("Share PDF", systemImage: "square.and.arrow.up").frame(maxWidth: .infinity)
                            }
                            .buttonStyle(.bordered)
                            .tint(theme.primary)
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Outstanding Report")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
            .sheet(item: $pdfFile) { ShareSheet(url: $0.url) }
            .sheet(item: $savePDF) { FileSaver(url: $0.url) }
            .sheet(item: $dueFor) { PreviousDueSheet(customer: $0, start: start, end: end) }
            .alert("Payment from \(payFor?.name ?? "")", isPresented: Binding(get: { payFor != nil }, set: { if !$0 { payFor = nil } })) {
                TextField("Amount received", text: $payAmount).keyboardType(.decimalPad)
                TextField("Note (bank / cash)", text: $payNote)
                Button("Save") {
                    if let r = payFor, let a = Double(payAmount.replacingOccurrences(of: ",", with: ".")), a > 0 {
                        store.addPayment(Payment(customerId: r.customerId, date: min(Date(), end), amount: a, note: payNote))
                    }
                    payFor = nil
                }
                Button("Cancel", role: .cancel) { payFor = nil }
            } message: { Text("Balance now: \(AppFormatters.currency(payFor?.balance ?? 0, code: cur))") }
        }
    }

    private func detail(_ r: OutstandingRow, _ cur: String) -> String {
        var t = "Billed \(AppFormatters.currency(r.billed, code: cur))"
        if r.previous > 0.004 { t += " + previous \(AppFormatters.currency(r.previous, code: cur))" }
        if r.paid > 0 { t += " - paid \(AppFormatters.currency(r.paid, code: cur))" }
        return t
    }

    private func reminder(_ r: OutstandingRow, _ cur: String) -> String {
        let first = r.name.split(separator: " ").first.map(String.init) ?? r.name
        return "Hello \(first), this is Sai's Kitchen. Your balance for \(label) is \(AppFormatters.currency(r.balance, code: cur)). Please pay by bank transfer: IBAN BE40 9676 8333 5963, BIC TRWIBEB1XXX. Thank you! \u{1F64F}"
    }

    private func makePDF(_ list: [OutstandingRow], save: Bool) {
        if let url = try? OutstandingPDF.make(monthLabel: label, rows: list, settings: store.settings) {
            if save { savePDF = ExportFile(url: url) } else { pdfFile = ExportFile(url: url) }
        }
    }
}

struct BulkRow: Identifiable {
    let customer: Customer
    let summary: InvoiceSummary
    var id: String { customer.id }
}

struct BulkInvoicesView: View {
    @Environment(KitchenStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var scheme
    @State private var startDate = AppFormatters.startOfMonth()
    @State private var endDate = Date()
    @State private var query = ""
    @State private var unselected = Set<String>()
    @State private var share: ShareItems?
    @State private var savePDF: ExportFile?
    @State private var alertText: String?
    @State private var dueFor: Customer?
    private let theme = AppTheme()

    private var rows: [BulkRow] {
        store.customers
            .map { BulkRow(customer: $0, summary: store.invoiceSummary(customer: $0, kind: .combined, start: startDate, end: endDate)) }
            .filter { !$0.summary.tiffins.isEmpty || !$0.summary.cateringOrders.isEmpty }
            .filter { query.isEmpty || $0.customer.name.localizedStandardContains(query) || $0.customer.phone.localizedStandardContains(query) }
            .sorted { $0.customer.name.localizedCaseInsensitiveCompare($1.customer.name) == .orderedAscending }
    }

    var body: some View {
        let all = rows
        let chosen = all.filter { !unselected.contains($0.id) }
        let cur = store.settings.currency
        NavigationStack {
            Form {
                Section("Period") {
                    DatePicker("Start", selection: $startDate, displayedComponents: .date)
                    DatePicker("End", selection: $endDate, displayedComponents: .date)
                    HStack {
                        Button("Last month") {
                            let p = Calendar.current.date(byAdding: .month, value: -1, to: Date()) ?? Date()
                            startDate = AppFormatters.startOfMonth(for: p); endDate = AppFormatters.endOfMonth(for: p)
                        }
                        Spacer()
                        Button("This month") { startDate = AppFormatters.startOfMonth(); endDate = Date() }
                    }.buttonStyle(.borderless)
                }
                Section("Customers") {
                    SearchField(text: $query, placeholder: "Search customer...").listRowBackground(Color.clear)
                    HStack {
                        Button("Select all") { unselected = [] }
                        Spacer()
                        Button("Select none") { unselected = Set(all.map { $0.id }) }
                    }.buttonStyle(.borderless)
                    ForEach(all) { row in
                        let c = row.customer
                        let s = row.summary
                        Button {
                            if unselected.contains(c.id) { unselected.remove(c.id) } else { unselected.insert(c.id) }
                        } label: {
                            HStack {
                                Image(systemName: unselected.contains(c.id) ? "circle" : "checkmark.circle.fill").foregroundStyle(theme.primary)
                                VStack(alignment: .leading) {
                                    Text(c.name).foregroundStyle(theme.text(scheme))
                                    Text("\(s.tiffins.count) tiffin days, \(s.cateringOrders.count) orders").font(.caption).foregroundStyle(theme.secondaryText(scheme))
                                }
                                Spacer()
                                Text(AppFormatters.currency(due(s), code: cur)).bold().foregroundStyle(theme.primary)
                            }
                        }
                        .swipeActions { Button("+ due") { dueFor = c }.tint(theme.primary) }
                    }
                    if all.isEmpty { Text("No entries in this period.").foregroundStyle(theme.secondaryText(scheme)) }
                }
                if !chosen.isEmpty {
                    Section("\(chosen.count) invoices selected") {
                        Button { sendAll(chosen.map { $0.summary }) } label: { Label("Send all invoices (separate PDFs)", systemImage: "square.and.arrow.up.on.square") }
                        Button { combined(chosen.map { $0.summary }) } label: { Label("One combined PDF (all customers)", systemImage: "doc.on.doc") }
                        ForEach(chosen) { row in
                            Button { one(row.summary) } label: { Label("Send \(row.customer.name)'s invoice", systemImage: "paperplane") }
                        }
                    }
                }
            }
            .scrollContentBackground(.hidden)
            .background(theme.background(scheme))
            .navigationTitle("Bulk Invoices")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
            .sheet(item: $share) { ShareSheetMany(items: $0.items) }
            .sheet(item: $dueFor) { PreviousDueSheet(customer: $0, start: startDate, end: endDate) }
            .sheet(item: $savePDF) { FileSaver(url: $0.url) }
            .alert("Invoices", isPresented: Binding(get: { alertText != nil }, set: { if !$0 { alertText = nil } })) { Button("OK", role: .cancel) {} } message: { Text(alertText ?? "") }
        }
    }

    private func due(_ s: InvoiceSummary) -> Double { s.previousBalance + s.tiffinTotal + s.cateringTotal - s.paidInPeriod }

    private func sendAll(_ list: [InvoiceSummary]) {
        do { share = ShareItems(items: try InvoicePDFGenerator.makeEach(list)) } catch { alertText = "Could not create invoices." }
    }
    private func combined(_ list: [InvoiceSummary]) {
        do {
            let label = "\(AppFormatters.isoDate(startDate))_\(AppFormatters.isoDate(endDate))"
            share = ShareItems(items: [try InvoicePDFGenerator.makeCombined(list, label: label)])
        } catch { alertText = "Could not create the PDF." }
    }
    private func one(_ s: InvoiceSummary) {
        do { share = ShareItems(items: [try InvoicePDFGenerator.makePDF(summary: s)]) } catch { alertText = "Could not create the invoice." }
    }
}
