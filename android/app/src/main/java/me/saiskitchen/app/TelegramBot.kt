package me.saiskitchen.app

import android.content.Context
import androidx.work.*
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.util.concurrent.TimeUnit
import kotlin.math.abs

/**
 * Chat entry: you message your own Telegram bot, the phone fetches the message,
 * saves the entries and the bot replies. No server: the app talks to Telegram directly.
 */
object TelegramBot {
    private val lock = Mutex()
    private fun prefs(c: Context) = c.applicationContext.getSharedPreferences("sai_telegram", Context.MODE_PRIVATE)

    fun token(c: Context): String = prefs(c).getString("token", "") ?: ""
    fun chatId(c: Context): Long = prefs(c).getLong("chat", 0L)
    fun pairingCode(c: Context): String = prefs(c).getString("code", "") ?: ""
    fun isConfigured(c: Context) = token(c).isNotBlank()
    fun isConnected(c: Context) = isConfigured(c) && chatId(c) != 0L

    fun saveToken(c: Context, token: String) {
        val code = (1000..9999).random().toString()
        prefs(c).edit().putString("token", token.trim()).putLong("chat", 0L).putLong("offset", 0L)
            .putString("code", code).remove("batch").apply()
        schedule(c)
    }

    fun disconnect(c: Context) {
        prefs(c).edit().clear().apply()
        WorkManager.getInstance(c).cancelUniqueWork("telegram")
    }

    /** Checks Telegram every 15 minutes even when the app is closed (Android's minimum). */
    fun schedule(c: Context) {
        if (!isConfigured(c)) return
        val req = PeriodicWorkRequestBuilder<TelegramWorker>(15, TimeUnit.MINUTES)
            .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()).build()
        WorkManager.getInstance(c.applicationContext).enqueueUniquePeriodicWork("telegram", ExistingPeriodicWorkPolicy.KEEP, req)
    }

    private fun api(token: String, method: String, body: JSONObject? = null): JSONObject {
        val conn = URL("https://api.telegram.org/bot$token/$method").openConnection() as HttpURLConnection
        conn.connectTimeout = 10_000; conn.readTimeout = 20_000
        if (body != null) {
            conn.requestMethod = "POST"; conn.doOutput = true
            conn.setRequestProperty("Content-Type", "application/json")
            conn.outputStream.use { it.write(body.toString().toByteArray()) }
        }
        val stream = if (conn.responseCode in 200..299) conn.inputStream else conn.errorStream
        return JSONObject(stream.bufferedReader().use { it.readText() })
    }

    private fun send(token: String, chat: Long, text: String) {
        runCatching { api(token, "sendMessage", JSONObject().put("chat_id", chat).put("text", text)) }
    }

    private const val HELP = "Send your daily list like this:\n\nDate - 06.10.26\ndaily tiffins\n1. Pranav 1 tiffin at pasila\n2. Meena 2 tiffins at Iso Omena\n\nAlacarte\n1. Neha - 2 kg poha 12 euro, roti 20 pcs 0.5 each at Pasila\n\nCatering\n1. Rohit - chole chana 10 euro\n\nCommands: /undo removes the last message's entries, /help shows this."

    /** Fetch new messages, save them, reply. Returns a short status for the settings screen. */
    suspend fun poll(context: Context, store: KitchenStore): String {
        if (!lock.tryLock()) return "Already checking..."
        try {
            val p = prefs(context)
            val token = token(context)
            if (token.isBlank()) return "No bot token set."
            return withContext(Dispatchers.IO) {
                try {
                    val offset = p.getLong("offset", 0L)
                    val res = api(token, "getUpdates", JSONObject().put("offset", offset).put("timeout", 0)
                        .put("allowed_updates", org.json.JSONArray().put("message")))
                    if (!res.optBoolean("ok")) return@withContext "Telegram says: ${res.optString("description", "error")}"
                    val list = res.getJSONArray("result")
                    var handled = 0
                    for (i in 0 until list.length()) {
                        val u = list.getJSONObject(i)
                        val msg = u.optJSONObject("message")
                        if (msg != null && msg.has("text")) {
                            val chat = msg.getJSONObject("chat").getLong("id")
                            val reply = withContext(Dispatchers.Main) { handle(context, store, msg.getString("text"), chat, msg.optLong("date")) }
                            if (reply != null) { send(token, chat, reply); handled++ }
                        }
                        p.edit().putLong("offset", u.getLong("update_id") + 1).apply()
                    }
                    if (list.length() == 0) "No new messages." else "Processed $handled message(s)."
                } catch (e: Exception) {
                    "Could not reach Telegram (${e.message})."
                }
            }
        } finally { lock.unlock() }
    }

    private fun handle(context: Context, store: KitchenStore, text: String, chat: Long, sent: Long): String? {
        val p = prefs(context)
        val t = text.trim()
        val locked = chatId(context)
        if (locked == 0L) {
            val code = pairingCode(context)
            if (t.startsWith("/start") && code.isNotEmpty() && t.removePrefix("/start").trim() == code) {
                p.edit().putLong("chat", chat).remove("code").apply()
                return "Connected ✅ Sai's Kitchen app is linked to this chat.\n\n$HELP"
            }
            return "To connect, send: /start <the 4-digit code shown in the app's Settings>"
        }
        if (chat != locked) return null
        if (t.startsWith("/help") || t.startsWith("/start")) return HELP
        if (t.startsWith("/undo")) {
            val b = Batch.fromJson(p.getString("batch", null)) ?: return "Nothing to undo."
            p.edit().remove("batch").apply()
            return EntryWriter.undo(store, b)
        }
        val today = LocalDate.now()
        val dayFirst = WhatsAppParser.parse(t, false, store.settings.defaultTiffinPrice)
        if (dayFirst.tiffins.isEmpty() && dayFirst.orders.isEmpty()) return "I couldn't find any entries in that message.\n\n$HELP"
        var parsed = dayFirst
        var date = dayFirst.date
        var note = ""
        fun near(d: LocalDate?) = d != null && abs(d.toEpochDay() - today.toEpochDay()) <= 31
        if (!near(date)) {
            val monthFirst = WhatsAppParser.parse(t, true, store.settings.defaultTiffinPrice)
            if (near(monthFirst.date)) { parsed = monthFirst; date = monthFirst.date; note = "(date read as month.day)\n" }
        }
        if (date == null) { date = Instant.ofEpochSecond(if (sent > 0) sent else System.currentTimeMillis() / 1000).atZone(ZoneId.systemDefault()).toLocalDate(); note = "(no date in message, used $date)\n" }
        else if (!near(date)) return "The date $date is more than a month away from today, so I did not save anything. Please resend with the right date."
        val (summary, batch) = EntryWriter.apply(store, parsed, date!!)
        if (batch.tiffinIds.isNotEmpty() || batch.orderIds.isNotEmpty() || batch.customerIds.isNotEmpty()) p.edit().putString("batch", batch.toJson()).apply()
        return note + summary
    }
}

class TelegramWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        TelegramBot.poll(applicationContext, KitchenStore.get(applicationContext))
        return Result.success()
    }
}
