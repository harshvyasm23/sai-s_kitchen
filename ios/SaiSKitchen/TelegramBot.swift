import Foundation

/// Chat entry via your own Telegram bot. The app fetches messages from Telegram directly (no server).
/// iPhone can only check while the app is open; use the Android phone if you need background checking.
@MainActor
enum TelegramBot {
    private static let d = UserDefaults.standard
    static var token: String { d.string(forKey: "tg_token") ?? "" }
    static var chats: Set<Int64> { Set((d.string(forKey: "tg_chats") ?? "").split(separator: ",").compactMap { Int64($0) }) }
    static var pairingCode: String { d.string(forKey: "tg_code") ?? "" }
    static var isConfigured: Bool { !token.isEmpty }
    static var isConnected: Bool { isConfigured && !chats.isEmpty }

    static func newCode() { d.set(String(Int.random(in: 1000...9999)), forKey: "tg_code") }
    private static var busy = false

    static func saveToken(_ t: String) {
        d.set(t.trimmingCharacters(in: .whitespaces), forKey: "tg_token")
        d.set("", forKey: "tg_chats")
        d.set(0, forKey: "tg_offset")
        d.set(String(Int.random(in: 1000...9999)), forKey: "tg_code")
        }

    static func disconnect() {
        for k in ["tg_token", "tg_chats", "tg_offset", "tg_code"] { d.removeObject(forKey: k) }
    }

    private static let help = "Send your daily list like this:\n\nDate - 06.10.26\ndaily tiffins\n1. Pranav 1 tiffin at pasila\n2. Meena 2 tiffins at Iso Omena\n\nAlacarte\n1. Neha - 2 kg poha 12 euro, roti 20 pcs 0.5 each at Pasila\n\nCatering\n1. Rohit - chole chana 10 euro\n\nCommands: /undo removes the last message's entries, /help shows this."

    private static func api(_ method: String, _ body: [String: Any]) async throws -> [String: Any] {
        guard let url = URL(string: "https://api.telegram.org/bot\(token)/\(method)") else { return [:] }
        var req = URLRequest(url: url)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONSerialization.data(withJSONObject: body)
        req.timeoutInterval = 20
        let (data, _) = try await URLSession.shared.data(for: req)
        return (try JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
    }

    static func poll(store: KitchenStore) async -> String {
        guard isConfigured else { return "No bot token set." }
        if busy { return "Already checking..." }
        busy = true
        defer { busy = false }
        do {
            let res = try await api("getUpdates", ["offset": d.integer(forKey: "tg_offset"), "timeout": 0, "allowed_updates": ["message"]])
            guard res["ok"] as? Bool == true else { return "Telegram says: \(res["description"] as? String ?? "error")" }
            let list = res["result"] as? [[String: Any]] ?? []
            var handled = 0
            for u in list {
                if let msg = u["message"] as? [String: Any], let text = msg["text"] as? String,
                   let chat = (msg["chat"] as? [String: Any])?["id"] as? Int64 {
                    let sent = msg["date"] as? Double ?? 0
                    if let reply = handle(store: store, text: text, chat: chat, sent: sent) {
                        _ = try? await api("sendMessage", ["chat_id": chat, "text": reply])
                        handled += 1
                    }
                }
                if let id = u["update_id"] as? Int { d.set(id + 1, forKey: "tg_offset") }
            }
            return list.isEmpty ? "No new messages." : "Processed \(handled) message(s)."
        } catch {
            return "Could not reach Telegram (\(error.localizedDescription))."
        }
    }

    private static func handle(store: KitchenStore, text: String, chat: Int64, sent: Double) -> String? {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if !chats.contains(chat) {
            if pairingCode.isEmpty { return nil }
            if t.hasPrefix("/start"), t.dropFirst(6).trimmingCharacters(in: .whitespaces) == pairingCode {
                d.set((chats.union([chat])).map(String.init).joined(separator: ","), forKey: "tg_chats")
                d.removeObject(forKey: "tg_code")
                return "Connected ✅ This chat can now send entries to the Sai's Kitchen app.\n\n" + help
            }
            return "To connect, send: /start <the 4-digit code shown in the app's Settings>"
        }
        if t.hasPrefix("/help") || t.hasPrefix("/start") { return help }
        if t.hasPrefix("/undo") {
            guard let b = d.string(forKey: "tg_batch_\(chat)").flatMap(EntryBatch.from) else { return "Nothing to undo." }
            d.removeObject(forKey: "tg_batch_\(chat)")
            return EntryWriter.undo(store: store, batch: b)
        }
        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        func near(_ date: Date?) -> Bool {
            guard let date else { return false }
            return abs(cal.dateComponents([.day], from: today, to: cal.startOfDay(for: date)).day ?? 999) <= 31
        }
        let price = store.settings.defaultTiffinPrice
        let dayFirst = WhatsAppParser.parse(t, monthFirst: false, defaultPrice: price)
        if dayFirst.tiffins.isEmpty && dayFirst.orders.isEmpty { return "I couldn't find any entries in that message.\n\n" + help }
        var parsed = dayFirst
        var date = dayFirst.date
        var note = ""
        if !near(date) {
            let mf = WhatsAppParser.parse(t, monthFirst: true, defaultPrice: price)
            if near(mf.date) { parsed = mf; date = mf.date; note = "(date read as month.day)\n" }
        }
        if date == nil {
            date = sent > 0 ? Date(timeIntervalSince1970: sent) : Date()
            note = "(no date in message, used today's)\n"
        } else if !near(date) {
            return "The date \(AppFormatters.isoDate(date!)) is more than a month away from today, so I did not save anything. Please resend with the right date."
        }
        let (summary, batch) = EntryWriter.apply(store: store, parsed: parsed, date: date!)
        if !batch.tiffinIds.isEmpty || !batch.orderIds.isEmpty || !batch.customerIds.isEmpty { d.set(batch.json, forKey: "tg_batch_\(chat)") }
        return note + summary
    }
}

struct EntryBatch {
    var tiffinIds: [String]
    var orderIds: [String]
    var customerIds: [String]

    var json: String {
        let o: [String: Any] = ["t": tiffinIds, "o": orderIds, "c": customerIds]
        return (try? JSONSerialization.data(withJSONObject: o)).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
    }

    static func from(_ s: String) -> EntryBatch? {
        guard let data = s.data(using: .utf8), let o = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        return EntryBatch(tiffinIds: o["t"] as? [String] ?? [], orderIds: o["o"] as? [String] ?? [], customerIds: o["c"] as? [String] ?? [])
    }
}

@MainActor
enum EntryWriter {
    private static func pretty(_ n: String) -> String {
        n.split(separator: " ").map { $0.prefix(1).uppercased() + $0.dropFirst() }.joined(separator: " ")
    }

    static func apply(store: KitchenStore, parsed: ParsedMessage, date: Date) -> (String, EntryBatch) {
        let cur = store.settings.currency
        let cal = Calendar.current
        var created: [String: Customer] = [:]
        var lines: [String] = []
        var tIds: [String] = []
        var oIds: [String] = []

        func customerFor(_ name: String, _ m: (status: String, customer: Customer?)) -> (Customer, String?) {
            if let c = m.customer {
                if m.status == "ambiguous" { return (c, "several customers match \"\(name)\", used \(c.name)") }
                if WhatsAppParser.norm(c.name) != WhatsAppParser.norm(name) { return (c, "\"\(name)\" matched to \(c.name)") }
                return (c, nil)
            }
            let key = WhatsAppParser.norm(name).trimmingCharacters(in: .whitespaces)
            if let c = created[key] { return (c, nil) }
            let c = Customer(name: pretty(name), phone: "")
            store.addCustomer(c)
            created[key] = c
            return (c, "new customer - check spelling")
        }

        for t in parsed.tiffins {
            let m = WhatsAppParser.matchCustomer(t.name, in: store.customers)
            if let ex = m.customer, store.tiffins.contains(where: { $0.customerId == ex.id && cal.isDate($0.date, inSameDayAs: date) }) {
                lines.append("↷ \(ex.name): skipped, already has a tiffin on this date")
                continue
            }
            let (c, note) = customerFor(t.name, m)
            let e = TiffinEntry(date: date, customerId: c.id, noonQty: t.noon, eveningQty: t.evening, unitPrice: t.price,
                                deliveryCharge: t.delivery, notes: t.place.map { "Telegram • \($0)" } ?? "Telegram")
            store.addMultipleTiffins([e])
            tIds.append(e.id)
            let extra = ([note].compactMap { $0 }) + t.warnings
            lines.append("✓ \(c.name) - \((t.noon + t.evening).clean) tiffin" + (t.place.map { ", \($0)" } ?? "") + " = " + AppFormatters.currency(e.total, code: cur)
                         + (extra.isEmpty ? "" : "\n   ⚠ " + extra.joined(separator: "; ")))
        }
        for o in parsed.orders {
            if o.items.isEmpty || o.warnings.contains(where: { $0.hasPrefix("No price") }) {
                let why = o.warnings.first(where: { $0.hasPrefix("No price") || $0.hasPrefix("No items") }) ?? "no items"
                lines.append("✗ \(o.name): not saved - \(why)")
                continue
            }
            let (c, note) = customerFor(o.name, WhatsAppParser.matchCustomer(o.name, in: store.customers))
            let order = CateringOrder(date: date, customerId: c.id, deliveryCharge: o.delivery,
                                      notes: (o.kind == "catering" ? "Catering" : "À la carte") + (o.place.map { " • \($0)" } ?? ""),
                                      items: o.items.map { CateringItem(itemName: $0.name, qty: $0.qty, unitPrice: $0.price) })
            store.addCateringOrders([order])
            oIds.append(order.id)
            let extra = ([note].compactMap { $0 }) + o.warnings
            lines.append("✓ \(c.name) - \(o.kind == "catering" ? "catering" : "à la carte"): " + o.items.map { $0.name }.joined(separator: ", ")
                         + " = " + AppFormatters.currency(order.total, code: cur) + (extra.isEmpty ? "" : "\n   ⚠ " + extra.joined(separator: "; ")))
        }
        let total = store.tiffins.filter { tIds.contains($0.id) }.reduce(0) { $0 + $1.total }
            + store.cateringOrders.filter { oIds.contains($0.id) }.reduce(0) { $0 + $1.total }
        let none = tIds.isEmpty && oIds.isEmpty
        let head = none ? "Nothing saved." : "Saved for \(AppFormatters.isoDate(date)) (\(AppFormatters.currency(total, code: cur)) total):"
        let tail = none ? "" : "\n\nSend /undo to remove this batch."
        return ("\(head)\n" + lines.joined(separator: "\n") + tail,
                EntryBatch(tiffinIds: tIds, orderIds: oIds, customerIds: created.values.map { $0.id }))
    }

    static func undo(store: KitchenStore, batch b: EntryBatch) -> String {
        for id in b.tiffinIds { if let e = store.tiffins.first(where: { $0.id == id }) { store.deleteTiffin(e) } }
        for id in b.orderIds { if let o = store.cateringOrders.first(where: { $0.id == id }) { store.deleteCateringOrder(o) } }
        for id in b.customerIds {
            let used = store.tiffins.contains { $0.customerId == id } || store.cateringOrders.contains { $0.customerId == id }
            if !used, let c = store.customers.first(where: { $0.id == id }) { store.deleteCustomer(c) }
        }
        return "Removed \(b.tiffinIds.count) tiffin entries and \(b.orderIds.count) orders from the last message."
    }
}

import SwiftUI

struct TelegramSettingsCard: View {
    @Environment(KitchenStore.self) private var store
    @State private var token = ""
    @State private var version = 0
    @State private var status: String?

    var body: some View {
        let _ = version
        SettingsSection(title: "Telegram Chat Entry", icon: "paperplane.fill") {
            Text("Message your own Telegram bot the daily list; the app saves it and the bot replies. The iPhone checks while the app is open.")
                .font(.caption).foregroundStyle(.secondary)
            if !TelegramBot.isConfigured {
                Text("1. In Telegram open @BotFather, send /newbot, follow the steps.\n2. Copy the token and paste it below.").font(.footnote)
                TextField("Bot token", text: $token).textInputAutocapitalization(.never).autocorrectionDisabled().textFieldStyle(.roundedBorder)
                Button("Save token") { TelegramBot.saveToken(token); token = ""; version += 1 }.disabled(!token.contains(":"))
            } else {
                if TelegramBot.isConnected {
                    Text("✅ Connected (\(TelegramBot.chats.count) chat(s))").font(.footnote)
                    if !TelegramBot.pairingCode.isEmpty {
                        Text("To add another person: they send your bot\n/start \(TelegramBot.pairingCode)").font(.footnote.bold())
                    } else {
                        Button("Add another person / chat") { TelegramBot.newCode(); version += 1 }.buttonStyle(.borderless)
                    }
                } else {
                    Text("3. Open your bot in Telegram and send:\n/start \(TelegramBot.pairingCode)\nThen tap Check now.").font(.footnote.bold())
                }
                HStack {
                    Button("Check now") { Task { status = "Checking..."; status = await TelegramBot.poll(store: store); version += 1 } }
                    Spacer()
                    Button("Disconnect", role: .destructive) { TelegramBot.disconnect(); status = nil; version += 1 }
                }
                .buttonStyle(.borderless)
            }
            if let status { Text(status).font(.caption).foregroundStyle(.secondary) }
        }
    }
}
