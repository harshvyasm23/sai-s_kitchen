package me.saiskitchen.app

import android.content.Context
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDate
import java.time.format.TextStyle
import java.util.Locale

/** Sends the next day's menu through the Meta WhatsApp Business Cloud API (a pre-approved message template). */
object WaBusiness {
    private fun prefs(c: Context) = c.applicationContext.getSharedPreferences("sai_wa_business", Context.MODE_PRIVATE)
    fun phoneId(c: Context) = prefs(c).getString("phoneId", "") ?: ""
    fun token(c: Context) = prefs(c).getString("token", "") ?: ""
    fun template(c: Context) = prefs(c).getString("template", "daily_menu") ?: "daily_menu"
    fun lang(c: Context) = prefs(c).getString("lang", "en") ?: "en"
    fun isConfigured(c: Context) = phoneId(c).isNotBlank() && token(c).isNotBlank()
    fun save(c: Context, phoneId: String, token: String, template: String, lang: String) {
        prefs(c).edit().putString("phoneId", phoneId.trim()).putString("token", token.trim())
            .putString("template", template.trim().ifBlank { "daily_menu" }).putString("lang", lang.trim().ifBlank { "en" }).apply()
    }

    /** Template parameters may not contain line breaks or long runs of spaces. */
    private fun clean(s: String) = s.replace(Regex("\\s+"), " ").trim()

    fun dateLabel(d: LocalDate) = "${d.dayOfWeek.getDisplayName(TextStyle.FULL, Locale.UK)} ${d.dayOfMonth} ${d.month.getDisplayName(TextStyle.SHORT, Locale.UK)}"

    /** Plain text version, used for the normal WhatsApp fallback. */
    fun plainText(name: String, d: LocalDate, menu: String) =
        "Hello ${name.trim().split(" ").first()}, tomorrow's menu at Sai's Kitchen (${dateLabel(d)}):\n${clean(menu)}\n\n" +
            "Pure veg, homemade with love 🙏. Order or change: 0442355458"

    /** One message for everyone (broadcast list / channel / group). */
    fun groupText(d: LocalDate, menu: String) =
        "🙏 Jai Sai Nath 🙏\nTomorrow's menu at Sai's Kitchen (${dateLabel(d)}):\n${clean(menu)}\n\n" +
            "Pure veg, homemade with love.\nOrder or change by call/WhatsApp: 0442355458"

    /** Returns null on success, otherwise the error text from Meta. */
    fun send(c: Context, toPhone: String, firstName: String, d: LocalDate, menu: String): String? = try {
        val body = JSONObject()
            .put("messaging_product", "whatsapp").put("to", waNumber(toPhone)).put("type", "template")
            .put("template", JSONObject().put("name", template(c)).put("language", JSONObject().put("code", lang(c)))
                .put("components", JSONArray().put(JSONObject().put("type", "body").put("parameters", JSONArray(
                    listOf(clean(firstName), dateLabel(d), clean(menu)).map { JSONObject().put("type", "text").put("text", it) })))))
        val conn = URL("https://graph.facebook.com/v21.0/${phoneId(c)}/messages").openConnection() as HttpURLConnection
        conn.connectTimeout = 10_000; conn.readTimeout = 20_000
        conn.requestMethod = "POST"; conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        conn.setRequestProperty("Authorization", "Bearer ${token(c)}")
        conn.outputStream.use { it.write(body.toString().toByteArray()) }
        val ok = conn.responseCode in 200..299
        val text = (if (ok) conn.inputStream else conn.errorStream).bufferedReader().use { it.readText() }
        if (ok) null else runCatching { JSONObject(text).getJSONObject("error").optString("message") }.getOrDefault(text.take(200))
    } catch (e: Exception) { e.message ?: "Network error" }
}

@Composable
fun MenuBroadcastScreen(store: KitchenStore, onClose: () -> Unit) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val date = remember { LocalDate.now().plusDays(1) }
    val menuText = store.menu[date.dayOfWeek.value] ?: ""
    val planned = store.plannedFor(date)
    val expected = planned.filter { !it.skipped && !store.isHoliday(date) }.map { it.customer.id }.toSet()
    val people = store.customers.filter { it.isActive && it.phone.isNotBlank() }.sortedBy { it.name.lowercase() }
    var selected by remember { mutableStateOf(people.filter { it.id in expected }.map { it.id }.toSet()) }
    var showSetup by remember { mutableStateOf(!WaBusiness.isConfigured(context)) }
    var phoneId by remember { mutableStateOf(WaBusiness.phoneId(context)) }
    var token by remember { mutableStateOf(WaBusiness.token(context)) }
    var template by remember { mutableStateOf(WaBusiness.template(context)) }
    var lang by remember { mutableStateOf(WaBusiness.lang(context)) }
    var confirm by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    val results = remember { mutableStateMapOf<String, String>() }

    OverlayScaffold("Send Tomorrow's Menu", onClose) {
        AppCard {
            Text(WaBusiness.dateLabel(date), fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(menuText, fontWeight = FontWeight.SemiBold)
            TextButton(onClick = { onClose() }) { Text("Wrong menu? Go back, open Weekly menu") }
        }
        if (store.isHoliday(date)) Text("⚠ Tomorrow is marked as a holiday.", color = Brand.error)
        Button(onClick = {
            val send = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                type = "text/plain"; putExtra(android.content.Intent.EXTRA_TEXT, WaBusiness.groupText(date, menuText))
            }
            context.startActivity(android.content.Intent.createChooser(send, "Share menu").addFlags(android.content.Intent.FLAG_ACTIVITY_NEW_TASK))
        }, enabled = menuText.isNotBlank(), modifier = Modifier.fillMaxWidth()) { Text("Share menu (one message for everyone)") }
        Text("Choose WhatsApp, then your Broadcast list (or channel/group). Everyone gets it with one tap.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)

        AppCard {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Meta WhatsApp Business setup", fontWeight = FontWeight.Bold, modifier = Modifier.weight(1f))
                TextButton(onClick = { showSetup = !showSetup }) { Text(if (showSetup) "Hide" else if (WaBusiness.isConfigured(context)) "Edit ✓" else "Set up") }
            }
            if (showSetup) {
                Text("Sending from +358 44 235 5458 needs a Meta WhatsApp Business Cloud API account and one approved message template. " +
                    "Template body to create (category Utility): \"Hello {{1}}, tomorrow's menu at Sai's Kitchen ({{2}}): {{3}}. Pure veg, homemade with love. Order or change: 0442355458\"",
                    fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(6.dp))
                OutlinedTextField(phoneId, { phoneId = it }, label = { Text("Phone number ID") }, singleLine = true, modifier = Modifier.fillMaxWidth())
                OutlinedTextField(token, { token = it }, label = { Text("Access token (permanent)") }, singleLine = true, visualTransformation = PasswordVisualTransformation(), modifier = Modifier.fillMaxWidth())
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedTextField(template, { template = it }, label = { Text("Template name") }, singleLine = true, modifier = Modifier.weight(1f))
                    OutlinedTextField(lang, { lang = it }, label = { Text("Language") }, singleLine = true, modifier = Modifier.width(100.dp))
                }
                Button(onClick = { WaBusiness.save(context, phoneId, token, template, lang); showSetup = false }, modifier = Modifier.fillMaxWidth()) { Text("Save") }
            }
        }

        Text("Who gets it (${selected.size} selected)", fontWeight = FontWeight.Bold, fontSize = 17.sp)
        Text("Customers expected tomorrow are ticked. Customers without a phone number are not shown.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = { selected = people.map { it.id }.toSet() }) { Text("All") }
            OutlinedButton(onClick = { selected = people.filter { it.id in expected }.map { it.id }.toSet() }) { Text("Expected only") }
            OutlinedButton(onClick = { selected = emptySet() }) { Text("None") }
        }
        people.forEach { c ->
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Checkbox(checked = c.id in selected, onCheckedChange = { selected = if (c.id in selected) selected - c.id else selected + c.id })
                Column(Modifier.weight(1f)) {
                    Text(c.name); Text(c.phone, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                results[c.id]?.let { r -> Text(if (r == "ok") "✓ Sent" else "✗", color = if (r == "ok") Brand.success else Brand.error, fontWeight = FontWeight.Bold) }
            }
            results[c.id]?.takeIf { it != "ok" }?.let { Text(it, fontSize = 11.sp, color = Brand.error) }
        }
        Button(
            enabled = selected.isNotEmpty() && WaBusiness.isConfigured(context) && !busy && menuText.isNotBlank(),
            onClick = { confirm = true }, modifier = Modifier.fillMaxWidth(),
        ) { Text(if (busy) "Sending..." else "Send to ${selected.size} customers via Meta") }
        Text("No Meta account yet? Use the normal WhatsApp buttons below: one tap per customer, message is pre-written.", fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        people.filter { it.id in selected }.forEach { c ->
            OutlinedButton(onClick = { openWhatsApp(context, c.phone, WaBusiness.plainText(c.name, date, menuText)) }, modifier = Modifier.fillMaxWidth()) {
                Text("WhatsApp ${c.name}", maxLines = 1)
            }
        }
    }
    if (confirm) AlertDialog(
        onDismissRequest = { confirm = false },
        title = { Text("Send menu now?") },
        text = { Text("This sends the ${WaBusiness.dateLabel(date)} menu from your business number to ${selected.size} customers. Meta charges a small fee per message.") },
        confirmButton = {
            TextButton(onClick = {
                confirm = false; busy = true; results.clear()
                val targets = people.filter { it.id in selected }
                scope.launch {
                    for (c in targets) {
                        val err = withContext(Dispatchers.IO) { WaBusiness.send(context, c.phone, c.name, date, menuText) }
                        results[c.id] = err ?: "ok"
                    }
                    busy = false
                }
            }) { Text("Send") }
        },
        dismissButton = { TextButton(onClick = { confirm = false }) { Text("Cancel") } },
    )
}
