import SwiftUI

struct EntryRowsView: View {
    @Environment(KitchenStore.self) private var store
    @Environment(\.colorScheme) private var scheme
    let tiffins: [TiffinEntry]
    let orders: [CateringOrder]
    @State private var editingTiffin: TiffinEntry?
    @State private var editingOrder: CateringOrder?
    private let theme = AppTheme()

    var body: some View {
        Group {
            if tiffins.isEmpty && orders.isEmpty {
                Text("No entries in this period.").foregroundStyle(theme.secondaryText(scheme))
            }
            ForEach(tiffins) { entry in
                EntryCard(title: store.customerName(for: entry.customerId),
                          subtitle: "\(AppFormatters.displayDate(entry.date)) • Noon \(entry.noonQty.clean), Evening \(entry.eveningQty.clean)",
                          total: AppFormatters.currency(entry.total, code: store.settings.currency), color: theme.primary)
                    .listRowSeparator(.hidden).listRowBackground(Color.clear)
                    .contentShape(Rectangle())
                    .onTapGesture { editingTiffin = entry }
                    .swipeActions { Button(role: .destructive) { store.deleteTiffin(entry) } label: { Label("Delete", systemImage: "trash") } }
            }
            ForEach(orders) { order in
                EntryCard(title: store.customerName(for: order.customerId),
                          subtitle: "\(AppFormatters.displayDate(order.date)) • Catering • \(order.items.count) item(s)",
                          total: AppFormatters.currency(order.total, code: store.settings.currency), color: theme.secondary)
                    .listRowSeparator(.hidden).listRowBackground(Color.clear)
                    .contentShape(Rectangle())
                    .onTapGesture { editingOrder = order }
                    .swipeActions { Button(role: .destructive) { store.deleteCateringOrder(order) } label: { Label("Delete", systemImage: "trash") } }
            }
        }
        .sheet(item: $editingTiffin) { EditTiffinView(entry: $0) }
        .sheet(item: $editingOrder) { EditCateringView(order: $0) }
    }
}

struct MonthlyEntriesView: View {
    @Environment(KitchenStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var scheme
    @State private var month = Date()
    private let theme = AppTheme()

    private var start: Date { AppFormatters.startOfMonth(for: month) }
    private var end: Date { AppFormatters.endOfMonth(for: month) }
    private var tiffins: [TiffinEntry] { store.tiffins.filter { AppFormatters.isDate($0.date, between: start, and: end) }.sorted { $0.date > $1.date } }
    private var orders: [CateringOrder] { store.cateringOrders.filter { AppFormatters.isDate($0.date, between: start, and: end) }.sorted { $0.date > $1.date } }
    private var total: Double { tiffins.reduce(0) { $0 + $1.total } + orders.reduce(0) { $0 + $1.total } }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    HStack {
                        Button { shift(-1) } label: { Image(systemName: "chevron.left") }.buttonStyle(.borderless)
                        Spacer()
                        Text(month, format: .dateTime.month(.wide).year()).font(.headline)
                        Spacer()
                        Button { shift(1) } label: { Image(systemName: "chevron.right") }.buttonStyle(.borderless)
                    }
                    Text("\(tiffins.count) tiffin • \(orders.count) catering • Total \(AppFormatters.currency(total, code: store.settings.currency))")
                        .font(.subheadline).foregroundStyle(theme.secondaryText(scheme))
                }
                EntryRowsView(tiffins: tiffins, orders: orders)
            }
            .navigationTitle("Monthly Entries")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
            .scrollContentBackground(.hidden)
            .background(theme.background(scheme))
        }
    }

    private func shift(_ by: Int) { month = Calendar.current.date(byAdding: .month, value: by, to: month) ?? month }
}

struct AllEntriesView: View {
    @Environment(KitchenStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var scheme
    @State private var from = Calendar.current.date(byAdding: .month, value: -3, to: Date()) ?? Date()
    @State private var to = Date()
    @State private var query = ""
    private let theme = AppTheme()

    private func matches(_ customerId: String) -> Bool {
        query.isEmpty || store.customerName(for: customerId).localizedCaseInsensitiveContains(query)
    }
    private var tiffins: [TiffinEntry] { store.tiffins.filter { AppFormatters.isDate($0.date, between: from, and: to) && matches($0.customerId) }.sorted { $0.date > $1.date } }
    private var orders: [CateringOrder] { store.cateringOrders.filter { AppFormatters.isDate($0.date, between: from, and: to) && matches($0.customerId) }.sorted { $0.date > $1.date } }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    DatePicker("From", selection: $from, displayedComponents: .date)
                    DatePicker("To", selection: $to, displayedComponents: .date)
                    TextField("Search customer", text: $query)
                }
                EntryRowsView(tiffins: tiffins, orders: orders)
            }
            .navigationTitle("All Entries")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
            .scrollContentBackground(.hidden)
            .background(theme.background(scheme))
        }
    }
}

struct EditTiffinView: View {
    @Environment(KitchenStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let entry: TiffinEntry
    @State private var date: Date
    @State private var noon: String
    @State private var evening: String
    @State private var price: String
    @State private var delivery: String
    @State private var notes: String

    init(entry: TiffinEntry) {
        self.entry = entry
        _date = State(initialValue: entry.date)
        _noon = State(initialValue: entry.noonQty.clean)
        _evening = State(initialValue: entry.eveningQty.clean)
        _price = State(initialValue: entry.unitPrice.clean)
        _delivery = State(initialValue: entry.deliveryCharge.clean)
        _notes = State(initialValue: entry.notes)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(store.customerName(for: entry.customerId)) {
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                    TextField("Noon qty", text: $noon).keyboardType(.decimalPad)
                    TextField("Evening qty", text: $evening).keyboardType(.decimalPad)
                    TextField("Unit price", text: $price).keyboardType(.decimalPad)
                    TextField("Delivery", text: $delivery).keyboardType(.decimalPad)
                    TextField("Notes", text: $notes)
                }
            }
            .navigationTitle("Edit Tiffin")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { save() } }
            }
        }
    }

    private func save() {
        var updated = entry
        updated.date = date
        updated.noonQty = Double(noon.normalizedDecimal) ?? 0
        updated.eveningQty = Double(evening.normalizedDecimal) ?? 0
        updated.unitPrice = Double(price.normalizedDecimal) ?? 0
        updated.deliveryCharge = Double(delivery.normalizedDecimal) ?? 0
        updated.notes = notes
        store.updateTiffin(updated)
        dismiss()
    }
}

struct EditCateringView: View {
    @Environment(KitchenStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let order: CateringOrder
    @State private var date: Date
    @State private var delivery: String
    @State private var notes: String
    @State private var items: [CateringItem]

    init(order: CateringOrder) {
        self.order = order
        _date = State(initialValue: order.date)
        _delivery = State(initialValue: order.deliveryCharge.clean)
        _notes = State(initialValue: order.notes)
        _items = State(initialValue: order.items)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section(store.customerName(for: order.customerId)) {
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                    TextField("Delivery", text: $delivery).keyboardType(.decimalPad)
                    TextField("Notes", text: $notes)
                }
                Section("Items") {
                    ForEach($items) { $item in
                        VStack(alignment: .leading) {
                            TextField("Item", text: $item.itemName)
                            HStack {
                                Text("Qty"); TextField("0", value: $item.qty, format: .number).keyboardType(.decimalPad)
                                Text("Price"); TextField("0", value: $item.unitPrice, format: .number).keyboardType(.decimalPad)
                            }
                        }
                    }
                    .onDelete { items.remove(atOffsets: $0) }
                    Button("Add item") { items.append(CateringItem()) }
                }
            }
            .navigationTitle("Edit Catering")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { save() } }
            }
        }
    }

    private func save() {
        var updated = order
        updated.date = date
        updated.deliveryCharge = Double(delivery.normalizedDecimal) ?? 0
        updated.notes = notes
        updated.items = items.filter { !$0.itemName.isEmpty }
        store.updateCatering(updated)
        dismiss()
    }
}
