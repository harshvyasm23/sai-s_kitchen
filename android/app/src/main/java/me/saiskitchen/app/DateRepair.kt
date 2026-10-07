package me.saiskitchen.app

import java.time.LocalDate
import java.time.LocalDateTime
import java.time.ZoneOffset

/**
 * Old backups contain hand-typed dates such as "2026–01-30" (long dash), "19-12-2025", "2026-0924", "2025-09" or "2026-03-22-".
 * Instead of silently losing those entries we repair them and tell the user. [note] is set whenever the date was guessed or changed.
 */
object DateRepair {
    data class Result(val date: LocalDate, val note: String?)

    fun parse(raw: String, createdAtMs: Long?): Result? {
        val clean = raw.trim()
        if (Regex("""\d{4}-\d{2}-\d{2}(?:T.*)?""").matches(clean)) {
            return runCatching { Result(LocalDate.parse(clean.take(10)), null) }.getOrNull()
        }
        val s = clean.replace(Regex("[\\u2010-\\u2015\\u2212/.]"), "-").trim('-', ' ')
        val created = createdAtMs?.let { LocalDateTime.ofEpochSecond(it / 1000, 0, ZoneOffset.UTC).toLocalDate() }
        fun make(y: Int, m: Int, d: Int): LocalDate? = runCatching { LocalDate.of(y, m, d) }.getOrNull()
        fun repaired(d: LocalDate?, how: String): Result? {
            if (d == null) return null
            // an entry is not typed years before it is created: if the guess is far off, trust the day it was entered
            if (created != null && (d.isAfter(created.plusDays(1)) || d.isBefore(created.minusDays(62)))) {
                return Result(created, "date \"$raw\" was unclear - used the day it was entered ($created)")
            }
            return Result(d, "date \"$raw\" read as $d")
        }
        Regex("""^(\d{4})-(\d{1,2})-(\d{1,2})$""").find(s)?.let { return repaired(make(it.groupValues[1].toInt(), it.groupValues[2].toInt(), it.groupValues[3].toInt()), "ymd") }
        Regex("""^(\d{4})-(\d{2})(\d{2})$""").find(s)?.let { return repaired(make(it.groupValues[1].toInt(), it.groupValues[2].toInt(), it.groupValues[3].toInt()), "ymd") }
        Regex("""^(\d{1,2})-(\d{1,2})-(\d{4})$""").find(s)?.let { return repaired(make(it.groupValues[3].toInt(), it.groupValues[2].toInt(), it.groupValues[1].toInt()), "dmy") }
        Regex("""^(\d{4})-(\d{1,2})$""").find(s)?.let { m ->
            val first = make(m.groupValues[1].toInt(), m.groupValues[2].toInt(), 1) ?: return null
            // only the month is known: use the day it was entered when that is in the same month, else the 1st
            val day = if (created != null && created.year == first.year && created.month == first.month) created else first
            return Result(day, "date \"$raw\" had no day - used $day, please check")
        }
        return null
    }
}
