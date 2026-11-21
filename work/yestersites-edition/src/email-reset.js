async function resetSignature(hash,payload){
  const enc=new TextEncoder(),key=await crypto.subtle.importKey('raw',enc.encode(hash),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  return hexBytes(await crypto.subtle.sign('HMAC',key,enc.encode('yestersites-password-reset:'+payload)));
}
async function emailRecovery(request,u,env){
  const db=env.DB,ask=u.pathname==='/forgot/',post=request.method==='POST';
  if(!['GET','POST'].includes(request.method))throw new Issue('Method not allowed.',405);
  if((!env.PROTON_SMTP_TOKEN && !env.RESEND_API_KEY) || !env.RESET_EMAIL_FROM)return accountWindow('Password recovery','<p>Email delivery is awaiting setup. You can reset your password with your saved <a href="/recover/">recovery key</a>.</p>');
  if(post && request.headers.get('origin')!==u.origin)throw new Issue('Submit this form from YesterSites.',403);
  const f=post?new URLSearchParams(await readLimited(request,4096)):null;
  if(ask){
    if(!post)return accountWindow('Email a password reset link','<form method="post"><label>Account email<input name="email" type="email" autocomplete="email" maxlength="254" required></label><button>Email reset link</button></form><a href="/recover/">Use a recovery key</a>');
    const email=(f.get('email')||'').trim().toLowerCase();
    if(email.length>254 || !/^\S+@\S+\.\S+$/.test(email))throw new Issue('Enter a valid email address.');
    await throttle(db,request,'reset:'+email);
    const row=await db.prepare('SELECT owner,hash FROM local_accounts WHERE email=?').bind(email).first();
    if(row){
      const payload=[encodeURIComponent(row.owner),Math.floor(Date.now()/1000)+1800,token()].join('.');
      const url=new URL('/reset/',serviceHome);url.searchParams.set('token',payload+'.'+await resetSignature(row.hash,payload));
      if(env.PROTON_SMTP_TOKEN){
        try{await sendProtonReset(env,email,url.href);}catch{console.warn('Proton password reset delivery failed');}
      }else {
      const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json'},body:JSON.stringify({from:env.RESET_EMAIL_FROM,to:[email],subject:'Reset your YesterSites password',text:'Use this link within 30 minutes to choose a new password.\n\n'+url.href+'\n\nIf you did not request this, you can ignore this message.'})});
      if(!response.ok)console.warn('Password reset delivery failed with provider status',response.status);
      }
    }
    return accountWindow('Check your email','<p>If the address belongs to an account, look for a reset link. It expires in 30 minutes.</p><a href="/recover/">Use a recovery key</a>');
  }
  const code=post?f.get('token'):u.searchParams.get('token');
  const match=/^([\w:%-]{1,160})\.(\d{10})\.([0-9a-f]{64})\.([0-9a-f]{64})$/.exec(code||'');
  const expired=()=>accountWindow('Reset link expired','<p>Request a <a href="/forgot/">fresh reset link</a>.</p>',400);
  if(!match || +match[2]<Math.floor(Date.now()/1000))return expired();
  const owner=decodeURIComponent(match[1]),row=await db.prepare('SELECT hash FROM local_accounts WHERE owner=?').bind(owner).first();
  if(!row || !equalHash(await resetSignature(row.hash,code.slice(0,-65)),match[4]))return expired();
  if(!post){
    const page=accountWindow('Choose a new password','<form method="post" action="/reset/"><input type="hidden" name="token" value="'+e(code)+'"><label>New password<input type="password" name="password" minlength="15" maxlength="256" autocomplete="new-password" required></label><button>Save password</button></form>');
    page.headers.set('Referrer-Policy','no-referrer');return page;
  }
  const pw=f.get('password')||'';if(pw.length<15 || pw.length>256)throw new Issue('Use 15–256 characters.');
  const next=await newHash(pw);
  const [result]=await db.batch([db.prepare('UPDATE local_accounts SET hash=?,salt=?,rounds=? WHERE owner=? AND hash=?').bind(next.hash,next.salt,next.rounds,owner,row.hash),db.prepare('DELETE FROM member_sessions WHERE owner=? AND changes()>0').bind(owner)]);
  return result.meta.changes?startSession(db,owner,'/account/',request):expired();
}
