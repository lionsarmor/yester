// Proton Mail submission requires STARTTLS before the SMTP token is sent.
async function sendProtonReset(env,recipient,resetUrl){
  const sender=env.RESET_EMAIL_FROM;
  const mailbox=/^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9.-]+$/;
  if(!mailbox.test(sender)||!mailbox.test(recipient))throw Error('Invalid mail address');
  const {connect}=await import('cloudflare:sockets');
  let socket=connect({hostname:'smtp.protonmail.ch',port:587},{secureTransport:'starttls'});
  const timeout=setTimeout(()=>socket.close().catch(()=>{}),15000);
  let reader,writer,buffer='';
  const encoder=new TextEncoder(),decoder=new TextDecoder();
  function attach(){
    socket.closed.catch(()=>{});
    reader=socket.readable.getReader();writer=socket.writable.getWriter();
  }
  async function reply(code){
    for(let lines=0;lines<64;lines++){
      while(!buffer.includes('\r\n')){
        const part=await reader.read();if(part.done)throw Error('Mail connection closed');
        buffer+=decoder.decode(part.value,{stream:true});
        if(buffer.length>32768)throw Error('Invalid mail reply');
      }
      const end=buffer.indexOf('\r\n'),line=buffer.slice(0,end);
      buffer=buffer.slice(end+2);
      if(Number(line.slice(0,3))!==code)throw Error('Mail server rejected step '+code);
      if(line[3]===' ')return;
      if(line[3]!=='-')throw Error('Invalid mail reply');
    }
    throw Error('Invalid mail reply');
  }
  async function command(line,code){await writer.write(encoder.encode(line+'\r\n'));await reply(code);}
  try{
    attach();await reply(220);
    await command('EHLO yestersites.com',250);await command('STARTTLS',220);
    reader.releaseLock();writer.releaseLock();buffer='';
    socket=socket.startTls();attach();await socket.opened;
    await command('EHLO yestersites.com',250);
    await command('AUTH PLAIN '+btoa('\0'+sender+'\0'+env.PROTON_SMTP_TOKEN),235);
    await command('MAIL FROM:<'+sender+'>',250);await command('RCPT TO:<'+recipient+'>',250);await command('DATA',354);
    await command(['From: YesterSites <'+sender+'>','To: <'+recipient+'>','Date: '+new Date().toUTCString(),
      'Message-ID: <'+crypto.randomUUID()+'@'+sender.split('@')[1]+'>','Subject: Reset your YesterSites password',
      'MIME-Version: 1.0','Content-Type: text/plain; charset=UTF-8','','Open this link within 30 minutes to choose a new password.',
      '',resetUrl,'','If you did not request this, you can ignore this email.','.'].join('\r\n'),250);
  }finally{clearTimeout(timeout);await socket.close().catch(()=>{});}
}
