import ExpoModulesCore
import WebKit

public class YesterControlsModule: Module {
  private func browser(_ root: UIView?) -> WKWebView? {
    if let web = root as? WKWebView { return web }
    for child in root?.subviews ?? [] {
      if let web = browser(child) { return web }
    }
    return nil
  }
  public func definition() -> ModuleDefinition {
    Name("YesterControls")
    Events("shortcut")
    AsyncFunction("configure") { (silent: Bool, tap: Bool, promise: Promise) in
      guard let web = self.browser(self.appContext?.utilities?.currentViewController()?.view) else {
        promise.resolve(false)
        return
      }
      web.setAllMediaPlaybackSuspended(silent) { promise.resolve(true) }
    }.runOnQueue(.main)
  }
}
