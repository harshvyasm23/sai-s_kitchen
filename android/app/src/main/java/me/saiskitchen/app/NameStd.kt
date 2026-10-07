package me.saiskitchen.app

/** Turns messy customer names into the standard form: "Name Bhai Sai's Kitchen" (gents) / "Name Sai's Kitchen" (ladies). */
object NameStd {
    const val SUFFIX = "Sai's Kitchen"
    private val MALE_WORDS = setOf("bhai", "bhaiya", "bhaiyya")
    private val FEMALE_WORDS = setOf("ben", "behen", "bhabhi", "lady", "ladies", "madam")
    private val NOISE = setOf("sai", "s", "sais", "tiffin", "tifin", "tiffen", "tiffins", "tifins", "kitchen", "service", "ji", "gents") + MALE_WORDS + FEMALE_WORDS
    private val PLACE_FILLER = setOf("iso", "at", "in", "railway", "station", "helsinki")
    private val FEMALE_NAMES = setOf("priti", "priya", "meena", "meenakshi", "pooja", "neha", "kavita", "anita", "sunita", "rekha", "divya", "jyoti",
        "sonal", "hetal", "nisha", "ritu", "aroona", "sneha", "shweta", "deepa", "dipti", "komal", "mina", "rina", "hema", "bhavna", "shilpa", "sapna")
    private val SHORT = mapOf("omena" to "Iso Omena", "pasila" to "Pasila", "lepp" to "Leppävaara", "myyr" to "Myyrmäki", "station" to "Helsinki")

    /** Words that identify the person, without "Bhai", "Sai's Kitchen", tiffin words. Used to match typed names. */
    fun core(s: String): String =
        WhatsAppParser.norm(s).split(Regex("[^a-z0-9]+")).filter { it.isNotEmpty() && it !in NOISE }.joinToString(" ")

    fun shortPlace(text: String): String = WhatsAppParser.findPlace(text)?.let { SHORT[it.key] } ?: ""

    class Parsed(val base: String, val place: String, val male: Boolean?)

    fun parse(old: String, address: String): Parsed {
        val words = Regex("\\p{L}+").findAll(old).map { it.value }.toList()
        var male: Boolean? = null
        var place = ""
        val keep = mutableListOf<String>()
        for (w in words) {
            val n = WhatsAppParser.norm(w)
            when {
                n in MALE_WORDS -> male = true
                n in FEMALE_WORDS -> male = false
                n in NOISE -> {}
                else -> {
                    val p = if (n.length >= 4) shortPlace(n) else ""
                    if (p.isNotEmpty() && place.isEmpty()) place = p else if (p.isEmpty()) keep.add(w)
                }
            }
        }
        if (place.isNotEmpty()) keep.removeAll { WhatsAppParser.norm(it) in PLACE_FILLER }
        if (place.isEmpty()) place = shortPlace(address)
        val base = keep.joinToString(" ") { it.lowercase().replaceFirstChar { c -> c.uppercase() } }
        if (male == null) {
            val first = WhatsAppParser.norm(keep.firstOrNull() ?: "")
            male = !(first in FEMALE_NAMES || first.endsWith("ben"))
        }
        return Parsed(base, place, male)
    }

    fun isSure(old: String): Boolean {
        val w = Regex("\\p{L}+").findAll(old).map { WhatsAppParser.norm(it.value) }.toList()
        return w.any { it in MALE_WORDS || it in FEMALE_WORDS } || (w.firstOrNull() in FEMALE_NAMES)
    }

    fun build(base: String, place: String, male: Boolean): String =
        listOf(base, place.trim(), if (male) "Bhai" else "", SUFFIX).filter { it.isNotBlank() }.joinToString(" ")
}

