import nodemailer from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';

export function gmailNewsletterConfig(){
 const user=process.env.GMAIL_USER?.trim()||'',password=(process.env.GMAIL_APP_PASSWORD||'').replace(/\s/g,'');
 return {ready:/^[a-z0-9._%+-]+@gmail\.com$/i.test(user)&&/^[a-z0-9]{16}$/i.test(password),user,password,sender:'VITOENCODES <'+user+'>'};
}
export function gmailTransportOptions(){
 const config=gmailNewsletterConfig();
 return {host:'smtp.gmail.com',port:465,secure:true,auth:{user:config.user,pass:config.password},connectionTimeout:7000,greetingTimeout:7000,socketTimeout:12000,disableFileAccess:true,disableUrlAccess:true};
}
export async function sendGmailNewsletter(to:string,subject:string,text:string,key:string,unsubscribe?:string,sendMail?:(mail:Mail.Options)=>Promise<{accepted:unknown[]}>){
 const config=gmailNewsletterConfig();if(!config.ready)throw new Error('Newsletter Gmail is not configured yet.');
 const message:Mail.Options={from:config.sender,to,subject,text,messageId:'<'+key.replace(/[^a-zA-Z0-9.-]/g,'-')+'@gmail.com>',headers:unsubscribe?{'List-Unsubscribe':'<'+unsubscribe+'>','List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}:undefined};
 const transport=sendMail?undefined:nodemailer.createTransport(gmailTransportOptions());
 try{
  const result=sendMail?await sendMail(message):await transport!.sendMail(message);
  if(!result.accepted?.length)throw new Error();
 }catch{throw new Error('Email delivery was not confirmed. Check the Gmail app password and sending limits.');}
 finally{transport?.close();}
}
