(function(root){'use strict';
// A deliberately small document language, shared by browser and server.
// No SVG, MathML, CSS, event handlers, embedded frames or external resources.
const tags=new Set('p div span h1 h2 h3 h4 h5 h6 strong b em i u s br hr ul ol li table thead tbody tfoot tr td th blockquote pre code a img'.split(' '));
const voids=new Set(['br','hr','img']);
const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function decode(s){return s.replace(/&(?:amp|quot|apos|lt|gt|#\d+|#x[0-9a-f]+);/gi,x=>{const key=x.slice(1,-1).toLowerCase();const named={amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'};if(named[key])return named[key];const n=key.startsWith('#x')?parseInt(key.slice(2),16):parseInt(key.slice(1),10);return n>0&&n<=0x10ffff?String.fromCodePoint(n):''})}
function attribute(raw,name){const re=new RegExp('(?:^|\\s)'+name+'\\s*=\\s*(?:"([^"<>]*)"|\'([^\'<>]*)\'|([^\\s"\'<>`=]+))','i');const m=raw.match(re);return m?decode(m[1]??m[2]??m[3]):''}
function safeImage(s){return typeof s==='string'&&/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=\r\n]+$/.test(s)&&s.length<600000?s:''}
function safeDownload(s){return typeof s==='string'&&/^data:[a-z0-9.+/-]*;base64,[A-Za-z0-9+/=\r\n]*$/i.test(s)?s:''}
function html(input){
 return String(input??'').split(/(<[^>]*>)/g).map(token=>{
  if(!token.startsWith('<'))return token.replace(/</g,'&lt;');
  const m=token.match(/^<(\/?)\s*([a-z][a-z0-9]*)\b([^>]*)>$/i);
  if(!m)return escape(token);
  const name=m[2].toLowerCase();if(!tags.has(name))return '';
  if(m[1])return voids.has(name)?'':'</'+name+'>';
  const raw=m[3];let attrs='';
  const cls=attribute(raw,'class');if(cls&&/^[a-z0-9_ -]{1,150}$/i.test(cls))attrs+=' class="'+escape(cls)+'"';
  if(name==='td'||name==='th')for(const key of ['colspan','rowspan']){const v=attribute(raw,key);if(/^[1-9][0-9]?$/.test(v))attrs+=' '+key+'="'+v+'"'}
  if(name==='img'){const src=safeImage(attribute(raw,'src'));if(!src)return '';attrs+=' src="'+src+'" alt="'+escape(attribute(raw,'alt'))+'"'}
  if(name==='a'){const href=attribute(raw,'href');if(/^https:\/\/[^\s<>"']+$/i.test(href))attrs+=' href="'+escape(href)+'" target="_blank" rel="noopener noreferrer"'}
  return '<'+name+attrs+'>';
 }).join('');
}
function workspace(ws){
 const clean=structuredClone(ws);let changed=0;
 for(const d of clean.documents||[]){const value=html(d.html);if(value!==d.html){d.html=value;d.status='draft';d.approvedAt=null;d.stale=true;d.staleReason='Contenuto ripulito: necessaria revisione umana';changed++}for(const v of d.versions||[])if(typeof v.html==='string')v.html=html(v.html)}
 if(clean.entity?.logo&&!safeImage(clean.entity.logo)){clean.entity.logo='';changed++}
 function walk(v){if(!v||typeof v!=='object')return;for(const [k,x] of Object.entries(v)){if(k==='dataUrl'&&typeof x==='string'&&!safeDownload(x)){v[k]='';changed++}else if(x&&typeof x==='object')walk(x)}}walk(clean);
 return {workspace:clean,changed};
}
const api={html,workspace,safeImage,safeDownload,escape};
if(typeof module!=='undefined'&&module.exports)module.exports=api;root.AIGHSecurity=api;
})(typeof window!=='undefined'?window:globalThis);
