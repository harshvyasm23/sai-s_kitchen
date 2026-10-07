package me.saiskitchen.app

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

@Composable
fun AppCard(modifier: Modifier = Modifier, onClick: (() -> Unit)? = null, content: @Composable ColumnScope.() -> Unit) {
    val m = if (onClick != null) modifier.clickable { onClick() } else modifier
    Card(
        modifier = m.fillMaxWidth(),
        shape = RoundedCornerShape(16.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        elevation = CardDefaults.cardElevation(defaultElevation = 3.dp),
    ) { Column(Modifier.padding(16.dp), content = content) }
}

@Composable
fun SummaryRow(label: String, value: String, isTotal: Boolean = false) {
    Row(Modifier.fillMaxWidth().padding(vertical = 4.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, fontWeight = if (isTotal) FontWeight.Bold else FontWeight.Normal,
            color = if (isTotal) MaterialTheme.colorScheme.onSurface else MaterialTheme.colorScheme.onSurfaceVariant)
        Text(value, fontWeight = FontWeight.Bold, color = if (isTotal) Brand.primary else MaterialTheme.colorScheme.onSurface,
            fontSize = if (isTotal) 18.sp else 14.sp)
    }
}

@Composable
fun EmptyState(icon: ImageVector, title: String, subtitle: String) {
    Column(Modifier.fillMaxWidth().padding(40.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Icon(icon, null, tint = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(48.dp))
        Spacer(Modifier.height(10.dp))
        Text(title, fontWeight = FontWeight.Bold, fontSize = 17.sp)
        Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
fun SearchField(value: String, onChange: (String) -> Unit, placeholder: String) {
    OutlinedTextField(
        value = value, onValueChange = onChange, singleLine = true, modifier = Modifier.fillMaxWidth(),
        placeholder = { Text(placeholder) }, leadingIcon = { Icon(Icons.Default.Search, null) },
        shape = RoundedCornerShape(12.dp),
    )
}

@Composable
fun NumberField(label: String, value: String, onChange: (String) -> Unit, modifier: Modifier = Modifier) {
    OutlinedTextField(
        value = value, onValueChange = onChange, label = { Text(label) }, singleLine = true,
        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal), modifier = modifier.fillMaxWidth(),
    )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DateField(label: String, date: LocalDate, onChange: (LocalDate) -> Unit, modifier: Modifier = Modifier) {
    var open by remember { mutableStateOf(false) }
    OutlinedButton(onClick = { open = true }, modifier = modifier) {
        Icon(Icons.Default.CalendarMonth, null)
        Spacer(Modifier.width(8.dp))
        Text("$label: ${Fmt.displayDate(date)}")
    }
    if (open) {
        val state = rememberDatePickerState(initialSelectedDateMillis = date.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli())
        DatePickerDialog(
            onDismissRequest = { open = false },
            confirmButton = {
                TextButton(onClick = {
                    state.selectedDateMillis?.let { onChange(Instant.ofEpochMilli(it).atZone(ZoneOffset.UTC).toLocalDate()) }
                    open = false
                }) { Text("OK") }
            },
            dismissButton = { TextButton(onClick = { open = false }) { Text("Cancel") } },
        ) { DatePicker(state = state) }
    }
}

/** Title + scrolling content for a main tab. */
@Composable
fun TabScreen(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxSize().statusBarsPadding().verticalScroll(rememberScrollState()).padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)) {
        Text(title, fontSize = 30.sp, fontWeight = FontWeight.Bold)
        content()
    }
}

/** Full screen with a back arrow, used for add/view screens. */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OverlayScaffold(
    title: String, onBack: () -> Unit, scrollable: Boolean = true,
    actions: @Composable RowScope.() -> Unit = {}, content: @Composable ColumnScope.() -> Unit,
) {
    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(title, fontWeight = FontWeight.Bold) },
                navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Filled.ArrowBack, "Back") } },
                actions = actions,
            )
        },
        containerColor = MaterialTheme.colorScheme.background,
    ) { inner ->
        val base = Modifier.fillMaxSize().padding(inner)
        Column(
            (if (scrollable) base.verticalScroll(rememberScrollState()) else base).padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(14.dp), content = content,
        )
    }
}

@Composable
fun EntryCard(title: String, subtitle: String, total: String, color: Color, trailing: @Composable () -> Unit = {}) {
    AppCard {
        Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Column(Modifier.weight(1f)) {
                Text(title, fontWeight = FontWeight.Bold, color = color, fontSize = 16.sp)
                Text(subtitle, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 13.sp)
            }
            Text(total, fontWeight = FontWeight.Bold, color = color, fontSize = 16.sp)
            trailing()
        }
    }
}

/** Search box + a fixed-height scrolling list, so you never scroll the whole page to find a customer. */
@Composable
fun CustomerPicker(customers: List<Customer>, selected: Set<String>, onChange: (Set<String>) -> Unit) {
    var query by remember { mutableStateOf("") }
    if (customers.isEmpty()) {
        Text("Add a customer first (Customers tab).", color = MaterialTheme.colorScheme.onSurfaceVariant)
        return
    }
    SearchField(query, { query = it }, "Search customer by name or phone...")
    if (selected.isNotEmpty()) {
        Row(Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(customers.filter { it.id in selected }.joinToString { it.name }, color = Brand.primary, fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp, modifier = Modifier.weight(1f))
            TextButton(onClick = { onChange(emptySet()) }) { Text("Clear") }
        }
    }
    val shown = customers.filter { query.isBlank() || it.name.contains(query, true) || it.phone.contains(query, true) }
    Spacer(Modifier.height(6.dp))
    Column(Modifier.fillMaxWidth().heightIn(max = 260.dp).verticalScroll(rememberScrollState())) {
        shown.forEach { c ->
            CustomerPickRow(c, c.id in selected) { onChange(if (c.id in selected) selected - c.id else selected + c.id) }
        }
        if (shown.isEmpty()) Text("No customer found.", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(8.dp))
    }
}

@Composable
fun CustomerPickRow(c: Customer, selected: Boolean, onToggle: () -> Unit) {
    Row(Modifier.fillMaxWidth().clickable { onToggle() }.padding(vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
        Checkbox(checked = selected, onCheckedChange = { onToggle() })
        Column {
            Text(c.name)
            Text(c.phone, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}

@Composable
fun GradientBox(modifier: Modifier = Modifier, content: @Composable BoxScope.() -> Unit) {
    Box(
        modifier.background(androidx.compose.ui.graphics.Brush.linearGradient(listOf(Brand.primary, Brand.secondary))),
        content = content,
    )
}
