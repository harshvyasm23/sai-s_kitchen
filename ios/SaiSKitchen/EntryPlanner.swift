import Foundation

/// Turns a parsed message into a safe plan (twin of EntryPlanner.kt, which has the QA tests).
/// Whenever something is unclear it stops and produces ONE question with numbered options.
enum EntryPlanner {
    /// Answers given so far for one line. cust = customer id | "new" | "skip"; place = place key; dup = keep | replace; alt = re-typed name.
    struct Res {
        var cust: String? = nil
        var place: String? = nil
        var dup: String? = nil
        var alt: String? = nil
    }

    struct Option { let label: String; let value: String }
    struct Question { let key: String; let field: String; let title: String; let options: [Option] }

    struct Line {
        let key: String
        let kind: String
        let raw: String
        var customer: Customer?
        var newName: String?
        var tiffin: ParsedTiffin?
        var order: ParsedOrder?
        var placeLabel: String?
        var delivery: Double
        var status: String // save | skip
        var notes: [String]
        var replace: [TiffinEntry] = []
    }

    struct Plan { var lines: [Line]; var question: Question? }

    enum Kind { case exact, unique, typo, ambiguous, none }
    struct Match { let kind: Kind; let candidates: [Customer] }

    static func pretty(_ n: String) -> String {
        n.split(separator: " ").map { $0.prefix(1).uppercased() + $0.dropFirst() }.joined(separator: " ")
    }

    private static func toks(_ s: String) -> [String] {
        WhatsAppParser.norm(s).components(separatedBy: CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyz0123456789").inverted).filter { !$0.isEmpty }
    }

    /// Finds who a typed name probably means.
    static func match(_ name: String, _ customers: [Customer]) -> Match {
        let q = toks(name)
        if q.isEmpty { return Match(kind: .none, candidates: []) }
        let full = q.joined(separator: " ")
        let exact = customers.filter { toks($0.name).joined(separator: " ") == full }
        if exact.count == 1 { return Match(kind: .exact, candidates: exact) }
        if exact.count > 1 { return Match(kind: .ambiguous, candidates: exact) }
        // every typed word is a whole word of the customer's name, or the customer's whole name is inside what was typed
        let whole = customers.filter { c in
            let ct = toks(c.name)
            return !ct.isEmpty && (q.allSatisfy { ct.contains($0) } || ct.allSatisfy { q.contains($0) })
        }
        if whole.count == 1 { return Match(kind: .unique, candidates: whole) }
        if whole.count > 1 { return Match(kind: .ambiguous, candidates: whole) }
        // only the start of a word matches ("meena" -> "Meenakshi"): never guess, ask
        let starts = customers.filter { c in
            let ct = toks(c.name)
            return !ct.isEmpty && q.allSatisfy { w in ct.contains { $0.hasPrefix(w) } }
        }
        // spelling mistakes: compare word by word
        var scored: [(Int, Customer)] = []
        for c in customers {
            let ct = toks(c.name)
            var best = Int.max
            for w in q {
                for x in ct {
                    let lim = w.count >= 5 ? 2 : (w.count >= 4 ? 1 : 0)
                    let d = WhatsAppParser.lev(w, x)
                    if d <= lim && d < best { best = d }
                }
            }
            let whole = WhatsAppParser.lev(full, ct.joined(separator: " "))
            if whole <= (full.count >= 7 ? 2 : 1) { best = min(best, whole) }
            if best != Int.max { scored.append((best, c)) }
        }
        scored.sort { $0.0 < $1.0 }
        var all: [Customer] = []
        for c in starts + scored.map({ $0.1 }) where !all.contains(where: { $0.id == c.id }) { all.append(c) }
        return all.isEmpty ? Match(kind: .none, candidates: []) : Match(kind: .typo, candidates: Array(all.prefix(5)))
    }

    private static func custQuestion(_ key: String, _ typed: String, _ m: Match) -> Question {
        var opts = m.candidates.prefix(5).map { Option(label: $0.name + ($0.phone.isEmpty ? "" : " (\($0.phone))"), value: $0.id) }
        opts.append(Option(label: "New customer \"\(pretty(typed))\"", value: "new"))
        opts.append(Option(label: "Skip this line", value: "skip"))
        let title: String
        switch m.kind {
        case .ambiguous: title = "\"\(typed)\" matches more than one customer. Which one?"
        case .typo: title = "I can't find \"\(typed)\" exactly. Did you mean:"
        default: title = "I can't find \"\(typed)\" in your customers."
        }
        return Question(key: key, field: "cust", title: title, options: opts)
    }

    private static func placeQuestion(_ key: String, _ raw: String?) -> Question {
        let title = (raw ?? "").trimmingCharacters(in: .whitespaces).isEmpty ? "No delivery place given. Where does it go?" : "I don't know the place \"\(raw ?? "")\". Which one is it?"
        let ordered = WhatsAppParser.places.filter { $0.key != "home" } + WhatsAppParser.places.filter { $0.key == "home" }
        return Question(key: key, field: "place", title: title, options: ordered.map {
            Option(label: $0.label + ($0.rate > 0 ? " (€\(String(format: "%.2f", $0.rate)) per tiffin)" : " (no delivery)"), value: $0.key)
        })
    }

    static func plan(_ p: ParsedMessage, date: Date, customers: [Customer], existing: [TiffinEntry], res: [String: Res]) -> Plan {
        var lines: [Line] = []
        var seen: [String: String] = [:]
        let cal = Calendar.current
        for (i, t) in p.tiffins.enumerated() {
            let key = "t\(i)"
            let r = res[key] ?? Res()
            let typed = r.alt ?? t.name
            var notes: [String] = []
            var customer: Customer? = nil
            var newName: String? = nil
            switch r.cust {
            case "skip":
                lines.append(Line(key: key, kind: "tiffin", raw: t.raw, customer: nil, newName: nil, tiffin: t, order: nil, placeLabel: nil, delivery: 0, status: "skip", notes: ["skipped by you"]))
                continue
            case "new":
                newName = pretty(typed)
            case nil:
                let m = match(typed, customers)
                switch m.kind {
                case .exact: customer = m.candidates[0]
                case .unique: customer = m.candidates[0]; notes.append("\"\(t.name)\" matched to \(m.candidates[0].name)")
                default: return Plan(lines: lines, question: custQuestion(key, typed, m))
                }
            case .some(let id):
                guard let c = customers.first(where: { $0.id == id }) else { return Plan(lines: lines, question: custQuestion(key, typed, match(typed, customers))) }
                customer = c
            }
            guard let place = WhatsAppParser.placeByKey(r.place ?? t.placeKey) else {
                return Plan(lines: lines, question: placeQuestion(key, t.rawPlace))
            }
            let ident = customer?.id ?? ("new:" + WhatsAppParser.norm(newName ?? typed).trimmingCharacters(in: .whitespaces))
            let qty = t.noon + t.evening
            let delivery = r.place != nil ? place.rate * qty : t.delivery
            if let prev = seen[ident] {
                let who = customer?.name ?? newName ?? typed
                lines.append(Line(key: key, kind: "tiffin", raw: t.raw, customer: customer, newName: newName, tiffin: t, order: nil, placeLabel: place.label, delivery: 0, status: "skip",
                                  notes: ["\(who) is listed twice in this message (\(prev) and \(place.label)) - kept the first one"]))
                continue
            }
            var replace: [TiffinEntry] = []
            if let c = customer {
                let same = existing.filter { $0.customerId == c.id && cal.isDate($0.date, inSameDayAs: date) }
                if !same.isEmpty {
                    switch r.dup {
                    case "keep":
                        lines.append(Line(key: key, kind: "tiffin", raw: t.raw, customer: c, newName: nil, tiffin: t, order: nil, placeLabel: place.label, delivery: 0, status: "skip",
                                          notes: ["already has a tiffin on this date - kept the existing one"]))
                        continue
                    case "replace":
                        replace = same
                    default:
                        let e = same[0]
                        return Plan(lines: lines, question: Question(key: key, field: "dup",
                            title: "\(c.name) already has a tiffin on \(AppFormatters.displayDate(date)) (\(e.quantity.clean) tiffin, \(AppFormatters.currency(e.total, code: "EUR"))). What now?",
                            options: [Option(label: "Keep the existing one (skip this line)", value: "keep"), Option(label: "Replace it with this new entry", value: "replace")]))
                    }
                }
            }
            seen[ident] = place.label
            lines.append(Line(key: key, kind: "tiffin", raw: t.raw, customer: customer, newName: newName, tiffin: t, order: nil, placeLabel: place.label, delivery: delivery, status: "save", notes: notes, replace: replace))
        }
        for (i, o) in p.orders.enumerated() {
            let key = "o\(i)"
            let r = res[key] ?? Res()
            let typed = r.alt ?? o.name
            if o.items.isEmpty || o.warnings.contains(where: { $0.hasPrefix("No price") }) {
                let why = o.warnings.first(where: { $0.hasPrefix("No price") || $0.hasPrefix("No items") }) ?? "no items"
                lines.append(Line(key: key, kind: "order", raw: o.raw, customer: nil, newName: nil, tiffin: nil, order: o, placeLabel: nil, delivery: 0, status: "skip", notes: ["not saved - \(why)"]))
                continue
            }
            var notes: [String] = []
            var customer: Customer? = nil
            var newName: String? = nil
            switch r.cust {
            case "skip":
                lines.append(Line(key: key, kind: "order", raw: o.raw, customer: nil, newName: nil, tiffin: nil, order: o, placeLabel: nil, delivery: 0, status: "skip", notes: ["skipped by you"]))
                continue
            case "new":
                newName = pretty(typed)
            case nil:
                let m = match(typed, customers)
                switch m.kind {
                case .exact: customer = m.candidates[0]
                case .unique: customer = m.candidates[0]; notes.append("\"\(o.name)\" matched to \(m.candidates[0].name)")
                default: return Plan(lines: lines, question: custQuestion(key, typed, m))
                }
            case .some(let id):
                guard let c = customers.first(where: { $0.id == id }) else { return Plan(lines: lines, question: custQuestion(key, typed, match(typed, customers))) }
                customer = c
            }
            notes.append(contentsOf: o.warnings)
            lines.append(Line(key: key, kind: "order", raw: o.raw, customer: customer, newName: newName, tiffin: nil, order: o, placeLabel: o.place, delivery: o.delivery, status: "save", notes: notes))
        }
        return Plan(lines: lines, question: nil)
    }

    /// Applies the user's reply to a question. Returns the new answers, or an error text to send back.
    static func answer(_ q: Question, _ cur: Res, _ reply: String) -> (Res?, String?) {
        let text = reply.trimmingCharacters(in: .whitespacesAndNewlines)
        if let n = Int(text) {
            if n < 1 || n > q.options.count { return (nil, "Please reply with a number from 1 to \(q.options.count) (or /cancel).") }
            let v = q.options[n - 1].value
            var r = cur
            switch q.field { case "cust": r.cust = v; case "place": r.place = v; default: r.dup = v }
            return (r, nil)
        }
        var r = cur
        switch q.field {
        case "cust":
            r.alt = text; r.cust = nil
            return (r, nil)
        case "place":
            guard let hit = WhatsAppParser.findPlace(text) else { return (nil, "I don't know that place. Reply with a number from 1 to \(q.options.count).") }
            r.place = hit.key
            return (r, nil)
        default:
            let w = WhatsAppParser.norm(text)
            if w.hasPrefix("keep") { r.dup = "keep"; return (r, nil) }
            if w.hasPrefix("replace") { r.dup = "replace"; return (r, nil) }
            return (nil, "Please reply with a number from 1 to \(q.options.count) (or /cancel).")
        }
    }
}
