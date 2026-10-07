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

    private static let help = "Send your daily list like this:\n\nDate - 06.10.26\ndaily tiffins\n1. Pranav 1 tiffin at pasila\n2. Meena 2 tiffins at Iso Omena\n\nAlacarte\n1. Neha - 2 kg poha 12 euro, roti 20 pcs 0.5 each at Pasila\n\nCatering\n1. Rohit - chole chana 10 euro\n\nDelivery is charged per tiffin (Iso Omena 1 euro, Pasila/Leppavaara/Station/Myyrmanni 0.50, home 0). If I am unsure about a name or place I will ask you to pick a number.\n\nCommands: /undo removes the last message's entries, /cancel drops an unfinished list, /paid Name 40 records a payment, /outstanding shows who owes, /help shows this."

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
        if t.hasPrefix("/outstanding") {
            let cur = store.settings.currency
            let rows = store.outstandingRows(start: AppFormatters.startOfMonth(), end: AppFormatters.endOfMonth()).filter { $0.balance > 0.004 }
            if rows.isEmpty { return "Nobody owes anything \u{1F389}" }
            return "Outstanding this month: " + AppFormatters.currency(rows.reduce(0) { $0 + $1.balance }, code: cur) + "\n" +
                rows.sorted { $0.balance > $1.balance }.map { "\($0.name): \(AppFormatters.currency($0.balance, code: cur))" }.joined(separator: "\n")
        }
        if t.hasPrefix("/paid") {
            let parts = t.dropFirst(5).trimmingCharacters(in: .whitespaces)
            guard let range = parts.range(of: #"\s+([0-9]+(?:[.,][0-9]+)?)\s*(€|eur|euro)?\s*$"#, options: [.regularExpression, .caseInsensitive]) else {
                return "Use: /paid <name> <amount>   e.g. /paid Aroona 40"
            }
            let name = parts[parts.startIndex..<range.lowerBound].trimmingCharacters(in: .whitespaces)
            let amountText = parts[range].trimmingCharacters(in: .whitespaces).filter { "0123456789.,".contains($0) }.replacingOccurrences(of: ",", with: ".")
            guard !name.isEmpty, let amount = Double(amountText) else { return "Use: /paid <name> <amount>   e.g. /paid Aroona 40" }
            var hits = store.customers.filter { $0.name.caseInsensitiveCompare(name) == .orderedSame }
            if hits.isEmpty {
                hits = store.customers.filter { $0.name.localizedCaseInsensitiveContains(name) || ($0.name.split(separator: " ").first.map(String.init) ?? "").caseInsensitiveCompare(name) == .orderedSame }
            }
            if hits.isEmpty { return "No customer matches \"\(name)\"." }
            if hits.count > 1 { return "More than one match: " + hits.map(\.name).joined(separator: ", ") + ". Type the full name." }
            let c = hits[0]
            store.addPayment(Payment(customerId: c.id, amount: amount, note: "Telegram"))
            let bal = store.outstandingRows(start: AppFormatters.startOfMonth(), end: AppFormatters.endOfMonth()).first { $0.customerId == c.id }?.balance ?? 0
            let cur = store.settings.currency
            return "Recorded \(AppFormatters.currency(amount, code: cur)) from \(c.name) \u{2705}\nStill owes: \(AppFormatters.currency(max(bal, 0), code: cur))"
        }
        if t.hasPrefix("/cancel") {
            if d.string(forKey: "tg_pending_\(chat)") != nil { d.removeObject(forKey: "tg_pending_\(chat)"); return "Cancelled. Nothing was saved from that list." }
            return "Nothing to cancel."
        }
        let pend = Pending.load(d.string(forKey: "tg_pending_\(chat)"))
        let lower = t.lowercased()
        let looksLikeList = t.contains("\n") || lower.contains("tiffin") || lower.range(of: #"date\s*[-:]"#, options: .regularExpression) != nil
        if let pend, !looksLikeList { return answer(store: store, chat: chat, pend: pend, reply: t) }

        let cal = Calendar.current
        let today = cal.startOfDay(for: Date())
        func near(_ date: Date?) -> Bool {
            guard let date else { return false }
            return abs(cal.dateComponents([.day], from: today, to: cal.startOfDay(for: date)).day ?? 999) <= 31
        }
        let price = store.settings.defaultTiffinPrice
        let dayFirst = WhatsAppParser.parse(t, monthFirst: false, defaultPrice: price)
        if dayFirst.tiffins.isEmpty && dayFirst.orders.isEmpty {
            return Int(t) != nil ? "There is nothing waiting for an answer. Send your list." : "I couldn't find any entries in that message.\n\n" + help
        }
        var date = dayFirst.date
        var monthFirst = false
        var note = pend != nil ? "(The earlier unfinished list was dropped.)\n" : ""
        if !near(date) {
            let mf = WhatsAppParser.parse(t, monthFirst: true, defaultPrice: price)
            if near(mf.date) { date = mf.date; monthFirst = true; note += "(date read as month.day)\n" }
        }
        if date == nil {
            date = sent > 0 ? Date(timeIntervalSince1970: sent) : Date()
            note += "(no date in message, used today's)\n"
        } else if !near(date) {
            return "The date \(AppFormatters.isoDate(date!)) is more than a month away from today, so I did not save anything. Please resend with the right date."
        }
        return note + advance(store: store, chat: chat, pend: Pending(text: t, monthFirst: monthFirst, date: date!, res: [:], at: Date().timeIntervalSince1970))
    }

    /// Re-plans the list; asks the next question, or saves when everything is clear.
    private static func advance(store: KitchenStore, chat: Int64, pend: Pending) -> String {
        let parsed = WhatsAppParser.parse(pend.text, monthFirst: pend.monthFirst, defaultPrice: store.settings.defaultTiffinPrice)
        let plan = EntryPlanner.plan(parsed, date: pend.date, customers: store.customers, existing: store.tiffins, res: pend.res)
        if let q = plan.question {
            d.set(pend.json, forKey: "tg_pending_\(chat)")
            let idx = Int(q.key.dropFirst()) ?? -1
            let raw = q.key.hasPrefix("t") ? (parsed.tiffins.indices.contains(idx) ? parsed.tiffins[idx].raw : "") : (parsed.orders.indices.contains(idx) ? parsed.orders[idx].raw : "")
            let hint = q.field == "cust" ? "Reply with a number, or type the correct name." : (q.field == "place" ? "Reply with a number, or type the place." : "Reply with a number.")
            return "Nothing saved yet - one question:\n\n\u{00BB} \(raw)\n\(q.title)\n"
                + q.options.enumerated().map { "\($0.offset + 1). \($0.element.label)" }.joined(separator: "\n") + "\n\n\(hint) (/cancel to stop)"
        }
        d.removeObject(forKey: "tg_pending_\(chat)")
        let (summary, batch) = EntryWriter.applyPlan(store: store, plan: plan, date: pend.date)
        if !batch.tiffinIds.isEmpty || !batch.orderIds.isEmpty || !batch.customerIds.isEmpty { d.set(batch.json, forKey: "tg_batch_\(chat)") }
        return summary
    }

    private static func answer(store: KitchenStore, chat: Int64, pend: Pending, reply: String) -> String {
        var pend = pend
        let parsed = WhatsAppParser.parse(pend.text, monthFirst: pend.monthFirst, defaultPrice: store.settings.defaultTiffinPrice)
        guard let q = EntryPlanner.plan(parsed, date: pend.date, customers: store.customers, existing: store.tiffins, res: pend.res).question else {
            return advance(store: store, chat: chat, pend: pend)
        }
        let (res, err) = EntryPlanner.answer(q, pend.res[q.key] ?? EntryPlanner.Res(), reply)
        guard let res else { return err ?? "Please reply with a number." }
        pend.res[q.key] = res
        return advance(store: store, chat: chat, pend: pend)
    }
}

/// A list that is waiting for answers to questions.
struct Pending {
    var text: String
    var monthFirst: Bool
    var date: Date
    var res: [String: EntryPlanner.Res]
    var at: Double

    var json: String {
        var r: [String: Any] = [:]
        for (k, v) in res {
            r[k] = ["c": v.cust ?? NSNull(), "p": v.place ?? NSNull(), "d": v.dup ?? NSNull(), "a": v.alt ?? NSNull()] as [String: Any]
        }
        let o: [String: Any] = ["text": text, "mf": monthFirst, "date": date.timeIntervalSince1970, "at": at, "res": r]
        return (try? JSONSerialization.data(withJSONObject: o)).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
    }

    static func load(_ s: String?) -> Pending? {
        guard let s, let data = s.data(using: .utf8), let o = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let text = o["text"] as? String, let mf = o["mf"] as? Bool, let date = o["date"] as? Double, let at = o["at"] as? Double else { return nil }
        if Date().timeIntervalSince1970 - at > 12 * 3600 { return nil }
        var res: [String: EntryPlanner.Res] = [:]
        for (k, v) in (o["res"] as? [String: Any] ?? [:]) {
            guard let m = v as? [String: Any] else { continue }
            res[k] = EntryPlanner.Res(cust: m["c"] as? String, place: m["p"] as? String, dup: m["d"] as? String, alt: m["a"] as? String)
        }
        return Pending(text: text, monthFirst: mf, date: Date(timeIntervalSince1970: date), res: res, at: at)
    }
}

struct EntryBatch {
    var tiffinIds: [String]
    var orderIds: [String]
    var customerIds: [String]
    var replaced: [TiffinEntry] = []

    var json: String {
        let rep = replaced.map { ["id": $0.id, "date": $0.date.timeIntervalSince1970, "cust": $0.customerId, "n": $0.noonQty, "e": $0.eveningQty, "p": $0.unitPrice, "d": $0.deliveryCharge, "notes": $0.notes] as [String: Any] }
        let o: [String: Any] = ["t": tiffinIds, "o": orderIds, "c": customerIds, "r": rep]
        return (try? JSONSerialization.data(withJSONObject: o)).flatMap { String(data: $0, encoding: .utf8) } ?? "{}"
    }

    static func from(_ s: String) -> EntryBatch? {
        guard let data = s.data(using: .utf8), let o = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else { return nil }
        let rep: [TiffinEntry] = (o["r"] as? [[String: Any]] ?? []).compactMap { r in
            guard let id = r["id"] as? String, let date = r["date"] as? Double, let cust = r["cust"] as? String else { return nil }
            return TiffinEntry(id: id, date: Date(timeIntervalSince1970: date), customerId: cust, noonQty: r["n"] as? Double ?? 0, eveningQty: r["e"] as? Double ?? 0,
                               unitPrice: r["p"] as? Double ?? 0, deliveryCharge: r["d"] as? Double ?? 0, notes: r["notes"] as? String ?? "")
        }
        return EntryBatch(tiffinIds: o["t"] as? [String] ?? [], orderIds: o["o"] as? [String] ?? [], customerIds: o["c"] as? [String] ?? [], replaced: rep)
    }
}

@MainActor
enum EntryWriter {
    static func applyPlan(store: KitchenStore, plan: EntryPlanner.Plan, date: Date) -> (String, EntryBatch) {
        let cur = store.settings.currency
        var created: [String: Customer] = [:]
        var lines: [String] = []
        var tIds: [String] = []
        var oIds: [String] = []
        var replaced: [TiffinEntry] = []
        var total = 0.0

        func customerFor(_ l: EntryPlanner.Line) -> (Customer, Bool) {
            if let c = l.customer { return (c, false) }
            let name = l.newName ?? "Customer"
            let key = WhatsAppParser.norm(name).trimmingCharacters(in: .whitespaces)
            if let c = created[key] { return (c, false) }
            if let c = store.customers.first(where: { WhatsAppParser.norm($0.name).trimmingCharacters(in: .whitespaces) == key }) { return (c, false) }
            let c = Customer(name: name, phone: "")
            store.addCustomer(c)
            created[key] = c
            return (c, true)
        }

        for l in plan.lines {
            if l.status != "save" {
                lines.append("↷ " + (l.customer?.name ?? l.tiffin?.name ?? l.order?.name ?? l.raw) + ": " + l.notes.joined(separator: "; "))
                continue
            }
            let (c, isNew) = customerFor(l)
            var extra = l.notes
            if isNew { extra.append("new customer - add phone in Customers") }
            if l.kind == "tiffin", let t = l.tiffin {
                for old in l.replace { store.deleteTiffin(old); replaced.append(old) }
                let e = TiffinEntry(date: date, customerId: c.id, noonQty: t.noon, eveningQty: t.evening, unitPrice: t.price,
                                    deliveryCharge: l.delivery, notes: "Telegram • \(l.placeLabel ?? "")")
                store.addMultipleTiffins([e])
                tIds.append(e.id)
                total += e.total
                let q = t.noon + t.evening
                if !l.replace.isEmpty { extra.append("replaced the earlier entry") }
                let delivery = l.delivery > 0 ? " + \(AppFormatters.currency(l.delivery, code: cur)) delivery" : ", no delivery"
                lines.append("✓ \(c.name): \(q.clean) tiffin, \(l.placeLabel ?? "") (\(AppFormatters.currency(q * t.price, code: cur))\(delivery)) = \(AppFormatters.currency(e.total, code: cur))"
                             + (extra.isEmpty ? "" : "\n   ⚠ " + extra.joined(separator: "; ")))
            } else if let o = l.order {
                let order = CateringOrder(date: date, customerId: c.id, deliveryCharge: l.delivery,
                                          notes: (o.kind == "catering" ? "Catering" : "À la carte") + (o.place.map { " • \($0)" } ?? ""),
                                          items: o.items.map { CateringItem(itemName: $0.name, qty: $0.qty, unitPrice: $0.price) })
                store.addCateringOrders([order])
                oIds.append(order.id)
                total += order.total
                lines.append("✓ \(c.name) - \(o.kind == "catering" ? "catering" : "à la carte"): " + o.items.map { $0.name }.joined(separator: ", ")
                             + " = " + AppFormatters.currency(order.total, code: cur) + (extra.isEmpty ? "" : "\n   ⚠ " + extra.joined(separator: "; ")))
            }
        }
        let saved = tIds.count + oIds.count
        let head = saved == 0 ? "Nothing saved." : "Saved \(saved) for \(AppFormatters.displayDate(date)) - total \(AppFormatters.currency(total, code: cur)):"
        let tail = saved == 0 ? "" : "\n\nSend /undo to remove this whole batch."
        return ("\(head)\n" + lines.joined(separator: "\n") + tail,
                EntryBatch(tiffinIds: tIds, orderIds: oIds, customerIds: created.values.map { $0.id }, replaced: replaced))
    }

    static func undo(store: KitchenStore, batch b: EntryBatch) -> String {
        for id in b.tiffinIds { if let e = store.tiffins.first(where: { $0.id == id }) { store.deleteTiffin(e) } }
        for id in b.orderIds { if let o = store.cateringOrders.first(where: { $0.id == id }) { store.deleteCateringOrder(o) } }
        if !b.replaced.isEmpty { store.addMultipleTiffins(b.replaced) }
        for id in b.customerIds {
            let used = store.tiffins.contains { $0.customerId == id } || store.cateringOrders.contains { $0.customerId == id }
            if !used, let c = store.customers.first(where: { $0.id == id }) { store.deleteCustomer(c) }
        }
        return "Removed \(b.tiffinIds.count) tiffin entries and \(b.orderIds.count) orders from the last message."
            + (b.replaced.isEmpty ? "" : " Put back \(b.replaced.count) earlier entries.")
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
