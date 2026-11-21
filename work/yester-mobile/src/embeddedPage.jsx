import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { memberOf, SERVICE, webURL } from "./discovery";

function publicAddress(input) {
  const u = new URL(input);
  const member = memberOf(input);
  if (u.origin === SERVICE && member) {
    u.hostname = member + ".yestersites.com";
    u.pathname = u.pathname.replace(/^\/members\/[^/]+/, "") || "/";
  }
  u.searchParams.delete("surfer");
  return u.href;
}

export default forwardRef(function BrowserSurface(props, ref) {
  const url = publicAddress(props.source.uri);
  const parsed = new URL(url);
  const member = memberOf(url);
  const target = new URL(url);
  if (member) target.searchParams.set("surfer", "1");
  const frame = useRef(null);
  const latest = useRef(props);
  latest.current = props;
  const [version, setVersion] = useState(0);
  const [stopped, setStopped] = useState(false);
  const [ready, setReady] = useState(false);
  // An account or editor requires a first-party session. Never embed our own origin.
  const separate = parsed.origin === location.origin || parsed.origin === SERVICE ||
    parsed.origin === "https://retropage.yestersites.com" || parsed.protocol !== "https:";
  function notify() {
    setReady(true);
    latest.current.onNavigationStateChange?.({ url, title: parsed.hostname, loading:false,
      canGoBack:false, canGoForward:false });
    latest.current.onLoadEnd?.();
  }
  function audio() {
    const { muted, tap } = window.yesterMediaPreference || { muted:false, tap:true };
    if (member) frame.current?.contentWindow?.postMessage(
      {surfer:"sound", enabled:!muted && !tap, muted}, parsed.origin);
  }
  useEffect(() => {
    latest.current.onLoadStart?.();
    if (separate) notify();
    function receive(event) {
      if (!member || event.source !== frame.current?.contentWindow || event.origin !== parsed.origin) return;
      const data = event.data;
      if (data?.surfer === "ready" || data?.surfer === "link") {
        const valid = typeof data.url === "string" && webURL(data.url);
        if (!valid) return;
        const clean = publicAddress(valid);
        if (data.surfer === "link") latest.current.onOpenWindow?.({nativeEvent:{targetUrl:clean}});
        else if (new URL(clean).origin === parsed.origin) {
          setReady(true);
          latest.current.onNavigationStateChange?.({url:clean,title:new URL(clean).hostname,loading:false,canGoBack:false,canGoForward:false});
          audio();
        }
      }
    }
    window.addEventListener("message", receive);
    window.addEventListener("yester-audio", audio);
    return () => {window.removeEventListener("message",receive);window.removeEventListener("yester-audio",audio);};
  }, [url, version]);
  useImperativeHandle(ref, () => ({
    reload(){setReady(false);setStopped(false);setVersion(v=>v+1);},
    stopLoading(){setStopped(true);latest.current.onLoadEnd?.();},
  }));
  const link = <a href={url} target="_blank" rel="noopener noreferrer">Open {parsed.hostname} in a tab ↗</a>;
  return <div style={{flex:"1 1 0",minHeight:0,display:"flex",flexDirection:"column",background:"#fff",color:"#242025",font:"14px Arial,sans-serif"}}>
    {separate || !member ? <div style={{padding:"8px 12px",background:"#f4f1e7"}}>{separate ? "Continue to this site in its own tab. " : "If this site blocks embedded browsing, use its direct link. "}{link}</div> : null}
    {stopped ? <p style={{padding:12}}>Loading stopped. Select Reload to try again.</p> :
      !separate && <iframe key={version} ref={frame} inert={member && !ready ? true : undefined} data-member-media={member ? "1" : undefined} src={target.href} title={"Website · "+parsed.hostname}
        style={{border:0,width:"100%",flex:"1 1 0",minHeight:0}} allow="autoplay; fullscreen; gamepad; picture-in-picture; web-share"
        sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups allow-popups-to-escape-sandbox"
        onLoad={()=>{notify();audio();}} />}
  </div>;
});
