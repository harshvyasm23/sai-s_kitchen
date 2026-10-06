package me.saiskitchen.app

import android.content.Context
import android.content.Intent
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.graphics.pdf.PdfDocument
import androidx.core.content.FileProvider
import java.io.File
import java.time.LocalDate

data class OutstandingRow(val name: String, val phone: String, val tiffin: Double, val catering: Double) {
    val total get() = tiffin + catering
}

/** Multi-page A4 PDF of the monthly outstanding report. */
object ReportPdf {
    private const val W = 595
    private const val H = 842
    private const val MARGIN = 40f
    private const val ROW = 26f
    private val ORANGE = Color.rgb(255, 107, 53)
    private val TEXT = Color.rgb(45, 49, 66)
    private val MUTED = Color.rgb(107, 114, 128)
    private val LINE = Color.rgb(229, 231, 235)

    private fun paint(size: Float, color: Int = TEXT, bold: Boolean = false, align: Paint.Align = Paint.Align.LEFT) =
        Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textSize = size; this.color = color; textAlign = align
            typeface = if (bold) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
        }

    fun outstanding(context: Context, monthLabel: String, rows: List<OutstandingRow>, settings: AppSettings): File {
        val doc = PdfDocument()
        val cur = settings.currency
        var pageNo = 1
        var page = doc.startPage(PdfDocument.PageInfo.Builder(W, H, pageNo).create())
        var c: Canvas = page.canvas

        fun header(): Float {
            c.drawRect(0f, 0f, W.toFloat(), 90f, Paint().apply { color = ORANGE })
            c.drawText(settings.companyName, MARGIN, 40f, paint(22f, Color.WHITE, true))
            c.drawText("Outstanding Report - $monthLabel", MARGIN, 68f, paint(14f, Color.WHITE))
            val y = 125f
            c.drawText("Customer", MARGIN, y, paint(11f, MUTED, true))
            c.drawText("Tiffin", 330f, y, paint(11f, MUTED, true, Paint.Align.RIGHT))
            c.drawText("Catering", 420f, y, paint(11f, MUTED, true, Paint.Align.RIGHT))
            c.drawText("Total", W - MARGIN, y, paint(11f, MUTED, true, Paint.Align.RIGHT))
            c.drawLine(MARGIN, y + 8f, W - MARGIN, y + 8f, Paint().apply { color = LINE; strokeWidth = 1f })
            return y + 8f + ROW
        }

        var y = header()
        rows.forEach { r ->
            if (y > H - 90f) {
                doc.finishPage(page)
                pageNo++
                page = doc.startPage(PdfDocument.PageInfo.Builder(W, H, pageNo).create())
                c = page.canvas
                y = header()
            }
            c.drawText(r.name, MARGIN, y, paint(12f, TEXT, true))
            if (r.phone.isNotBlank()) c.drawText(r.phone, MARGIN, y + 12f, paint(9f, MUTED))
            c.drawText(Fmt.currency(r.tiffin, cur), 330f, y, paint(12f, align = Paint.Align.RIGHT))
            c.drawText(Fmt.currency(r.catering, cur), 420f, y, paint(12f, align = Paint.Align.RIGHT))
            c.drawText(Fmt.currency(r.total, cur), W - MARGIN, y, paint(12f, TEXT, true, Paint.Align.RIGHT))
            c.drawLine(MARGIN, y + 16f, W - MARGIN, y + 16f, Paint().apply { color = LINE; strokeWidth = 0.5f })
            y += ROW + 4f
        }
        if (rows.isEmpty()) c.drawText("No entries for this month.", MARGIN, y, paint(12f, MUTED))
        else {
            if (y > H - 70f) {
                doc.finishPage(page); pageNo++
                page = doc.startPage(PdfDocument.PageInfo.Builder(W, H, pageNo).create())
                c = page.canvas; y = header()
            }
            y += 6f
            c.drawText("Grand total (${rows.size} customers)", MARGIN, y, paint(13f, ORANGE, true))
            c.drawText(Fmt.currency(rows.sumOf { it.total }, cur), W - MARGIN, y, paint(14f, ORANGE, true, Paint.Align.RIGHT))
        }
        c.drawText("${settings.companyName} - ${settings.companyPhone} - generated ${LocalDate.now()}", MARGIN, H - 24f, paint(9f, MUTED))
        doc.finishPage(page)

        val dir = File(context.cacheDir, "invoices").apply { mkdirs() }
        val file = File(dir, "Outstanding_Report_${monthLabel.replace(" ", "_")}.pdf")
        file.outputStream().use { doc.writeTo(it) }
        doc.close()
        return file
    }

    fun share(context: Context, file: File) = InvoicePdf.share(context, file)
}
