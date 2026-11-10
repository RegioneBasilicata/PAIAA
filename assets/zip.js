(function(root){'use strict';
const table=(()=>{const a=[];for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);a[n]=c>>>0}return a})();
function crc32(bytes){let c=0xFFFFFFFF;for(let i=0;i<bytes.length;i++)c=table[(c^bytes[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0}
function u16(n){return [n&255,(n>>>8)&255]}
function u32(n){return [n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255]}
function enc(s){return new TextEncoder().encode(String(s))}
function dosDateTime(d=new Date()){let y=Math.max(1980,d.getFullYear());return {time:(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1),date:((y-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate()}}
function concat(parts){let len=parts.reduce((a,p)=>a+p.length,0),out=new Uint8Array(len),o=0;for(const p of parts){out.set(p,o);o+=p.length}return out}
function toBytes(v){if(v instanceof Uint8Array)return v;if(v instanceof ArrayBuffer)return new Uint8Array(v);return enc(v)}
function createZip(files){const locals=[],centrals=[];let offset=0;const dt=dosDateTime();for(const f of files){const name=enc(f.name),data=toBytes(f.data),crc=crc32(data);const local=new Uint8Array([0x50,0x4b,0x03,0x04,...u16(20),...u16(0x0800),...u16(0),...u16(dt.time),...u16(dt.date),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...name,...data]);locals.push(local);const central=new Uint8Array([0x50,0x4b,0x01,0x02,...u16(20),...u16(20),...u16(0x0800),...u16(0),...u16(dt.time),...u16(dt.date),...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(offset),...name]);centrals.push(central);offset+=local.length}
 const centralStart=offset,centralData=concat(centrals);const end=new Uint8Array([0x50,0x4b,0x05,0x06,...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(centralData.length),...u32(centralStart),...u16(0)]);return concat([...locals,centralData,end])}
function downloadZip(files,name='backup.zip'){const bytes=createZip(files),blob=new Blob([bytes],{type:'application/zip'}),u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);return bytes}
const api={crc32,createZip,downloadZip};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.AIGHZip=api;
})(typeof window!=='undefined'?window:globalThis);
