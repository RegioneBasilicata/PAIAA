'use strict';
const {createHash}=require('node:crypto');
const {SOURCES}=require('../assets/workflow4');
const SOURCES_LIST=SOURCES.map(s=>({id:s.id,title:s.title,url:s.url}));
const digest=s=>createHash('sha256').update(s).digest('hex');
function normalize(text){return text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim()}
async function retrieve(source,fetcher=fetch){
 const allowed=new Set(SOURCES_LIST.map(s=>new URL(s.url).hostname));let url=new URL(source.url);
 for(let n=0;n<5;n++){
  if(url.protocol!=='https:'||!allowed.has(url.hostname)||url.username||url.password||url.port)throw Error('Destinazione non consentita');
  const r=await fetcher(url,{redirect:'manual',signal:AbortSignal.timeout(10000),headers:{'User-Agent':'PAIAA-Regulatory-Monitor/4.0','Accept':'text/html,application/xhtml+xml,text/plain'}});
  if([301,302,303,307,308].includes(r.status)){url=new URL(r.headers.get('location'),url);continue}
  if(!r.ok)throw Error('Fonte non disponibile (HTTP '+r.status+')');
  if(!/text\/html|application\/xhtml\+xml|text\/plain/i.test(r.headers.get('content-type')||''))throw Error('Formato della fonte non supportato');
  const reader=r.body.getReader();let size=0,chunks=[];
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>2000000){await reader.cancel();throw Error('Risposta troppo grande')}chunks.push(Buffer.from(value))}
  const text=normalize(Buffer.concat(chunks).toString('utf8'));
  if(text.length<300||/captcha|access denied|verifica di essere umano|just a moment|enable javascript and cookies/i.test(text))throw Error('Contenuto non verificabile o protezione automatica');
  return {hash:digest(text),text,url:url.href};
 }
 throw Error('Troppi reindirizzamenti');
}
function createMonitor(db,audit,{fetcher=fetch}={}){
 db.exec(`CREATE TABLE IF NOT EXISTS regulatory_settings(id INTEGER PRIMARY KEY CHECK(id=1),enabled INTEGER NOT NULL DEFAULT 0,last_run TEXT); INSERT OR IGNORE INTO regulatory_settings(id,enabled) VALUES(1,0);
 CREATE TABLE IF NOT EXISTS regulatory_snapshots(id INTEGER PRIMARY KEY,source_id TEXT NOT NULL,at TEXT NOT NULL,hash TEXT NOT NULL,text TEXT NOT NULL,url TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS regulatory_checks(id INTEGER PRIMARY KEY,source_id TEXT NOT NULL,at TEXT NOT NULL,status TEXT NOT NULL,detail TEXT NOT NULL,snapshot_id INTEGER);
 CREATE TABLE IF NOT EXISTS regulatory_reviews(id INTEGER PRIMARY KEY,check_id INTEGER NOT NULL UNIQUE,at TEXT NOT NULL,actor TEXT NOT NULL,note TEXT NOT NULL);`);
 let busy=false,stopped=false;
 function status(){return {settings:db.prepare('SELECT * FROM regulatory_settings WHERE id=1').get(),busy,sources:SOURCES_LIST.map(s=>({...s,latest:db.prepare('SELECT * FROM regulatory_checks WHERE source_id=? ORDER BY id DESC LIMIT 1').get(s.id)||null})),history:db.prepare('SELECT c.*,r.actor,r.note FROM regulatory_checks c LEFT JOIN regulatory_reviews r ON r.check_id=c.id ORDER BY c.id DESC LIMIT 100').all()}}
 async function check(actor='sistema'){
  if(busy)throw Object.assign(Error('Verifica già in corso'),{status:409});busy=true;
  try{for(const source of SOURCES_LIST){if(stopped)break;const at=new Date().toISOString();try{
   const value=await retrieve(source,fetcher);if(stopped)break;
   const previous=db.prepare('SELECT * FROM regulatory_snapshots WHERE source_id=? ORDER BY id DESC LIMIT 1').get(source.id);
   let snapshotId=previous?.id,status=previous?(previous.hash===value.hash?'unchanged':'changed'):'baseline';
   if(status!=='unchanged')snapshotId=Number(db.prepare('INSERT INTO regulatory_snapshots(source_id,at,hash,text,url) VALUES(?,?,?,?,?)').run(source.id,at,value.hash,value.text,value.url).lastInsertRowid);
   db.prepare('INSERT INTO regulatory_checks(source_id,at,status,detail,snapshot_id) VALUES(?,?,?,?,?)').run(source.id,at,status,status==='changed'?'Contenuto della pagina modificato: rilevanza normativa da verificare.':status==='baseline'?'Prima acquisizione; non dimostra assenza di novità precedenti.':'Nessuna variazione del contenuto monitorato.',snapshotId);
  }catch(e){if(!stopped)db.prepare('INSERT INTO regulatory_checks(source_id,at,status,detail) VALUES(?,?,?,?)').run(source.id,at,'error',e.message)}}
  if(!stopped){db.prepare('UPDATE regulatory_settings SET last_run=? WHERE id=1').run(new Date().toISOString());audit(actor,'REGULATORY_CHECK',null,{sources:SOURCES_LIST.length})}
  }finally{busy=false}return stopped?null:status();
 }
 function configure(enabled,actor){if(typeof enabled!=='boolean')throw Object.assign(Error('Configurazione non valida'),{status:400});db.prepare('UPDATE regulatory_settings SET enabled=? WHERE id=1').run(enabled?1:0);audit(actor,'REGULATORY_SCHEDULE',null,{enabled});return status()}
 function review(input,actor){if(!Number.isInteger(input.checkId)||typeof input.note!=='string'||input.note.trim().length<30)throw Object.assign(Error('Indicare verifica e nota motivata di almeno 30 caratteri'),{status:400});const c=db.prepare('SELECT * FROM regulatory_checks WHERE id=?').get(input.checkId);if(!c||c.status!=='changed')throw Object.assign(Error('Variazione non disponibile'),{status:400});if(db.prepare('SELECT id FROM regulatory_reviews WHERE check_id=?').get(c.id))throw Object.assign(Error('Variazione già annotata'),{status:409});db.prepare('INSERT INTO regulatory_reviews(check_id,at,actor,note) VALUES(?,?,?,?)').run(c.id,new Date().toISOString(),actor,input.note.trim());audit(actor,'REGULATORY_REVIEW',null,{checkId:c.id,note:input.note.trim()});return status()}
 const timer=setInterval(()=>{const s=db.prepare('SELECT * FROM regulatory_settings WHERE id=1').get();if(s.enabled&&!busy&&(!s.last_run||Date.now()-Date.parse(s.last_run)>=86400000))check().catch(()=>{})},60000);timer.unref();
 return {status,check,configure,review,stop(){stopped=true;clearInterval(timer)}};
}
module.exports={createMonitor,retrieve,normalize,SOURCES_LIST};
