import Foundation

enum AppFormatters {
    static let isoDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()

    static let displayDateFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_GB")
        formatter.dateStyle = .medium
        formatter.timeStyle = .none
        return formatter
    }()

    static func currency(_ amount: Double, code: String = "EUR") -> String {
        let formatter = NumberFormatter()
        formatter.numberStyle = .currency
        formatter.currencyCode = code
        formatter.minimumFractionDigits = 2
        formatter.maximumFractionDigits = 2
        formatter.locale = Locale(identifier: "en_GB")
        return formatter.string(from: NSNumber(value: amount)) ?? "€\(String(format: "%.2f", amount))"
    }

    static func isoDate(_ date: Date) -> String {
        isoDateFormatter.string(from: date)
    }

    static func displayDate(_ date: Date) -> String {
        displayDateFormatter.string(from: date)
    }

    static func startOfWeek(for date: Date = Date()) -> Date {
        let calendar = Calendar.current
        let weekday = calendar.component(.weekday, from: date)
        let daysFromMonday = weekday == 1 ? 6 : weekday - 2
        return calendar.date(byAdding: .day, value: -daysFromMonday, to: calendar.startOfDay(for: date)) ?? date
    }

    static func startOfMonth(for date: Date = Date()) -> Date {
        let components = Calendar.current.dateComponents([.year, .month], from: date)
        return Calendar.current.date(from: components) ?? date
    }

    static func endOfMonth(for date: Date = Date()) -> Date {
        let start = startOfMonth(for: date)
        return Calendar.current.date(byAdding: DateComponents(month: 1, day: -1), to: start) ?? date
    }

    static func isDate(_ date: Date, between start: Date, and end: Date) -> Bool {
        let calendar = Calendar.current
        let normalizedDate = calendar.startOfDay(for: date)
        let normalizedStart = calendar.startOfDay(for: start)
        let normalizedEnd = calendar.startOfDay(for: end)
        return normalizedDate >= normalizedStart && normalizedDate <= normalizedEnd
    }
}
