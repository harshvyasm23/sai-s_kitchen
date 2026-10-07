import SwiftUI

/// Sends the next day's menu through the Meta WhatsApp Business Cloud API (a pre-approved message template).
enum WaBusiness {
    private static let d = UserDefaults.standard
    static var phoneId: String { d.string(forKey: "wab_phoneId") ?? "" }
    static var token: String { d.string(forKey: "wab_token") ?? "" }
    static var template: String { d.string(forKey: "wab_template") ?? "daily_menu" }
    static var lang: String { d.string(forKey: "wab_lang") ?? "en" }
    static var isConfigured: Bool { !phoneId.isEmpty && !token.isEmpty }
    static func save(phoneId: String, token: String, template: String, lang: String) {
        d.set(phoneId.trimmingCharacters(in: .whitespacesAndNewlines), forKey: "wab_phoneId")
        d.set(token.trimmingCharacters(in: .whitespacesAndNewlines), forKey: "wab_token")
        let t = template.trimmingCharacters(in: .whitespaces), l = lang.trimmingCharacters(in: .whitespaces)
        d.set(t.isEmpty ? "daily_menu" : t, forKey: "wab_template")
        d.set(l.isEmpty ? "en" : l, forKey: "wab_lang")
    }

    /// Template parameters may not contain line breaks or long runs of spaces.
    static func clean(_ s: String) -> String { s.split(whereSeparator: { $0.isWhitespace }).joined(separator: " ") }

    static func dateLabel(_ date: Date) -> String {
        let f = DateFormatter(); f.locale = Locale(identifier: "en_GB"); f.dateFormat = "EEEE d MMM"
        return f.string(from: date)
    }

    static func plainText(name: String, date: Date, menu: String) -> String {
        let first = name.split(separator: " ").first.map(String.init) ?? name
        return "Hello \(first), tomorrow's menu at Sai's Kitchen (\(dateLabel(date))):\n\(clean(menu))\n\nPure veg, homemade with love \u{1F64F}. Order or change: 0442355458"
    }

    /// One message for everyone (broadcast list / channel / group).
    static func groupText(date: Date, menu: String) -> String {
        "\u{1F64F} Jai Sai Nath \u{1F64F}\nTomorrow's menu at Sai's Kitchen (\(dateLabel(date))):\n\(clean(menu))\n\nPure veg, homemade with love.\nOrder or change by call/WhatsApp: 0442355458"
    }

    /// Returns nil on success, otherwise the error text from Meta.
    static func send(to phone: String, firstName: String, date: Date, menu: String) async -> String? {
        guard let url = URL(string: "https://graph.facebook.com/v21.0/\(phoneId)/messages") else { return "Bad phone number ID" }
        let params = [clean(firstName), dateLabel(date), clean(menu)].map { ["type": "text", "text": $0] }
        let body: [String: Any] = [
            "messaging_product": "whatsapp", "to": waNumber(phone), "type": "template",
            "template": ["name": template, "language": ["code": lang], "components": [["type": "body", "parameters": params]]],
        ]
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        req.timeoutInterval = 20
        do {
            let (data, resp) = try await URLSession.shared.data(for: req)
            if let code = (resp as? HTTPURLResponse)?.statusCode, (200..<300).contains(code) { return nil }
            if let o = try? JSONSerialization.jsonObject(with: data) as? [String: Any], let e = o["error"] as? [String: Any], let m = e["message"] as? String { return m }
            return String(data: data, encoding: .utf8).map { String($0.prefix(200)) } ?? "Failed"
        } catch { return error.localizedDescription }
    }
}

struct MenuBroadcastView: View {
    @Environment(KitchenStore.self) private var store
    @Environment(\.colorScheme) private var scheme
    @Environment(\.openURL) private var openURL
    private let theme = AppTheme()
    @State private var date = Calendar.current.date(byAdding: .day, value: 1, to: Calendar.current.startOfDay(for: Date())) ?? Date()
    @State private var selected: Set<String> = []
    @State private var started = false
    @State private var showSetup = false
    @State private var phoneId = WaBusiness.phoneId
    @State private var token = WaBusiness.token
    @State private var template = WaBusiness.template
    @State private var lang = WaBusiness.lang
    @State private var confirm = false
    @State private var busy = false
    @State private var results: [String: String] = [:]
    @State private var shareItems: [Any]? = nil

    private var people: [Customer] {
        store.customers.filter { $0.isActive && !$0.phone.isEmpty }.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }
    private var expected: Set<String> {
        Set(store.plannedFor(date).filter { !$0.skipped && !store.isHoliday(date) }.map { $0.customer.id })
    }
    private var menuText: String { store.menu[String(KitchenStore.isoWeekday(date))] ?? "" }

    var body: some View {
        ZStack {
            theme.background(scheme).ignoresSafeArea()
            ScrollView {
                VStack(alignment: .leading, spacing: 10) {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(WaBusiness.dateLabel(date)).font(.caption).foregroundStyle(theme.secondaryText(scheme))
                        Text(menuText).fontWeight(.semibold)
                        Text("Wrong menu? Go back and open Weekly menu.").font(.caption).foregroundStyle(theme.secondaryText(scheme))
                    }.padding(14).frame(maxWidth: .infinity, alignment: .leading).appCardStyle(scheme)
                    if store.isHoliday(date) { Text("\u{26A0} Tomorrow is marked as a holiday.").foregroundStyle(theme.error) }
                    Button("Share menu (one message for everyone)") { shareItems = [WaBusiness.groupText(date: date, menu: menuText)] }
                        .buttonStyle(.borderedProminent).tint(theme.primary).disabled(menuText.isEmpty)
                    Text("Choose WhatsApp, then your Broadcast list (or channel/group). Everyone gets it with one tap.").font(.caption).foregroundStyle(theme.secondaryText(scheme))

                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Text("Meta WhatsApp Business setup").fontWeight(.bold)
                            Spacer()
                            Button(showSetup ? "Hide" : (WaBusiness.isConfigured ? "Edit \u{2713}" : "Set up")) { showSetup.toggle() }
                        }
                        if showSetup {
                            Text("Sending from +358 44 235 5458 needs a Meta WhatsApp Business Cloud API account and one approved message template. Template body to create (category Utility): \"Hello {{1}}, tomorrow's menu at Sai's Kitchen ({{2}}): {{3}}. Pure veg, homemade with love. Order or change: 0442355458\"")
                                .font(.caption).foregroundStyle(theme.secondaryText(scheme))
                            TextField("Phone number ID", text: $phoneId).textFieldStyle(.roundedBorder).textInputAutocapitalization(.never)
                            SecureField("Access token (permanent)", text: $token).textFieldStyle(.roundedBorder)
                            HStack {
                                TextField("Template name", text: $template).textFieldStyle(.roundedBorder).textInputAutocapitalization(.never)
                                TextField("Language", text: $lang).textFieldStyle(.roundedBorder).frame(width: 90).textInputAutocapitalization(.never)
                            }
                            Button("Save") { WaBusiness.save(phoneId: phoneId, token: token, template: template, lang: lang); showSetup = false }
                                .buttonStyle(.borderedProminent).tint(theme.primary)
                        }
                    }.padding(14).frame(maxWidth: .infinity, alignment: .leading).appCardStyle(scheme)

                    Text("Who gets it (\(selected.count) selected)").font(.headline)
                    Text("Customers expected tomorrow are ticked. Customers without a phone number are not shown.").font(.caption).foregroundStyle(theme.secondaryText(scheme))
                    HStack {
                        Button("All") { selected = Set(people.map(\.id)) }.buttonStyle(.bordered)
                        Button("Expected only") { selected = expected.intersection(Set(people.map(\.id))) }.buttonStyle(.bordered)
                        Button("None") { selected = [] }.buttonStyle(.bordered)
                    }
                    ForEach(people) { c in
                        VStack(alignment: .leading, spacing: 2) {
                            HStack {
                                Button { if selected.contains(c.id) { selected.remove(c.id) } else { selected.insert(c.id) } } label: {
                                    Image(systemName: selected.contains(c.id) ? "checkmark.square.fill" : "square").font(.title3)
                                }.buttonStyle(.plain)
                                VStack(alignment: .leading) { Text(c.name); Text(c.phone).font(.caption).foregroundStyle(theme.secondaryText(scheme)) }
                                Spacer()
                                if let r = results[c.id] { Text(r == "ok" ? "\u{2713} Sent" : "\u{2717}").foregroundStyle(r == "ok" ? theme.success : theme.error).fontWeight(.bold) }
                            }
                            if let r = results[c.id], r != "ok" { Text(r).font(.caption2).foregroundStyle(theme.error) }
                        }
                    }
                    Button(busy ? "Sending..." : "Send to \(selected.count) customers via Meta") { confirm = true }
                        .buttonStyle(.borderedProminent).tint(theme.primary)
                        .disabled(selected.isEmpty || !WaBusiness.isConfigured || busy || menuText.isEmpty)
                    Text("No Meta account yet? Use the normal WhatsApp buttons below: one tap per customer, message is pre-written.").font(.caption).foregroundStyle(theme.secondaryText(scheme))
                    ForEach(people.filter { selected.contains($0.id) }) { c in
                        Button("WhatsApp \(c.name)") {
                            if let u = whatsAppURL(phone: c.phone, text: WaBusiness.plainText(name: c.name, date: date, menu: menuText)) { openURL(u) }
                        }.buttonStyle(.bordered)
                    }
                }.padding(20)
            }
        }
        .navigationTitle("Send Tomorrow's Menu")
        .onAppear {
            guard !started else { return }; started = true
            selected = expected.intersection(Set(people.map(\.id)))
            showSetup = !WaBusiness.isConfigured
        }
        .sheet(isPresented: Binding(get: { shareItems != nil }, set: { if !$0 { shareItems = nil } })) { ShareSheetMany(items: shareItems ?? []) }
        .alert("Send menu now?", isPresented: $confirm) {
            Button("Send") {
                busy = true; results = [:]
                let targets = people.filter { selected.contains($0.id) }
                let menu = menuText, d = date
                Task {
                    for c in targets {
                        let err = await WaBusiness.send(to: c.phone, firstName: c.name.split(separator: " ").first.map(String.init) ?? c.name, date: d, menu: menu)
                        results[c.id] = err ?? "ok"
                    }
                    busy = false
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This sends the \(WaBusiness.dateLabel(date)) menu from your business number to \(selected.count) customers. Meta charges a small fee per message.")
        }
    }
}
