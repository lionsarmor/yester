const { withAndroidManifest, withInfoPlist } = require("expo/config-plugins");

// A hand-typed old-web address can legitimately use HTTP. The catalog and editor
// endpoints use HTTPS, and the WebView still blocks mixed content on secure pages.
module.exports = (config) =>
  withInfoPlist(
    withAndroidManifest(config, (result) => {
      result.modResults.manifest.application[0].$[
        "android:usesCleartextTraffic"
      ] = "true";
      return result;
    }),
    (result) => {
      result.modResults.NSAppTransportSecurity = {
        ...result.modResults.NSAppTransportSecurity,
        NSAllowsArbitraryLoadsInWebContent: true,
      };
      return result;
    },
  );
