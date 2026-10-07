import SwiftUI
import UniformTypeIdentifiers

struct ContentView: View {
    @Environment(KitchenStore.self) private var store
    private let theme = AppTheme()

    private var preferredScheme: ColorScheme? {
        switch store.themeMode {
        case .light: return .light
        case .dark: return .dark
        case .auto: return nil
        }
    }

    var body: some View {
        TabView {
            DashboardView()
                .tabItem { Label("Dashboard", systemImage: "square.grid.2x2.fill") }
            CustomersView()
                .tabItem { Label("Customers", systemImage: "person.2.fill") }
            EntriesHomeView()
                .tabItem { Label("New Entry", systemImage: "plus.circle.fill") }
            ReportsView()
                .tabItem { Label("Reports", systemImage: "chart.bar.xaxis") }
            InvoicesHomeView()
                .tabItem { Label("Invoices", systemImage: "doc.text.fill") }
            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape.fill") }
        }
        .tint(theme.primary)
        .preferredColorScheme(preferredScheme)
        .task {
            while !Task.isCancelled {
                if TelegramBot.isConfigured { _ = await TelegramBot.poll(store: store) }
                try? await Task.sleep(for: .seconds(15))
            }
        }
    }
}

struct DashboardView: View {
    @Environment(KitchenStore.self) private var store
    @Environment(\.colorScheme) private var scheme
    @State private var filter: PeriodFilter = .today
    @State private var customStart: Date = Date()
    @State private var customEnd: Date = Date()
    @State private var selectedMonth: Date = Date()
    private let theme = AppTheme()

    enum PeriodFilter: String, CaseIterable, Identifiable {
        case today = "Today"
        case yesterday = "Yesterday"
        case week = "Week"
        case month = "This Month"
        case monthRange = "Month Range"
        case custom = "Custom Date"
        var id: String { rawValue }
    }

    private var range: (Date, Date) {
        let calendar = Calendar.current
        switch filter {
        case .today:
            let today = calendar.startOfDay(for: Date())
            return (today, today)
        case .yesterday:
            let yesterday = calendar.date(byAdding: .day, value: -1, to: calendar.startOfDay(for: Date())) ?? Date()
            return (yesterday, yesterday)
        case .week:
            return (AppFormatters.startOfWeek(), calendar.startOfDay(for: Date()))
        case .month:
            return (AppFormatters.startOfMonth(), calendar.startOfDay(for: Date()))
        case .monthRange:
            return (AppFormatters.startOfMonth(for: selectedMonth), AppFormatters.endOfMonth(for: selectedMonth))
        case .custom:
            return (customStart, customEnd)
        }
    }

    private var metrics: DashboardMetrics { store.metrics(start: range.0, end: range.1) }

    var body: some View {
        NavigationStack {
            ZStack(alignment: .top) {
                theme.background(scheme).ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 18) {
                        header
                        periodCard
                            .padding(.top, -18)
                        metricGrid
                        revenueCard
                        comparisonCard
                    }
                    .padding(.horizontal, 20)
                    .padding(.bottom, 30)
                }
                .ignoresSafeArea(edges: .top)
            }
        }
    }

    private var header: some View {
        LinearGradient(colors: [theme.primary, theme.secondary], startPoint: .topLeading, endPoint: .bottomTrailing)
            .frame(height: 190)
            .overlay(alignment: .bottomLeading) {
                VStack(alignment: .leading, spacing: 7) {
                    HStack {
                        ZStack {
                            Circle().fill(.white.opacity(0.22)).frame(width: 42, height: 42)
                            Image(systemName: "takeoutbag.and.cup.and.straw.fill").foregroundStyle(.white).font(.title3)
                        }
                        Spacer()
                        Text(store.themeMode.rawValue)
                            .font(.caption.weight(.semibold))
                            .foregroundStyle(.white)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .background(.white.opacity(0.18), in: .capsule)
                    }
                    Text("Sai's Kitchen")
                        .font(.system(size: 34, weight: .bold, design: .rounded))
                        .foregroundStyle(.white)
                    Text("Tiffin Tracker & Invoicing")
                        .font(.subheadline.weight(.medium))
                        .foregroundStyle(.white.opacity(0.9))
                }
                .padding(.horizontal, 24)
                .padding(.bottom, 30)
            }
            .clipShape(.rect(cornerRadii: RectangleCornerRadii(bottomLeading: 28, bottomTrailing: 28)))
            .padding(.horizontal, -20)
    }

    private var periodCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                Image(systemName: "calendar").foregroundStyle(theme.primary)
                Text("Period").font(.headline)
                Spacer()
            }
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 9) {
                ForEach(PeriodFilter.allCases) { item in
                    Button {
                        filter = item
                    } label: {
                        Text(item.rawValue)
                            .font(.caption.weight(.semibold))
                            .lineLimit(1)
                            .minimumScaleFactor(0.75)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 10)
                            .background(filter == item ? theme.primary : theme.background(scheme), in: .rect(cornerRadius: 12))
                            .foregroundStyle(filter == item ? .white : theme.secondaryText(scheme))
                    }
                }
            }
            if filter == .custom {
                DatePicker("Start", selection: $customStart, displayedComponents: .date)
                DatePicker("End", selection: $customEnd, displayedComponents: .date)
            }
            if filter == .monthRange {
                DatePicker("Month", selection: $selectedMonth, displayedComponents: [.date])
            }
            Text("\(AppFormatters.displayDate(range.0)) - \(AppFormatters.displayDate(range.1))")
                .font(.footnote)
                .foregroundStyle(theme.secondaryText(scheme))
                .frame(maxWidth: .infinity, alignment: .center)
        }
        .padding(18)
        .appCardStyle(scheme)
    }

    private var metricGrid: some View {
        LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 14) {
            MetricCard(title: "Total Revenue", value: AppFormatters.currency(metrics.totalRevenue, code: store.settings.currency), icon: "eurosign.circle.fill", color: theme.success)
            MetricCard(title: "Tiffins Delivered", value: metrics.totalTiffins.clean, icon: "takeoutbag.and.cup.and.straw.fill", color: theme.primary)
            MetricCard(title: "Catering Orders", value: "\(metrics.cateringOrders)", icon: "fork.knife.circle.fill", color: theme.secondary)
            MetricCard(title: "Delivery Charges", value: AppFormatters.currency(metrics.deliveryTotal, code: store.settings.currency), icon: "scooter", color: theme.warning)
        }
    }

    private var revenueCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            Label("Revenue Breakdown", systemImage: "chart.pie.fill")
                .font(.headline)
                .foregroundStyle(theme.text(scheme))
            RevenueBar(tiffin: max(0, metrics.totalRevenue - metrics.cateringRevenue), catering: metrics.cateringRevenue)
            SummaryRow(label: "Tiffin Sales", value: AppFormatters.currency(metrics.totalRevenue - metrics.cateringRevenue, code: store.settings.currency))
            SummaryRow(label: "Catering Sales", value: AppFormatters.currency(metrics.cateringRevenue, code: store.settings.currency))
            Divider()
            SummaryRow(label: "Total", value: AppFormatters.currency(metrics.totalRevenue, code: store.settings.currency), isTotal: true)
        }
        .padding(18)
        .appCardStyle(scheme)
    }

    private var comparisonCard: some View {
        let previousStart = Calendar.current.date(byAdding: .month, value: -1, to: AppFormatters.startOfMonth()) ?? Date()
        let previousEnd = AppFormatters.endOfMonth(for: previousStart)
        let previous = store.metrics(start: previousStart, end: previousEnd).totalRevenue
        let diff = metrics.totalRevenue - previous
        return VStack(alignment: .leading, spacing: 13) {
            Text("Comparison with Last Month").font(.headline)
            SummaryRow(label: "Last Month Total", value: AppFormatters.currency(previous, code: store.settings.currency))
            SummaryRow(label: "Current Period", value: AppFormatters.currency(metrics.totalRevenue, code: store.settings.currency))
            Divider()
            HStack {
                Text("Difference").font(.headline)
                Spacer()
                Text("\(diff >= 0 ? "+" : "")\(AppFormatters.currency(diff, code: store.settings.currency))")
                    .font(.headline)
                    .foregroundStyle(diff >= 0 ? theme.success : theme.error)
            }
        }
        .padding(18)
        .appCardStyle(scheme)
    }
}

struct MetricCard: View {
    @Environment(\.colorScheme) private var scheme
    let title: String
    let value: String
    let icon: String
    let color: Color
    private let theme = AppTheme()

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundStyle(color)
                .frame(width: 48, height: 48)
                .background(color.opacity(0.14), in: .rect(cornerRadius: 12))
            Text(title).font(.caption).foregroundStyle(theme.secondaryText(scheme))
            Text(value).font(.title3.bold()).foregroundStyle(theme.text(scheme)).lineLimit(1).minimumScaleFactor(0.7)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(16)
        .appCardStyle(scheme)
    }
}

struct RevenueBar: View {
    let tiffin: Double
    let catering: Double
    private let theme = AppTheme()
    var total: Double { max(tiffin + catering, 0.01) }

    var body: some View {
        VStack(spacing: 10) {
            GeometryReader { proxy in
                HStack(spacing: 0) {
                    Rectangle().fill(theme.primary).frame(width: proxy.size.width * (tiffin / total))
                    Rectangle().fill(theme.secondary).frame(width: proxy.size.width * (catering / total))
                }
                .clipShape(.capsule)
            }
            .frame(height: 16)
            HStack {
                Label("Tiffin", systemImage: "circle.fill").foregroundStyle(theme.primary)
                Spacer()
                Label("Catering", systemImage: "circle.fill").foregroundStyle(theme.secondary)
            }
            .font(.caption.weight(.medium))
        }
    }
}

struct SummaryRow: View {
    @Environment(\.colorScheme) private var scheme
    let label: String
    let value: String
    var isTotal: Bool = false
    private let theme = AppTheme()

    var body: some View {
        HStack {
            Text(label).foregroundStyle(isTotal ? theme.text(scheme) : theme.secondaryText(scheme)).font(isTotal ? .headline : .body)
            Spacer()
            Text(value).font(isTotal ? .headline : .body.weight(.semibold)).foregroundStyle(isTotal ? theme.primary : theme.text(scheme))
        }
    }
}

struct CustomersView: View {
    @Environment(KitchenStore.self) private var store
    @Environment(\.colorScheme) private var scheme
    @State private var search = ""
    @State private var showingAdd = false
    @State private var editingCustomer: Customer?
    private let theme = AppTheme()

    private var filteredCustomers: [Customer] {
        guard !search.isEmpty else { return store.customers }
        return store.customers.filter { $0.name.localizedStandardContains(search) || $0.phone.localizedStandardContains(search) }
    }

    var body: some View {
        NavigationStack {
            ZStack {
                theme.background(scheme).ignoresSafeArea()
                VStack(spacing: 14) {
                    SearchField(text: $search, placeholder: "Search by name or phone...")
                    if filteredCustomers.isEmpty {
                        EmptyState(icon: "person.crop.circle.badge.plus", title: "No customers yet", subtitle: "Add your first customer to get started")
                    } else {
                        List {
                            ForEach(filteredCustomers) { customer in
                                CustomerCard(customer: customer)
                                    .listRowSeparator(.hidden)
                                    .listRowBackground(Color.clear)
                                    .swipeActions(edge: .trailing) {
                                        Button(role: .destructive) { store.deleteCustomer(customer) } label: { Label("Delete", systemImage: "trash") }
                                        Button { editingCustomer = customer } label: { Label("Edit", systemImage: "pencil") }.tint(theme.primary)
                                    }
                            }
                        }
                        .listStyle(.plain)
                        .scrollContentBackground(.hidden)
                    }
                }
                .padding(.horizontal, 16)
            }
            .navigationTitle("Customers")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button { showingAdd = true } label: { Image(systemName: "plus") }
                        .buttonStyle(.borderedProminent)
                        .tint(theme.primary)
                }
            }
            .sheet(isPresented: $showingAdd) { CustomerFormView(customer: nil) }
            .sheet(item: $editingCustomer) { customer in CustomerFormView(customer: customer) }
        }
    }
}

struct CustomerCard: View {
    @Environment(\.colorScheme) private var scheme
    let customer: Customer
    private let theme = AppTheme()

    var body: some View {
        HStack(spacing: 14) {
            Image(systemName: "person.fill")
                .font(.title3)
                .foregroundStyle(theme.primary)
                .frame(width: 54, height: 54)
                .background(theme.primary.opacity(0.12), in: .rect(cornerRadius: 13))
            VStack(alignment: .leading, spacing: 5) {
                Text(customer.name).font(.headline).foregroundStyle(theme.text(scheme))
                Label(customer.phone, systemImage: "phone.fill").font(.caption).foregroundStyle(theme.secondaryText(scheme))
                if !customer.address.isEmpty {
                    Label(customer.address, systemImage: "mappin.and.ellipse").font(.caption).foregroundStyle(theme.secondaryText(scheme)).lineLimit(1)
                }
                Text(customer.type.rawValue)
                    .font(.caption2.weight(.bold))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background((customer.type == .regular ? theme.success : theme.warning).opacity(0.16), in: .rect(cornerRadius: 8))
            }
            Spacer()
        }
        .padding(14)
        .appCardStyle(scheme)
    }
}

struct CustomerFormView: View {
    @Environment(KitchenStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var scheme
    let customer: Customer?
    @State private var name: String
    @State private var phone: String
    @State private var address: String
    @State private var type: CustomerType
    @State private var showError = false
    private let theme = AppTheme()

    init(customer: Customer?) {
        self.customer = customer
        _name = State(initialValue: customer?.name ?? "")
        _phone = State(initialValue: customer?.phone ?? "")
        _address = State(initialValue: customer?.address ?? "")
        _type = State(initialValue: customer?.type ?? .regular)
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Customer Details") {
                    TextField("Name", text: $name)
                    TextField("Phone", text: $phone).keyboardType(.phonePad)
                    TextField("Address", text: $address, axis: .vertical)
                    Picker("Type", selection: $type) {
                        ForEach(CustomerType.allCases) { item in Text(item.rawValue).tag(item) }
                    }
                    .pickerStyle(.segmented)
                }
            }
            .navigationTitle(customer == nil ? "Add Customer" : "Edit Customer")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button("Save") { save() }.foregroundStyle(theme.primary) }
            }
            .alert("Missing Details", isPresented: $showError) { Button("OK", role: .cancel) {} } message: { Text("Please enter customer name and phone number.") }
            .scrollContentBackground(.hidden)
            .background(theme.background(scheme))
        }
    }

    private func save() {
        guard !name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty, !phone.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            showError = true
            return
        }
        if let customer {
            store.updateCustomer(Customer(id: customer.id, name: name, phone: phone, address: address, type: type, createdAt: customer.createdAt, updatedAt: Date(), isActive: customer.isActive))
        } else {
            store.addCustomer(Customer(name: name, phone: phone, address: address, type: type))
        }
        dismiss()
    }
}

struct EntriesHomeView: View {
    @Environment(\.colorScheme) private var scheme
    @State private var showingTiffin = false
    @State private var showingCatering = false
    @State private var showingAll = false
    @State private var showingWhatsApp = false
    private let theme = AppTheme()

    var body: some View {
        NavigationStack {
            ZStack {
                theme.background(scheme).ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 16) {
                        ActionCard(icon: "message.fill", title: "WhatsApp Message", subtitle: "Paste your daily WhatsApp list and add all entries at once", color: theme.success) { showingWhatsApp = true }
                        ActionCard(icon: "takeoutbag.and.cup.and.straw.fill", title: "Tiffin Entry", subtitle: "Record daily tiffin delivery with noon and evening quantities", color: theme.primary) { showingTiffin = true }
                        ActionCard(icon: "fork.knife.circle.fill", title: "Catering Order", subtitle: "Create party or catering orders with multiple items", color: theme.secondary) { showingCatering = true }
                        ActionCard(icon: "list.bullet.rectangle.fill", title: "View All Entries", subtitle: "Browse all tiffin and catering records", color: theme.info) { showingAll = true }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("New Entry")
            .sheet(isPresented: $showingTiffin) { AddTiffinView() }
            .sheet(isPresented: $showingCatering) { AddCateringView() }
            .sheet(isPresented: $showingAll) { AllEntriesView() }
            .sheet(isPresented: $showingWhatsApp) { WhatsAppEntryView() }
        }
    }
}

struct ActionCard: View {
    @Environment(\.colorScheme) private var scheme
    let icon: String
    let title: String
    let subtitle: String
    let color: Color
    let action: () -> Void
    private let theme = AppTheme()

    var body: some View {
        Button(action: action) {
            HStack(spacing: 16) {
                Image(systemName: icon).font(.title).foregroundStyle(color).frame(width: 64, height: 64).background(color.opacity(0.14), in: .rect(cornerRadius: 16))
                VStack(alignment: .leading, spacing: 5) {
                    Text(title).font(.headline).foregroundStyle(theme.text(scheme))
                    Text(subtitle).font(.subheadline).foregroundStyle(theme.secondaryText(scheme)).multilineTextAlignment(.leading)
                }
                Spacer()
                Image(systemName: "plus").foregroundStyle(theme.secondaryText(scheme))
            }
            .padding(18)
            .appCardStyle(scheme)
        }
        .buttonStyle(.plain)
    }
}

struct AddTiffinView: View {
    @Environment(KitchenStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var scheme
    @State private var selectedIds: Set<String> = []
    @State private var query = ""
    @State private var date = Date()
    @State private var noonQty = "0"
    @State private var eveningQty = "1"
    @State private var unitPrice = "8"
    @State private var delivery = "0.50"
    @State private var notes = ""
    @State private var showError = false
    private let theme = AppTheme()

    private var perCustomerTotal: Double { ((Double(noonQty.normalizedDecimal) ?? 0) + (Double(eveningQty.normalizedDecimal) ?? 0)) * (Double(unitPrice.normalizedDecimal) ?? 0) + (Double(delivery.normalizedDecimal) ?? 0) }

    var body: some View {
        NavigationStack {
            Form {
                Section("Customers (\(selectedIds.count) selected)") {
                    CustomerMultiPicker(customers: store.customers, selected: selectedIds, onToggle: toggle)
                }
                Section("Entry Details") {
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                    TextField("Noon Qty", text: $noonQty).keyboardType(.decimalPad)
                    TextField("Evening Qty", text: $eveningQty).keyboardType(.decimalPad)
                    TextField("Unit Price (€)", text: $unitPrice).keyboardType(.decimalPad)
                    TextField("Delivery (€)", text: $delivery).keyboardType(.decimalPad)
                    TextField("Notes", text: $notes, axis: .vertical)
                }
                Section {
                    SummaryRow(label: selectedIds.count > 1 ? "Per Customer" : "Total", value: AppFormatters.currency(perCustomerTotal, code: store.settings.currency), isTotal: true)
                    if selectedIds.count > 1 {
                        SummaryRow(label: "Total (\(selectedIds.count) customers)", value: AppFormatters.currency(perCustomerTotal * Double(selectedIds.count), code: store.settings.currency), isTotal: true)
                    }
                }
            }
            .navigationTitle("Add Tiffin Entry")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button(selectedIds.count > 1 ? "Add Entries" : "Add") { save() }.foregroundStyle(theme.primary) }
            }
            .alert("Cannot Add Entry", isPresented: $showError) { Button("OK", role: .cancel) {} } message: { Text("Select at least one customer and enter at least one quantity.") }
            .scrollContentBackground(.hidden)
            .background(theme.background(scheme))
        }
    }

    private func toggle(_ id: String) {
        if selectedIds.contains(id) { selectedIds.remove(id) } else { selectedIds.insert(id) }
    }

    private func save() {
        let noon = Double(noonQty.normalizedDecimal) ?? 0
        let evening = Double(eveningQty.normalizedDecimal) ?? 0
        guard !selectedIds.isEmpty, noon + evening > 0 else { showError = true; return }
        let entries = selectedIds.map { id in
            TiffinEntry(date: date, customerId: id, noonQty: noon, eveningQty: evening, unitPrice: Double(unitPrice.normalizedDecimal) ?? 0, deliveryCharge: Double(delivery.normalizedDecimal) ?? 0, notes: notes)
        }
        store.addMultipleTiffins(entries)
        dismiss()
    }
}

struct AddCateringView: View {
    @Environment(KitchenStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var scheme
    @State private var selectedIds: Set<String> = []
    @State private var query = ""
    @State private var date = Date()
    @State private var delivery = "2"
    @State private var notes = ""
    @State private var items: [CateringDraftItem] = [CateringDraftItem()]
    @State private var showError = false
    private let theme = AppTheme()

    private var itemsTotal: Double { items.reduce(0) { $0 + ((Double($1.qty.normalizedDecimal) ?? 0) * (Double($1.unitPrice.normalizedDecimal) ?? 0)) } }
    private var perCustomerTotal: Double { itemsTotal + (Double(delivery.normalizedDecimal) ?? 0) }

    var body: some View {
        NavigationStack {
            Form {
                Section("Customers (\(selectedIds.count) selected)") {
                    CustomerMultiPicker(customers: store.customers, selected: selectedIds, onToggle: toggle)
                }
                Section("Order Details") {
                    DatePicker("Date", selection: $date, displayedComponents: .date)
                    TextField("Delivery Charge (€)", text: $delivery).keyboardType(.decimalPad)
                    TextField("Notes", text: $notes, axis: .vertical)
                }
                Section("Items") {
                    ForEach($items) { $item in
                        VStack(alignment: .leading, spacing: 8) {
                            TextField("Item name", text: $item.name)
                            HStack {
                                TextField("Qty", text: $item.qty).keyboardType(.decimalPad)
                                TextField("Unit Price", text: $item.unitPrice).keyboardType(.decimalPad)
                            }
                        }
                    }
                    .onDelete { items.remove(atOffsets: $0) }
                    Button { items.append(CateringDraftItem()) } label: { Label("Add Item", systemImage: "plus") }
                }
                Section {
                    SummaryRow(label: "Items Total", value: AppFormatters.currency(itemsTotal, code: store.settings.currency))
                    SummaryRow(label: selectedIds.count > 1 ? "Per Customer" : "Grand Total", value: AppFormatters.currency(perCustomerTotal, code: store.settings.currency), isTotal: true)
                    if selectedIds.count > 1 {
                        SummaryRow(label: "Total (\(selectedIds.count) customers)", value: AppFormatters.currency(perCustomerTotal * Double(selectedIds.count), code: store.settings.currency), isTotal: true)
                    }
                }
            }
            .navigationTitle("Add Catering Order")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) { Button(selectedIds.count > 1 ? "Add Orders" : "Add") { save() }.foregroundStyle(theme.primary) }
            }
            .alert("Cannot Add Order", isPresented: $showError) { Button("OK", role: .cancel) {} } message: { Text("Select at least one customer and add at least one valid item.") }
            .scrollContentBackground(.hidden)
            .background(theme.background(scheme))
        }
    }

    private func toggle(_ id: String) {
        if selectedIds.contains(id) { selectedIds.remove(id) } else { selectedIds.insert(id) }
    }

    private func save() {
        let validItems = items.filter { !$0.name.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty && (Double($0.qty.normalizedDecimal) ?? 0) > 0 }
        guard !selectedIds.isEmpty, !validItems.isEmpty else { showError = true; return }
        let orders = selectedIds.map { id in
            CateringOrder(date: date, customerId: id, deliveryCharge: Double(delivery.normalizedDecimal) ?? 0, notes: notes, items: validItems.map { CateringItem(itemName: $0.name, qty: Double($0.qty.normalizedDecimal) ?? 0, unitPrice: Double($0.unitPrice.normalizedDecimal) ?? 0) })
        }
        store.addCateringOrders(orders)
        dismiss()
    }
}

struct CateringDraftItem: Identifiable {
    let id = UUID()
    var name = ""
    var qty = "0"
    var unitPrice = "0"
}

struct ReportsView: View {
    @Environment(KitchenStore.self) private var store
    @Environment(\.colorScheme) private var scheme
    @State private var selectedCustomer: Customer?
    @State private var customerQuery = ""
    @State private var search = ""
    @State private var startDate = AppFormatters.startOfMonth()
    @State private var endDate = Date()
    private let theme = AppTheme()

    private var customers: [Customer] {
        search.isEmpty ? store.customers : store.customers.filter { $0.name.localizedStandardContains(search) || $0.phone.localizedStandardContains(search) }
    }

    private var customerTiffins: [TiffinEntry] { selectedCustomer.map { store.tiffins(customerId: $0.id, start: startDate, end: endDate) } ?? [] }
    private var customerOrders: [CateringOrder] { selectedCustomer.map { store.catering(customerId: $0.id, start: startDate, end: endDate) } ?? [] }

    var body: some View {
        NavigationStack {
            ZStack {
                theme.background(scheme).ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 16) {
                        selectorCard
                        dateCard
                        if let selectedCustomer {
                            reportSummary(customer: selectedCustomer)
                            entriesList
                        } else {
                            EmptyState(icon: "person.text.rectangle", title: "Select a customer", subtitle: "Choose a customer to view their entries")
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Customer Reports")
        }
    }

    private var selectorCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Search Customer").font(.headline)
            SearchField(text: $search, placeholder: "Search by name or phone...")
            if let selectedCustomer {
                HStack {
                    Text("Selected: \(selectedCustomer.name)").font(.subheadline.weight(.semibold)).foregroundStyle(theme.primary)
                    Spacer()
                    Button("Clear") { self.selectedCustomer = nil }.font(.caption.weight(.semibold))
                }
                .padding(12)
                .background(theme.primary.opacity(0.12), in: .rect(cornerRadius: 12))
            }
            ForEach(customers.prefix(4)) { customer in
                Button { selectedCustomer = customer; search = "" } label: {
                    HStack {
                        VStack(alignment: .leading) {
                            Text(customer.name).foregroundStyle(theme.text(scheme))
                            Text(customer.phone).font(.caption).foregroundStyle(theme.secondaryText(scheme))
                        }
                        Spacer()
                    }
                }
            }
        }
        .padding(16)
        .appCardStyle(scheme)
    }

    private var dateCard: some View {
        VStack(alignment: .leading) {
            Text("Date Range").font(.headline)
            DatePicker("Start", selection: $startDate, displayedComponents: .date)
            DatePicker("End", selection: $endDate, displayedComponents: .date)
        }
        .padding(16)
        .appCardStyle(scheme)
    }

    private func reportSummary(customer: Customer) -> some View {
        let tiffinTotal = customerTiffins.reduce(0) { $0 + $1.total }
        let cateringTotal = customerOrders.reduce(0) { $0 + $1.total }
        return VStack(spacing: 14) {
            HStack(spacing: 12) {
                MetricCard(title: "Tiffin Total", value: AppFormatters.currency(tiffinTotal, code: store.settings.currency), icon: "takeoutbag.and.cup.and.straw.fill", color: theme.primary)
                MetricCard(title: "Catering Total", value: AppFormatters.currency(cateringTotal, code: store.settings.currency), icon: "fork.knife.circle.fill", color: theme.secondary)
            }
            SummaryRow(label: "Grand Total", value: AppFormatters.currency(tiffinTotal + cateringTotal, code: store.settings.currency), isTotal: true)
                .padding(14)
                .background(theme.primary.opacity(0.10), in: .rect(cornerRadius: 12))
        }
    }

    private var entriesList: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Tiffin Entries (\(customerTiffins.count))").font(.title3.bold())
            ForEach(customerTiffins) { entry in
                EntryCard(title: AppFormatters.displayDate(entry.date), subtitle: "Noon \(entry.noonQty.clean) • Evening \(entry.eveningQty.clean) • Delivery \(AppFormatters.currency(entry.deliveryCharge, code: store.settings.currency))", total: AppFormatters.currency(entry.total, code: store.settings.currency), color: theme.primary)
            }
            Text("Catering Orders (\(customerOrders.count))").font(.title3.bold()).padding(.top, 8)
            ForEach(customerOrders) { order in
                EntryCard(title: AppFormatters.displayDate(order.date), subtitle: order.items.map(\.itemName).joined(separator: ", "), total: AppFormatters.currency(order.total, code: store.settings.currency), color: theme.secondary)
            }
        }
    }
}

struct InvoicesHomeView: View {
    @Environment(\.colorScheme) private var scheme
    @State private var showingGenerator = false
    @State private var showingOutstanding = false
    @State private var showingBulk = false
    private let theme = AppTheme()

    var body: some View {
        NavigationStack {
            ZStack {
                theme.background(scheme).ignoresSafeArea()
                VStack(spacing: 16) {
                    ActionCard(icon: "square.and.arrow.up.on.square.fill", title: "Bulk Invoices", subtitle: "Make everyone's invoice at once, then send them", color: theme.primary) { showingBulk = true }
                    ActionCard(icon: "doc.text.fill", title: "Generate Invoice", subtitle: "Create a PDF invoice for any customer", color: theme.primary) { showingGenerator = true }
                    ActionCard(icon: "chart.bar.doc.horizontal.fill", title: "Outstanding Report", subtitle: "View monthly outstanding amounts by customer", color: theme.secondary) { showingOutstanding = true }
                    Spacer()
                }
                .padding(20)
            }
            .navigationTitle("Invoices")
            .toolbar { ToolbarItem(placement: .topBarTrailing) { Button { showingGenerator = true } label: { Image(systemName: "plus") }.buttonStyle(.borderedProminent).tint(theme.primary) } }
            .sheet(isPresented: $showingGenerator) { GenerateInvoiceView() }
            .sheet(isPresented: $showingOutstanding) { OutstandingReportView() }
            .sheet(isPresented: $showingBulk) { BulkInvoicesView() }
        }
    }
}

struct GenerateInvoiceView: View {
    @Environment(KitchenStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var scheme
    @State private var selectedCustomer: Customer?
    @State private var customerQuery = ""
    @State private var kind: InvoiceKind = .combined
    @State private var startDate = AppFormatters.startOfMonth()
    @State private var endDate = Date()
    @State private var generatedURL: URL?
    @State private var savePDF: ExportFile?
    @State private var alertText: String?
    @State private var dueCustomer: Customer?
    private let theme = AppTheme()

    private var tiffins: [TiffinEntry] { selectedCustomer.map { store.tiffins(customerId: $0.id, start: startDate, end: endDate) } ?? [] }
    private var orders: [CateringOrder] { selectedCustomer.map { store.catering(customerId: $0.id, start: startDate, end: endDate) } ?? [] }

    var body: some View {
        NavigationStack {
            Form {
                Section("Customer") {
                    if let selectedCustomer {
                        Text("Selected: \(selectedCustomer.name)").font(.headline).foregroundStyle(theme.primary)
                    }
                    SearchField(text: $customerQuery, placeholder: "Search customer by name or phone...")
                        .listRowBackground(Color.clear)
                    ForEach(Array(store.customers.filter { customerQuery.isEmpty || $0.name.localizedStandardContains(customerQuery) || $0.phone.localizedStandardContains(customerQuery) }.prefix(customerQuery.isEmpty ? 6 : 10))) { customer in
                        Button { selectedCustomer = customer; customerQuery = "" } label: {
                            HStack {
                                Text(customer.name).foregroundStyle(theme.text(scheme))
                                Spacer()
                                if selectedCustomer?.id == customer.id { Image(systemName: "checkmark.circle.fill").foregroundStyle(theme.primary) }
                            }
                        }
                    }
                }
                Section("Invoice Type") {
                    Picker("Type", selection: $kind) {
                        ForEach(InvoiceKind.allCases) { item in Text(item.rawValue).tag(item) }
                    }
                }
                Section("Period") {
                    DatePicker("Start", selection: $startDate, displayedComponents: .date)
                    DatePicker("End", selection: $endDate, displayedComponents: .date)
                }
                if let selectedCustomer, let g = store.duplicateCustomerGroups().first(where: { $0.contains { $0.id == selectedCustomer.id } }) {
                    Section("\u{26A0} Same customer saved twice") {
                        let twins = g.filter { $0.id != selectedCustomer.id }
                        let extra = twins.reduce(0) { $0 + store.tiffins(customerId: $1.id, start: startDate, end: endDate).count + store.catering(customerId: $1.id, start: startDate, end: endDate).count }
                        Text(twins.map(\.name).joined(separator: ", ") + " has the same phone/name" + (extra > 0 ? " and \(extra) entries in this period that are NOT on this bill." : "."))
                        Button("Merge them into \(selectedCustomer.name)") { store.mergeCustomers(keep: selectedCustomer, others: g); generatedURL = nil }
                    }
                }
                if let selectedCustomer {
                    Section("Invoice Preview") {
                        Text(selectedCustomer.name).font(.headline)
                        SummaryRow(label: "Tiffin Entries", value: "\(tiffins.count)")
                        SummaryRow(label: "Tiffin Total", value: AppFormatters.currency(tiffins.reduce(0) { $0 + $1.total }, code: store.settings.currency))
                        SummaryRow(label: "Catering Orders", value: "\(orders.count)")
                        SummaryRow(label: "Catering Total", value: AppFormatters.currency(orders.reduce(0) { $0 + $1.total }, code: store.settings.currency))
                        SummaryRow(label: "Grand Total", value: AppFormatters.currency(grandTotal, code: store.settings.currency), isTotal: true)
                    }
                    Section {
                        Button { dueCustomer = selectedCustomer } label: {
                            let pd = store.previousDue(customerId: selectedCustomer.id, start: startDate, end: endDate)
                            Label(pd > 0 ? "Previous unpaid: \(AppFormatters.currency(pd, code: store.settings.currency)) (edit)" : "Add previous unpaid amount", systemImage: "plus.circle")
                        }
                        Button { generate(customer: selectedCustomer) } label: { Label("Generate PDF Invoice", systemImage: "square.and.arrow.down") }
                        if let generatedURL {
                            Button { savePDF = ExportFile(url: generatedURL) } label: { Label("Download PDF (Save to Files)", systemImage: "arrow.down.doc.fill") }
                            ShareLink(item: generatedURL) { Label("Share Invoice", systemImage: "square.and.arrow.up") }
                        }
                    }
                }
            }
            .sheet(item: $savePDF) { FileSaver(url: $0.url) }
            .sheet(item: $dueCustomer, onDismiss: { generatedURL = nil }) { PreviousDueSheet(customer: $0, start: startDate, end: endDate) }
            .navigationTitle("Generate Invoice")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
            .alert("Invoice", isPresented: Binding(get: { alertText != nil }, set: { if !$0 { alertText = nil } })) { Button("OK", role: .cancel) {} } message: { Text(alertText ?? "") }
            .scrollContentBackground(.hidden)
            .background(theme.background(scheme))
        }
    }

    private var grandTotal: Double {
        let tiffinTotal = tiffins.reduce(0) { $0 + $1.total }
        let cateringTotal = orders.reduce(0) { $0 + $1.total }
        switch kind { case .combined: return tiffinTotal + cateringTotal; case .tiffin: return tiffinTotal; case .catering: return cateringTotal }
    }

    private func generate(customer: Customer) {
        let includeTiffins = kind == .combined || kind == .tiffin
        let includeCatering = kind == .combined || kind == .catering
        guard (includeTiffins && !tiffins.isEmpty) || (includeCatering && !orders.isEmpty) else {
            alertText = "No entries found for this customer and period."
            return
        }
        do {
            generatedURL = try InvoicePDFGenerator.makePDF(summary: store.invoiceSummary(customer: customer, kind: kind, start: startDate, end: endDate))
            alertText = "Invoice PDF created. Tap Download PDF to save it in Files, or Share Invoice to send it."
        } catch {
            alertText = "Failed to generate invoice. Please try again."
        }
    }
}

struct EntryCard: View {
    @Environment(\.colorScheme) private var scheme
    let title: String
    let subtitle: String
    let total: String
    let color: Color
    private let theme = AppTheme()

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(title).font(.headline).foregroundStyle(color)
                Spacer()
                Text(total).font(.headline).foregroundStyle(color)
            }
            Text(subtitle).font(.subheadline).foregroundStyle(theme.secondaryText(scheme))
        }
        .padding(14)
        .appCardStyle(scheme)
    }
}

struct SettingsView: View {
    @Environment(KitchenStore.self) private var store
    @Environment(\.colorScheme) private var scheme
    @State private var showingClear = false
    @State private var showMonthly = false
    @State private var showAll = false
    @State private var showOutstanding = false
    @State private var showDataCheck = false
    @State private var showImporter = false
    @State private var exportFile: ExportFile?
    @State private var message: String?
    private let theme = AppTheme()

    var body: some View {
        NavigationStack {
            ZStack {
                theme.background(scheme).ignoresSafeArea()
                ScrollView {
                    VStack(spacing: 16) {
                        SettingsSection(title: "Theme", icon: "paintpalette.fill") {
                            Picker("Theme", selection: Binding(
                                get: { store.themeMode },
                                set: { store.updateTheme($0) }
                            )) {
                                ForEach(ThemeMode.allCases) { mode in Text(mode.rawValue).tag(mode) }
                            }
                            .pickerStyle(.segmented)
                        }
                        SettingsSection(title: "Quick Actions", icon: "bolt.fill") {
                            Button { showMonthly = true } label: { Label("Monthly Entries", systemImage: "calendar") }
                            Button { showAll = true } label: { Label("View All Entries", systemImage: "list.bullet.rectangle") }
                            Button { showOutstanding = true } label: { Label("Outstanding Report", systemImage: "exclamationmark.circle") }
                            Button { showDataCheck = true } label: {
                                let n = store.duplicateCustomerGroups().count + store.sameDayGroups().count
                                Label("Data Check" + (n > 0 ? "  \u{26A0} \(n) to review" : "  \u{2713}"), systemImage: "checkmark.shield")
                            }
                        }
                        SettingsSection(title: "Business Defaults", icon: "doc.text.fill") {
                            SettingsTextRow(label: "Company", value: store.settings.companyName)
                            SettingsTextRow(label: "Phone", value: store.settings.companyPhone)
                            SettingsTextRow(label: "Currency", value: store.settings.currency)
                            SettingsTextRow(label: "Default Tiffin", value: AppFormatters.currency(store.settings.defaultTiffinPrice, code: store.settings.currency))
                        }
                        TelegramSettingsCard()
                        SettingsSection(title: "Data Management", icon: "externaldrive.fill") {
                            Button { showImporter = true } label: { Label("Import Data", systemImage: "square.and.arrow.down") }
                            Menu {
                                Button("Everything") { export("all") }
                                Button("Customers only") { export("customers") }
                                Button("Tiffin entries only") { export("tiffins") }
                                Button("Catering orders only") { export("catering") }
                            } label: { Label("Export Data", systemImage: "square.and.arrow.up") }
                            Button { self.store.seedSampleData() } label: { Label("Generate Test Data", systemImage: "plus.square.on.square") }
                            Button(role: .destructive) { showingClear = true } label: { Label("Clear All Data", systemImage: "trash") }
                        }
                        SettingsSection(title: "App Info", icon: "info.circle.fill") {
                            SettingsTextRow(label: "Version", value: "1.0.0")
                            SettingsTextRow(label: "Customers", value: "\(store.customers.count)")
                            SettingsTextRow(label: "Tiffin Entries", value: "\(store.tiffins.count)")
                            SettingsTextRow(label: "Catering Orders", value: "\(store.cateringOrders.count)")
                        }
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Settings")
            .sheet(isPresented: $showMonthly) { MonthlyEntriesView() }
            .sheet(isPresented: $showAll) { AllEntriesView() }
            .sheet(isPresented: $showOutstanding) { OutstandingReportView() }
            .sheet(isPresented: $showDataCheck) { DataCheckView() }
            .sheet(item: $exportFile) { ShareSheet(url: $0.url) }
            .fileImporter(isPresented: $showImporter, allowedContentTypes: [.json, .plainText, .data]) { result in
                switch result {
                case .success(let url):
                    let scoped = url.startAccessingSecurityScopedResource()
                    defer { if scoped { url.stopAccessingSecurityScopedResource() } }
                    do {
                        let data = try Data(contentsOf: url)
                        message = try store.importData(data).message
                    } catch {
                        message = error.localizedDescription
                    }
                case .failure(let error):
                    message = error.localizedDescription
                }
            }
            .alert("Import", isPresented: Binding(get: { message != nil }, set: { if !$0 { message = nil } })) {
                Button("OK", role: .cancel) {}
            } message: { Text(message ?? "") }
            .alert("Clear All Data?", isPresented: $showingClear) {
                Button("Cancel", role: .cancel) {}
                Button("Clear", role: .destructive) { store.clearAllData() }
            } message: { Text("This removes customers, tiffin entries, and catering orders from this iOS app.") }
        }
    }

    private func export(_ kind: String) {
        do {
            let data = try DataExchange.build(store: store, kind: kind)
            let name = "saiskitchen-\(kind)-\(AppFormatters.isoDate(Date())).json"
            let url = FileManager.default.temporaryDirectory.appendingPathComponent(name)
            try data.write(to: url)
            exportFile = ExportFile(url: url)
        } catch {
            message = error.localizedDescription
        }
    }
}

struct SettingsSection<Content: View>: View {
    @Environment(\.colorScheme) private var scheme
    let title: String
    let icon: String
    @ViewBuilder let content: Content
    private let theme = AppTheme()

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            Label(title, systemImage: icon).font(.headline).foregroundStyle(theme.text(scheme))
            content
        }
        .padding(16)
        .appCardStyle(scheme)
    }
}

struct SettingsTextRow: View {
    @Environment(\.colorScheme) private var scheme
    let label: String
    let value: String
    private let theme = AppTheme()
    var body: some View {
        HStack {
            Text(label).foregroundStyle(theme.secondaryText(scheme))
            Spacer()
            Text(value).fontWeight(.semibold).foregroundStyle(theme.text(scheme)).multilineTextAlignment(.trailing)
        }
    }
}

/// Search box + fixed-height scrolling list, so you never scroll the whole page to find a customer.
struct CustomerMultiPicker: View {
    @Environment(\.colorScheme) private var scheme
    let customers: [Customer]
    let selected: Set<String>
    let onToggle: (String) -> Void
    @State private var query = ""
    private let theme = AppTheme()

    var body: some View {
        SearchField(text: $query, placeholder: "Search customer by name or phone...")
            .listRowBackground(Color.clear)
        if !selected.isEmpty {
            Text(customers.filter { selected.contains($0.id) }.map(\.name).joined(separator: ", "))
                .font(.footnote.bold()).foregroundStyle(theme.primary)
        }
        let shown = customers.filter { query.isEmpty || $0.name.localizedStandardContains(query) || $0.phone.localizedStandardContains(query) }
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                ForEach(shown) { customer in
                    Button { onToggle(customer.id) } label: {
                        HStack {
                            VStack(alignment: .leading) {
                                Text(customer.name).foregroundStyle(theme.text(scheme))
                                Text(customer.phone).font(.caption).foregroundStyle(theme.secondaryText(scheme))
                            }
                            Spacer()
                            Image(systemName: selected.contains(customer.id) ? "checkmark.circle.fill" : "circle")
                                .foregroundStyle(selected.contains(customer.id) ? theme.primary : theme.secondaryText(scheme))
                        }
                        .padding(.vertical, 8)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    Divider()
                }
                if shown.isEmpty { Text("No customer found.").foregroundStyle(theme.secondaryText(scheme)).padding(8) }
            }
        }
        .frame(height: 260)
    }
}

struct SearchField: View {
    @Environment(\.colorScheme) private var scheme
    @Binding var text: String
    let placeholder: String
    private let theme = AppTheme()

    var body: some View {
        HStack(spacing: 10) {
            Image(systemName: "magnifyingglass").foregroundStyle(theme.secondaryText(scheme))
            TextField(placeholder, text: $text)
                .textInputAutocapitalization(.never)
        }
        .padding(14)
        .background(theme.surface(scheme), in: .rect(cornerRadius: 14))
        .shadow(color: .black.opacity(scheme == .dark ? 0.2 : 0.05), radius: 6, x: 0, y: 2)
    }
}

struct EmptyState: View {
    @Environment(\.colorScheme) private var scheme
    let icon: String
    let title: String
    let subtitle: String
    private let theme = AppTheme()

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: icon).font(.system(size: 56)).foregroundStyle(theme.border(scheme))
            Text(title).font(.title3.bold()).foregroundStyle(theme.text(scheme))
            Text(subtitle).font(.subheadline).foregroundStyle(theme.secondaryText(scheme)).multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 70)
    }
}

extension String {
    var normalizedDecimal: String { replacingOccurrences(of: ",", with: ".") }
}

extension Double {
    var clean: String {
        truncatingRemainder(dividingBy: 1) == 0 ? String(Int(self)) : String(format: "%.2f", self)
    }
}

#Preview {
    ContentView()
        .environment(KitchenStore())
}
