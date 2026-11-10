(function(root){'use strict';
const DB_NAME='paiaa_4_wip', STORE='workspace', LEGACY_DB='paiaa_4_no_legacy_auto_import', TENANTS_KEY='paiaa4_tenants', CURRENT_KEY='paiaa4_current_tenant';
let db=null, fallback=false;
const uid=()=> 'tenant_'+(root.crypto&&crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36));
const slugify=s=>String(s||'ente').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48)||'ente';
function open(){return new Promise((resolve)=>{if(!('indexedDB' in root)){fallback=true;return resolve(null)};try{const req=indexedDB.open(DB_NAME,1);req.onupgradeneeded=()=>{const d=req.result;if(!d.objectStoreNames.contains(STORE))d.createObjectStore(STORE)};req.onsuccess=()=>{db=req.result;resolve(db)};req.onerror=()=>{fallback=true;resolve(null)}}catch(e){fallback=true;resolve(null)}})}
function readDir(){const raw=localStorage.getItem(TENANTS_KEY);if(!raw)return [];try{const x=JSON.parse(raw);if(!Array.isArray(x))throw Error();return x}catch(e){throw new Error('Directory degli enti non leggibile: nessun dato è stato sovrascritto. Recuperare una copia di backup prima di continuare.')}}
function writeDir(items){localStorage.setItem(TENANTS_KEY,JSON.stringify(items));return true}
function getCurrentTenant(){try{return localStorage.getItem(CURRENT_KEY)||''}catch(e){return ''}}
function setCurrentTenant(id){try{localStorage.setItem(CURRENT_KEY,id)}catch(e){}return id}
function normalizeTenant(t){return {id:t.id||uid(),slug:t.slug||slugify(t.name),name:/^comune di esempio$/i.test(t.name||'')?'Ente di Esempio':t.name||'Nuovo ente',type:/^comune$/i.test(t.type||'')?'Ente':t.type||'Ente',city:t.city||'Basilicata',logo:/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(t.logo||'')?t.logo:'',createdAt:t.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),users:Array.isArray(t.users)&&t.users.length?t.users:[{username:'admin',password:'admin',role:'Amministratore'},{username:'user',password:'user',role:'Utente tenant'}],isDemo:!!t.isDemo}}
async function legacyWorkspace(){if(!('indexedDB' in root))return null;return new Promise(resolve=>{try{const req=indexedDB.open(LEGACY_DB,1);req.onsuccess=()=>{try{const old=req.result;if(!old.objectStoreNames.contains('workspace'))return resolve(null);const tx=old.transaction('workspace','readonly'),r=tx.objectStore('workspace').get('main');r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>resolve(null)}catch(e){resolve(null)}};req.onerror=()=>resolve(null);req.onupgradeneeded=()=>resolve(null)}catch(e){resolve(null)}})}
async function passwordHash(password,salt){
 if(!root.crypto?.subtle)throw new Error('WebCrypto non disponibile: usare il server locale');
 salt=salt||Array.from(root.crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
 const key=await root.crypto.subtle.importKey('raw',new TextEncoder().encode(password),'PBKDF2',false,['deriveBits']);
 const bytes=await root.crypto.subtle.deriveBits({name:'PBKDF2',salt:new TextEncoder().encode(salt),iterations:210000,hash:'SHA-256'},key,256);
 return {salt,hash:Array.from(new Uint8Array(bytes),x=>x.toString(16).padStart(2,'0')).join('')};
}
let directoryChain=Promise.resolve();
function ensureTenants(){const op=directoryChain.then(ensureDirectory);directoryChain=op.catch(()=>{});return op}
async function ensureDirectory(){
 let list=readDir(),isNew=!list.length;
 if(isNew)list=[normalizeTenant({id:'tenant_demo',slug:'ente',name:'Ente di Esempio',type:'Ente',city:'Basilicata',isDemo:true})];
 list=list.map(normalizeTenant);
 for(const t of list)for(const u of t.users){if(typeof u.password==='string'){u.credential=await passwordHash(u.password);delete u.password}}
 // Preserve all legacy entries. Mono-Ente only affects the visible selection.
 if(list.length>1&&!localStorage.getItem(TENANTS_KEY+':migration-backup'))localStorage.setItem(TENANTS_KEY+':migration-backup',JSON.stringify(list));
 writeDir(list);
 const chosen=list.find(t=>t.id===getCurrentTenant())||list[0];setCurrentTenant(chosen.id);
 if(isNew){const old=await legacyWorkspace();if(old&&await save(old,chosen.id)!==true)throw new Error('Migrazione non salvata')}
 return [chosen];
}
async function listTenants(){return ensureTenants()}
async function createTenant(){throw new Error('Installazione mono-Ente: non è possibile creare altri tenant')}
async function updateTenant(id,patch={}){await ensureTenants();const list=readDir(),i=list.findIndex(t=>t.id===id);if(i<0)return null;const safePatch={...patch};delete safePatch.id;delete safePatch.users;list[i]=normalizeTenant({...list[i],...safePatch,id:list[i].id,users:list[i].users});writeDir(list);return list[i]}
async function removeTenant(){throw new Error('Installazione mono-Ente: l’Ente configurato non può essere rimosso')}

async function resetUserPassword(tenantId,username,newPassword){if(typeof newPassword!=='string'||newPassword.length<12)throw new Error('La password deve avere almeno 12 caratteri');await ensureTenants();const list=readDir(),t=list.find(x=>x.id===tenantId);if(!t)throw new Error('Tenant non trovato');const u=t.users.find(x=>x.username===username);if(!u)throw new Error('Utente non trovato');u.credential=await passwordHash(newPassword);delete u.password;t.updatedAt=new Date().toISOString();writeDir(list);return true}
async function authenticate(tenantId,username,password){const list=await ensureTenants(),t=list.find(x=>x.id===tenantId);if(!t)return null;const u=t.users.find(x=>x.username===username);if(!u?.credential)return null;const value=await passwordHash(password,u.credential.salt);return value.hash===u.credential.hash?{tenant:t,user:{username:u.username,role:u.role}}:null}
function keyFor(tenantId){return 'tenant:'+(tenantId||getCurrentTenant()||'tenant_demo')}
async function load(tenantId){if(!db&&!fallback)await open();const key=keyFor(tenantId);if(fallback){const s=localStorage.getItem(DB_NAME+':'+key);try{return s?JSON.parse(s):null}catch(e){throw new Error('Workspace locale non leggibile: nessun dato è stato sovrascritto')}}return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(key);r.onsuccess=()=>resolve(r.result||null);r.onerror=()=>reject(new Error('Impossibile leggere il workspace IndexedDB'));tx.onabort=()=>reject(new Error('Lettura IndexedDB interrotta'))})}
async function save(ws,tenantId){if(!db&&!fallback)await open();const key=keyFor(tenantId);if(fallback){try{localStorage.setItem(DB_NAME+':'+key,JSON.stringify(ws));return true}catch(e){return false}}return new Promise(resolve=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(ws,key);tx.oncomplete=()=>resolve(true);tx.onerror=()=>resolve(false)})}
async function clear(tenantId){if(!db&&!fallback)await open();const key=keyFor(tenantId);if(fallback){try{localStorage.removeItem(DB_NAME+':'+key)}catch(e){}return}return new Promise(resolve=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>resolve()})}
async function replaceWorkspace(ws,tenantId,previous){
 if(!db&&!fallback)await open();const key=keyFor(tenantId),backup=key+':pre-import';
 if(fallback){localStorage.setItem(DB_NAME+':'+backup,JSON.stringify(previous));localStorage.setItem(DB_NAME+':'+key,JSON.stringify(ws));return true}
 return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put(previous,backup);tx.objectStore(STORE).put(ws,key);tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(new Error('Importazione annullata: database non disponibile'));tx.onabort=()=>reject(new Error('Importazione annullata'))});
}
async function restorePreImport(tenantId){if(!db&&!fallback)await open();const key=keyFor(tenantId)+':pre-import';let previous;if(fallback){previous=JSON.parse(localStorage.getItem(DB_NAME+':'+key)||'null')}else previous=await new Promise((resolve,reject)=>{const r=db.transaction(STORE,'readonly').objectStore(STORE).get(key);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});if(!previous)throw new Error('Copia di ripristino non disponibile');if(await save(previous,tenantId)!==true)throw new Error('Ripristino non salvato');return previous}
root.AIGHDB={open,load,save,clear,ensureTenants,listTenants,createTenant,updateTenant,removeTenant,resetUserPassword,authenticate,getCurrentTenant,setCurrentTenant,slugify,replaceWorkspace,restorePreImport,get mode(){return fallback?'localStorage offline dimostrativo':'IndexedDB offline dimostrativo'}};
})(window);
