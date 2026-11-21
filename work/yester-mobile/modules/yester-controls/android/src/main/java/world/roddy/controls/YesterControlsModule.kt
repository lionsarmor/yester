package world.roddy.controls

import android.os.Handler
import android.os.Looper
import android.view.KeyEvent
import android.view.View
import android.view.ViewGroup
import android.view.Window
import android.webkit.WebView
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.lang.ref.WeakReference

private class BrowserKeys(
  val previous: Window.Callback,
  module: YesterControlsModule
) : Window.Callback by previous {
  private val owner = WeakReference(module)

  private fun route(event: KeyEvent): Boolean {
    if (!event.isAltPressed || event.isCtrlPressed || event.isMetaPressed) return false
    val action = when (event.keyCode) {
      KeyEvent.KEYCODE_L -> "address"
      KeyEvent.KEYCODE_DPAD_LEFT -> "back"
      KeyEvent.KEYCODE_DPAD_RIGHT -> "forward"
      else -> return false
    }
    val controls = owner.get() ?: return false
    if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
      controls.sendEvent("shortcut", mapOf("action" to action))
    }
    return true
  }

  override fun dispatchKeyEvent(event: KeyEvent) =
    route(event) || previous.dispatchKeyEvent(event)

  override fun dispatchKeyShortcutEvent(event: KeyEvent) =
    route(event) || previous.dispatchKeyShortcutEvent(event)
}

class YesterControlsModule : Module() {
  private var window: WeakReference<Window>? = null
  private var keys: BrowserKeys? = null

  private fun browser(root: View?): WebView? {
    if (root is WebView) return root
    if (root is ViewGroup) for (i in 0 until root.childCount) {
      browser(root.getChildAt(i))?.let { return it }
    }
    return null
  }

  private fun detach() {
    val k = keys
    window?.get()?.let { if (k != null && it.callback === k) it.callback = k.previous }
    window = null
    keys = null
  }

  private fun bind(target: Window) {
    if (window?.get() === target && keys != null) return
    detach()
    val callback = target.callback ?: return
    keys = BrowserKeys(callback, this).also { target.callback = it }
    window = WeakReference(target)
  }

  override fun definition() = ModuleDefinition {
    Name("YesterControls")
    Events("shortcut")
    OnDestroy { Handler(Looper.getMainLooper()).post { detach() } }
    AsyncFunction("configure") { muted: Boolean, tap: Boolean ->
      val target = appContext.currentActivity?.window ?: return@AsyncFunction false
      bind(target)
      val web = browser(target.decorView) ?: return@AsyncFunction false
      web.settings.mediaPlaybackRequiresUserGesture = tap
      if (!WebViewFeature.isFeatureSupported(WebViewFeature.MUTE_AUDIO)) return@AsyncFunction false
      WebViewCompat.setAudioMuted(web, muted)
      WebViewCompat.isAudioMuted(web) == muted
    }.runOnQueue(Queues.MAIN)
  }
}
