import React from "react";

export default function PeekPage({ url }: { url: string }) {
  return <iframe title="Page preview" src={url} sandbox="" tabIndex={-1}
    allow="autoplay 'none'; camera 'none'; microphone 'none'" referrerPolicy="no-referrer"
    style={{border:0, width:"100%", flex:1, pointerEvents:"none"}} />;
}
