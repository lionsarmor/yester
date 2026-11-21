import React from "react";
import WebView from "react-native-webview";

// No bridge, scripts, input, media permissions, or popups in the peek.
export default function PeekPage({ url }: { url: string }) {
  return <WebView source={{ uri: url }} style={{ flex: 1 }}
    javaScriptEnabled={false} domStorageEnabled={false} allowFileAccess={false}
    mediaPlaybackRequiresUserAction allowsFullscreenVideo={false}
    originWhitelist={["*"]} onOpenWindow={() => {}}
    onShouldStartLoadWithRequest={request => request.url === url} />;
}
