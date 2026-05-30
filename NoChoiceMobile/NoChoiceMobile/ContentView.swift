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

        webView.loadFileURL(playURL, allowingReadAccessTo: webRoot)
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

    private static let nativeLocationScript = WKUserScript(
        source: """
        (function() {
          if (window.__NO_CHOICE_NATIVE_GEO__) return;
          var callbacks = {};
          var nextId = 1;
          window.__NO_CHOICE_NATIVE_GEO__ = {
            deliver: function(id, payload) {
              var cb = callbacks[id];
              if (!cb) return;
              delete callbacks[id];
              cb.success(payload);
            },
            fail: function(id, message) {
              var cb = callbacks[id];
              if (!cb) return;
              delete callbacks[id];
              if (cb.error) cb.error({ code: 2, message: message || "定位失败" });
            }
          };
          Object.defineProperty(navigator, "geolocation", {
            configurable: true,
            value: {
              getCurrentPosition: function(success, error, options) {
                var id = String(nextId++);
                callbacks[id] = { success: success, error: error };
                window.webkit.messageHandlers.noChoiceLocation.postMessage({
                  type: "getCurrentPosition",
                  id: id,
                  options: options || {}
                });
              },
              watchPosition: function(success, error, options) {
                var id = String(nextId++);
                callbacks[id] = { success: success, error: error };
                window.webkit.messageHandlers.noChoiceLocation.postMessage({
                  type: "getCurrentPosition",
                  id: id,
                  options: options || {}
                });
                return id;
              },
              clearWatch: function(id) {
                delete callbacks[String(id)];
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
                locationManager.requestWhenInUseAuthorization()
            case .restricted, .denied:
                failPendingLocations("定位权限未开启")
            default:
                locationManager.requestLocation()
            }
        }

        func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
            if manager.authorizationStatus == .authorizedWhenInUse || manager.authorizationStatus == .authorizedAlways {
                manager.requestLocation()
            } else if manager.authorizationStatus == .restricted || manager.authorizationStatus == .denied {
                failPendingLocations("定位权限未开启")
            }
        }

        func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
            guard let location = locations.last else {
                failPendingLocations("没有拿到当前位置")
                return
            }

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
            failPendingLocations("定位失败")
        }

        private func failPendingLocations(_ message: String) {
            let ids = pendingLocationCallbackIds
            pendingLocationCallbackIds.removeAll()

            ids.forEach { id in
                let script = "window.__NO_CHOICE_NATIVE_GEO__ && window.__NO_CHOICE_NATIVE_GEO__.fail(\\\"\(Self.escapeJS(id))\\\", \\\"\(Self.escapeJS(message))\\\");"
                webView?.evaluateJavaScript(script)
            }
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
