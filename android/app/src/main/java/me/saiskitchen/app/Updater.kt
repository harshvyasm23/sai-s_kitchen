package me.saiskitchen.app

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.core.content.FileProvider
import org.json.JSONObject
import java.io.File
import java.net.HttpURLConnection
import java.net.URL

data class UpdateInfo(val build: Int, val url: String)

/**
 * Self-update: every push builds an APK on GitHub and publishes it as the "latest" release.
 * The app checks that release and offers a one-tap update. No Play Store needed.
 */
object Updater {
    /** Returns info if a newer build than the installed one exists, else null (also null when offline). */
    fun check(): UpdateInfo? = try {
        val conn = URL("https://api.github.com/repos/${BuildConfig.UPDATE_REPO}/releases/tags/latest").openConnection() as HttpURLConnection
        conn.connectTimeout = 8000
        conn.readTimeout = 8000
        conn.setRequestProperty("Accept", "application/vnd.github+json")
        if (conn.responseCode != 200) null else {
            val json = JSONObject(conn.inputStream.bufferedReader().use { it.readText() })
            val build = Regex("versionCode:\\s*(\\d+)").find(json.optString("body"))?.groupValues?.get(1)?.toIntOrNull()
            val assets = json.getJSONArray("assets")
            var url: String? = null
            for (i in 0 until assets.length()) {
                val a = assets.getJSONObject(i)
                if (a.getString("name").endsWith(".apk")) url = a.getString("browser_download_url")
            }
            if (build != null && url != null && build > BuildConfig.VERSION_CODE) UpdateInfo(build, url) else null
        }
    } catch (e: Exception) {
        null
    }

    fun download(context: Context, info: UpdateInfo): File {
        val dir = File(context.cacheDir, "updates").apply { mkdirs() }
        val file = File(dir, "update.apk")
        val conn = URL(info.url).openConnection() as HttpURLConnection
        conn.instanceFollowRedirects = true
        conn.connectTimeout = 15000
        conn.readTimeout = 60000
        conn.inputStream.use { input -> file.outputStream().use { input.copyTo(it) } }
        return file
    }

    /** Returns false when Android first needs the user to allow installs from this app (settings screen opens). */
    fun install(context: Context, file: File): Boolean {
        if (!context.packageManager.canRequestPackageInstalls()) {
            context.startActivity(
                Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
            return false
        }
        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        context.startActivity(
            Intent(Intent.ACTION_VIEW)
                .setDataAndType(uri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
        )
        return true
    }
}
