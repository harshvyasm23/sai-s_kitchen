package me.saiskitchen.app

import java.time.LocalDate

/**
 * Turns a parsed message into a safe plan. Whenever something is unclear (customer not found, place not
 * recognised, customer already has a tiffin that day) it stops and produces ONE question with numbered
 * options, so the Telegram bot can ask and the answer can be applied. Pure logic: no Android, fully testable.
 */
object EntryPlanner {
    /** Answers given so far for one line. cust = customer id | "new" | "skip"; place = place key; dup = keep | replace; alt = re-typed name. */
    data class Res(val cust: String? = null, val place: String? = null, val dup: String? = null, val alt: String? = null)

    data class Option(val label: String, val value: String)
    data class Question(val key: String, val field: String, val title: String, val options: List<Option>)

    data class Line(
        val key: String, val kind: String, val raw: String,
        val customer: Customer?, val newName: String?,
        val tiffin: ParsedTiffin?, val order: ParsedOrder?,
        val placeLabel: String?, val delivery: Double,
        val status: String, // save | skip
        val notes: List<String>, val replace: List<TiffinEntry> = emptyList(),
    )

    data class Plan(val lines: List<Line>, val question: Question?)

    enum class Kind { EXACT, UNIQUE, TYPO, AMBIGUOUS, NONE }
    data class Match(val kind: Kind, val candidates: List<Customer>)

    fun pretty(name: String) = name.trim().split(" ").filter { it.isNotEmpty() }.joinToString(" ") { w -> w.replaceFirstChar { it.uppercase() } }

    private fun lev(a: String, b: String): Int {
        var p = IntArray(b.length + 1) { it }
        for (i in 1..a.length) {
            val c = IntArray(b.length + 1); c[0] = i
            for (j in 1..b.length) c[j] = minOf(p[j] + 1, c[j - 1] + 1, p[j - 1] + if (a[i - 1] != b[j - 1]) 1 else 0)
            p = c
        }
        return p[b.length]
    }

    private fun toks(s: String) = NameStd.core(s).split(" ").filter { it.isNotEmpty() }

    /** Finds who a typed name probably means. */
    fun match(name: String, customers: List<Customer>): Match {
        val q = toks(name)
        if (q.isEmpty()) return Match(Kind.NONE, emptyList())
        val full = q.joinToString(" ")
        customers.filter { toks(it.name).joinToString(" ") == full }.let { if (it.size == 1) return Match(Kind.EXACT, it) else if (it.size > 1) return Match(Kind.AMBIGUOUS, it) }
        // every typed word is a whole word of the customer's name ("pranav" -> "Pranav Bhatt"), or the customer's whole name is inside what was typed
        val whole = customers.filter { c ->
            val ct = toks(c.name)
            ct.isNotEmpty() && (q.all { it in ct } || ct.all { it in q })
        }
        if (whole.size == 1) return Match(Kind.UNIQUE, whole)
        if (whole.size > 1) return Match(Kind.AMBIGUOUS, whole)
        // only the start of a word matches ("meena" -> "Meenakshi"): never guess, ask
        val starts = customers.filter { c ->
            val ct = toks(c.name)
            ct.isNotEmpty() && q.all { w -> ct.any { it.startsWith(w) } }
        }
        // spelling mistakes: compare word by word
        val scored = customers.mapNotNull { c ->
            val ct = toks(c.name)
            var best = Int.MAX_VALUE
            for (w in q) for (x in ct) {
                val lim = if (w.length >= 5) 2 else if (w.length >= 4) 1 else 0
                val d = lev(w, x)
                if (d <= lim && d < best) best = d
            }
            val whole = lev(full, ct.joinToString(" "))
            if (whole <= (if (full.length >= 7) 2 else 1)) best = minOf(best, whole)
            if (best == Int.MAX_VALUE) null else Pair(best, c)
        }.sortedBy { it.first }
        val all = (starts + scored.map { it.second }).distinctBy { it.id }
        return if (all.isEmpty()) Match(Kind.NONE, emptyList()) else Match(Kind.TYPO, all.take(5))
    }

    private fun custQuestion(key: String, typed: String, m: Match, customers: List<Customer>): Question {
        val opts = mutableListOf<Option>()
        val list = if (m.candidates.isNotEmpty()) m.candidates else emptyList()
        list.take(5).forEach { opts.add(Option(it.name + if (it.phone.isNotBlank()) " (${it.phone})" else "", it.id)) }
        opts.add(Option("New customer \"${pretty(typed)}\"", "new"))
        opts.add(Option("Skip this line", "skip"))
        val title = when (m.kind) {
            Kind.AMBIGUOUS -> "\"$typed\" matches more than one customer. Which one?"
            Kind.TYPO -> "I can't find \"$typed\" exactly. Did you mean:"
            else -> "I can't find \"$typed\" in your customers."
        }
        return Question(key, "cust", title, opts)
    }

    private fun placeQuestion(key: String, raw: String?): Question {
        val title = if (raw.isNullOrBlank()) "No delivery place given. Where does it go?" else "I don't know the place \"$raw\". Which one is it?"
        return Question(key, "place", title, WhatsAppParser.PLACES.sortedBy { if (it.key == "home") 99 else 0 }.map {
            Option(it.label + if (it.rate > 0) " (€${"%.2f".format(java.util.Locale.US, it.rate)} per tiffin)" else " (no delivery)", it.key)
        })
    }

    fun plan(p: ParsedMessage, date: LocalDate, customers: List<Customer>, existing: List<TiffinEntry>, res: Map<String, Res>): Plan {
        val lines = mutableListOf<Line>()
        val seenTiffin = mutableMapOf<String, String>() // normalized name or id -> place label
        for ((i, t) in p.tiffins.withIndex()) {
            val key = "t$i"
            val r = res[key] ?: Res()
            val typed = r.alt ?: t.name
            val notes = mutableListOf<String>()
            var customer: Customer? = null
            var newName: String? = null
            when (r.cust) {
                "skip" -> { lines.add(Line(key, "tiffin", t.raw, null, null, t, null, null, 0.0, "skip", listOf("skipped by you"))); continue }
                "new" -> newName = pretty(typed)
                null -> {
                    val m = match(typed, customers)
                    when (m.kind) {
                        Kind.EXACT -> customer = m.candidates[0]
                        Kind.UNIQUE -> { customer = m.candidates[0]; notes.add("\"${t.name}\" matched to ${customer.name}") }
                        else -> return Plan(lines, custQuestion(key, typed, m, customers))
                    }
                }
                else -> customer = customers.firstOrNull { it.id == r.cust } ?: return Plan(lines, custQuestion(key, typed, match(typed, customers), customers))
            }
            val place = WhatsAppParser.placeByKey(r.place ?: t.placeKey)
            if (place == null) return Plan(lines, placeQuestion(key, t.rawPlace))
            val ident = customer?.id ?: ("new:" + WhatsAppParser.norm(newName ?: typed).trim())
            val qty = t.noon + t.evening
            val deliveryFinal = if (r.place != null) place.rate * qty else t.delivery
            if (ident in seenTiffin) {
                val who = customer?.name ?: newName ?: typed
                lines.add(Line(key, "tiffin", t.raw, customer, newName, t, null, place.label, 0.0, "skip",
                    listOf("$who is listed twice in this message (${seenTiffin[ident]} and ${place.label}) - kept the first one")))
                continue
            }
            var replace = emptyList<TiffinEntry>()
            if (customer != null) {
                val same = existing.filter { it.customerId == customer.id && it.date == date }
                if (same.isNotEmpty()) {
                    when (r.dup) {
                        "keep" -> { lines.add(Line(key, "tiffin", t.raw, customer, null, t, null, place.label, 0.0, "skip", listOf("already has a tiffin on this date - kept the existing one"))); continue }
                        "replace" -> replace = same
                        else -> {
                            val e = same[0]
                            return Plan(lines, Question(key, "dup", "${customer.name} already has a tiffin on ${Fmt.displayDate(date)} (${e.quantity.clean()} tiffin, ${Fmt.currency(e.total, "EUR")}). What now?",
                                listOf(Option("Keep the existing one (skip this line)", "keep"), Option("Replace it with this new entry", "replace"))))
                        }
                    }
                }
            }
            seenTiffin[ident] = place.label
            lines.add(Line(key, "tiffin", t.raw, customer, newName, t, null, place.label, deliveryFinal, "save", notes, replace))
        }
        for ((i, o) in p.orders.withIndex()) {
            val key = "o$i"
            val r = res[key] ?: Res()
            val typed = r.alt ?: o.name
            if (o.items.isEmpty() || o.warnings.any { it.startsWith("No price") }) {
                lines.add(Line(key, "order", o.raw, null, null, null, o, null, 0.0, "skip",
                    listOf("not saved - " + (o.warnings.firstOrNull { it.startsWith("No price") || it.startsWith("No items") } ?: "no items")))); continue
            }
            val notes = mutableListOf<String>()
            var customer: Customer? = null
            var newName: String? = null
            when (r.cust) {
                "skip" -> { lines.add(Line(key, "order", o.raw, null, null, null, o, null, 0.0, "skip", listOf("skipped by you"))); continue }
                "new" -> newName = pretty(typed)
                null -> {
                    val m = match(typed, customers)
                    when (m.kind) {
                        Kind.EXACT -> customer = m.candidates[0]
                        Kind.UNIQUE -> { customer = m.candidates[0]; notes.add("\"${o.name}\" matched to ${customer.name}") }
                        else -> return Plan(lines, custQuestion(key, typed, m, customers))
                    }
                }
                else -> customer = customers.firstOrNull { it.id == r.cust } ?: return Plan(lines, custQuestion(key, typed, match(typed, customers), customers))
            }
            notes.addAll(o.warnings)
            lines.add(Line(key, "order", o.raw, customer, newName, null, o, o.place, o.delivery, "save", notes))
        }
        return Plan(lines, null)
    }

    /** Applies the user's reply to a question. Returns the new answers, or an error text to send back. */
    fun answer(q: Question, cur: Res, reply: String): Pair<Res?, String?> {
        val n = reply.trim().toIntOrNull()
        if (n != null) {
            if (n !in 1..q.options.size) return Pair(null, "Please reply with a number from 1 to ${q.options.size} (or /cancel).")
            val v = q.options[n - 1].value
            return Pair(when (q.field) { "cust" -> cur.copy(cust = v); "place" -> cur.copy(place = v); else -> cur.copy(dup = v) }, null)
        }
        return when (q.field) {
            "cust" -> Pair(cur.copy(alt = reply.trim(), cust = null), null)
            "place" -> WhatsAppParser.findPlace(reply)?.let { Pair(cur.copy(place = it.key), null) }
                ?: Pair(null, "I don't know that place. Reply with a number from 1 to ${q.options.size}.")
            else -> {
                val w = WhatsAppParser.norm(reply).trim()
                val v = if (w.startsWith("keep")) "keep" else if (w.startsWith("replace")) "replace" else null
                if (v != null) Pair(cur.copy(dup = v), null) else Pair(null, "Please reply with a number from 1 to ${q.options.size} (or /cancel).")
            }
        }
    }
}
