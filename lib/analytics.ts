import {database} from './database.ts';
import {normalizeSearch} from './catalog-search.ts';
export async function trackEvent(input:unknown){
 if(process.env.ANALYTICS_ENABLED==='false'||!input||typeof input!=='object')return;
 const value=input as Record<string,unknown>,kind=value.kind;if(!['view','mirror','search'].includes(String(kind)))return;
 let subject='';const db=await database();try{
  if(kind==='search'){
   if(typeof value.query!=='string'||value.query.length<2||value.query.length>80||/@|https?:|npg_|gh[pousr]_|password|token=/i.test(value.query))return;
   subject=normalizeSearch(value.query);if(subject.length<2||/^[\d\s+()-]{7,}$/.test(subject))return;
  }else{
   if(typeof value.releaseId!=='string'||value.releaseId.length>500)return;
   const row=await db.prepare("SELECT id FROM releases WHERE id=? AND status='published'").get(value.releaseId);if(!row)return;subject=value.releaseId;
  }
  await db.prepare('INSERT INTO analytics_daily(day,kind,subject,total) VALUES(?,?,?,1) ON CONFLICT(day,kind,subject) DO UPDATE SET total=analytics_daily.total+1').run(new Date().toISOString().slice(0,10),String(kind),subject);
 }finally{await db.close();}
}
export async function analyticsSummary(){const db=await database();try{
 const since=new Date(Date.now()-30*86400000).toISOString().slice(0,10);
 const totals=await db.prepare('SELECT kind,sum(total) AS n FROM analytics_daily WHERE day>=? GROUP BY kind').all(since);
 const popular=await db.prepare("SELECT a.subject,r.title,sum(a.total) AS n FROM analytics_daily a LEFT JOIN releases r ON r.id=a.subject WHERE a.day>=? AND a.kind='view' GROUP BY a.subject,r.title ORDER BY n DESC LIMIT 10").all(since);
 const searches=await db.prepare("SELECT subject,sum(total) AS n FROM analytics_daily WHERE day>=? AND kind='search' GROUP BY subject ORDER BY n DESC LIMIT 15").all(since);
 return {enabled:process.env.ANALYTICS_ENABLED!=='false',days:30,totals,popular,searches};
 }finally{await db.close();}}
