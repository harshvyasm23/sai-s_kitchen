import Foundation
import UIKit

struct InvoiceSummary {
    let customer: Customer
    let kind: InvoiceKind
    let startDate: Date
    let endDate: Date
    let tiffins: [TiffinEntry]
    let cateringOrders: [CateringOrder]
    let settings: AppSettings

    var tiffinTotal: Double { tiffins.reduce(0) { $0 + $1.total } }
    var cateringTotal: Double { cateringOrders.reduce(0) { $0 + $1.total } }
    var grandTotal: Double {
        switch kind {
        case .combined: return tiffinTotal + cateringTotal
        case .tiffin: return tiffinTotal
        case .catering: return cateringTotal
        }
    }
}

@MainActor
enum InvoicePDFGenerator {
    static func makePDF(summary: InvoiceSummary) throws -> URL {
        let pageRect = CGRect(x: 0, y: 0, width: 595, height: 842)
        let renderer = UIGraphicsPDFRenderer(bounds: pageRect)
        let fileName = "\(summary.customer.name.replacingOccurrences(of: " ", with: "_"))_Invoice_\(AppFormatters.isoDate(Date())).pdf"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)

        try renderer.writePDF(to: url) { context in
            context.beginPage()
            draw(summary: summary, pageRect: pageRect)
        }
        return url
    }

    private static func draw(summary: InvoiceSummary, pageRect: CGRect) {
        let orange = UIColor(red: 1.0, green: 0.42, blue: 0.21, alpha: 1)
        let text = UIColor(red: 0.17, green: 0.19, blue: 0.26, alpha: 1)
        let muted = UIColor(red: 0.42, green: 0.45, blue: 0.50, alpha: 1)
        let margin: CGFloat = 40
        var y: CGFloat = 42

        func drawText(_ string: String, x: CGFloat, y: CGFloat, width: CGFloat, font: UIFont, color: UIColor = text, alignment: NSTextAlignment = .left) {
            let paragraph = NSMutableParagraphStyle()
            paragraph.alignment = alignment
            let attrs: [NSAttributedString.Key: Any] = [.font: font, .foregroundColor: color, .paragraphStyle: paragraph]
            string.draw(in: CGRect(x: x, y: y, width: width, height: 40), withAttributes: attrs)
        }

        drawText(summary.settings.companyName, x: margin, y: y, width: 280, font: .boldSystemFont(ofSize: 28), color: orange)
        drawText("INVOICE", x: pageRect.width - margin - 180, y: y, width: 180, font: .boldSystemFont(ofSize: 26), color: text, alignment: .right)
        y += 34
        drawText(summary.settings.companyPhone, x: margin, y: y, width: 260, font: .systemFont(ofSize: 12), color: muted)
        drawText("Date: \(AppFormatters.displayDate(Date()))", x: pageRect.width - margin - 220, y: y, width: 220, font: .systemFont(ofSize: 12), color: muted, alignment: .right)
        y += 18
        drawText(summary.settings.companyAddress, x: margin, y: y, width: 360, font: .systemFont(ofSize: 12), color: muted)
        drawText("Period: \(AppFormatters.displayDate(summary.startDate)) - \(AppFormatters.displayDate(summary.endDate))", x: pageRect.width - margin - 260, y: y, width: 260, font: .systemFont(ofSize: 12), color: muted, alignment: .right)
        y += 35

        orange.setFill()
        UIBezierPath(rect: CGRect(x: margin, y: y, width: pageRect.width - (margin * 2), height: 3)).fill()
        y += 24

        UIColor(red: 0.98, green: 0.98, blue: 0.98, alpha: 1).setFill()
        UIBezierPath(roundedRect: CGRect(x: margin, y: y, width: pageRect.width - (margin * 2), height: 82), cornerRadius: 10).fill()
        drawText("Bill To", x: margin + 16, y: y + 12, width: 240, font: .boldSystemFont(ofSize: 14))
        drawText(summary.customer.name, x: margin + 16, y: y + 34, width: 260, font: .boldSystemFont(ofSize: 16))
        drawText(summary.customer.phone, x: margin + 16, y: y + 55, width: 260, font: .systemFont(ofSize: 12), color: muted)
        if !summary.customer.address.isEmpty {
            drawText(summary.customer.address, x: pageRect.width / 2, y: y + 34, width: 230, font: .systemFont(ofSize: 12), color: muted)
        }
        y += 108

        if summary.kind == .combined || summary.kind == .tiffin {
            y = drawSection(title: "Tiffin Services", lines: summary.tiffins.map { entry in
                "\(AppFormatters.displayDate(entry.date))  •  Noon \(entry.noonQty.clean), Evening \(entry.eveningQty.clean)  •  \(AppFormatters.currency(entry.total, code: summary.settings.currency))"
            }, y: y, margin: margin, width: pageRect.width - (margin * 2), accent: orange, text: text, muted: muted)
        }

        if summary.kind == .combined || summary.kind == .catering {
            let lines = summary.cateringOrders.flatMap { order in
                order.items.map { item in
                    "\(AppFormatters.displayDate(order.date))  •  \(item.itemName)  \(item.qty.clean) × \(AppFormatters.currency(item.unitPrice, code: summary.settings.currency))  •  \(AppFormatters.currency(item.total, code: summary.settings.currency))"
                } + (order.deliveryCharge > 0 ? ["Delivery charge  •  \(AppFormatters.currency(order.deliveryCharge, code: summary.settings.currency))"] : [])
            }
            y = drawSection(title: "Catering Services", lines: lines, y: y, margin: margin, width: pageRect.width - (margin * 2), accent: orange, text: text, muted: muted)
        }

        y += 12
        UIColor(red: 1.0, green: 0.42, blue: 0.21, alpha: 0.12).setFill()
        UIBezierPath(roundedRect: CGRect(x: margin, y: y, width: pageRect.width - (margin * 2), height: 58), cornerRadius: 10).fill()
        drawText("GRAND TOTAL", x: margin + 18, y: y + 16, width: 220, font: .boldSystemFont(ofSize: 18), color: text)
        drawText(AppFormatters.currency(summary.grandTotal, code: summary.settings.currency), x: pageRect.width - margin - 220, y: y + 14, width: 200, font: .boldSystemFont(ofSize: 22), color: orange, alignment: .right)
        y += 86

        drawText("Payment Details", x: margin, y: y, width: 220, font: .boldSystemFont(ofSize: 14), color: text)
        y += 20
        drawText("BIC: TRWIBEB1XXX  •  IBAN: BE40 9676 8333 5963", x: margin, y: y, width: pageRect.width - (margin * 2), font: .systemFont(ofSize: 12), color: muted)
        y += 22
        drawText("Thank you for your business! Payment is due within 7 days.", x: margin, y: y, width: pageRect.width - (margin * 2), font: .systemFont(ofSize: 12), color: muted)
    }

    private static func drawSection(title: String, lines: [String], y: CGFloat, margin: CGFloat, width: CGFloat, accent: UIColor, text: UIColor, muted: UIColor) -> CGFloat {
        var currentY = y
        func drawText(_ string: String, x: CGFloat, y: CGFloat, width: CGFloat, font: UIFont, color: UIColor) {
            string.draw(in: CGRect(x: x, y: y, width: width, height: 28), withAttributes: [.font: font, .foregroundColor: color])
        }
        guard !lines.isEmpty else { return currentY }
        drawText(title, x: margin, y: currentY, width: width, font: .boldSystemFont(ofSize: 17), color: text)
        currentY += 28
        accent.setFill()
        UIBezierPath(rect: CGRect(x: margin, y: currentY, width: width, height: 1.5)).fill()
        currentY += 12
        for line in lines.prefix(14) {
            drawText(line, x: margin, y: currentY, width: width, font: .systemFont(ofSize: 12), color: muted)
            currentY += 22
        }
        if lines.count > 14 {
            drawText("+ \(lines.count - 14) more line(s)", x: margin, y: currentY, width: width, font: .italicSystemFont(ofSize: 12), color: muted)
            currentY += 22
        }
        return currentY + 18
    }
}

private extension Double {
    var clean: String {
        truncatingRemainder(dividingBy: 1) == 0 ? String(Int(self)) : String(format: "%.2f", self)
    }
}
