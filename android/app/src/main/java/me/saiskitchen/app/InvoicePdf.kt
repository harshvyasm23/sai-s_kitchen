package me.saiskitchen.app

import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import androidx.core.content.FileProvider
import java.io.File
import java.time.LocalDate

data class InvoiceSummary(
    val customer: Customer,
    val kind: InvoiceKind,
    val start: LocalDate,
    val end: LocalDate,
    val tiffins: List<TiffinEntry>,
    val orders: List<CateringOrder>,
    val settings: AppSettings,
) {
    val tiffinTotal get() = tiffins.sumOf { it.total }
    val cateringTotal get() = orders.sumOf { it.total }
    val grandTotal get() = when (kind) {
        InvoiceKind.Combined -> tiffinTotal + cateringTotal
        InvoiceKind.Tiffin -> tiffinTotal
        InvoiceKind.Catering -> cateringTotal
    }
}

object InvoicePdf {
    private const val W = 595
    private const val H = 842
    private const val MARGIN = 40f
    private val ORANGE = Color.rgb(255, 107, 53)
    private val TEXT = Color.rgb(45, 49, 66)
    private val MUTED = Color.rgb(107, 114, 128)

    fun make(context: Context, s: InvoiceSummary): File {
        val doc = PdfDocument()
        val page = doc.startPage(PdfDocument.PageInfo.Builder(W, H, 1).create())
        draw(page.canvas, s)
        doc.finishPage(page)
        val dir = File(context.cacheDir, "invoices").apply { mkdirs() }
        val name = "${s.customer.name.replace(" ", "_")}_Invoice_${LocalDate.now()}.pdf"
        val file = File(dir, name)
        file.outputStream().use { doc.writeTo(it) }
        doc.close()
        return file
    }

    fun share(context: Context, file: File) {
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val send = Intent(Intent.ACTION_SEND).apply {
            type = "application/pdf"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(Intent.createChooser(send, "Share invoice").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
    }

    private fun paint(size: Float, color: Int = TEXT, bold: Boolean = false, align: Paint.Align = Paint.Align.LEFT) =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textSize = size; this.color = color; textAlign = align
            typeface = if (bold) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
        }

    private fun fill(color: Int) = Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color }

    private fun draw(c: Canvas, s: InvoiceSummary) {
        val cur = s.settings.currency
        var y = 70f
        c.drawText(s.settings.companyName, MARGIN, y, paint(26f, ORANGE, true))
        c.drawText("INVOICE", W - MARGIN, y, paint(24f, TEXT, true, Paint.Align.RIGHT))
        y += 24f
        c.drawText(s.settings.companyPhone, MARGIN, y, paint(11f, MUTED))
        c.drawText("Date: ${Fmt.displayDate(LocalDate.now())}", W - MARGIN, y, paint(11f, MUTED, align = Paint.Align.RIGHT))
        y += 16f
        c.drawText(s.settings.companyAddress, MARGIN, y, paint(11f, MUTED))
        c.drawText("Period: ${Fmt.displayDate(s.start)} - ${Fmt.displayDate(s.end)}", W - MARGIN, y, paint(11f, MUTED, align = Paint.Align.RIGHT))
        y += 24f
        c.drawRect(MARGIN, y, W - MARGIN, y + 3f, fill(ORANGE))
        y += 22f

        c.drawRoundRect(RectF(MARGIN, y, W - MARGIN, y + 82f), 10f, 10f, fill(Color.rgb(250, 250, 250)))
        c.drawText("Bill To", MARGIN + 16f, y + 24f, paint(13f, bold = true))
        c.drawText(s.customer.name, MARGIN + 16f, y + 46f, paint(15f, bold = true))
        c.drawText(s.customer.phone, MARGIN + 16f, y + 66f, paint(11f, MUTED))
        if (s.customer.address.isNotEmpty()) c.drawText(s.customer.address, W / 2f, y + 46f, paint(11f, MUTED))
        y += 106f

        if (s.kind != InvoiceKind.Catering) {
            y = section(c, "Tiffin Services", s.tiffins.map {
                "${Fmt.displayDate(it.date)}  •  Noon ${it.noonQty.clean()}, Evening ${it.eveningQty.clean()}  •  ${Fmt.currency(it.total, cur)}"
            }, y)
        }
        if (s.kind != InvoiceKind.Tiffin) {
            val lines = s.orders.flatMap { o ->
                o.items.map { "${Fmt.displayDate(o.date)}  •  ${it.itemName}  ${it.qty.clean()} × ${Fmt.currency(it.unitPrice, cur)}  •  ${Fmt.currency(it.total, cur)}" } +
                    (if (o.deliveryCharge > 0) listOf("Delivery charge  •  ${Fmt.currency(o.deliveryCharge, cur)}") else emptyList())
            }
            y = section(c, "Catering Services", lines, y)
        }

        y += 8f
        c.drawRoundRect(RectF(MARGIN, y, W - MARGIN, y + 58f), 10f, 10f, fill(Color.argb(30, 255, 107, 53)))
        c.drawText("GRAND TOTAL", MARGIN + 18f, y + 36f, paint(17f, bold = true))
        c.drawText(Fmt.currency(s.grandTotal, cur), W - MARGIN - 18f, y + 37f, paint(21f, ORANGE, true, Paint.Align.RIGHT))
        y += 88f

        c.drawText("Payment Details", MARGIN, y, paint(13f, bold = true))
        y += 20f
        c.drawText("BIC: ${PaymentDetails.BIC}  •  IBAN: ${PaymentDetails.IBAN}", MARGIN, y, paint(11f, MUTED))
        y += 20f
        c.drawText("Thank you for your business! Payment is due within 7 days.", MARGIN, y, paint(11f, MUTED))
    }

    private fun section(c: Canvas, title: String, lines: List<String>, startY: Float): Float {
        if (lines.isEmpty()) return startY
        var y = startY
        c.drawText(title, MARGIN, y + 14f, paint(16f, bold = true))
        y += 26f
        c.drawRect(MARGIN, y, W - MARGIN, y + 1.5f, fill(ORANGE))
        y += 20f
        val p = paint(11f, MUTED)
        for (line in lines.take(14)) { c.drawText(line, MARGIN, y, p); y += 21f }
        if (lines.size > 14) { c.drawText("+ ${lines.size - 14} more line(s)", MARGIN, y, paint(11f, MUTED)); y += 21f }
        return y + 16f
    }
}

/** Same bank details as the iPhone app's invoice. Edit here if they change. */
object PaymentDetails {
    const val BIC = "TRWIBEB1XXX"
    const val IBAN = "BE40 9676 8333 5963"
}
