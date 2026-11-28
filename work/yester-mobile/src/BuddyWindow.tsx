import React from "react";
import { Modal, Pressable, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import WebView from "./BrowserSurface";
import { openSharedFeed } from "./feedLink";

export default function BuddyWindow({uri, close, openFeed}: {
  uri: string; close: () => void; openFeed: (url: string) => void;
}) {
  return <Modal animationType="slide" onRequestClose={close}>
    <SafeAreaView style={{flex:1,backgroundColor:"#d4d1c7"}}>
      <Pressable accessibilityRole="button" onPress={close} style={{padding:12}}>
        <Text style={{fontWeight:"bold",color:"#252d43"}}>‹ Return to YESTER</Text>
      </Pressable>
      <WebView source={{uri}} domStorageEnabled
        originWhitelist={["*"]}
        injectedJavaScript={"if(location.origin==='https://buddy.roddy.world')window.buddyInYester=true;true;"}
        onMessage={event=>{
          if(event.nativeEvent.url.startsWith("https://buddy.roddy.world/") && event.nativeEvent.data==="close-buddy-share")close();
        }}
        onShouldStartLoadWithRequest={request=>{
          const feed=openSharedFeed(request.url);
          if(feed){close();openFeed(feed);return false;}
          try{return ["https://buddy.roddy.world","https://accounts.roddy.world"].includes(new URL(request.url).origin);}
          catch{return false;}
        }}
        onOpenWindow={event=>{
          if(event.nativeEvent.targetUrl==="https://accounts.roddy.world/") {
            void import("react-native").then(({Linking})=>Linking.openURL("https://accounts.roddy.world/")).catch(()=>{});
          }
        }}
      />
    </SafeAreaView>
  </Modal>;
}
