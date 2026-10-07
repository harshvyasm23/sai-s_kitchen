package me.saiskitchen.app

import java.text.Normalizer
import java.time.LocalDate

/**
 * Reads a WhatsApp-style message such as
 *
 *   Date - 10.06.26
 *   daily tiffins
 *   1. Pranav 1 tiffin at pasila
 *   2. Meena 2 tiffins at Iso Omena
 *   Alacarte
 *   1. Neha - 2 kg poha 12 euro, roti 20 pcs 0.5 each at Pasila
 *   Catering
 *   1. Rohit - chole chana 10 euro, puri 10 x 1.5 each
 *
 * and turns it into entries. Pure logic, no UI, so it can be unit-tested.
 */
data class ParsedTiffin(
    val raw: String, val name: String, val noon: Double, val evening: Double,
    val price: Double, val delivery: Double, val place: String?, val warnings: List<String>,
    val placeKey: String? = null, val rawPlace: String? = null,
)

data class ParsedItem(val name: String, val qty: Double, val price: Double)

data class ParsedOrder(
    val raw: String, val name: String, val kind: String, val items: List<ParsedItem>,
    val delivery: Double, val place: String?, val warnings: List<String>,
)

data class ParsedMessage(
    val date: LocalDate?, val tiffins: List<ParsedTiffin>, val orders: List<ParsedOrder>, val warnings: List<String>,
)

object WhatsAppParser {
    private const val NUM = """\d+(?:[.,]\d+)?"""
    private const val TIF = """t+i+f+[ie]+n+s?"""
    private const val UNIT = """(?:kgs?|g|gm|grams?|pcs|pc|pieces?|plates?|boxes|box|litres?|ltr|l|nos)"""
    private val I = setOf(RegexOption.IGNORE_CASE)

    private val NUMBERING = Regex("""^\s*(?:\d+\s*[.):]|[-•*])\s*""")
    private val HEADER = Regex("""^\s*(?:daily\s+)?(?:tiffins?|catering|a\s*la\s*carte|alacarte|orders?|snacks?|extras?|special)\b[^0-9]*$""", I)
    private val DATE_RX = Regex("""(\d{1,2})[./\-](\d{1,2})[./\-](\d{2,4})""")
    private val PLACE_RX = Regex("""(?:\bat\b|\bin\b|@|\bnear\b|\bfrom\b|\bto\b)\s*(.+)$""", I)

    fun norm(s: String): String =
        Normalizer.normalize(s.lowercase(), Normalizer.Form.NFD).replace(Regex("\\p{M}+"), "")

    private fun num(s: String) = s.replace(',', '.').toDouble()
    private fun has(p: String, rx: String) = Regex(rx).containsMatchIn(p)

    class Place(val key: String, val label: String, val rate: Double, val words: List<String>)

    /** Delivery stops. rate = charge PER TIFFIN. */
    val PLACES = listOf(
        Place("home", "Home / pickup", 0.0, listOf("home", "ghar", "pickup", "pick", "self", "collect", "takeaway", "free", "nodelivery")),
        Place("omena", "Iso Omena", 1.0, listOf("omena", "isoomena")),
        Place("pasila", "Pasila", 0.5, listOf("pasila")),
        Place("lepp", "Leppävaara", 0.5, listOf("leppavaara", "leppavara", "lepavara", "sello")),
        Place("myyr", "Myyrmanni", 0.5, listOf("myyrmanni", "myyrmaki", "myrmanni")),
        Place("station", "Helsinki Railway Station", 0.5, listOf("helsinki", "hki", "railway", "rautatie", "rautatieasema", "station", "stn", "asema")),
    )
    private val PLACE_TAIL = setOf("iso", "railway", "helsinki", "central", "at", "in")

    fun placeByKey(key: String?) = PLACES.firstOrNull { it.key == key }

    private fun wordMatch(tok: String, word: String): Boolean {
        if (tok == word) return true
        if (tok.length < 5 || word.length < 5) return false
        return lev(tok, word) <= (if (word.length >= 8) 2 else 1)
    }

    /** Finds a delivery stop in free text, forgiving of spelling mistakes ("Lepavara", "passila"). */
    fun findPlace(text: String): Place? {
        val toks = norm(text).split(Regex("[^a-z]+")).filter { it.isNotEmpty() }
        for (p in PLACES) if (toks.any { t -> p.words.any { w -> wordMatch(t, w) } }) return p
        return null
    }

    /** label, delivery (per tiffin), warning */
    fun placeInfo(text: String): Triple<String, Double, String?> {
        val p = findPlace(text) ?: return Triple(text.trim(), 0.5, "Unknown place '${text.trim()}' - used 0.50 delivery")
        return Triple(p.label, p.rate, null)
    }

    fun parseDate(text: String, monthFirst: Boolean): LocalDate? {
        val m = DATE_RX.find(text) ?: return null
        val a = m.groupValues[1].toInt(); val b = m.groupValues[2].toInt(); var y = m.groupValues[3].toInt()
        if (y < 100) y += 2000
        var d = if (monthFirst) b else a
        var mo = if (monthFirst) a else b
        if (mo > 12 && d <= 12) { val t = d; d = mo; mo = t }
        return try { LocalDate.of(y, mo, d) } catch (e: Exception) { null }
    }

    fun parseTiffin(line: String, defaultPrice: Double): ParsedTiffin {
        val s = NUMBERING.replaceFirst(line, "").trim()
        val w = mutableListOf<String>()
        val pm = PLACE_RX.find(s)
        val place = pm?.groupValues?.get(1)?.trim(' ', '.', ',', ';')
        val body = if (pm != null) s.substring(0, pm.range.first) else s
        val low = norm(body)
        val full = norm(s)
        var noon = 0.0; var evening = 0.0
        // "1 noon", "2 tiffins evening" first; each number is used once, so "1 noon 1 evening" is not counted twice
        var rest = low
        for ((words, isNoon) in listOf("noon|lunch|morning" to true, "evening|dinner|night" to false)) {
            for (m in Regex("($NUM)\\s*(?:$TIF\\s*)?(?:$words)").findAll(rest).toList()) {
                if (isNoon) noon += num(m.groupValues[1]) else evening += num(m.groupValues[1])
                rest = rest.replaceRange(m.range, " ".repeat(m.value.length))
            }
        }
        for ((words, isNoon) in listOf("noon|lunch|morning" to true, "evening|dinner|night" to false)) {
            for (m in Regex("(?:$words)\\s*[:=x]?\\s*($NUM)").findAll(rest).toList()) {
                if (isNoon) noon += num(m.groupValues[1]) else evening += num(m.groupValues[1])
                rest = rest.replaceRange(m.range, " ".repeat(m.value.length))
            }
        }
        if (noon + evening == 0.0) {
            var q = 1.0
            val qm = Regex("($NUM)\\s*(?:x\\s*)?$TIF").find(low) ?: Regex("$TIF\\s*[:=x]\\s*($NUM)").find(low)
            if (qm != null) q = num(qm.groupValues[1])
            if (has(low, "noon|lunch|morning") && !has(low, "evening|dinner|night")) noon = q else evening = q
        }
        var price = defaultPrice
        val prm = Regex("(?:€\\s*($NUM)|($NUM)\\s*(?:€|eur\\w*)|price\\s*[:=]?\\s*($NUM))").find(low)
        if (prm != null) price = num(prm.groupValues[1].ifEmpty { prm.groupValues[2].ifEmpty { prm.groupValues[3] } })
        var delivery = 0.0
        var label: String? = null
        var placeKey: String? = null
        var rate = 0.0
        val qty = noon + evening
        var rawPlace = place
        Regex("delivery\\s*[:=]?\\s*($NUM)").find(full)?.let { delivery = num(it.groupValues[1]) }
        var n = if (pm != null) s.substring(0, pm.range.first) else s
        n = Regex("(?:€\\s*$NUM|$NUM\\s*(?:€|eur\\w*)|price\\s*[:=]?\\s*$NUM|delivery\\s*[:=]?\\s*$NUM)", I).replace(n, " ")
        n = Regex("$NUM\\s*(?:x\\s*)?").replace(n, " ")
        n = Regex("\\b(?:$TIF|noon|lunch|morning|evening|dinner|night|delivery|price)\\b|[:=@€+]", I).replace(n, " ")
        n = n.replace(Regex("\\s+"), " ").trim(' ', '-', '.', ',', ';', ':')
        if (place == null) {
            // no "at ...": a place typed straight after the name, e.g. "Pranav leppavara 1 tiffin"
            val toks = n.split(" ").filter { it.isNotEmpty() }.toMutableList()
            val popped = mutableListOf<String>()
            while (toks.size > 1 && (findPlace(toks.last()) != null || norm(toks.last()) in PLACE_TAIL)) popped.add(0, toks.removeAt(toks.size - 1))
            if (popped.isNotEmpty() && findPlace(popped.joinToString(" ")) != null) { rawPlace = popped.joinToString(" "); n = toks.joinToString(" ") }
            else toks.addAll(popped)
        }
        if (rawPlace != null) {
            val hit = findPlace(rawPlace)
            if (hit != null) { label = hit.label; placeKey = hit.key; rate = hit.rate }
            else { label = rawPlace.trim(); w.add("Unknown place '${rawPlace.trim()}' - please choose") }
        } else {
            w.add("No place given - please choose")
        }
        delivery = if (delivery > 0.0) delivery else (rate * qty)
        if (n.isEmpty()) w.add("No name found")
        return ParsedTiffin(line, n, noon, evening, price, delivery, label, w, placeKey, rawPlace)
    }

    fun parseItem(seg: String): Pair<ParsedItem, List<String>>? {
        var s = seg.trim()
        if (s.isEmpty()) return null
        val per = Regex("""\b(?:each|per|every)\b|/\s*$UNIT\b|@""", I).containsMatchIn(s)
        var price: Double? = null
        var qty: Double? = null
        var unit = ""
        Regex("€\\s*($NUM)|($NUM)\\s*(?:€|eur\\w*)", I).find(s)?.let {
            price = num(it.groupValues[1].ifEmpty { it.groupValues[2] })
            s = s.substring(0, it.range.first) + " " + s.substring(it.range.last + 1)
        }
        Regex("($NUM)\\s*($UNIT)\\b", I).find(s)?.let {
            qty = num(it.groupValues[1]); unit = it.groupValues[2].lowercase()
            s = s.substring(0, it.range.first) + " " + s.substring(it.range.last + 1)
        }
        val nums = Regex(NUM).findAll(s).map { it.value }.toList()
        if (nums.isNotEmpty()) {
            if (qty == null && price == null && nums.size >= 2) { qty = num(nums[0]); price = num(nums[1]) }
            else if (qty == null) qty = num(nums[0])
            else if (price == null) price = num(nums[0])
            s = Regex(NUM).replace(s, " ")
        }
        s = Regex("""\b(?:of|x|per|each|every|for|total|rs)\b|[@/=]""", I).replace(s, " ")
        var name = s.replace(Regex("\\s+"), " ").trim(' ', '-', '.', ',', ';', ':')
        name = name.replaceFirstChar { it.uppercase() }
        val w = mutableListOf<String>()
        if (name.isEmpty()) { w.add("Item without a name"); name = "Item" }
        if (price == null) { w.add("No price for $name"); price = 0.0 }
        val q = qty ?: 1.0
        val p = price ?: 0.0
        return if (per || (q == 1.0 && unit.isEmpty())) {
            Pair(ParsedItem(if (unit.isNotEmpty()) "$name ($unit)" else name, q, p), w)
        } else {
            val label = q.clean() + if (unit.isNotEmpty()) " $unit" else ""
            Pair(ParsedItem("$name ($label)", 1.0, p), w)
        }
    }

    fun parseOrder(line: String, kind: String): ParsedOrder {
        val s = NUMBERING.replaceFirst(line, "").trim()
        val sep = Regex("""\s[-–—:]\s|:|\s[-–—]\s*""").find(s)
        var name: String; var rest: String
        if (sep != null) {
            name = s.substring(0, sep.range.first).trim(); rest = s.substring(sep.range.last + 1)
        } else {
            val d = Regex("""\d""").find(s)
            if (d != null) { name = s.substring(0, d.range.first).trim(); rest = s.substring(d.range.first) } else { name = s; rest = "" }
        }
        val w = mutableListOf<String>()
        var delivery = 0.0
        var label: String? = null
        val pm = Regex("""(?:\bat\b|@)\s*([A-Za-zÄÖäö][^,;+]*)$""", I).find(rest)
        if (pm != null) {
            val (l, d, warn) = placeInfo(pm.groupValues[1])
            label = l; delivery = d
            rest = rest.substring(0, pm.range.first)
            if (kind == "catering") {
                if (delivery != 0.0) w.add("Catering is self pickup - delivery ignored")
                delivery = 0.0
            } else if (warn != null) w.add(warn)
        }
        val dm = Regex("delivery\\s*[:=]?\\s*($NUM)", I).find(rest)
        if (dm != null && kind != "catering") {
            delivery = num(dm.groupValues[1]); rest = rest.substring(0, dm.range.first) + rest.substring(dm.range.last + 1)
        }
        val items = mutableListOf<ParsedItem>()
        for (seg in rest.split(Regex("[,;+\\n]"))) {
            val r = parseItem(seg) ?: continue
            items.add(r.first); w.addAll(r.second)
        }
        if (name.isEmpty()) w.add("No name found")
        if (items.isEmpty()) w.add("No items found")
        return ParsedOrder(line, name.trim(' ', '-', '.', ',', ':'), kind, items, delivery, label, w)
    }

    fun parse(text: String, monthFirst: Boolean, defaultPrice: Double): ParsedMessage {
        var date: LocalDate? = null
        var mode = "tiffin"
        val tiffins = mutableListOf<ParsedTiffin>()
        val orders = mutableListOf<ParsedOrder>()
        val warns = mutableListOf<String>()
        for (raw in text.lines()) {
            val line = raw.trim()
            if (line.isEmpty()) continue
            if (Regex("""^\W*date\b""", I).containsMatchIn(line) || (date == null && DATE_RX.matches(line))) {
                date = parseDate(line, monthFirst) ?: date
                continue
            }
            if (!NUMBERING.containsMatchIn(line) && HEADER.matches(line)) {
                val l = norm(line)
                mode = if (l.contains("tiffin")) "tiffin" else if (l.contains("catering")) "catering" else "alacarte"
                continue
            }
            if (mode == "tiffin") {
                val t = parseTiffin(line, defaultPrice)
                if (t.name.isEmpty()) { warns.add("Could not read: $line"); continue }
                tiffins.add(t)
            } else {
                val o = parseOrder(line, mode)
                if (o.name.isEmpty() && o.items.isEmpty()) { warns.add("Could not read: $line"); continue }
                orders.add(o)
            }
        }
        if (date == null) warns.add("No date found - using today")
        return ParsedMessage(date, tiffins, orders, warns)
    }

    private fun lev(a: String, b: String): Int {
        var p = IntArray(b.length + 1) { it }
        for (i in 1..a.length) {
            val c = IntArray(b.length + 1); c[0] = i
            for (j in 1..b.length) c[j] = minOf(p[j] + 1, c[j - 1] + 1, p[j - 1] + if (a[i - 1] != b[j - 1]) 1 else 0)
            p = c
        }
        return p[b.length]
    }

    /** status: matched | ambiguous | new */
    fun matchCustomer(name: String, customers: List<Customer>): Pair<String, Customer?> {
        val n = norm(name).trim()
        if (n.isEmpty()) return Pair("new", null)
        customers.firstOrNull { norm(it.name).trim() == n }?.let { return Pair("matched", it) }
        val first = n.split(" ")[0]
        val fz = customers.filter {
            val c = norm(it.name).trim()
            c.startsWith(n) || n.startsWith(c) || c.split(" ")[0] == first
        }
        if (fz.size == 1) return Pair("matched", fz[0])
        if (fz.size > 1) return Pair("ambiguous", fz[0])
        val lim = if (n.length <= 5) 1 else 2
        val near = customers.filter {
            val c = norm(it.name).trim()
            minOf(lev(n, c), lev(n, c.split(" ")[0])) <= lim
        }
        if (near.size == 1) return Pair("matched", near[0])
        return Pair("new", null)
    }
}
