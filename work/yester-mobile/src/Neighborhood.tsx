import React, { useRef, useState } from "react";
import { BackHandler, Button, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import WebView from "react-native-webview";
import { memberAddress, openSharedFeed, viewerHome } from "./feedLink";
import { webURL } from "./discovery";

export default function Neighborhood({ address, openBrowser }: {address: string; openBrowser: (url?: string) => void}) {
  const view = useRef<WebView<object>>(null);
  const back = useRef(false);
  const [ticket]=useState(()=>[Math.random(),Math.random(),Date.now()].join("-"));
  const injectTicket="if(window===window.top && location.origin==='https://yestersites.com' && location.pathname==='/browse/')window.yesterTicket="+JSON.stringify(ticket)+";true;";
  const [failed,setFailed] = useState(false);
  React.useEffect(()=>{
    const listener=BackHandler.addEventListener("hardwareBackPress",()=>{
      if(!back.current)return false;
      view.current?.goBack();return true;
    });
    return ()=>listener.remove();
  },[]);
  const source=React.useMemo(()=>({uri:address}),[address]);
  return <SafeAreaView style={{flex:1, backgroundColor:"#d4d1c7"}}>
    {failed ? <View style={{padding:16,gap:8}}>
      <Text>The neighborhood couldn’t be reached.</Text>
      <Button title="Try again" onPress={()=>setFailed(false)}/>
      <Button title="Open browser" onPress={()=>openBrowser()}/>
    </View> : <WebView<object> ref={view} source={source} style={{flex:1}} applicationNameForUserAgent="YesterNeighborhood/1"
      allowsFullscreenVideo allowsInlineMediaPlayback domStorageEnabled injectedJavaScript={injectTicket}
      onError={()=>setFailed(true)}
      onNavigationStateChange={state=>{
        back.current=state.canGoBack;
        const href=webURL(state.url);
        if(href && !href.startsWith(viewerHome) && !href.startsWith("https://yestersites.com/account/connected/") &&
           !href.includes("/api/member-badge/connect?"))openBrowser(href);
      }}
      onOpenWindow={e=>{const href=webURL(e.nativeEvent.targetUrl);if(href)openBrowser(href);}}
      onMessage={e=>{

        try{
          if(new URL(e.nativeEvent.url).origin!=="https://yestersites.com")return;
          const message=JSON.parse(e.nativeEvent.data);
          if(message.ticket!==ticket)return;
          if(message.type==="browser"){const href=memberAddress(message.url);if(href)openBrowser(href);}
          if(message.type==="share"){
            const link=openSharedFeed(message.url);
            if(link)void Share.share({message:link,url:link}).catch(()=>{});
          }
        }catch{}
      }}
    />}
  </SafeAreaView>;
}
