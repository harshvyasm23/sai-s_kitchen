import SwiftUI
import UIKit

private let routeOrder = ["omena", "pasila", "lepp", "myyr", "station", "other", "home"]
private func placeLabel(_ key: String) -> String {
    switch key {
    case "other": return "Other / not set"
    case "home": return "Pickup / no delivery"
    default: return WhatsAppParser.places.first { $0.key == key }?.label ?? "Other / not set"
    }
}
private let dayNames = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
private let dayNamesFull = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

/// What to cook and where to deliver on a given day, with one-tap entry from weekly schedules.
struct KitchenPlanView: View {
    @Environment(KitchenStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var scheme
    private let theme = AppTheme()
    @State private var date = Calendar.current.startOfDay(for: Date())

    var body: some View {
        let cur = store.settings.currency
        let planned = store.plannedFor(date)
        let holiday = store.isHoliday(date)
        let cooking = planned.filter { $0.entry != nil || (!$0.skipped && !holiday) }
        let noon = cooking.reduce(0) { $0 + ($1.entry?.noonQty ?? $1.noon) }
        let eve = cooking.reduce(0) { $0 + ($1.entry?.eveningQty ?? $1.evening) }
        let pending = planned.filter { $0.entry == nil && !$0.skipped && !holiday && $0.qty > 0 }
        let groups = Dictionary(grouping: planned) { routeOrder.contains($0.place) ? $0.place : "other" }
        NavigationStack {
            ZStack {
                theme.background(scheme).ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Button("Today") { date = Calendar.current.startOfDay(for: Date()) }.buttonStyle(.bordered)
                            Button("Tomorrow") { date = Calendar.current.date(byAdding: .day, value: 1, to: Calendar.current.startOfDay(for: Date())) ?? date }.buttonStyle(.bordered)
                            Spacer()
                            DatePicker("", selection: $date, displayedComponents: .date).labelsHidden()
                        }
                        VStack(alignment: .leading, spacing: 4) {
                            Text("\(dayNamesFull[KitchenStore.isoWeekday(date)]) menu").font(.caption).foregroundStyle(theme.secondaryText(scheme))
                            Text(store.menu[String(KitchenStore.isoWeekday(date))] ?? "").fontWeight(.semibold)
                        }.padding(14).frame(maxWidth: .infinity, alignment: .leading).appCardStyle(scheme)
                        VStack(alignment: .leading, spacing: 6) {
                            Text("To cook: \((noon + eve).clean) tiffins").font(.title2.bold()).foregroundStyle(theme.primary)
                            Text("Noon \(noon.clean)  \u{2022}  Evening \(eve.clean)  \u{2022}  \(cooking.count) customers").font(.subheadline).foregroundStyle(theme.secondaryText(scheme))
                            Toggle("Holiday - no tiffin for anyone", isOn: Binding(get: { holiday }, set: { store.setSkip("", date, on: $0) }))
                        }.padding(14).frame(maxWidth: .infinity, alignment: .leading).appCardStyle(scheme)
                        if !pending.isEmpty {
                            Button("Add entries for all \(pending.count) pending") { pending.forEach { store.confirmPlanned($0, date) } }
                                .buttonStyle(.borderedProminent).tint(theme.primary).frame(maxWidth: .infinity)
                        }
                        if planned.isEmpty {
                            VStack(alignment: .leading, spacing: 4) {
                                Text("No one scheduled for this day.").fontWeight(.semibold)
                                Text("Set each regular customer's weekdays once, and they appear here every week.").font(.footnote).foregroundStyle(theme.secondaryText(scheme))
                            }.padding(14).frame(maxWidth: .infinity, alignment: .leading).appCardStyle(scheme)
                        }
                        ForEach(routeOrder.filter { groups[$0] != nil }, id: \.self) { key in
                            let rows = groups[key] ?? []
                            let n = rows.filter { r in cooking.contains { $0.id == r.id } }.reduce(0) { $0 + ($1.entry?.quantity ?? $1.qty) }
                            Text("\(placeLabel(key))  \u{2022}  \(n.clean) tiffins").font(.headline).foregroundStyle(theme.primary).padding(.top, 6)
                            ForEach(rows) { p in row(p, holiday: holiday, cur: cur) }
                        }
                        NavigationLink { SchedulesView() } label: { Label("Weekly schedules (set who comes which days)", systemImage: "calendar") }.buttonStyle(.bordered)
                        NavigationLink { MenuView() } label: { Label("Weekly menu & poster", systemImage: "fork.knife") }.buttonStyle(.bordered)
                    }
                    .padding(20)
                }
            }
            .navigationTitle("Today's Kitchen")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
        }
    }

    @ViewBuilder
    private func row(_ p: Planned, holiday: Bool, cur: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(p.customer.name).fontWeight(.semibold)
                    let q = p.entry.map { "Noon \($0.noonQty.clean) + Evening \($0.eveningQty.clean)" } ?? "Noon \(p.noon.clean) + Evening \(p.evening.clean)"
                    Text(q + (p.customer.phone.isEmpty ? "" : "  \u{2022}  \(p.customer.phone)")).font(.caption).foregroundStyle(theme.secondaryText(scheme))
                    if let e = p.entry { Text("\u{2713} Entry saved \(AppFormatters.currency(e.total, code: cur))").font(.caption).foregroundStyle(theme.success) }
                    else if p.skipped || holiday { Text("Skipped").font(.caption).foregroundStyle(theme.error) }
                    else { Text("Pending").font(.caption).foregroundStyle(theme.secondary) }
                }
                Spacer()
                if !p.skipped && !holiday {
                    Button { store.toggleDelivered(p.customer.id, date) } label: {
                        VStack(spacing: 2) {
                            Image(systemName: store.isDelivered(p.customer.id, date) ? "checkmark.circle.fill" : "circle").font(.title2)
                            Text("Delivered").font(.system(size: 10))
                        }
                    }.buttonStyle(.plain).foregroundStyle(store.isDelivered(p.customer.id, date) ? theme.success : theme.secondaryText(scheme))
                }
            }
            if p.entry == nil && !holiday {
                HStack {
                    if !p.skipped && p.qty > 0 { Button("Add entry") { store.confirmPlanned(p, date) }.buttonStyle(.borderedProminent).tint(theme.primary) }
                    Button(p.skipped ? "Undo skip" : "Skip this day") { store.setSkip(p.customer.id, date, on: !p.skipped) }.buttonStyle(.bordered)
                }
            }
        }
        .padding(14).frame(maxWidth: .infinity, alignment: .leading).appCardStyle(scheme)
    }
}

struct SchedulesView: View {
    @Environment(KitchenStore.self) private var store
    @Environment(\.colorScheme) private var scheme
    private let theme = AppTheme()
    @State private var query = ""
    @State private var editing: Customer?

    var body: some View {
        let list = store.customers.filter { $0.isActive && (query.isEmpty || $0.name.localizedCaseInsensitiveContains(query)) }
            .sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
        ZStack {
            theme.background(scheme).ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Pick the days each regular customer gets tiffin. They then show up in Today's Kitchen automatically; you only confirm or skip.")
                        .font(.footnote).foregroundStyle(theme.secondaryText(scheme))
                    TextField("Search customer...", text: $query).textFieldStyle(.roundedBorder)
                    ForEach(list) { c in
                        Button { editing = c } label: {
                            VStack(alignment: .leading, spacing: 2) {
                                Text(c.name).fontWeight(.semibold).foregroundStyle(theme.text(scheme))
                                if let s = store.schedule(for: c.id) {
                                    Text(s.days.sorted().map { dayNames[$0] }.joined(separator: " ") + "  \u{2022}  noon \(s.noon.clean) / evening \(s.evening.clean)  \u{2022}  " + placeLabel(s.place))
                                        .font(.caption).foregroundStyle(theme.primary)
                                } else {
                                    Text("Not scheduled - tap to set").font(.caption).foregroundStyle(theme.secondaryText(scheme))
                                }
                            }
                            .padding(14).frame(maxWidth: .infinity, alignment: .leading).appCardStyle(scheme)
                        }.buttonStyle(.plain)
                    }
                }.padding(20)
            }
        }
        .navigationTitle("Weekly Schedules")
        .sheet(item: $editing) { ScheduleEditor(customer: $0) }
    }
}

struct ScheduleEditor: View {
    @Environment(KitchenStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    let customer: Customer
    @State private var days: Set<Int> = [1, 2, 3, 4, 5]
    @State private var noon = "0"
    @State private var evening = "1"
    @State private var place = "home"
    @State private var loaded = false

    var body: some View {
        NavigationStack {
            Form {
                Section("Days") {
                    HStack {
                        ForEach(1...7, id: \.self) { d in
                            Button(dayNames[d]) { if days.contains(d) { days.remove(d) } else { days.insert(d) } }
                                .buttonStyle(.bordered).tint(days.contains(d) ? .orange : .gray).font(.caption)
                        }
                    }
                }
                Section("Tiffins per day") {
                    TextField("Noon", text: $noon).keyboardType(.decimalPad)
                    TextField("Evening", text: $evening).keyboardType(.decimalPad)
                }
                Section("Delivery place (charged per tiffin)") {
                    Picker("Place", selection: $place) {
                        ForEach(WhatsAppParser.places, id: \.key) { Text($0.label).tag($0.key) }
                    }.pickerStyle(.inline).labelsHidden()
                }
                if store.schedule(for: customer.id) != nil {
                    Button("Remove schedule", role: .destructive) { store.removeSchedule(customer.id); dismiss() }
                }
            }
            .navigationTitle(customer.name)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        store.setSchedule(Schedule(customerId: customer.id, days: days.sorted(), noon: Double(noon.replacingOccurrences(of: ",", with: ".")) ?? 0,
                                                   evening: Double(evening.replacingOccurrences(of: ",", with: ".")) ?? 0, place: place))
                        dismiss()
                    }.disabled(days.isEmpty)
                }
            }
            .onAppear {
                guard !loaded else { return }; loaded = true
                if let s = store.schedule(for: customer.id) { days = Set(s.days); noon = s.noon.clean; evening = s.evening.clean; place = s.place }
            }
        }
    }
}

/// Money overview: income, unpaid, best customers, busiest days, quiet customers, one-tap reminders.
struct MoneyView: View {
    @Environment(KitchenStore.self) private var store
    @Environment(\.dismiss) private var dismiss
    @Environment(\.colorScheme) private var scheme
    @Environment(\.openURL) private var openURL
    private let theme = AppTheme()
    @State private var month = Date()
    @State private var showOutstanding = false

    private func reminder(_ r: OutstandingRow, label: String, cur: String) -> String {
        let first = r.name.split(separator: " ").first.map(String.init) ?? r.name
        return "Hello \(first), this is Sai's Kitchen. Your balance for \(label) is \(AppFormatters.currency(r.balance, code: cur)). Please pay by bank transfer: IBAN BE40 9676 8333 5963, BIC TRWIBEB1XXX. Thank you! \u{1F64F}"
    }

    var body: some View {
        let cur = store.settings.currency
        let start = AppFormatters.startOfMonth(for: month), end = AppFormatters.endOfMonth(for: month)
        let rows = store.outstandingRows(start: start, end: end)
        let billed = rows.reduce(0) { $0 + $1.billed }, paid = rows.reduce(0) { $0 + $1.paid }
        let due = rows.filter { $0.balance > 0.005 }.sorted { $0.balance > $1.balance }
        let df = DateFormatter(); let _ = { df.dateFormat = "MMMM yyyy" }()
        let label = df.string(from: month)
        let cal = Calendar.current
        let monthTiffins = store.tiffins.filter { cal.startOfDay(for: $0.date) >= cal.startOfDay(for: start) && cal.startOfDay(for: $0.date) <= cal.startOfDay(for: end) }
        let byDay = (1...7).map { d in monthTiffins.filter { KitchenStore.isoWeekday($0.date) == d }.reduce(0) { $0 + $1.quantity } }
        let maxDay = max(byDay.max() ?? 1, 1)
        let quiet: [(Customer, Date)] = store.customers.compactMap { c in
            let mine = store.tiffins.filter { $0.customerId == c.id }
            guard let last = mine.map(\.date).max(), last < (cal.date(byAdding: .day, value: -14, to: Date()) ?? Date()) else { return nil }
            let recent = mine.filter { $0.date > (cal.date(byAdding: .day, value: -60, to: last) ?? last) }.count
            return recent >= 5 ? (c, last) : nil
        }
        NavigationStack {
            ZStack {
                theme.background(scheme).ignoresSafeArea()
                ScrollView {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Button { month = cal.date(byAdding: .month, value: -1, to: month) ?? month } label: { Image(systemName: "chevron.left") }
                            Spacer(); Text(label).fontWeight(.semibold); Spacer()
                            Button { month = cal.date(byAdding: .month, value: 1, to: month) ?? month } label: { Image(systemName: "chevron.right") }
                        }
                        VStack(alignment: .leading, spacing: 6) {
                            line("Billed this month", AppFormatters.currency(billed, code: cur))
                            line("Received", AppFormatters.currency(paid, code: cur))
                            line("Still to collect", AppFormatters.currency(due.reduce(0) { $0 + $1.balance }, code: cur), big: true)
                            Text("\(due.count) customers have not fully paid").font(.caption).foregroundStyle(theme.secondaryText(scheme))
                        }.padding(14).frame(maxWidth: .infinity, alignment: .leading).appCardStyle(scheme)
                        Text("Who owes money").font(.headline)
                        if due.isEmpty { Text("Everyone is paid up \u{2713}").fontWeight(.semibold).foregroundStyle(theme.success).padding(14).frame(maxWidth: .infinity, alignment: .leading).appCardStyle(scheme) }
                        ForEach(due, id: \.customerId) { r in
                            VStack(alignment: .leading, spacing: 8) {
                                HStack {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(r.name).fontWeight(.semibold)
                                        Text(r.paid <= 0 ? "Nothing paid yet" : "Paid \(AppFormatters.currency(r.paid, code: cur)) of \(AppFormatters.currency(r.previous + r.billed, code: cur))")
                                            .font(.caption).foregroundStyle(theme.secondaryText(scheme))
                                    }
                                    Spacer()
                                    Text(AppFormatters.currency(r.balance, code: cur)).fontWeight(.bold).foregroundStyle(theme.error)
                                }
                                Button("WhatsApp reminder") {
                                    if let u = whatsAppURL(phone: r.phone, text: reminder(r, label: label, cur: cur)) { openURL(u) }
                                }.buttonStyle(.bordered)
                            }.padding(14).frame(maxWidth: .infinity, alignment: .leading).appCardStyle(scheme)
                        }
                        Button("Open full Outstanding Report (PDF, record payments)") { showOutstanding = true }.buttonStyle(.bordered)
                        Text("Best customers").font(.headline)
                        VStack(alignment: .leading, spacing: 4) {
                            let top = Array(rows.sorted { $0.billed > $1.billed }.prefix(5))
                            if top.isEmpty { Text("No entries this month.").foregroundStyle(theme.secondaryText(scheme)) }
                            ForEach(Array(top.enumerated()), id: \.offset) { i, r in line("\(i + 1). \(r.name)", AppFormatters.currency(r.billed, code: cur)) }
                        }.padding(14).frame(maxWidth: .infinity, alignment: .leading).appCardStyle(scheme)
                        Text("Busiest days (tiffins)").font(.headline)
                        VStack(spacing: 6) {
                            ForEach(1...7, id: \.self) { d in
                                HStack {
                                    Text(dayNames[d]).font(.footnote).frame(width: 40, alignment: .leading)
                                    GeometryReader { g in
                                        ZStack(alignment: .leading) {
                                            Capsule().fill(Color.gray.opacity(0.2))
                                            Capsule().fill(theme.primary).frame(width: max(g.size.width * byDay[d - 1] / maxDay, 4))
                                        }
                                    }.frame(height: 12)
                                    Text(byDay[d - 1].clean).font(.footnote).frame(width: 44, alignment: .trailing)
                                }
                            }
                        }.padding(14).frame(maxWidth: .infinity, alignment: .leading).appCardStyle(scheme)
                        if !quiet.isEmpty {
                            Text("Quiet regulars (no tiffin for 14+ days)").font(.headline)
                            VStack(alignment: .leading, spacing: 4) {
                                ForEach(quiet, id: \.0.id) { c, last in line(c.name, "last \(AppFormatters.displayDate(last))") }
                            }.padding(14).frame(maxWidth: .infinity, alignment: .leading).appCardStyle(scheme)
                        }
                    }.padding(20)
                }
            }
            .navigationTitle("Money Overview")
            .toolbar { ToolbarItem(placement: .cancellationAction) { Button("Close") { dismiss() } } }
            .sheet(isPresented: $showOutstanding) { OutstandingReportView() }
        }
    }

    private func line(_ a: String, _ b: String, big: Bool = false) -> some View {
        HStack { Text(a).fontWeight(big ? .bold : .regular); Spacer(); Text(b).fontWeight(.bold).foregroundStyle(big ? theme.primary : theme.text(scheme)) }
    }
}

/// Draws the weekly tiffin menu as a shareable image in the Sai's Kitchen colours.
enum MenuPoster {
    static func render(menu: [String: String], price: Double) -> UIImage {
        let w: CGFloat = 1080, h: CGFloat = 1620
        let green = UIColor(red: 0x1F / 255, green: 0x6B / 255, blue: 0x3A / 255, alpha: 1)
        let maroon = UIColor(red: 0x7B / 255, green: 0x1E / 255, blue: 0x2B / 255, alpha: 1)
        let orange = UIColor(red: 0xE8 / 255, green: 0x76 / 255, blue: 0x1E / 255, alpha: 1)
        let cream = UIColor(red: 1, green: 0xF4 / 255, blue: 0xDF / 255, alpha: 1)
        let ink = UIColor(red: 0x2B / 255, green: 0x21 / 255, blue: 0x18 / 255, alpha: 1)
        let gold = UIColor(red: 1, green: 0xE9 / 255, blue: 0xB8 / 255, alpha: 1)
        let days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        func draw(_ s: String, centerX: CGFloat, y: CGFloat, size: CGFloat, color: UIColor, bold: Bool) {
            var font = bold ? UIFont.boldSystemFont(ofSize: size) : UIFont.systemFont(ofSize: size)
            var width = (s as NSString).size(withAttributes: [.font: font]).width
            var sz = size
            while width > 1000 && sz > 14 { sz -= 1; font = bold ? UIFont.boldSystemFont(ofSize: sz) : UIFont.systemFont(ofSize: sz); width = (s as NSString).size(withAttributes: [.font: font]).width }
            (s as NSString).draw(at: CGPoint(x: centerX - width / 2, y: y), withAttributes: [.font: font, .foregroundColor: color])
        }
        let renderer = UIGraphicsImageRenderer(size: CGSize(width: w, height: h))
        return renderer.image { ctx in
            let c = ctx.cgContext
            cream.setFill(); c.fill(CGRect(x: 0, y: 0, width: w, height: h))
            orange.withAlphaComponent(0.08).setFill()
            for x in stride(from: 20, to: Int(w), by: 54) { for y in stride(from: 20, to: Int(h), by: 54) { c.fillEllipse(in: CGRect(x: x - 4, y: y - 4, width: 8, height: 8)) } }
            green.setFill(); c.fill(CGRect(x: 0, y: 0, width: w, height: 250))
            draw("|| Jai Siya Ram || Jai Sai Nath ||", centerX: w / 2, y: 22, size: 30, color: gold, bold: false)
            draw("Sai's Kitchen", centerX: w / 2, y: 62, size: 92, color: .white, bold: true)
            draw("Taste That Feels Like Home", centerX: w / 2, y: 178, size: 34, color: gold, bold: false)
            maroon.setFill(); c.fill(CGRect(x: 0, y: 250, width: w, height: 90))
            draw("WEEKLY TIFFIN MENU  \u{2022}  \(price.clean)\u{20AC} PER TIFFIN", centerX: w / 2, y: 275, size: 40, color: .white, bold: true)
            var y: CGFloat = 372
            let para = NSMutableParagraphStyle(); para.lineBreakMode = .byWordWrapping
            for d in 1...7 {
                let txt = (menu[String(d)] ?? "") as NSString
                let attrs: [NSAttributedString.Key: Any] = [.font: UIFont.systemFont(ofSize: 34), .foregroundColor: ink, .paragraphStyle: para]
                let bound = CGSize(width: w - 80 - 250 - 30, height: 1000)
                let r = txt.boundingRect(with: bound, options: [.usesLineFragmentOrigin], attributes: attrs, context: nil)
                let rowH = max(ceil(r.height) + 40, 100)
                UIColor.white.setFill(); UIBezierPath(roundedRect: CGRect(x: 40, y: y, width: w - 80, height: rowH), cornerRadius: 22).fill()
                (d % 2 == 0 ? maroon : green).setFill(); UIBezierPath(roundedRect: CGRect(x: 40, y: y, width: 240, height: rowH), cornerRadius: 22).fill()
                draw(days[d - 1], centerX: 160, y: y + rowH / 2 - 20, size: 34, color: .white, bold: true)
                txt.draw(in: CGRect(x: 310, y: y + (rowH - ceil(r.height)) / 2, width: bound.width, height: ceil(r.height) + 4), withAttributes: attrs)
                y += rowH + 14
            }
            y += 6
            draw("Pure Veg  \u{2022}  Fresh  \u{2022}  Homemade  \u{2022}  Healthy", centerX: w / 2, y: y + 12, size: 36, color: maroon, bold: true)
            draw("Morning tiffin: book 24 hours ahead  \u{2022}  Dinner: tell us before 10 AM", centerX: w / 2, y: y + 66, size: 28, color: ink, bold: false)
            draw("Occasional delivery: Iso Omena 1\u{20AC}  \u{2022}  Sello, Myyrmanni, Helsinki Station 0.50\u{20AC} (per tiffin)", centerX: w / 2, y: y + 108, size: 25, color: ink, bold: false)
            let fy = h - 150
            green.setFill(); c.fill(CGRect(x: 0, y: fy, width: w, height: 150))
            draw("Call / WhatsApp: 0442355458", centerX: w / 2, y: fy + 30, size: 40, color: .white, bold: true)
            draw("Instagram: jai.sainath11   \u{2022}   saiskitchen.me", centerX: w / 2, y: fy + 88, size: 32, color: gold, bold: false)
            orange.setStroke(); c.setLineWidth(8); c.stroke(CGRect(x: 14, y: 14, width: w - 28, height: h - 28))
        }
    }
}

struct MenuView: View {
    @Environment(KitchenStore.self) private var store
    @Environment(\.colorScheme) private var scheme
    private let theme = AppTheme()
    @State private var texts: [String: String] = [:]
    @State private var saved = false
    @State private var shareItems: [Any]? = nil

    var body: some View {
        ZStack {
            theme.background(scheme).ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    Text("Edit the menu for each day. Today's Kitchen shows it, and the poster is ready to share on WhatsApp / Instagram.")
                        .font(.footnote).foregroundStyle(theme.secondaryText(scheme))
                    ForEach(1...7, id: \.self) { d in
                        VStack(alignment: .leading, spacing: 2) {
                            Text(dayNamesFull[d]).font(.caption).foregroundStyle(theme.secondaryText(scheme))
                            TextField(dayNamesFull[d], text: Binding(get: { texts[String(d)] ?? "" }, set: { texts[String(d)] = $0; saved = false }), axis: .vertical)
                                .textFieldStyle(.roundedBorder)
                        }
                    }
                    Button(saved ? "Saved \u{2713}" : "Save menu") { store.saveMenu(texts); saved = true }.buttonStyle(.borderedProminent).tint(theme.primary)
                    Button("Share weekly menu poster (image)") {
                        store.saveMenu(texts)
                        let img = MenuPoster.render(menu: texts, price: store.settings.defaultTiffinPrice)
                        let url = FileManager.default.temporaryDirectory.appendingPathComponent("Sais_Kitchen_Weekly_Menu.png")
                        if let data = img.pngData() { try? data.write(to: url); shareItems = [url] }
                    }.buttonStyle(.bordered)
                    Button("Reset to standard menu") { texts = DefaultMenu.days; saved = false }
                }.padding(20)
            }
        }
        .navigationTitle("Weekly Menu & Poster")
        .onAppear { if texts.isEmpty { texts = store.menu } }
        .sheet(isPresented: Binding(get: { shareItems != nil }, set: { if !$0 { shareItems = nil } })) { ShareSheetMany(items: shareItems ?? []) }
    }
}
