import UIKit

struct OutstandingRow {
    var name: String
    var phone: String
    var tiffin: Double
    var catering: Double
    var total: Double { tiffin + catering }
}

@MainActor
enum OutstandingPDF {
    static func make(monthLabel: String, rows: [OutstandingRow], settings: AppSettings) throws -> URL {
        let page = CGRect(x: 0, y: 0, width: 595, height: 842)
        let margin: CGFloat = 40
        let orange = UIColor(red: 1.0, green: 0.42, blue: 0.21, alpha: 1)
        let text = UIColor(red: 0.18, green: 0.19, blue: 0.26, alpha: 1)
        let muted = UIColor(red: 0.42, green: 0.45, blue: 0.5, alpha: 1)
        let line = UIColor(red: 0.9, green: 0.91, blue: 0.92, alpha: 1)
        let fileName = "Outstanding_Report_\(monthLabel.replacingOccurrences(of: " ", with: "_")).pdf"
        let url = FileManager.default.temporaryDirectory.appendingPathComponent(fileName)

        func draw(_ s: String, x: CGFloat, y: CGFloat, width: CGFloat, size: CGFloat, bold: Bool = false, color: UIColor, align: NSTextAlignment = .left) {
            let p = NSMutableParagraphStyle()
            p.alignment = align
            let attrs: [NSAttributedString.Key: Any] = [
                .font: bold ? UIFont.boldSystemFont(ofSize: size) : UIFont.systemFont(ofSize: size),
                .foregroundColor: color, .paragraphStyle: p,
            ]
            (s as NSString).draw(in: CGRect(x: x, y: y, width: width, height: size + 6), withAttributes: attrs)
        }

        func header(_ ctx: CGContext) -> CGFloat {
            orange.setFill()
            ctx.fill(CGRect(x: 0, y: 0, width: page.width, height: 90))
            draw(settings.companyName, x: margin, y: 22, width: 500, size: 22, bold: true, color: .white)
            draw("Outstanding Report - \(monthLabel)", x: margin, y: 54, width: 500, size: 14, color: .white)
            let y: CGFloat = 112
            draw("Customer", x: margin, y: y, width: 200, size: 11, bold: true, color: muted)
            draw("Tiffin", x: 230, y: y, width: 100, size: 11, bold: true, color: muted, align: .right)
            draw("Catering", x: 330, y: y, width: 90, size: 11, bold: true, color: muted, align: .right)
            draw("Total", x: 420, y: y, width: page.width - margin - 420, size: 11, bold: true, color: muted, align: .right)
            line.setFill()
            ctx.fill(CGRect(x: margin, y: y + 20, width: page.width - 2 * margin, height: 1))
            return y + 30
        }

        let renderer = UIGraphicsPDFRenderer(bounds: page)
        try renderer.writePDF(to: url) { context in
            context.beginPage()
            var y = header(context.cgContext)
            for r in rows {
                if y > page.height - 90 {
                    context.beginPage()
                    y = header(context.cgContext)
                }
                draw(r.name, x: margin, y: y, width: 190, size: 12, bold: true, color: text)
                if !r.phone.isEmpty { draw(r.phone, x: margin, y: y + 15, width: 190, size: 9, color: muted) }
                draw(AppFormatters.currency(r.tiffin, code: settings.currency), x: 230, y: y, width: 100, size: 12, color: text, align: .right)
                draw(AppFormatters.currency(r.catering, code: settings.currency), x: 330, y: y, width: 90, size: 12, color: text, align: .right)
                draw(AppFormatters.currency(r.total, code: settings.currency), x: 420, y: y, width: page.width - margin - 420, size: 12, bold: true, color: text, align: .right)
                line.setFill()
                context.cgContext.fill(CGRect(x: margin, y: y + 30, width: page.width - 2 * margin, height: 0.5))
                y += 38
            }
            if rows.isEmpty {
                draw("No entries for this month.", x: margin, y: y, width: 300, size: 12, color: muted)
            } else {
                if y > page.height - 70 {
                    context.beginPage()
                    y = header(context.cgContext)
                }
                y += 6
                draw("Grand total (\(rows.count) customers)", x: margin, y: y, width: 300, size: 13, bold: true, color: orange)
                draw(AppFormatters.currency(rows.reduce(0) { $0 + $1.total }, code: settings.currency), x: 380, y: y, width: page.width - margin - 380, size: 14, bold: true, color: orange, align: .right)
            }
            draw("\(settings.companyName) - \(settings.companyPhone) - generated \(AppFormatters.isoDate(Date()))", x: margin, y: page.height - 34, width: 500, size: 9, color: muted)
        }
        return url
    }
}
