import ExpoModulesCore
import UIKit
import WebKit

private let shortcutNotification = Notification.Name("world.roddy.yester.shortcut")

private extension UIViewController {
  @objc func yesterBrowserShortcut(_ sender: UIKeyCommand) {
    NotificationCenter.default.post(name: shortcutNotification, object: sender)
  }
}

public class YesterControlsModule: Module {
  @MainActor private weak var host: UIViewController?
  @MainActor private var commands: [UIKeyCommand] = []
  @MainActor private var observer: NSObjectProtocol?

  @MainActor private func browser(_ root: UIView?) -> WKWebView? {
    if let web = root as? WKWebView { return web }
    for child in root?.subviews ?? [] {
      if let web = browser(child) { return web }
    }
    return nil
  }

  @MainActor private func detachKeys() {
    for command in commands { host?.removeKeyCommand(command) }
    if let observer { NotificationCenter.default.removeObserver(observer) }
    commands = []
    observer = nil
    host = nil
  }

  @MainActor private func bindKeys(to controller: UIViewController) {
    guard host !== controller else { return }
    detachKeys()
    host = controller
    let actions = ["l": "address", UIKeyCommand.inputLeftArrow: "back", UIKeyCommand.inputRightArrow: "forward"]
    for input in actions.keys {
      let command = UIKeyCommand(input: input, modifierFlags: .alternate, action: #selector(UIViewController.yesterBrowserShortcut(_:)))
      command.wantsPriorityOverSystemBehavior = true
      controller.addKeyCommand(command)
      commands.append(command)
    }
    observer = NotificationCenter.default.addObserver(forName: shortcutNotification, object: nil, queue: .main) { [weak self] event in
      guard let key = event.object as? UIKeyCommand, let input = key.input, let action = actions[input] else { return }
      self?.sendEvent("shortcut", ["action": action])
    }
  }

  public func definition() -> ModuleDefinition {
    Name("YesterControls")
    Events("shortcut")
    OnDestroy { Task { @MainActor in self.detachKeys() } }
    AsyncFunction("tick") {
      UISelectionFeedbackGenerator().selectionChanged()
    }.runOnQueue(.main)
    AsyncFunction("configure") { (silent: Bool, _: Bool, promise: Promise) in
      Task { @MainActor in
        guard let controller = self.appContext?.utilities?.currentViewController(),
              let web = self.browser(controller.view) else {
          promise.resolve(false)
          return
        }
        self.bindKeys(to: controller)
        web.setAllMediaPlaybackSuspended(silent) { promise.resolve(true) }
      }
    }
  }
}
