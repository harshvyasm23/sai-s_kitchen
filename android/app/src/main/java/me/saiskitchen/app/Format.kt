package me.saiskitchen.app

import java.text.NumberFormat
import java.time.DayOfWeek
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.temporal.TemporalAdjusters
import java.util.Currency
import java.util.Locale

fun Double.cents(): Double = Math.round(this * 100.0) / 100.0
fun Double.clean(): String = if (this % 1.0 == 0.0) toLong().toString() else toString()
fun String.dec(): Double = replace(',', '.').trim().toDoubleOrNull() ?: 0.0

object Fmt {
    private val display = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.UK)

    fun currency(amount: Double, code: String = "EUR"): String {
        val f = NumberFormat.getCurrencyInstance(Locale.UK)
        f.currency = Currency.getInstance(code)
        f.minimumFractionDigits = 2
        f.maximumFractionDigits = 2
        return f.format(amount)
    }

    fun displayDate(d: LocalDate): String = d.format(display)
    fun startOfWeek(d: LocalDate = LocalDate.now()): LocalDate = d.with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
    fun startOfMonth(d: LocalDate = LocalDate.now()): LocalDate = d.withDayOfMonth(1)
    fun endOfMonth(d: LocalDate = LocalDate.now()): LocalDate = d.with(TemporalAdjusters.lastDayOfMonth())
    fun inRange(d: LocalDate, start: LocalDate, end: LocalDate): Boolean = !d.isBefore(start) && !d.isAfter(end)
}
