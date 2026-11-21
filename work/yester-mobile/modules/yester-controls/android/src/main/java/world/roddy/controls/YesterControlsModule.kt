package world.roddy.controls

import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.webkit.WebView
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.functions.Queues

class YesterControlsModule : Module() {
  private fun browser(root: View?): WebView? {
    if (root is WebView) return root
    if (root is ViewGroup) for (i in 0 until root.childCount) browser(root.getChildAt(i))?.let { return it }
    return null
  }

  override fun definition() = ModuleDefinition {
    Name("YesterControls")
    Events("shortcut")
    AsyncFunction("configure") { muted: Boolean, tap: Boolean ->
      val web = browser(appContext.currentActivity?.window?.decorView) ?: return@AsyncFunction false
      web.settings.mediaPlaybackRequiresUserGesture = tap
      web.setOnKeyListener { _, code, event ->
        val action = when (code) {
          KeyEvent.KEYCODE_L -> "address"
          KeyEvent.KEYCODE_DPAD_LEFT -> "back"
          KeyEvent.KEYCODE_DPAD_RIGHT -> "forward"
          else -> null
        }
        if (!event.isAltPressed || action == null) false else {
          if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) sendEvent("shortcut", mapOf("action" to action))
          true
        }
      }
      if (!WebViewFeature.isFeatureSupported(WebViewFeature.MUTE_AUDIO)) return@AsyncFunction false
      WebViewCompat.setAudioMuted(web, muted)
      WebViewCompat.isAudioMuted(web) == muted
    }.runOnQueue(Queues.MAIN)
  }
}
