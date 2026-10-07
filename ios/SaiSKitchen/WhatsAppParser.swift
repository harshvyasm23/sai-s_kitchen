import Foundation

/// Reads a WhatsApp-style daily message (see the Android twin WhatsAppParser.kt, same rules):
///   Date - 10.06.26 / daily tiffins / 1. Pranav 1 tiffin at pasila / Alacarte / Catering ...
struct ParsedTiffin {
    var raw: String
    var name: String
    var noon: Double
    var evening: Double
    var price: Double
    var delivery: Double
    var place: String?
    var warnings: [String]
    var placeKey: String? = nil
    var rawPlace: String? = nil
}

struct ParsedItem {
    var name: String
    var qty: Double
    var price: Double
}

struct ParsedOrder {
    var raw: String
    var name: String
    var kind: String
    var items: [ParsedItem]
    var delivery: Double
    var place: String?
    var warnings: [String]
}

struct ParsedMessage {
    var date: Date?
    var tiffins: [ParsedTiffin]
    var orders: [ParsedOrder]
    var warnings: [String]
}

enum WhatsAppParser {
    private static let NUM = #"\d+(?:[.,]\d+)?"#
    private static let TIF = #"t+i+f+[ie]+n+s?"#
    private static let UNIT = #"(?:kgs?|g|gm|grams?|pcs|pc|pieces?|plates?|boxes|box|litres?|ltr|l|nos)"#

    // MARK: regex helpers
    private static func first(_ pattern: String, _ s: String, ci: Bool = true) -> (g: [String], range: NSRange)? {
        guard let re = try? NSRegularExpression(pattern: pattern, options: ci ? [.caseInsensitive] : []) else { return nil }
        let ns = s as NSString
        guard let m = re.firstMatch(in: s, range: NSRange(location: 0, length: ns.length)) else { return nil }
        var groups: [String] = []
        for i in 0..<m.numberOfRanges {
            let r = m.range(at: i)
            groups.append(r.location == NSNotFound ? "" : ns.substring(with: r))
        }
        return (groups, m.range)
    }

    private static func all(_ pattern: String, _ s: String) -> [[String]] {
        guard let re = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { return [] }
        let ns = s as NSString
        return re.matches(in: s, range: NSRange(location: 0, length: ns.length)).map { m in
            (0..<m.numberOfRanges).map { i in
                let r = m.range(at: i)
                return r.location == NSNotFound ? "" : ns.substring(with: r)
            }
        }
    }

    private static func has(_ pattern: String, _ s: String) -> Bool { first(pattern, s) != nil }

    private static func replace(_ pattern: String, _ s: String, with t: String = " ") -> String {
        guard let re = try? NSRegularExpression(pattern: pattern, options: [.caseInsensitive]) else { return s }
        return re.stringByReplacingMatches(in: s, range: NSRange(location: 0, length: (s as NSString).length), withTemplate: t)
    }

    private static func cut(_ s: String, before r: NSRange) -> String { (s as NSString).substring(to: r.location) }
    private static func cut(_ s: String, after r: NSRange) -> String { (s as NSString).substring(from: r.location + r.length) }
    private static func from(_ s: String, at r: NSRange) -> String { (s as NSString).substring(from: r.location) }

    static func norm(_ s: String) -> String {
        s.lowercased().folding(options: .diacriticInsensitive, locale: Locale(identifier: "en"))
    }

    private static func num(_ s: String) -> Double { Double(s.replacingOccurrences(of: ",", with: ".")) ?? 0 }

    private static func tidy(_ s: String) -> String {
        replace(#"\s+"#, s).trimmingCharacters(in: CharacterSet(charactersIn: " -.,;:"))
    }

    private static func stripNumbering(_ s: String) -> String {
        replace(#"^\s*(?:\d+\s*[.):]|[-•*])\s*"#, s, with: "").trimmingCharacters(in: .whitespaces)
    }

    // MARK: places
    struct Place {
        let key: String
        let label: String
        let rate: Double   // charge PER TIFFIN
        let words: [String]
    }

    static let places: [Place] = [
        Place(key: "home", label: "Home / pickup", rate: 0, words: ["home", "ghar", "pickup", "pick", "self", "collect", "takeaway", "free", "nodelivery"]),
        Place(key: "omena", label: "Iso Omena", rate: 1.0, words: ["omena", "isoomena"]),
        Place(key: "pasila", label: "Pasila", rate: 0.5, words: ["pasila"]),
        Place(key: "lepp", label: "Leppävaara", rate: 0.5, words: ["leppavaara", "leppavara", "lepavara", "sello"]),
        Place(key: "myyr", label: "Myyrmanni", rate: 0.5, words: ["myyrmanni", "myyrmaki", "myrmanni"]),
        Place(key: "station", label: "Helsinki Railway Station", rate: 0.5, words: ["helsinki", "hki", "railway", "rautatie", "rautatieasema", "station", "stn", "asema"]),
    ]
    private static let placeTail: Set<String> = ["iso", "railway", "helsinki", "central", "at", "in"]

    static func placeByKey(_ key: String?) -> Place? { places.first { $0.key == key } }

    private static func wordMatch(_ tok: String, _ word: String) -> Bool {
        if tok == word { return true }
        if tok.count < 5 || word.count < 5 { return false }
        return lev(tok, word) <= (word.count >= 8 ? 2 : 1)
    }

    static func letterTokens(_ s: String) -> [String] {
        norm(s).components(separatedBy: CharacterSet(charactersIn: "abcdefghijklmnopqrstuvwxyz").inverted).filter { !$0.isEmpty }
    }

    /// Finds a delivery stop in free text, forgiving of spelling mistakes ("Lepavara", "passila").
    static func findPlace(_ text: String) -> Place? {
        let toks = letterTokens(text)
        for p in places where toks.contains(where: { t in p.words.contains { wordMatch(t, $0) } }) { return p }
        return nil
    }

    static func placeInfo(_ text: String) -> (label: String, delivery: Double, warning: String?) {
        if let p = findPlace(text) { return (p.label, p.rate, nil) }
        let t = text.trimmingCharacters(in: .whitespaces)
        return (t, 0.5, "Unknown place '\(t)' - used 0.50 delivery")
    }

    // MARK: date
    static func parseDate(_ text: String, monthFirst: Bool) -> Date? {
        guard let m = first(#"(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})"#, text) else { return nil }
        let a = Int(m.g[1]) ?? 0, b = Int(m.g[2]) ?? 0
        var y = Int(m.g[3]) ?? 0
        if y < 100 { y += 2000 }
        var d = monthFirst ? b : a
        var mo = monthFirst ? a : b
        if mo > 12 && d <= 12 { swap(&d, &mo) }
        var c = DateComponents(); c.year = y; c.month = mo; c.day = d
        let cal = Calendar(identifier: .gregorian)
        guard let date = cal.date(from: c), cal.dateComponents([.day, .month], from: date).day == d else { return nil }
        return date
    }

    // MARK: tiffin line
    static func parseTiffin(_ line: String, defaultPrice: Double) -> ParsedTiffin {
        let s = stripNumbering(line)
        var w: [String] = []
        let pm = first(#"(?:\bat\b|\bin\b|@|\bnear\b|\bfrom\b|\bto\b)\s*(.+)$"#, s)
        let place = pm.map { $0.g[1].trimmingCharacters(in: CharacterSet(charactersIn: " .,;")) }
        let body = pm.map { cut(s, before: $0.range) } ?? s
        let low = norm(body)
        let full = norm(s)
        var noon = 0.0, evening = 0.0
        // each number is used once, so "1 noon 1 evening" is not counted twice
        var rest = low
        func consume(_ pattern: String, _ add: (Double) -> Void) {
            while let m = first(pattern, rest) {
                add(num(m.g[1]))
                rest = (rest as NSString).replacingCharacters(in: m.range, with: String(repeating: " ", count: m.range.length))
            }
        }
        consume("(\(NUM))\\s*(?:\(TIF)\\s*)?(?:noon|lunch|morning)") { noon += $0 }
        consume("(\(NUM))\\s*(?:\(TIF)\\s*)?(?:evening|dinner|night)") { evening += $0 }
        consume("(?:noon|lunch|morning)\\s*[:=x]?\\s*(\(NUM))") { noon += $0 }
        consume("(?:evening|dinner|night)\\s*[:=x]?\\s*(\(NUM))") { evening += $0 }
        if noon + evening == 0 {
            var q = 1.0
            if let qm = first("(\(NUM))\\s*(?:x\\s*)?\(TIF)", low) ?? first("\(TIF)\\s*[:=x]\\s*(\(NUM))", low) { q = num(qm.g[1]) }
            if has("noon|lunch|morning", low) && !has("evening|dinner|night", low) { noon = q } else { evening = q }
        }
        var price = defaultPrice
        if let prm = first("(?:€\\s*(\(NUM))|(\(NUM))\\s*(?:€|eur\\w*)|price\\s*[:=]?\\s*(\(NUM)))", low) {
            let v = !prm.g[1].isEmpty ? prm.g[1] : (!prm.g[2].isEmpty ? prm.g[2] : prm.g[3])
            price = num(v)
        }
        var delivery = 0.0
        var label: String? = nil
        var placeKey: String? = nil
        var rate = 0.0
        let qty = noon + evening
        var rawPlace = place
        if let dm = first("delivery\\s*[:=]?\\s*(\(NUM))", full) { delivery = num(dm.g[1]) }
        var n = pm.map { cut(s, before: $0.range) } ?? s
        n = replace("(?:€\\s*\(NUM)|\(NUM)\\s*(?:€|eur\\w*)|price\\s*[:=]?\\s*\(NUM)|delivery\\s*[:=]?\\s*\(NUM))", n)
        n = replace("\(NUM)\\s*(?:x\\s*)?", n)
        n = replace("\\b(?:\(TIF)|noon|lunch|morning|evening|dinner|night|delivery|price)\\b|[:=@€+]", n)
        n = tidy(n)
        if place == nil {
            // no "at ...": a place typed straight after the name, e.g. "Pranav leppavara 1 tiffin"
            var toks = n.split(separator: " ").map(String.init)
            var popped: [String] = []
            while toks.count > 1, let last = toks.last, findPlace(last) != nil || placeTail.contains(norm(last)) {
                popped.insert(toks.removeLast(), at: 0)
            }
            if !popped.isEmpty, findPlace(popped.joined(separator: " ")) != nil {
                rawPlace = popped.joined(separator: " ")
                n = toks.joined(separator: " ")
            }
        }
        if let rp = rawPlace {
            if let hit = findPlace(rp) { label = hit.label; placeKey = hit.key; rate = hit.rate }
            else { label = rp.trimmingCharacters(in: .whitespaces); w.append("Unknown place '\(label ?? "")' - please choose") }
        } else {
            w.append("No place given - please choose")
        }
        delivery = delivery > 0 ? delivery : rate * qty
        if n.isEmpty { w.append("No name found") }
        return ParsedTiffin(raw: line, name: n, noon: noon, evening: evening, price: price, delivery: delivery, place: label, warnings: w, placeKey: placeKey, rawPlace: rawPlace)
    }

    // MARK: order items
    static func cleanNum(_ d: Double) -> String { d.truncatingRemainder(dividingBy: 1) == 0 ? String(Int(d)) : String(d) }

    static func parseItem(_ seg: String) -> (ParsedItem, [String])? {
        var s = seg.trimmingCharacters(in: .whitespaces)
        if s.isEmpty { return nil }
        let per = has("\\b(?:each|per|every)\\b|/\\s*\(UNIT)\\b|@", s)
        var price: Double? = nil
        var qty: Double? = nil
        var unit = ""
        if let m = first("€\\s*(\(NUM))|(\(NUM))\\s*(?:€|eur\\w*)", s) {
            price = num(!m.g[1].isEmpty ? m.g[1] : m.g[2])
            s = cut(s, before: m.range) + " " + cut(s, after: m.range)
        }
        if let m = first("(\(NUM))\\s*(\(UNIT))\\b", s) {
            qty = num(m.g[1]); unit = m.g[2].lowercased()
            s = cut(s, before: m.range) + " " + cut(s, after: m.range)
        }
        let nums = all(NUM, s).map { $0[0] }
        if !nums.isEmpty {
            if qty == nil && price == nil && nums.count >= 2 { qty = num(nums[0]); price = num(nums[1]) }
            else if qty == nil { qty = num(nums[0]) }
            else if price == nil { price = num(nums[0]) }
            s = replace(NUM, s)
        }
        s = replace("\\b(?:of|x|per|each|every|for|total|rs)\\b|[@/=]", s)
        var name = tidy(s)
        if let f = name.first { name = f.uppercased() + name.dropFirst() }
        var w: [String] = []
        if name.isEmpty { w.append("Item without a name"); name = "Item" }
        if price == nil { w.append("No price for \(name)"); price = 0 }
        let q = qty ?? 1
        let p = price ?? 0
        if per || (q == 1 && unit.isEmpty) {
            return (ParsedItem(name: unit.isEmpty ? name : "\(name) (\(unit))", qty: q, price: p), w)
        }
        let label = cleanNum(q) + (unit.isEmpty ? "" : " \(unit)")
        return (ParsedItem(name: "\(name) (\(label))", qty: 1, price: p), w)
    }

    static func parseOrder(_ line: String, kind: String) -> ParsedOrder {
        let s = stripNumbering(line)
        var name: String
        var rest: String
        if let sep = first(#"\s[-–—:]\s|:|\s[-–—]\s*"#, s) {
            name = cut(s, before: sep.range).trimmingCharacters(in: .whitespaces)
            rest = cut(s, after: sep.range)
        } else if let d = first(#"\d"#, s) {
            name = cut(s, before: d.range).trimmingCharacters(in: .whitespaces)
            rest = from(s, at: d.range)
        } else {
            name = s; rest = ""
        }
        var w: [String] = []
        var delivery = 0.0
        var label: String? = nil
        if let pm = first(#"(?:\bat\b|@)\s*([A-Za-zÄÖäö][^,;+]*)$"#, rest) {
            let info = placeInfo(pm.g[1])
            label = info.label; delivery = info.delivery
            rest = cut(rest, before: pm.range)
            if kind == "catering" {
                if delivery != 0 { w.append("Catering is self pickup - delivery ignored") }
                delivery = 0
            } else if let warn = info.warning { w.append(warn) }
        }
        if kind != "catering", let dm = first("delivery\\s*[:=]?\\s*(\(NUM))", rest) {
            delivery = num(dm.g[1])
            rest = cut(rest, before: dm.range) + cut(rest, after: dm.range)
        }
        var items: [ParsedItem] = []
        for seg in rest.components(separatedBy: CharacterSet(charactersIn: ",;+\n")) {
            if let r = parseItem(seg) { items.append(r.0); w.append(contentsOf: r.1) }
        }
        if name.isEmpty { w.append("No name found") }
        if items.isEmpty { w.append("No items found") }
        return ParsedOrder(raw: line, name: name.trimmingCharacters(in: CharacterSet(charactersIn: " -.,:")), kind: kind,
                           items: items, delivery: delivery, place: label, warnings: w)
    }

    // MARK: whole message
    static func parse(_ text: String, monthFirst: Bool, defaultPrice: Double) -> ParsedMessage {
        var date: Date? = nil
        var mode = "tiffin"
        var tiffins: [ParsedTiffin] = []
        var orders: [ParsedOrder] = []
        var warns: [String] = []
        for raw in text.components(separatedBy: .newlines) {
            let line = raw.trimmingCharacters(in: .whitespaces)
            if line.isEmpty { continue }
            let numbered = has(#"^\s*(?:\d+\s*[.):]|[-•*])"#, line)
            if has(#"^\W*date\b"#, line) || (date == nil && has(#"^\s*\d{1,2}[./\-]\d{1,2}[./\-]\d{2,4}\s*$"#, line)) {
                date = parseDate(line, monthFirst: monthFirst) ?? date
                continue
            }
            if !numbered && has(#"^\s*(?:daily\s+)?(?:tiffins?|catering|a\s*la\s*carte|alacarte|orders?|snacks?|extras?|special)\b[^0-9]*$"#, line) {
                let l = norm(line)
                mode = l.contains("tiffin") ? "tiffin" : (l.contains("catering") ? "catering" : "alacarte")
                continue
            }
            if mode == "tiffin" {
                let t = parseTiffin(line, defaultPrice: defaultPrice)
                if t.name.isEmpty { warns.append("Could not read: \(line)"); continue }
                tiffins.append(t)
            } else {
                let o = parseOrder(line, kind: mode)
                if o.name.isEmpty && o.items.isEmpty { warns.append("Could not read: \(line)"); continue }
                orders.append(o)
            }
        }
        if date == nil { warns.append("No date found - using today") }
        return ParsedMessage(date: date, tiffins: tiffins, orders: orders, warnings: warns)
    }

    // MARK: customer matching
    static func lev(_ a: String, _ b: String) -> Int {
        let a = Array(a), b = Array(b)
        var p = Array(0...b.count)
        if a.isEmpty { return b.count }
        for i in 1...a.count {
            var c = [i] + Array(repeating: 0, count: b.count)
            if b.isEmpty { return a.count }
            for j in 1...b.count {
                c[j] = min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] != b[j - 1] ? 1 : 0))
            }
            p = c
        }
        return p[b.count]
    }

    /// status: matched | ambiguous | new
    static func matchCustomer(_ name: String, in customers: [Customer]) -> (status: String, customer: Customer?) {
        let n = NameStd.core(name)
        if n.isEmpty { return ("new", nil) }
        if let ex = customers.first(where: { NameStd.core($0.name) == n }) { return ("matched", ex) }
        let firstWord = n.components(separatedBy: " ")[0]
        let fz = customers.filter {
            let c = NameStd.core($0.name)
            return c.hasPrefix(n) || n.hasPrefix(c) || c.components(separatedBy: " ")[0] == firstWord
        }
        if fz.count == 1 { return ("matched", fz[0]) }
        if fz.count > 1 { return ("ambiguous", fz[0]) }
        let lim = n.count <= 5 ? 1 : 2
        let near = customers.filter {
            let c = NameStd.core($0.name)
            return min(lev(n, c), lev(n, c.components(separatedBy: " ")[0])) <= lim
        }
        if near.count == 1 { return ("matched", near[0]) }
        return ("new", nil)
    }
}
