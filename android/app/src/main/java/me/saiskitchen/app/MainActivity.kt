package me.saiskitchen.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AddCircle
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.People
import androidx.compose.material.icons.filled.Settings
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.ui.Alignment
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val store = KitchenStore.get(applicationContext)
        TelegramBot.schedule(applicationContext)
        val shared = sharedText(intent)
        setContent { SaiTheme(store.themeMode) { AppRoot(store, shared) } }
    }

    private fun sharedText(i: Intent?): String? =
        if (i?.action == Intent.ACTION_SEND && i.type?.startsWith("text/") == true) i.getStringExtra(Intent.EXTRA_TEXT) else null
}

private data class TabItem(val label: String, val icon: ImageVector)

private val TABS = listOf(
    TabItem("Dashboard", Icons.Default.Dashboard),
    TabItem("Customers", Icons.Default.People),
    TabItem("New Entry", Icons.Default.AddCircle),
    TabItem("Reports", Icons.Default.BarChart),
    TabItem("Invoices", Icons.Default.Description),
    TabItem("Settings", Icons.Default.Settings),
)

@Composable
fun AppRoot(store: KitchenStore, sharedText: String? = null) {
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var overlay by rememberSaveable { mutableStateOf<String?>(if (sharedText != null) "whatsapp" else null) }
    var pasted by rememberSaveable { mutableStateOf(sharedText ?: "") }
    var update by remember { mutableStateOf<UpdateInfo?>(null) }
    LaunchedEffect(Unit) { update = withContext(Dispatchers.IO) { Updater.check() } }
    val appContext = LocalContext.current.applicationContext
    LaunchedEffect(Unit) {
        while (true) {
            if (TelegramBot.isConfigured(appContext)) TelegramBot.poll(appContext, store)
            kotlinx.coroutines.delay(15_000)
        }
    }

    if (overlay != null) {
        BackHandler { overlay = null }
        val close = { overlay = null }
        when (overlay) {
            "whatsapp" -> WhatsAppScreen(store, pasted) { pasted = ""; close() }
            "tiffin" -> AddTiffinScreen(store, close)
            "catering" -> AddCateringScreen(store, close)
            "all" -> AllEntriesScreen(store, close)
            "monthly" -> MonthlyEntriesScreen(store, close)
            "invoice" -> GenerateInvoiceScreen(store, close)
            "outstanding" -> OutstandingScreen(store, close)
            "bulk" -> BulkInvoicesScreen(store, close)
            "datacheck" -> DataCheckScreen(store, close)
            "names" -> StandardizeNamesScreen(store, close)
        }
        return
    }

    Scaffold(
        containerColor = MaterialTheme.colorScheme.background,
        bottomBar = {
            Column {
            update?.let { UpdateBanner(it) }
            NavigationBar {
                TABS.forEachIndexed { i, t ->
                    NavigationBarItem(
                        selected = tab == i, onClick = { tab = i },
                        icon = { Icon(t.icon, t.label) },
                        label = { Text(t.label, maxLines = 1, style = MaterialTheme.typography.labelSmall) },
                        alwaysShowLabel = true,
                    )
                }
            }
            }
        },
    ) { inner ->
        androidx.compose.foundation.layout.Box(Modifier.fillMaxSize().padding(bottom = inner.calculateBottomPadding())) {
            when (tab) {
                0 -> DashboardScreen(store)
                1 -> CustomersScreen(store)
                2 -> NewEntryScreen { overlay = it }
                3 -> ReportsScreen(store)
                4 -> InvoicesScreen { overlay = it }
                5 -> SettingsScreen(store) { overlay = it }
            }
        }
    }
}

@Composable
private fun UpdateBanner(info: UpdateInfo) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var status by remember { mutableStateOf("New version available") }
    var busy by remember { mutableStateOf(false) }
    Row(
        Modifier.fillMaxWidth().background(Brand.primary).padding(horizontal = 16.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(status, color = androidx.compose.ui.graphics.Color.White, fontWeight = androidx.compose.ui.text.font.FontWeight.SemiBold)
        TextButton(enabled = !busy, onClick = {
            busy = true; status = "Downloading update..."
            scope.launch {
                val file = withContext(Dispatchers.IO) { runCatching { Updater.download(context, info) }.getOrNull() }
                if (file == null) { status = "Download failed. Try again."; busy = false }
                else {
                    status = if (Updater.install(context, file)) "Tap Install on the next screen" else "Allow installs for this app, then tap Update again"
                    busy = false
                }
            }
        }) { Text("UPDATE", color = androidx.compose.ui.graphics.Color.White, fontWeight = androidx.compose.ui.text.font.FontWeight.Bold) }
    }
}
