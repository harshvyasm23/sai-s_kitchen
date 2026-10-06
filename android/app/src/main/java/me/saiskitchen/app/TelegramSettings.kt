package me.saiskitchen.app

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlinx.coroutines.launch

@Composable
fun TelegramCard(store: KitchenStore) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var token by remember { mutableStateOf("") }
    var version by remember { mutableIntStateOf(0) }
    var status by remember { mutableStateOf<String?>(null) }
    val configured = remember(version) { TelegramBot.isConfigured(context) }
    val connected = remember(version) { TelegramBot.isConnected(context) }
    val code = remember(version) { TelegramBot.pairingCode(context) }

    AppCard {
        Text("Telegram Chat Entry", fontWeight = FontWeight.Bold)
        Text("Message your own Telegram bot the daily list; the app saves it and the bot replies.", fontSize = 12.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(8.dp))
        if (!configured) {
            Text("1. In Telegram open @BotFather, send /newbot, follow the steps.\n2. Copy the token it gives you and paste it below.", fontSize = 13.sp)
            OutlinedTextField(token, { token = it }, label = { Text("Bot token") }, singleLine = true, modifier = Modifier.fillMaxWidth())
            Button(onClick = { TelegramBot.saveToken(context, token); token = ""; version++ }, enabled = token.contains(":")) { Text("Save token") }
        } else {
            if (!connected) {
                Text("3. Open your bot in Telegram and send:\n/start $code", fontWeight = FontWeight.Bold)
                Text("Then tap Check now.", fontSize = 12.sp)
            } else {
                Text("✅ Connected (${TelegramBot.chats(context).size} chat(s)). Messages are checked every 15 seconds while the app is open and about every 15 minutes in the background.", fontSize = 13.sp)
                if (code.isNotEmpty()) Text("To add another person: they send your bot\n/start $code", fontWeight = FontWeight.Bold, fontSize = 13.sp)
                else TextButton(onClick = { TelegramBot.newCode(context); version++ }) { Text("Add another person / chat") }
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = { scope.launch { status = "Checking..."; status = TelegramBot.poll(context, store); version++ } }) { Text("Check now") }
                TextButton(onClick = { TelegramBot.disconnect(context); status = null; version++ }) { Text("Disconnect") }
            }
        }
        status?.let { Text(it, fontSize = 12.sp, color = MaterialTheme.colorScheme.onSurfaceVariant) }
    }
}
