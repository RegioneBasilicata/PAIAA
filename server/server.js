'use strict';
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const {DatabaseSync}=require('node:sqlite');
const {randomBytes,scrypt,timingSafeEqual,createHash}=require('node:crypto');
const {promisify}=require('node:util');
const C=require('../assets/core.js'),S=require('../assets/security.js');
const derive=promisify(scrypt),ROOT=path.resolve(__dirname,'..');
const hash=x=>createHash('sha256').update(x).digest('hex');
const error=(status,message)=>Object.assign(new Error(message),{status});
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const stable=x=>JSON.stringify(x);const now=()=>new Date().toISOString();
async function credential(password){const salt=randomBytes(16).toString('hex');return {salt,passwordHash:(await derive(password,salt,64)).toString('hex')}}
function passwordPolicy(p){if(typeof p!=='string'||p.length<12||p.length>256)throw error(400,'Password richiesta: da 12 a 256 caratteri')}
function readBootstrapPassword(file){if(!file)return undefined;const stat=fs.statSync(file);if(!stat.isFile()||stat.size>1024)throw new Error('File bootstrap non valido');return fs.readFileSync(file,'utf8').trimEnd()}
function start(options={}){
 const host=options.host||process.env.HOST||'127.0.0.1';
 const configuredOrigin=options.publicOrigin??process.env.AIGH_PUBLIC_ORIGIN;
 let publicOrigin;
 if(configuredOrigin){
  let url;try{url=new URL(configuredOrigin)}catch{throw new Error('AIGH_PUBLIC_ORIGIN deve essere un’origine HTTP o HTTPS valida')}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)throw new Error('AIGH_PUBLIC_ORIGIN deve contenere solo schema, host e porta, senza credenziali, percorsi o parametri');
  publicOrigin=url.origin;
 }
 if(!['127.0.0.1','localhost','::1'].includes(host)&&!publicOrigin)throw new Error('Un indirizzo non loopback richiede AIGH_PUBLIC_ORIGIN esplicita');
 const secureCookie=publicOrigin?.startsWith('https:')?'; Secure':'';
 const dataDir=options.dataDir||process.env.AIGH_DATA_DIR||path.join(__dirname,'data');fs.mkdirSync(dataDir,{recursive:true,mode:0o700});
 const database=path.join(dataDir,'governance.sqlite');const db=new DatabaseSync(database);fs.chmodSync(database,0o600);
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
 CREATE TABLE IF NOT EXISTS users(username TEXT PRIMARY KEY,role TEXT NOT NULL CHECK(role IN ('Amministratore','Utente tenant')),salt TEXT NOT NULL,password_hash TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,username TEXT NOT NULL REFERENCES users(username),csrf TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS workspace(id INTEGER PRIMARY KEY CHECK(id=1),revision INTEGER NOT NULL,json TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS backups(id INTEGER PRIMARY KEY,created_at TEXT NOT NULL,actor TEXT NOT NULL,revision INTEGER NOT NULL,json TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS audit(seq INTEGER PRIMARY KEY,at TEXT NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,revision INTEGER,digest TEXT NOT NULL,previous_hash TEXT NOT NULL,entry_hash TEXT NOT NULL);
 CREATE TRIGGER IF NOT EXISTS audit_no_update BEFORE UPDATE ON audit BEGIN SELECT RAISE(ABORT,'Audit append-only'); END;
 CREATE TRIGGER IF NOT EXISTS audit_no_delete BEFORE DELETE ON audit BEGIN SELECT RAISE(ABORT,'Audit append-only'); END;`);
 function audit(actor,action,revision,payload){const at=now(),digest=hash(stable(payload)),previous=db.prepare('SELECT entry_hash FROM audit ORDER BY seq DESC LIMIT 1').get()?.entry_hash||'';const entryHash=hash(stable({at,actor,action,revision,digest,previous}));db.prepare('INSERT INTO audit(at,actor,action,revision,digest,previous_hash,entry_hash) VALUES(?,?,?,?,?,?,?)').run(at,actor,action,revision??null,digest,previous,entryHash)}
 function transaction(fn){db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value}catch(e){db.exec('ROLLBACK');throw e}}
 const tenant=()=>{const row=db.prepare('SELECT json FROM workspace WHERE id=1').get();const e=row?JSON.parse(row.json).entity:{};return {id:'tenant_server',name:e.name||'Ente di Esempio',type:e.type||'Ente',city:e.city||'Basilicata',slug:'ente',logo:e.logo||'',isDemo:false}};
 const publicUser=u=>({username:u.username,role:u.role});
 const ready=(async()=>{
  if(!db.prepare('SELECT username FROM users LIMIT 1').get()){
   const password=options.adminPassword||process.env.AIGH_ADMIN_PASSWORD||readBootstrapPassword(process.env.AIGH_ADMIN_PASSWORD_FILE);if(!password)throw new Error('Primo avvio: impostare AIGH_ADMIN_PASSWORD oppure AIGH_ADMIN_PASSWORD_FILE. Nessuna password viene generata nei log.');passwordPolicy(password);const c=await credential(password);
   transaction(()=>{db.prepare('INSERT INTO users VALUES(?,?,?,?)').run('admin','Amministratore',c.salt,c.passwordHash);audit('system','ADMIN_CREATED',null,{username:'admin'})});
  }
  if(!db.prepare('SELECT id FROM workspace WHERE id=1').get()){
   const ws=C.createWorkspace();ws.meta.tenantId='tenant_server';ws.entity.tenantSlug='ente';ws.catalogExamples=[];ws.supportRequests=[];transaction(()=>{db.prepare('INSERT INTO workspace VALUES(1,0,?)').run(stable(ws));audit('system','WORKSPACE_CREATED',0,{digest:hash(stable(ws))})});
  }
  const stored=db.prepare('SELECT * FROM workspace WHERE id=1').get(),previous=JSON.parse(stored.json);if(previous.cases.some(c=>c.safetyPlan&&(c.riskMethodVersion!==C.ASSESSMENT4.VERSION||c.complianceMigrationVersion!==require('../assets/workflow4').RULESET))){const migrated=C.migrateWorkspaceV2(structuredClone(previous));transaction(()=>{db.prepare('INSERT INTO backups(created_at,actor,revision,json) VALUES(?,?,?,?)').run(now(),'system',stored.revision,stored.json);db.prepare('UPDATE workspace SET revision=?,json=? WHERE id=1').run(stored.revision+1,stable(migrated));audit('system','ASSESSMENT_METHOD_MIGRATED',stored.revision+1,{method:C.ASSESSMENT4.VERSION,priorDigest:hash(stored.json)})})}
 })();
 const attempts=new Map();
 async function body(req){if(!String(req.headers['content-type']||'').startsWith('application/json'))throw error(415,'Content-Type application/json richiesto');let chunks=[],length=0;for await(const chunk of req){length+=chunk.length;if(length>32*1024*1024)throw error(413,'Richiesta troppo grande');chunks.push(chunk)}try{return JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{throw error(400,'JSON non valido')}}
 function session(req){const cookie=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('paiaa4_session='));if(!cookie)throw error(401,'Accesso richiesto');const token=cookie.slice('paiaa4_session='.length);const row=db.prepare('SELECT s.*,u.role FROM sessions s JOIN users u USING(username) WHERE token_hash=? AND expires>?').get(hash(token),Date.now());if(!row)throw error(401,'Sessione scaduta: accedere di nuovo');return row}
 function admin(s){if(s.role!=='Amministratore')throw error(403,'Operazione riservata all’amministratore')}
 function revision(req,row){if(req.headers['if-match']!==String(row.revision))throw error(409,'Dati aggiornati da un altro utente. Esportare le modifiche locali e ricaricare prima di riprovare.')}
 function verifyHistory(old,ws){
  for(const k of ['events','authorizations','decisions']){const history=old[k]||[],next=ws[k]||[];if(next.length<history.length||history.some((v,i)=>stable(v)!==stable(next[i])))throw error(409,'Lo storico '+k+' non può essere modificato: usare l’importazione amministrativa per il ripristino')}
  for(const c of ws.cases){const prior=old.cases.find(x=>x.id===c.id),history=prior?.workflow4?.dossiers||[],next=c.workflow4?.dossiers||[];if(next.length<history.length||history.some((v,i)=>stable(v)!==stable(next[i])))throw error(409,'Le versioni del fascicolo PAIAA 4.0 non possono essere modificate con un salvataggio ordinario')}
  for(const c of ws.cases){const prior=old.cases.find(item=>item.id===c.id);for(const key of ['history','kpiResults']){const before=prior?.regionalPolicy?.[key]||[],after=c.regionalPolicy?.[key]||[];if(after.length<before.length||before.some((item,index)=>stable(item)!==stable(after[index])))throw error(409,'Storico regionale non modificabile con salvataggio ordinario');}}
  for(const d of ws.documents){const prior=old.documents.find(x=>x.id===d.id);if(!prior)continue;if(d.versions.length<prior.versions.length||prior.versions.some((v,i)=>stable(v)!==stable(d.versions[i])))throw error(409,'Storico versioni non modificabile')}
 }
 function checkBusiness(old,ws,actor){
  require('../assets/validation-lifecycle').enforce(require('../assets/workflow4'),old,ws,actor.username);require('../assets/validation-lifecycle').validateNewClosures(C,require('../assets/workflow4'),require('../assets/validation-progress'),old,ws);
  require('./authority').check(old,ws,actor);
  for(const incident of ws.incidents||[]){const prior=old.incidents?.find(item=>item.id===incident.id);if(incident.status==='closed'&&stable(prior)!==stable(incident)&&!require('../assets/workflow4').incidentNotificationState(incident).ready)throw error(422,'Chiusura incidente: completare screening privacy, termini e ricevute');}
  for(const d of ws.documents){const prior=old.documents.find(x=>x.id===d.id);if(d.status==='approved'&&(!prior||prior.status!=='approved'||prior.html!==d.html)){const issues=C.documentCompleteness(d);if(issues.length)throw error(422,'Approvazione documento: '+issues.join('; '))}}
  for(const t of ws.tasks)if(t.status==='completed'&&!C.taskReadiness(ws,t).ok)throw error(422,'Adempimento completato senza prove valide');
  for(const c of ws.cases){const prior=old.cases.find(x=>x.id===c.id);if(prior?.safetyPlan?.model==='selected-measures-v1'&&c.safetyPlan?.model!=='selected-measures-v1')throw error(422,'Il piano delle misure non può essere rimosso con un salvataggio ordinario')}
  for(const c of ws.cases)if(c.authorized&&(!old.cases.find(x=>x.id===c.id)?.authorized||c.safetyPlan?.model==='selected-measures-v1')){const isNew=!old.cases.find(x=>x.id===c.id)?.authorized;if(isNew){if(actor.role!=='Amministratore')throw error(403,'Decisione riservata al decisore amministratore qualificato');if(c.workflow4?.profile?.decisionMaker!==actor.username)throw error(403,'Il decisore deve coincidere con l’account autenticato');const latest=ws.authorizations.filter(a=>a.caseId===c.id).at(-1);if(latest?.author!==actor.username)throw error(403,'Autore della decisione diverso dall’account autenticato')}const check=C.authorizationReadiness(ws,c);if(!check.ready)throw error(422,'Caso non autorizzabile: '+check.missing.join('; '));if(!ws.authorizations.some(a=>a.caseId===c.id&&a.author&&a.role&&a.basis))throw error(422,'Atto di autorizzazione mancante')}
 }
 function commit(req,s,input,replace=false,restore=false){
  const validation=C.validateWorkspace(input);if(!validation.ok)throw error(422,validation.errors.join('; '));
  if(!replace&&input.cases?.some(c=>c.authorized&&c.complianceMigrationVersion!==require('../assets/workflow4').RULESET))throw error(422,'Riesame dei controlli normativi necessario prima di autorizzare');const cleaned=S.workspace(input),ws=cleaned.workspace;ws.meta.tenantId='tenant_server';ws.meta.version=C.APP_VERSION;ws.entity.tenantSlug='ente';ws.catalogExamples||=[];ws.supportRequests||=[];if(ws.cases.some(c=>c.safetyPlan&&(c.riskMethodVersion!==C.ASSESSMENT4.VERSION||c.complianceMigrationVersion!==require('../assets/workflow4').RULESET)))C.migrateWorkspaceV2(ws);
  return transaction(()=>{const row=db.prepare('SELECT * FROM workspace WHERE id=1').get();revision(req,row);const old=JSON.parse(row.json);
   if(!replace){if(s.role!=='Amministratore'&&['entity','settings','catalogExamples'].some(k=>stable(old[k])!==stable(ws[k])))throw error(403,'Configurazione riservata all’amministratore');const integrity=require('./integrity').check(old,ws);verifyHistory(old,ws);checkBusiness(old,ws,s);if(integrity.snapshotRequired){db.prepare('INSERT INTO backups(created_at,actor,revision,json) VALUES(?,?,?,?)').run(now(),s.username,row.revision,row.json);audit(s.username,'EVIDENCE_VERSION_PRESERVED',row.revision,{workspaceDigest:hash(row.json)})}}
   else{admin(s);db.prepare('INSERT INTO backups(created_at,actor,revision,json) VALUES(?,?,?,?)').run(now(),s.username,row.revision,row.json)}
   // The authoritative actor is recorded in the server audit, independent of client labels.
   const next=row.revision+1,json=stable(ws);db.prepare('UPDATE workspace SET revision=?,json=? WHERE id=1').run(next,json);audit(s.username,restore?'RESTORE':replace?'IMPORT':'WORKSPACE_SAVED',next,{workspaceDigest:hash(json),sanitized:cleaned.changed,eventIds:ws.events.slice(replace?0:old.events.length).map(e=>e.id)});return {revision:next,sanitized:cleaned.changed};
  });
 }
 const regulatory=require('./regulatory').createMonitor(db,audit,options.regulatory||{});
 const server=http.createServer(async(req,res)=>{
  const send=(status,value,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(stable(value))};
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');
  // Inline handlers/styles are used by the legacy UI; document HTML is separately allowlisted.
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  try{
   await ready;
   if(req.headers.host!==server.allowedHost)throw error(403,'Host non consentito');
   const origin=publicOrigin||'http://'+server.allowedHost;
   if(!['GET','HEAD'].includes(req.method)&&req.headers.origin!==origin)throw error(403,'Origine della richiesta non consentita');
   const url=new URL(req.url,origin),route=url.pathname;
   if(route==='/healthz'&&req.method==='GET'){db.prepare('SELECT 1').get();return send(200,{ok:true})}
   if(route==='/api/config'&&req.method==='GET')return send(200,{mode:'server',version:C.APP_VERSION,tenant:tenant()});
   if(route==='/api/login'&&req.method==='POST'){
    const input=await body(req);if(typeof input.username!=='string'||input.username.length>80||typeof input.password!=='string'||input.password.length>256)throw error(400,'Credenziali non valide');
    const key=req.socket.remoteAddress,record=attempts.get(key)||{count:0,until:Date.now()+15*60000};if(record.until<Date.now()){record.count=0;record.until=Date.now()+15*60000}if(record.count>=10)throw error(429,'Troppi tentativi: riprovare tra 15 minuti');record.count++;attempts.set(key,record);
    const user=db.prepare('SELECT * FROM users WHERE username=?').get(input.username),derived=(await derive(input.password,user?.salt||'constant-dummy-salt',64)).toString('hex');
    if(!user||!equal(derived,user.password_hash)){audit(input.username,'LOGIN_FAILED',null,{});throw error(401,'Credenziali non valide')}
    attempts.delete(key);const token=randomBytes(32).toString('hex'),csrf=randomBytes(32).toString('hex');db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(hash(token),user.username,csrf,Date.now()+8*3600000);audit(user.username,'LOGIN',null,{});
    return send(200,{user:publicUser(user),tenant:tenant(),csrf},{'Set-Cookie':`paiaa4_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${secureCookie}`});
   }
   if(route.startsWith('/api/')){
    const s=session(req);if(!['GET','HEAD'].includes(req.method)&&!equal(req.headers['x-csrf-token'],s.csrf))throw error(403,'Token CSRF non valido');
    if(route==='/api/regulatory'&&req.method==='GET')return send(200,regulatory.status());
    if(route==='/api/regulatory/check'&&req.method==='POST'){admin(s);return send(200,await regulatory.check(s.username))}
    if(route==='/api/regulatory/settings'&&req.method==='POST'){admin(s);return send(200,regulatory.configure((await body(req)).enabled,s.username))}
    if(route==='/api/regulatory/review'&&req.method==='POST'){admin(s);return send(200,regulatory.review(await body(req),s.username))}
    if(route==='/api/session'&&req.method==='GET')return send(200,{user:publicUser(s),tenant:tenant(),csrf:s.csrf});
    if(route==='/api/logout'&&req.method==='POST'){db.prepare('DELETE FROM sessions WHERE token_hash=?').run(s.token_hash);audit(s.username,'LOGOUT',null,{});return send(200,{ok:true},{'Set-Cookie':'paiaa4_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'+secureCookie})}
    if(route==='/api/workspace'&&req.method==='GET'){const r=db.prepare('SELECT * FROM workspace WHERE id=1').get();return send(200,{workspace:JSON.parse(r.json),revision:r.revision})}
    if(route==='/api/workspace'&&req.method==='PUT')return send(200,commit(req,s,await body(req)));
    if(route==='/api/import'&&req.method==='POST'){admin(s);return send(200,commit(req,s,await body(req),true))}
    if(route==='/api/restore'&&req.method==='POST'){admin(s);const backup=db.prepare('SELECT json FROM backups ORDER BY id DESC LIMIT 1').get();if(!backup)throw error(404,'Copia di ripristino non disponibile');return send(200,commit(req,s,JSON.parse(backup.json),true,true))}
    if(route==='/api/backups'&&req.method==='GET'){admin(s);return send(200,db.prepare('SELECT id,created_at,actor,revision FROM backups ORDER BY id DESC').all())}
    if(route==='/api/audit'&&req.method==='GET'){admin(s);return send(200,db.prepare('SELECT * FROM audit ORDER BY seq').all())}
    if(route==='/api/users'&&req.method==='GET'){admin(s);return send(200,db.prepare('SELECT username,role FROM users ORDER BY username').all())}
    if(route==='/api/users'&&req.method==='POST'){
     admin(s);const input=await body(req);if(!/^[a-zA-Z0-9_.-]{1,64}$/.test(input.username||'')||!['Amministratore','Utente tenant'].includes(input.role))throw error(400,'Username o ruolo non valido');passwordPolicy(input.password);const c=await credential(input.password);transaction(()=>{if(db.prepare('SELECT username FROM users WHERE username=?').get(input.username))throw error(409,'Utente già presente');db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(input.username,input.role,c.salt,c.passwordHash);audit(s.username,'USER_CREATED',null,{username:input.username,role:input.role})});return send(201,{ok:true});
    }
    if(route==='/api/password'&&req.method==='POST'){
     admin(s);const input=await body(req);passwordPolicy(input.password);const c=await credential(input.password);transaction(()=>{const r=db.prepare('UPDATE users SET salt=?,password_hash=? WHERE username=?').run(c.salt,c.passwordHash,input.username);if(!r.changes)throw error(404,'Utente non trovato');db.prepare('DELETE FROM sessions WHERE username=?').run(input.username);audit(s.username,'PASSWORD_RESET',null,{username:input.username})});return send(200,{ok:true});
    }
    throw error(404,'Endpoint non disponibile');
   }
   if(!['GET','HEAD'].includes(req.method))throw error(405,'Metodo non consentito');
   // No arbitrary filesystem serving: database, backups and server source are private.
   const relative=route==='/'?'index.html':decodeURIComponent(route.slice(1));
   if(!(relative==='index.html'||/^assets\/[a-zA-Z0-9_.-]+\.(js|css|svg|woff2|woff|ttf|eot)$/.test(relative)||relative===require('../assets/regional').SOURCE.localPath||relative==='data/Template_Catalogo_Casi_AI_v3.xlsx'||require('../assets/knowledge-data').some(x=>x.local===relative)))throw error(404,'Risorsa non disponibile');
   const file=path.join(ROOT,relative);const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.eot':'application/vnd.ms-fontobject','.svg':'image/svg+xml','.pdf':'application/pdf','.docx':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','.zip':'application/zip','.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}[path.extname(file)];
   const content=await fs.promises.readFile(file);if(relative.startsWith('data/library/'))res.setHeader('Content-Disposition','attachment; filename="'+path.basename(file)+'"');res.writeHead(200,{'Content-Type':mime,'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:content);
  }catch(e){if(!res.headersSent)send(e.status||(e.code==='ENOENT'?404:500),{error:e.status?e.message:'Operazione non riuscita'});else res.end()}
 });
 server.headersTimeout=15000;server.requestTimeout=30000;
 const listen=new Promise((resolve,reject)=>{server.once('error',reject);ready.then(()=>server.listen(options.port??Number(process.env.PORT||8784),host,()=>{const address=server.address();server.allowedHost=publicOrigin?new URL(publicOrigin).host:(host==='::1'?'[::1]':host)+':'+address.port;resolve()})).catch(reject)});
 return {server,db,ready:listen,close:()=>new Promise(resolve=>{regulatory.stop();server.close(()=>{db.close();resolve()});server.closeIdleConnections()})};
}
module.exports={start};
if(require.main===module){const app=start();app.ready.then(()=>console.log('AI Governance Hub v'+C.APP_VERSION+' · '+(process.env.AIGH_PUBLIC_ORIGIN||'http://'+app.server.allowedHost))).catch(e=>{console.error(e.message);process.exitCode=1});for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>app.close().then(()=>process.exit(0)))}
