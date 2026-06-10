import CoreLocation
import SwiftUI
import UIKit
import WebKit

struct ContentView: View {
    var body: some View {
        NoChoiceWebView()
            .ignoresSafeArea()
    }
}

private struct NoChoiceWebView: UIViewRepresentable {
    func makeCoordinator() -> Coordinator {
        Coordinator()
    }

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.defaultWebpagePreferences.allowsContentJavaScript = true
        configuration.allowsInlineMediaPlayback = true
        configuration.mediaTypesRequiringUserActionForPlayback = []
        configuration.websiteDataStore = .default()
        configuration.userContentController.addUserScript(Self.nativeLocationScript)
        configuration.userContentController.add(context.coordinator, name: "noChoiceLocation")

        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.navigationDelegate = context.coordinator
        webView.uiDelegate = context.coordinator
        webView.scrollView.contentInsetAdjustmentBehavior = .never
        webView.isOpaque = false
        webView.backgroundColor = UIColor(red: 0.91, green: 0.86, blue: 0.77, alpha: 1.0)
        context.coordinator.webView = webView

        guard
            let webRoot = Bundle.main.url(forResource: "WebApp", withExtension: nil),
            let playURL = Bundle.main.url(forResource: "play", withExtension: "html", subdirectory: "WebApp")
        else {
            webView.loadHTMLString(Self.missingBundleHTML, baseURL: nil)
            return webView
        }

        webView.loadFileURL(Self.launchURL(for: playURL), allowingReadAccessTo: webRoot)
        return webView
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}

    static func dismantleUIView(_ uiView: WKWebView, coordinator: Coordinator) {
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "noChoiceLocation")
    }

    private static let missingBundleHTML = """
    <!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
    <body style="font-family:-apple-system;padding:28px;background:#f3ecdd;color:#1a1714">
      <h2>App 资源没有打包进来</h2>
      <p>请确认 WebApp 文件夹已加入 Xcode 的 Copy Bundle Resources。</p>
    </body>
    """

    private static func launchURL(for playURL: URL) -> URL {
        let debugModes: [String: String] = [
            "--debug-group": "group",
            "--debug-input": "input",
            "--debug-confirm": "confirm",
            "--debug-deck": "deck",
            "--debug-deck-group": "deck-group",
            "--debug-detail": "detail",
        ]
        let arguments = ProcessInfo.processInfo.arguments
        guard let debugMode = debugModes.first(where: { arguments.contains($0.key) })?.value,
              var components = URLComponents(url: playURL, resolvingAgainstBaseURL: false)
        else {
            return playURL
        }
        components.queryItems = [URLQueryItem(name: "debug", value: debugMode)]
        return components.url ?? playURL
    }

    private static let nativeLocationScript = WKUserScript(
        source: """
        (function() {
          if (window.__NO_CHOICE_NATIVE_GEO__) return;
          var callbacks = {};
          var nextId = 1;
          function timeoutFor(options) {
            var raw = options && Number(options.timeout);
            if (!isFinite(raw) || raw <= 0) return 10000;
            return Math.max(1000, Math.min(30000, raw));
          }
          function clearCallbackTimer(cb) {
            if (cb && cb.timer) clearTimeout(cb.timer);
          }
          function makeTimeout(id, options) {
            return setTimeout(function() {
              var cb = callbacks[id];
              if (!cb) return;
              delete callbacks[id];
              if (cb.error) cb.error({ code: 3, message: "定位超时" });
            }, timeoutFor(options));
          }
          window.__NO_CHOICE_NATIVE_GEO__ = {
            deliver: function(id, payload) {
              var cb = callbacks[id];
              if (!cb) return;
              delete callbacks[id];
              clearCallbackTimer(cb);
              cb.success(payload);
            },
            fail: function(id, message, code) {
              var cb = callbacks[id];
              if (!cb) return;
              delete callbacks[id];
              clearCallbackTimer(cb);
              if (cb.error) cb.error({ code: code || 2, message: message || "定位失败" });
            }
          };
          Object.defineProperty(navigator, "geolocation", {
            configurable: true,
            value: {
              getCurrentPosition: function(success, error, options) {
                var id = String(nextId++);
                callbacks[id] = { success: success, error: error, timer: makeTimeout(id, options || {}) };
                window.webkit.messageHandlers.noChoiceLocation.postMessage({
                  type: "getCurrentPosition",
                  id: id,
                  options: options || {}
                });
              },
              watchPosition: function(success, error, options) {
                var id = String(nextId++);
                callbacks[id] = { success: success, error: error, timer: makeTimeout(id, options || {}) };
                window.webkit.messageHandlers.noChoiceLocation.postMessage({
                  type: "getCurrentPosition",
                  id: id,
                  options: options || {}
                });
                return id;
              },
              clearWatch: function(id) {
                var key = String(id);
                clearCallbackTimer(callbacks[key]);
                delete callbacks[key];
              }
            }
          });
        })();
        """,
        injectionTime: .atDocumentStart,
        forMainFrameOnly: false
    )
}

extension NoChoiceWebView {
    final class Coordinator: NSObject, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandler, CLLocationManagerDelegate {
        weak var webView: WKWebView?

        private let locationManager = CLLocationManager()
        private var pendingLocationCallbackIds: [String] = []
        private var locationTimeoutWorkItem: DispatchWorkItem?

        override init() {
            super.init()
            locationManager.delegate = self
            locationManager.desiredAccuracy = kCLLocationAccuracyNearestTenMeters
        }

        func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
            guard message.name == "noChoiceLocation",
                  let body = message.body as? [String: Any],
                  let id = body["id"] as? String
            else { return }

            pendingLocationCallbackIds.append(id)
            requestLocation()
        }

        private func requestLocation() {
            switch locationManager.authorizationStatus {
            case .notDetermined:
                scheduleLocationTimeout()
                locationManager.requestWhenInUseAuthorization()
            case .restricted, .denied:
                failPendingLocations("定位权限未开启")
            default:
                scheduleLocationTimeout()
                locationManager.requestLocation()
                locationManager.startUpdatingLocation()
            }
        }

        func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
            if manager.authorizationStatus == .authorizedWhenInUse || manager.authorizationStatus == .authorizedAlways {
                guard !pendingLocationCallbackIds.isEmpty else { return }
                scheduleLocationTimeout()
                manager.requestLocation()
                manager.startUpdatingLocation()
            } else if manager.authorizationStatus == .restricted || manager.authorizationStatus == .denied {
                failPendingLocations("定位权限未开启")
            }
        }

        func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
            guard let location = locations.last else {
                failPendingLocations("没有拿到当前位置")
                return
            }
            locationManager.stopUpdatingLocation()
            cancelLocationTimeout()

            let ids = pendingLocationCallbackIds
            pendingLocationCallbackIds.removeAll()

            let heading: Any = location.course >= 0 ? location.course : NSNull()
            let speed: Any = location.speed >= 0 ? location.speed : NSNull()
            let payload: [String: Any] = [
                "coords": [
                    "latitude": location.coordinate.latitude,
                    "longitude": location.coordinate.longitude,
                    "accuracy": max(location.horizontalAccuracy, 0),
                    "altitude": NSNull(),
                    "altitudeAccuracy": NSNull(),
                    "heading": heading,
                    "speed": speed
                ],
                "timestamp": Date().timeIntervalSince1970 * 1000
            ]

            guard let json = Self.jsonString(payload) else {
                failPendingLocations("定位数据格式异常")
                return
            }

            ids.forEach { id in
                let script = "window.__NO_CHOICE_NATIVE_GEO__ && window.__NO_CHOICE_NATIVE_GEO__.deliver(\\\"\(Self.escapeJS(id))\\\", \(json));"
                webView?.evaluateJavaScript(script)
            }
        }

        func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
            locationManager.stopUpdatingLocation()
            failPendingLocations("定位失败")
        }

        private func failPendingLocations(_ message: String) {
            cancelLocationTimeout()
            let ids = pendingLocationCallbackIds
            pendingLocationCallbackIds.removeAll()

            ids.forEach { id in
                let script = "window.__NO_CHOICE_NATIVE_GEO__ && window.__NO_CHOICE_NATIVE_GEO__.fail(\\\"\(Self.escapeJS(id))\\\", \\\"\(Self.escapeJS(message))\\\");"
                webView?.evaluateJavaScript(script)
            }
        }

        private func scheduleLocationTimeout() {
            cancelLocationTimeout()
            let item = DispatchWorkItem { [weak self] in
                guard let self, !self.pendingLocationCallbackIds.isEmpty else { return }
                self.locationManager.stopUpdatingLocation()
                self.failPendingLocations("定位超时")
            }
            locationTimeoutWorkItem = item
            DispatchQueue.main.asyncAfter(deadline: .now() + 10, execute: item)
        }

        private func cancelLocationTimeout() {
            locationTimeoutWorkItem?.cancel()
            locationTimeoutWorkItem = nil
        }

        func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
            guard let url = navigationAction.request.url else {
                decisionHandler(.allow)
                return
            }

            if shouldOpenExternally(url) {
                UIApplication.shared.open(url)
                decisionHandler(.cancel)
                return
            }

            decisionHandler(.allow)
        }

        private func shouldOpenExternally(_ url: URL) -> Bool {
            let scheme = (url.scheme ?? "").lowercased()
            let host = (url.host ?? "").lowercased()

            if scheme == "iosamap" || scheme == "amapuri" {
                return true
            }

            if host == "uri.amap.com" || host == "www.amap.com" {
                return true
            }

            return false
        }

        func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
            guard let presenter = Self.topViewController() else {
                completionHandler()
                return
            }

            let alert = UIAlertController(title: "不做选择", message: message, preferredStyle: .alert)
            alert.addAction(UIAlertAction(title: "好", style: .default) { _ in completionHandler() })
            presenter.present(alert, animated: true)
        }

        private static func jsonString(_ object: Any) -> String? {
            guard JSONSerialization.isValidJSONObject(object),
                  let data = try? JSONSerialization.data(withJSONObject: object)
            else { return nil }
            return String(data: data, encoding: .utf8)
        }

        private static func escapeJS(_ value: String) -> String {
            value
                .replacingOccurrences(of: "\\", with: "\\\\")
                .replacingOccurrences(of: "\"", with: "\\\"")
                .replacingOccurrences(of: "\n", with: "\\n")
                .replacingOccurrences(of: "\r", with: "\\r")
        }

        private static func topViewController() -> UIViewController? {
            let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
            let window = scenes.flatMap { $0.windows }.first { $0.isKeyWindow }
            var controller = window?.rootViewController

            while let presented = controller?.presentedViewController {
                controller = presented
            }

            return controller
        }
    }
}
