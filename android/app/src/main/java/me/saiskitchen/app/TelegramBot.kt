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
    fun chats(c: Context): Set<Long> =
        (prefs(c).getString("chats", "") ?: "").split(",").mapNotNull { it.trim().toLongOrNull() }.toSet()
    fun pairingCode(c: Context): String = prefs(c).getString("code", "") ?: ""
    fun isConfigured(c: Context) = token(c).isNotBlank()
    fun isConnected(c: Context) = isConfigured(c) && chats(c).isNotEmpty()

    /** New pairing code so another person/chat can be added. */
    fun newCode(c: Context): String {
        val code = (1000..9999).random().toString()
        prefs(c).edit().putString("code", code).apply()
        return code
    }

    fun saveToken(c: Context, token: String) {
        val code = (1000..9999).random().toString()
        prefs(c).edit().putString("token", token.trim()).putString("chats", "").putLong("offset", 0L)
            .putString("code", code).apply()
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

    private const val HELP = "Send your daily list like this:\n\nDate - 06.10.26\ndaily tiffins\n1. Pranav 1 tiffin at pasila\n2. Meena 2 tiffins at Iso Omena\n\nAlacarte\n1. Neha - 2 kg poha 12 euro, roti 20 pcs 0.5 each at Pasila\n\nCatering\n1. Rohit - chole chana 10 euro\n\nDelivery is charged per tiffin (Iso Omena 1 euro, Pasila/Leppavaara/Station/Myyrmanni 0.50, home 0). If I am unsure about a name or place I will ask you to pick a number.\n\nCommands: /undo removes the last message's entries, /cancel drops an unfinished list, /paid Name 40 records a payment, /outstanding shows who owes, /help shows this."

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
        val known = chats(context)
        if (chat !in known) {
            val code = pairingCode(context)
            if (code.isEmpty()) return null
            if (t.startsWith("/start") && t.removePrefix("/start").trim() == code) {
                p.edit().putString("chats", (known + chat).joinToString(",")).remove("code").apply()
                return "Connected ✅ This chat can now send entries to the Sai's Kitchen app.\n\n$HELP"
            }
            return "To connect, send: /start <the 4-digit code shown in the app's Settings>"
        }
        if (t.startsWith("/help") || t.startsWith("/start")) return HELP
        if (t.startsWith("/undo")) {
            val b = Batch.fromJson(p.getString("batch_$chat", null)) ?: return "Nothing to undo."
            p.edit().remove("batch_$chat").apply()
            return EntryWriter.undo(store, b)
        }
        if (t.startsWith("/outstanding")) {
            val rows = store.outstandingRows(Fmt.startOfMonth(), Fmt.endOfMonth()).filter { it.balance > 0.004 }
            if (rows.isEmpty()) return "Nobody owes anything 🎉"
            return "Outstanding this month: " + Fmt.currency(rows.sumOf { it.balance }, store.settings.currency) + "\n" +
                rows.sortedByDescending { it.balance }.joinToString("\n") { "${it.name}: ${Fmt.currency(it.balance, store.settings.currency)}" }
        }
        if (t.startsWith("/paid")) {
            val m = Regex("""^/paid\s+(.+?)\s+([0-9]+(?:[.,][0-9]+)?)\s*(?:€|eur|euro)?\s*$""", RegexOption.IGNORE_CASE).find(t)
                ?: return "Use: /paid <name> <amount>   e.g. /paid Aroona 40"
            val q = m.groupValues[1].trim(); val amt = m.groupValues[2].replace(',', '.').toDouble()
            val hits = store.customers.filter { it.name.equals(q, true) }.ifEmpty {
                store.customers.filter { it.name.contains(q, true) || it.name.split(" ").first().equals(q, true) } }
            if (hits.isEmpty()) return "No customer matches \"$q\"."
            if (hits.size > 1) return "More than one match: " + hits.joinToString { it.name } + ". Type the full name."
            val c = hits[0]
            store.addPayment(Payment(customerId = c.id, amount = amt, note = "Telegram"))
            val bal = store.outstandingRows(Fmt.startOfMonth(), Fmt.endOfMonth()).firstOrNull { it.customerId == c.id }?.balance ?: 0.0
            return "Recorded ${Fmt.currency(amt, store.settings.currency)} from ${c.name} ✅\nStill owes: ${Fmt.currency(maxOf(bal, 0.0), store.settings.currency)}"
        }
        if (t.startsWith("/cancel")) {
            return if (p.contains("pending_$chat")) { p.edit().remove("pending_$chat").apply(); "Cancelled. Nothing was saved from that list." } else "Nothing to cancel."
        }
        val pend = Pending.fromJson(p.getString("pending_$chat", null))
        val looksLikeList = t.contains("\n") || Regex("""tiffin|date\s*[-:]""", RegexOption.IGNORE_CASE).containsMatchIn(t)
        if (pend != null && !looksLikeList) return answer(context, store, chat, pend, t)

        val today = LocalDate.now()
        val dayFirst = WhatsAppParser.parse(t, false, store.settings.defaultTiffinPrice)
        if (dayFirst.tiffins.isEmpty() && dayFirst.orders.isEmpty()) {
            return if (t.toIntOrNull() != null) "There is nothing waiting for an answer. Send your list."
            else "I couldn't find any entries in that message.\n\n$HELP"
        }
        var parsed = dayFirst
        var date = dayFirst.date
        var monthFirst = false
        var note = if (pend != null) "(The earlier unfinished list was dropped.)\n" else ""
        fun near(d: LocalDate?) = d != null && abs(d.toEpochDay() - today.toEpochDay()) <= 31
        if (!near(date)) {
            val mf = WhatsAppParser.parse(t, true, store.settings.defaultTiffinPrice)
            if (near(mf.date)) { parsed = mf; date = mf.date; monthFirst = true; note += "(date read as month.day)\n" }
        }
        if (date == null) { date = Instant.ofEpochSecond(if (sent > 0) sent else System.currentTimeMillis() / 1000).atZone(ZoneId.systemDefault()).toLocalDate(); note += "(no date in message, used $date)\n" }
        else if (!near(date)) return "The date $date is more than a month away from today, so I did not save anything. Please resend with the right date."
        return note + advance(context, store, chat, Pending(t, monthFirst, date!!, mutableMapOf(), System.currentTimeMillis()))
    }

    /** Re-plans the list; asks the next question, or saves when everything is clear. */
    private fun advance(context: Context, store: KitchenStore, chat: Long, pend: Pending): String {
        val p = prefs(context)
        val parsed = WhatsAppParser.parse(pend.text, pend.monthFirst, store.settings.defaultTiffinPrice)
        val plan = EntryPlanner.plan(parsed, pend.date, store.customers, store.tiffins, pend.res)
        val q = plan.question
        if (q != null) {
            p.edit().putString("pending_$chat", pend.toJson()).apply()
            val raw = (parsed.tiffins.getOrNull(q.key.drop(1).toIntOrNull() ?: -1)?.takeIf { q.key.startsWith("t") }?.raw
                ?: parsed.orders.getOrNull(q.key.drop(1).toIntOrNull() ?: -1)?.takeIf { q.key.startsWith("o") }?.raw ?: "")
            val hint = when (q.field) { "cust" -> "Reply with a number, or type the correct name." ; "place" -> "Reply with a number, or type the place."; else -> "Reply with a number." }
            return "Nothing saved yet - one question:\n\n» $raw\n${q.title}\n" +
                q.options.mapIndexed { i, o -> "${i + 1}. ${o.label}" }.joinToString("\n") + "\n\n$hint (/cancel to stop)"
        }
        p.edit().remove("pending_$chat").apply()
        val (summary, batch) = EntryWriter.applyPlan(store, plan, pend.date)
        if (batch.tiffinIds.isNotEmpty() || batch.orderIds.isNotEmpty() || batch.customerIds.isNotEmpty()) p.edit().putString("batch_$chat", batch.toJson()).apply()
        return summary
    }

    private fun answer(context: Context, store: KitchenStore, chat: Long, pend: Pending, reply: String): String {
        val parsed = WhatsAppParser.parse(pend.text, pend.monthFirst, store.settings.defaultTiffinPrice)
        val q = EntryPlanner.plan(parsed, pend.date, store.customers, store.tiffins, pend.res).question
            ?: return advance(context, store, chat, pend)
        val (res, err) = EntryPlanner.answer(q, pend.res[q.key] ?: EntryPlanner.Res(), reply)
        if (res == null) return err ?: "Please reply with a number."
        pend.res[q.key] = res
        return advance(context, store, chat, pend)
    }
}

/** A list that is waiting for answers to questions. */
class Pending(val text: String, val monthFirst: Boolean, val date: LocalDate, val res: MutableMap<String, EntryPlanner.Res>, val at: Long) {
    fun toJson(): String = JSONObject().put("text", text).put("mf", monthFirst).put("date", date.toString()).put("at", at)
        .put("res", JSONObject().also { r -> res.forEach { (k, v) ->
            r.put(k, JSONObject().put("c", v.cust ?: JSONObject.NULL).put("p", v.place ?: JSONObject.NULL).put("d", v.dup ?: JSONObject.NULL).put("a", v.alt ?: JSONObject.NULL)) } }).toString()
    companion object {
        fun fromJson(s: String?): Pending? = runCatching {
            val j = JSONObject(s!!)
            if (System.currentTimeMillis() - j.getLong("at") > 12 * 3600_000L) return null
            val r = j.getJSONObject("res")
            val m = mutableMapOf<String, EntryPlanner.Res>()
            r.keys().forEach { k -> val o = r.getJSONObject(k)
                fun g(x: String) = if (o.isNull(x)) null else o.getString(x)
                m[k] = EntryPlanner.Res(g("c"), g("p"), g("d"), g("a")) }
            Pending(j.getString("text"), j.getBoolean("mf"), LocalDate.parse(j.getString("date")), m, j.getLong("at"))
        }.getOrNull()
    }
}

class TelegramWorker(ctx: Context, params: WorkerParameters) : CoroutineWorker(ctx, params) {
    override suspend fun doWork(): Result {
        TelegramBot.poll(applicationContext, KitchenStore.get(applicationContext))
        return Result.success()
    }
}
