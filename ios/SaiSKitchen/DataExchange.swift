import Foundation
import SwiftUI
import UIKit

/// Backup file format shared with the old Expo app and the Android app:
/// { "customers": [...], "tiffins": [...], "catering": [...], "exportDate": "..." }
/// Entry dates are "YYYY-MM-DD", timestamps are ISO-8601 strings, customers use "active".
struct ImportSummary {
    var customers = 0
    var tiffins = 0
    var orders = 0
    var skipped = 0

    var total: Int { customers + tiffins + orders }

    var message: String {
        if total == 0 {
            return skipped > 0 ? "Nothing new: all \(skipped) records are already in the app." : "No records found in that file."
        }
        var text = "Imported:\n"
        if customers > 0 { text += "• \(customers) customers\n" }
        if tiffins > 0 { text += "• \(tiffins) tiffin entries\n" }
        if orders > 0 { text += "• \(orders) catering orders\n" }
        if skipped > 0 { text += "(\(skipped) already existed and were skipped)" }
        return text
    }
}

struct ParsedBackup {
    var customers: [Customer]
    var tiffins: [TiffinEntry]
    var orders: [CateringOrder]
}

enum ExchangeError: LocalizedError {
    case invalidFile
    var errorDescription: String? { "This is not a Sai's Kitchen backup file." }
}

struct ExportFile: Identifiable {
    let id = UUID()
    let url: URL
}

enum DataExchange {
    private static let isoFractional: ISO8601DateFormatter = {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter
    }()
    private static let isoPlain = ISO8601DateFormatter()

    static func parseTimestamp(_ value: Any?) -> Date {
        guard let text = value as? String, !text.isEmpty else { return Date() }
        return isoFractional.date(from: text) ?? isoPlain.date(from: text) ?? Date()
    }

    static func timestamp(_ date: Date) -> String { isoFractional.string(from: date) }

    private static func parseDay(_ value: Any?) -> Date? {
        guard let text = value as? String, text.count >= 10 else { return nil }
        return AppFormatters.isoDateFormatter.date(from: String(text.prefix(10)))
    }

    private static func number(_ value: Any?) -> Double {
        if let d = value as? Double { return d }
        if let i = value as? Int { return Double(i) }
        if let s = value as? String { return Double(s.replacingOccurrences(of: ",", with: ".")) ?? 0 }
        return 0
    }

    /// kind: customers | tiffins | catering | all
    static func build(store: KitchenStore, kind: String) throws -> Data {
        var root: [String: Any] = [:]
        if kind == "customers" || kind == "all" {
            root["customers"] = store.customers.map { c -> [String: Any] in
                ["id": c.id, "name": c.name, "phone": c.phone, "address": c.address, "type": c.type.rawValue,
                 "createdAt": timestamp(c.createdAt), "updatedAt": timestamp(c.updatedAt), "active": c.isActive]
            }
        }
        if kind == "tiffins" || kind == "all" {
            root["tiffins"] = store.tiffins.map { t -> [String: Any] in
                ["id": t.id, "date": AppFormatters.isoDate(t.date), "customerId": t.customerId,
                 "noonQty": t.noonQty, "eveningQty": t.eveningQty, "unitPrice": t.unitPrice,
                 "deliveryCharge": t.deliveryCharge, "notes": t.notes,
                 "createdAt": timestamp(t.createdAt), "updatedAt": timestamp(t.updatedAt)]
            }
        }
        if kind == "catering" || kind == "all" {
            root["catering"] = store.cateringOrders.map { o -> [String: Any] in
                let items = o.items.map { i -> [String: Any] in
                    ["id": i.id, "cateringOrderId": o.id, "itemName": i.itemName, "qty": i.qty, "unitPrice": i.unitPrice, "note": i.note]
                }
                return ["id": o.id, "date": AppFormatters.isoDate(o.date), "customerId": o.customerId,
                        "deliveryCharge": o.deliveryCharge, "notes": o.notes, "items": items,
                        "createdAt": timestamp(o.createdAt), "updatedAt": timestamp(o.updatedAt)]
            }
        }
        root["exportDate"] = timestamp(Date())
        return try JSONSerialization.data(withJSONObject: root, options: [.prettyPrinted, .sortedKeys])
    }

    static func parse(_ data: Data) throws -> ParsedBackup {
        guard let root = try JSONSerialization.jsonObject(with: data) as? [String: Any] else { throw ExchangeError.invalidFile }
        func objects(_ key: String) -> [[String: Any]] { root[key] as? [[String: Any]] ?? [] }

        let customers: [Customer] = objects("customers").compactMap { o in
            guard let id = o["id"] as? String, let name = o["name"] as? String, !id.isEmpty, !name.isEmpty else { return nil }
            let type = CustomerType(rawValue: (o["type"] as? String) ?? "Regular") ?? .regular
            let active = (o["active"] as? Bool) ?? (o["isActive"] as? Bool) ?? true
            return Customer(id: id, name: name, phone: (o["phone"] as? String) ?? "", address: (o["address"] as? String) ?? "",
                            type: type, createdAt: parseTimestamp(o["createdAt"]), updatedAt: parseTimestamp(o["updatedAt"]), isActive: active)
        }

        let tiffins: [TiffinEntry] = objects("tiffins").compactMap { o in
            guard let id = o["id"] as? String, let customerId = o["customerId"] as? String,
                  !id.isEmpty, !customerId.isEmpty, let date = parseDay(o["date"]) else { return nil }
            let notes = (o["notes"] as? String) ?? (o["comment"] as? String) ?? ""
            return TiffinEntry(id: id, date: date, customerId: customerId, noonQty: number(o["noonQty"]), eveningQty: number(o["eveningQty"]),
                               unitPrice: number(o["unitPrice"]), deliveryCharge: number(o["deliveryCharge"]), notes: notes,
                               createdAt: parseTimestamp(o["createdAt"]), updatedAt: parseTimestamp(o["updatedAt"]))
        }

        let orders: [CateringOrder] = objects("catering").compactMap { o in
            guard let id = o["id"] as? String, let customerId = o["customerId"] as? String,
                  !id.isEmpty, !customerId.isEmpty, let date = parseDay(o["date"]) else { return nil }
            let rawItems = o["items"] as? [[String: Any]] ?? []
            let items: [CateringItem] = rawItems.map { i in
                CateringItem(id: (i["id"] as? String) ?? UUID().uuidString,
                             itemName: (i["itemName"] as? String) ?? (i["name"] as? String) ?? "",
                             qty: number(i["qty"]), unitPrice: number(i["unitPrice"]), note: (i["note"] as? String) ?? "")
            }
            guard !items.isEmpty else { return nil }
            let notes = (o["notes"] as? String) ?? (o["comment"] as? String) ?? ""
            return CateringOrder(id: id, date: date, customerId: customerId, deliveryCharge: number(o["deliveryCharge"]), notes: notes,
                                 items: items, createdAt: parseTimestamp(o["createdAt"]), updatedAt: parseTimestamp(o["updatedAt"]))
        }
        return ParsedBackup(customers: customers, tiffins: tiffins, orders: orders)
    }
}

struct ShareSheet: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [url], applicationActivities: nil)
    }
    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}

/// "Save to Files": lets the user pick a folder (On My iPhone, iCloud Drive...) for the PDF.
struct FileSaver: UIViewControllerRepresentable {
    let url: URL
    func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        UIDocumentPickerViewController(forExporting: [url], asCopy: true)
    }
    func updateUIViewController(_ controller: UIDocumentPickerViewController, context: Context) {}
}
