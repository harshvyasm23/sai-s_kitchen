package me.saiskitchen.app

import android.content.Context
import android.content.Intent
import android.graphics.*
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.FileProvider
import java.io.File

/** Draws the weekly tiffin menu as a shareable image in the Sai's Kitchen colours (cream, green, maroon, orange). */
object MenuPoster {
    private const val GREEN = 0xFF1F6B3A.toInt()
    private const val MAROON = 0xFF7B1E2B.toInt()
    private const val ORANGE = 0xFFE8761E.toInt()
    private const val CREAM = 0xFFFFF4DF.toInt()
    private const val INK = 0xFF2B2118.toInt()
    private val DAYS = listOf("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")

    fun render(menu: Map<Int, String>, price: Double): Bitmap {
        val w = 1080; val h = 1620
        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val c = Canvas(bmp)
        c.drawColor(CREAM)
        // faint pattern dots
        val dot = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0x14E8761E }
        for (x in 20 until w step 54) for (y in 20 until h step 54) c.drawCircle(x.toFloat(), y.toFloat(), 4f, dot)
        // header
        c.drawRect(0f, 0f, w.toFloat(), 250f, Paint().apply { color = GREEN })
        text(c, "|| Jai Siya Ram || Jai Sai Nath ||", w / 2f, 58f, 30f, 0xFFFFE9B8.toInt(), false, Paint.Align.CENTER)
        text(c, "Sai's Kitchen", w / 2f, 150f, 92f, Color.WHITE, true, Paint.Align.CENTER)
        text(c, "Taste That Feels Like Home", w / 2f, 205f, 34f, 0xFFFFE9B8.toInt(), false, Paint.Align.CENTER)
        c.drawRect(0f, 250f, w.toFloat(), 340f, Paint().apply { color = MAROON })
        text(c, "WEEKLY TIFFIN MENU  •  ${price.clean()}€ PER TIFFIN", w / 2f, 308f, 40f, Color.WHITE, true, Paint.Align.CENTER)
        // rows
        var y = 372f
        val tp = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { textSize = 34f; color = INK }
        for (d in 1..7) {
            val txt = menu[d] ?: ""
            val layout = StaticLayout.Builder.obtain(txt, 0, txt.length, tp, w - 80 - 250 - 30).setAlignment(Layout.Alignment.ALIGN_NORMAL).build()
            val rowH = maxOf(layout.height + 40f, 100f)
            val box = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE }
            c.drawRoundRect(40f, y, w - 40f, y + rowH, 22f, 22f, box)
            c.drawRoundRect(40f, y, 280f, y + rowH, 22f, 22f, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = if (d % 2 == 0) MAROON else GREEN })
            text(c, DAYS[d - 1], 160f, y + rowH / 2 + 12f, 34f, Color.WHITE, true, Paint.Align.CENTER)
            c.save(); c.translate(310f, y + (rowH - layout.height) / 2f); layout.draw(c); c.restore()
            y += rowH + 14f
        }
        // info
        y += 6f
        text(c, "Pure Veg  •  Fresh  •  Homemade  •  Healthy", w / 2f, y + 40f, 36f, MAROON, true, Paint.Align.CENTER)
        text(c, "Morning tiffin: book 24 hours ahead  •  Dinner: tell us before 10 AM", w / 2f, y + 90f, 28f, INK, false, Paint.Align.CENTER)
        text(c, "Occasional delivery: Iso Omena 1€  •  Sello, Myyrmanni, Helsinki Station 0.50€ (per tiffin)", w / 2f, y + 132f, 25f, INK, false, Paint.Align.CENTER)
        // footer
        val fy = h - 150f
        c.drawRect(0f, fy, w.toFloat(), h.toFloat(), Paint().apply { color = GREEN })
        text(c, "Call / WhatsApp: 0442355458", w / 2f, fy + 55f, 40f, Color.WHITE, true, Paint.Align.CENTER)
        text(c, "Instagram: jai.sainath11   •   saiskitchen.me", w / 2f, fy + 105f, 32f, 0xFFFFE9B8.toInt(), false, Paint.Align.CENTER)
        // border
        val b = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = 8f; color = ORANGE }
        c.drawRect(14f, 14f, w - 14f, h - 14f, b)
        return bmp
    }

    private fun text(c: Canvas, s: String, x: Float, y: Float, size: Float, color: Int, bold: Boolean, align: Paint.Align) {
        val p = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            textSize = size; this.color = color; textAlign = align
            typeface = if (bold) Typeface.DEFAULT_BOLD else Typeface.DEFAULT
        }
        // shrink to fit the width
        val max = 1000f
        while (p.measureText(s) > max && p.textSize > 14f) p.textSize -= 1f
        c.drawText(s, x, y, p)
    }

    fun share(context: Context, menu: Map<Int, String>, price: Double) {
        val dir = File(context.cacheDir, "exports").apply { mkdirs() }
        val file = File(dir, "Sais_Kitchen_Weekly_Menu.png")
        file.outputStream().use { render(menu, price).compress(Bitmap.CompressFormat.PNG, 100, it) }
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val send = Intent(Intent.ACTION_SEND).apply {
            type = "image/png"; putExtra(Intent.EXTRA_STREAM, uri)
            clipData = android.content.ClipData.newRawUri(file.name, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        val chooser = Intent.createChooser(send, "Share menu").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.packageManager.queryIntentActivities(send, 0).forEach {
            context.grantUriPermission(it.activityInfo.packageName, uri, Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        context.startActivity(chooser)
    }
}

@Composable
fun MenuScreen(store: KitchenStore, onClose: () -> Unit) {
    val context = LocalContext.current
    val texts = remember { mutableStateMapOf<Int, String>().apply { putAll(store.menu) } }
    var saved by remember { mutableStateOf(false) }
    OverlayScaffold("Weekly Menu & Poster", onClose) {
        Text("Edit the menu for each day. The Today's Kitchen screen shows it, and the poster is ready to share on WhatsApp / Instagram.",
            fontSize = 13.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        (1..7).forEach { d ->
            OutlinedTextField(
                value = texts[d].orEmpty(), onValueChange = { texts[d] = it; saved = false }, label = { Text(dayName(d)) },
                modifier = Modifier.fillMaxWidth(),
            )
        }
        Button(onClick = { store.setMenu(texts.toMap()); saved = true }, modifier = Modifier.fillMaxWidth()) { Text(if (saved) "Saved ✓" else "Save menu") }
        OutlinedButton(onClick = { store.setMenu(texts.toMap()); MenuPoster.share(context, texts.toMap(), store.settings.defaultTiffinPrice) }, modifier = Modifier.fillMaxWidth()) {
            Text("Share weekly menu poster (image)")
        }
        TextButton(onClick = { DefaultMenu.days.forEach { (k, v) -> texts[k] = v }; saved = false }, modifier = Modifier.fillMaxWidth()) { Text("Reset to standard menu") }
    }
}
