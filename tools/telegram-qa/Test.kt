import me.saiskitchen.app.*
import java.time.LocalDate

var fails = 0
fun check(name: String, ok: Boolean, extra: String = "") { if (!ok) { fails++; println("FAIL: $name $extra") } else println("ok:   $name") }

fun main() {
    val c = listOf("Pranav Bhatt", "Meenakshi Patel", "Mina Shah", "Parthiv Bhatt", "Chintan thakor", "Tushar patel", "Saumil bhai", "Kiran bhai parmar", "Manish bhai sorathiya", "Hardik bhai sorathiya", "Poojan bhai thakar", "Jay bhai patel", "Tilak bhai", "Aroona")
        .map { Customer(name = it, phone = "1") }
    val d = LocalDate.of(2026, 10, 7)
    fun run(text: String, existing: List<TiffinEntry> = emptyList(), res: Map<String, EntryPlanner.Res> = emptyMap()) =
        EntryPlanner.plan(WhatsAppParser.parse(text, false, 8.0), d, c, existing, res)

    // places & per-tiffin delivery
    for ((txt, rate) in listOf("Pranav 1 tiffin at pasila" to 0.5, "Pranav 2 tiffins at Iso Omena" to 2.0, "Pranav 1 tiffin at lepavara" to 0.5, "Pranav 3 tiffin at Leppävaara" to 1.5,
        "Pranav 1 tiffin at Helsinki railway station" to 0.5, "Pranav 2 tiffin at station" to 1.0, "Pranav 1 tiffin at passila" to 0.5, "Pranav 1 tiffin at myrmanni" to 0.5, "Pranav 1 tiffin at home" to 0.0, "Pranav 2 tiffin at pickup" to 0.0)) {
        val t = WhatsAppParser.parseTiffin(txt, 8.0)
        check("delivery $txt", Math.abs(t.delivery - rate) < 1e-9 && t.placeKey != null, "got ${t.delivery} ${t.placeKey} name=${t.name}")
    }
    // place typed without 'at'
    for (txt in listOf("Pranav leppavara 1 tiffin", "1. Pranav pasila 1 tiffin", "Pranav 1 tiffin leppavara", "Pranav iso omena 2 tiffins", "Pranav helsinki railway station 1 tiffin")) {
        val t = WhatsAppParser.parseTiffin(txt, 8.0)
        check("no-at place: $txt", t.placeKey != null && t.name == "Pranav", "name='${t.name}' key=${t.placeKey} raw=${t.rawPlace}")
    }
    // noon / evening qty keep working
    val t1 = WhatsAppParser.parseTiffin("2. Meena 1 noon 1 evening at pasila", 8.0)
    check("noon+evening", t1.noon == 1.0 && t1.evening == 1.0 && t1.delivery == 1.0, "${t1.noon} ${t1.evening} ${t1.delivery}")

    // customer matching
    fun kind(n: String) = EntryPlanner.match(n, c).kind
    check("exact", kind("Pranav Bhatt") == EntryPlanner.Kind.EXACT)
    check("case", kind("pranav bhatt") == EntryPlanner.Kind.EXACT)
    check("first name unique", kind("Pranav") == EntryPlanner.Kind.UNIQUE)
    check("first name typo -> typo", kind("Pranaav") == EntryPlanner.Kind.TYPO, kind("Pranaav").toString())
    check("bhai ambiguous", kind("bhai") == EntryPlanner.Kind.AMBIGUOUS)
    check("Bhatt ambiguous? (Pranav/Parthiv)", kind("Bhatt") == EntryPlanner.Kind.AMBIGUOUS)
    check("Mina vs Meenakshi", kind("Mina") != EntryPlanner.Kind.NONE, kind("Mina").toString())
    check("Meena -> asks", kind("Meena") == EntryPlanner.Kind.TYPO, kind("Meena").toString())
    check("unknown name none", kind("Zorro") == EntryPlanner.Kind.NONE)
    check("Kiran -> unique", kind("Kiran") == EntryPlanner.Kind.UNIQUE)
    check("kiran bhai -> unique", kind("kiran bhai") == EntryPlanner.Kind.UNIQUE, kind("kiran bhai").toString())
    check("Aroona typo Aruna", kind("Arona") == EntryPlanner.Kind.TYPO, kind("Arona").toString())

    // full plans
    var p = run("Date - 07.10.26\ndaily tiffins\n1. Pranav 1 tiffin at pasila\n2. Tushar patel 2 tiffins at Iso Omena\n3. Aroona 1 tiffin leppavara")
    check("clean list: no question", p.question == null && p.lines.size == 3 && p.lines.all { it.status == "save" }, p.question?.title ?: "")
    check("clean list deliveries", p.lines.map { it.delivery } == listOf(0.5, 2.0, 0.5), p.lines.map { it.delivery }.toString())

    p = run("Date - 07.10.26\ndaily tiffins\n1. Meena 1 tiffin at pasila")
    check("typo asks customer", p.question?.field == "cust" && p.question!!.options.size >= 3, p.question?.title ?: "none")
    println(p.question?.options?.joinToString { it.label })
    val mina = c.first { it.name == "Mina Shah" }
    p = run("Date - 07.10.26\ndaily tiffins\n1. Meena 1 tiffin at pasila", res = mapOf("t0" to EntryPlanner.Res(cust = mina.id)))
    check("answer resolves", p.question == null && p.lines[0].customer?.id == mina.id)
    p = run("Date - 07.10.26\ndaily tiffins\n1. Zorro 1 tiffin at pasila", res = mapOf("t0" to EntryPlanner.Res(cust = "new")))
    check("new customer", p.question == null && p.lines[0].newName == "Zorro")

    p = run("daily tiffins\n1. Pranav 1 tiffin at xyzabc")
    check("unknown place asks", p.question?.field == "place" && p.question!!.options.size == 6, p.question?.title ?: "none")
    p = run("daily tiffins\n1. Pranav 1 tiffin")
    check("missing place asks", p.question?.field == "place", p.question?.title ?: "none")
    p = run("daily tiffins\n1. Pranav 2 tiffin", res = mapOf("t0" to EntryPlanner.Res(place = "omena")))
    check("place answer sets per-tiffin delivery", p.question == null && p.lines[0].delivery == 2.0, p.lines.getOrNull(0)?.delivery.toString())

    // duplicates
    val pr = c.first { it.name == "Pranav Bhatt" }
    val ex = listOf(TiffinEntry(date = d, customerId = pr.id, noonQty = 0.0, eveningQty = 1.0, unitPrice = 8.0, deliveryCharge = 0.5))
    p = run("daily tiffins\n1. Pranav 1 tiffin at pasila", existing = ex)
    check("duplicate asks", p.question?.field == "dup", p.question?.title ?: "none")
    p = run("daily tiffins\n1. Pranav 1 tiffin at pasila", existing = ex, res = mapOf("t0" to EntryPlanner.Res(dup = "keep")))
    check("duplicate keep skips", p.question == null && p.lines[0].status == "skip")
    p = run("daily tiffins\n1. Pranav 1 tiffin at pasila", existing = ex, res = mapOf("t0" to EntryPlanner.Res(dup = "replace")))
    check("duplicate replace", p.question == null && p.lines[0].status == "save" && p.lines[0].replace.size == 1)
    p = run("daily tiffins\n1. Pranav leppavara 1 tiffin\n2. Pranav pasila 1 tiffin")
    check("same customer twice in message", p.question == null && p.lines[0].status == "save" && p.lines[1].status == "skip", p.lines.map { it.status }.toString() + p.question?.title)
    println(p.lines[1].notes)
    // different day existing is ok
    val ex2 = listOf(TiffinEntry(date = d.minusDays(1), customerId = pr.id, noonQty = 0.0, eveningQty = 1.0, unitPrice = 8.0, deliveryCharge = 0.5))
    p = run("daily tiffins\n1. Pranav 1 tiffin at pasila", existing = ex2)
    check("other day not duplicate", p.question == null && p.lines[0].status == "save")

    // orders
    p = run("Alacarte\n1. Tushar patel - 2 kg poha 12 euro at Pasila\nCatering\n1. Zorro - chole chana 10 euro")
    check("order unknown customer asks", p.question?.key == "o1", p.question?.key ?: "none")
    p = run("Alacarte\n1. Tushar patel - 2 kg poha 12 euro at Pasila")
    check("order saves", p.question == null && p.lines.size == 1 && p.lines[0].delivery == 0.5, p.lines.getOrNull(0)?.delivery.toString())
    // extra QA
    for ((txt, n, e, dl) in listOf(
        listOf("1) Pranav 2 tiffin evening at pasila", 0.0, 2.0, 1.0), listOf("- Pranav 1 noon at Iso Omena", 1.0, 0.0, 1.0),
        listOf("Pranav 3 tiffins Iso Omena", 0.0, 3.0, 3.0), listOf("Pranav 1 tiffin at Leppavaara", 0.0, 1.0, 0.5),
        listOf("Pranav 1 tiffin @ sello", 0.0, 1.0, 0.5), listOf("Pranav 2 tiffin at Helsinki station", 0.0, 2.0, 1.0),
        listOf("Pranav 1 tiffin at PASILA", 0.0, 1.0, 0.5), listOf("Pranav 2 noon 1 evening at pasila", 2.0, 1.0, 1.5)).map { Quad(it[0] as String, it[1] as Double, it[2] as Double, it[3] as Double) }) {
        val t = WhatsAppParser.parseTiffin(txt, 8.0)
        check("qa: $txt", t.noon == n && t.evening == e && Math.abs(t.delivery - dl) < 1e-9 && t.name == "Pranav", "noon=${t.noon} eve=${t.evening} del=${t.delivery} name='${t.name}' key=${t.placeKey}")
    }
    check("price override", WhatsAppParser.parseTiffin("Pranav 1 tiffin 9 euro at pasila", 8.0).price == 9.0)
    check("Aruna suggests Aroona", EntryPlanner.match("Aruna", c).candidates.any { it.name == "Aroona" })
    qa2()
    println(if (fails == 0) "ALL PASSED" else "$fails FAILED")
}

object Flow {
    // simulates the bot: asks questions, applies scripted answers, returns the final plan
    fun run(text: String, customers: List<Customer>, existing: List<TiffinEntry>, answers: List<String>, d: LocalDate): Pair<EntryPlanner.Plan, List<String>> {
        val res = mutableMapOf<String, EntryPlanner.Res>()
        val asked = mutableListOf<String>()
        var i = 0
        repeat(30) {
            val plan = EntryPlanner.plan(WhatsAppParser.parse(text, false, 8.0), d, customers, existing, res)
            val q = plan.question ?: return Pair(plan, asked)
            asked.add(q.title)
            val reply = answers.getOrNull(i++) ?: return Pair(plan, asked)
            val (r, err) = EntryPlanner.answer(q, res[q.key] ?: EntryPlanner.Res(), reply)
            if (r != null) res[q.key] = r else asked.add("ERR: $err")
        }
        error("loop")
    }
}

fun qa2() {
    val c = listOf("Pranav Bhatt", "Meenakshi Patel", "Parthiv Bhatt", "Tushar patel", "Kiran bhai parmar", "Aroona").map { Customer(name = it, phone = "1") }
    val d = LocalDate.of(2026, 10, 7)
    val ex = listOf(TiffinEntry(date = d, customerId = c[3].id, noonQty = 0.0, eveningQty = 1.0, unitPrice = 8.0, deliveryCharge = 0.5))
    // user's scenario: misspelt names and places in one list, answered by number or by typing
    val text = "Date - 07.10.26\ndaily tiffins\n1. Pranav 1 tiffin Lepavara\n2. Meena 2 tiffin passila\n3. Tushar patel 1 tiffin at pasila\n4. Aroona 1 tiffin at Iso Omena\n5. Kiran 1 tiffin at xyz\n6. Aruna 1 tiffin at station"
    val (plan, asked) = Flow.run(text, c, ex, listOf("1", "keep", "2", "2", "3", "arona", "1"), d)
    asked.forEach { println("  Q: $it") }
    println(plan.lines.joinToString("\n") { "  ${it.key} ${it.status} ${it.customer?.name ?: it.newName} ${it.placeLabel} ${it.delivery} ${it.notes}" })
    check("scenario completes", plan.question == null, plan.question?.title ?: "")
}

data class Quad(val a: String, val b: Double, val c: Double, val d: Double)
