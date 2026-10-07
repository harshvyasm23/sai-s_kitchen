import Foundation

/// Old backups contain hand-typed dates such as "2026–01-30" (long dash), "19-12-2025", "2026-0924", "2025-09" or "2026-03-22-".
/// Instead of silently losing those entries we repair them and tell the user (twin of DateRepair.kt, tested there).
enum DateRepair {
    struct Result { let date: Date; let note: String? }

    private static var cal: Calendar { Calendar.current }

    private static func make(_ y: Int, _ m: Int, _ d: Int) -> Date? {
        var c = DateComponents(); c.year = y; c.month = m; c.day = d
        guard let date = cal.date(from: c), cal.component(.day, from: date) == d, cal.component(.month, from: date) == m else { return nil }
        return date
    }

    private static func match(_ pattern: String, _ s: String) -> [Int]? {
        guard let re = try? NSRegularExpression(pattern: pattern), let m = re.firstMatch(in: s, range: NSRange(location: 0, length: (s as NSString).length)) else { return nil }
        return (1..<m.numberOfRanges).compactMap { Int((s as NSString).substring(with: m.range(at: $0))) }
    }

    static func parse(_ raw: String, createdAt: Date?) -> Result? {
        let clean = raw.trimmingCharacters(in: .whitespaces)
        if clean.range(of: #"^\d{4}-\d{2}-\d{2}"#, options: .regularExpression) != nil {
            if let y = Int(clean.prefix(4)), let m = Int(clean.dropFirst(5).prefix(2)), let d = Int(clean.dropFirst(8).prefix(2)), let date = make(y, m, d) { return Result(date: date, note: nil) }
            return nil
        }
        var s = clean
        for ch in ["\u{2010}", "\u{2011}", "\u{2012}", "\u{2013}", "\u{2014}", "\u{2015}", "\u{2212}", "/", "."] { s = s.replacingOccurrences(of: ch, with: "-") }
        s = s.trimmingCharacters(in: CharacterSet(charactersIn: "- "))
        let created: Date? = createdAt.map { cal.startOfDay(for: $0) }
        func repaired(_ d: Date?) -> Result? {
            guard let d else { return nil }
            if let created {
                let after = cal.date(byAdding: .day, value: 1, to: created)!
                let before = cal.date(byAdding: .day, value: -62, to: created)!
                if d > after || d < before { return Result(date: created, note: "date \"\(raw)\" was unclear - used the day it was entered (\(AppFormatters.isoDate(created)))") }
            }
            return Result(date: d, note: "date \"\(raw)\" read as \(AppFormatters.isoDate(d))")
        }
        if let g = match(#"^(\d{4})-(\d{1,2})-(\d{1,2})$"#, s) { return repaired(make(g[0], g[1], g[2])) }
        if let g = match(#"^(\d{4})-(\d{2})(\d{2})$"#, s) { return repaired(make(g[0], g[1], g[2])) }
        if let g = match(#"^(\d{1,2})-(\d{1,2})-(\d{4})$"#, s) { return repaired(make(g[2], g[1], g[0])) }
        if let g = match(#"^(\d{4})-(\d{1,2})$"#, s), let first = make(g[0], g[1], 1) {
            var day = first
            if let created, cal.component(.year, from: created) == g[0], cal.component(.month, from: created) == g[1] { day = created }
            return Result(date: day, note: "date \"\(raw)\" had no day - used \(AppFormatters.isoDate(day)), please check")
        }
        return nil
    }
}
