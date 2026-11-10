'use strict';

const {createHash}=require('node:crypto');
const Lifecycle=require('../assets/validation-lifecycle');

function fail(status,message){throw Object.assign(new Error(message),{status});}

// Decode the content on the server: a digest supplied by the client is not proof.
function attachment(record,{validateMetadata=true}={}){
 if(record.dataUrl===null||record.dataUrl===undefined||record.dataUrl==='')return null;
 const match=typeof record.dataUrl==='string'&&/^data:([a-z0-9.+/-]*);base64,([A-Za-z0-9+/=\r\n]*)$/i.exec(record.dataUrl);
 if(!match)fail(422,'Allegato non valido: usare un data URI base64.');
 const encoded=match[2].replace(/[\r\n]/g,'');
 const bytes=Buffer.from(encoded,'base64');
 if(bytes.toString('base64').replace(/=+$/,'')!==encoded.replace(/=+$/,''))fail(422,'Contenuto base64 dell’allegato non valido.');
 if(validateMetadata&&record.size!==undefined&&(!Number.isSafeInteger(record.size)||record.size<0||record.size!==bytes.length))fail(422,'Dimensione dell’allegato diversa dal contenuto effettivo.');
 const sha256=createHash('sha256').update(bytes).digest('hex');
 if(validateMetadata&&record.sha256!==undefined&&record.sha256!==null&&record.sha256!==''&&record.sha256!==sha256)fail(422,'Impronta SHA-256 dell’allegato diversa dal contenuto effettivo.');
 return {mime:match[1].toLowerCase(),size:bytes.length,sha256};
}

function evidenceContent(record,{previous=null,validateMetadata=true}={}){
 const files=[];
 function visit(value,location,prior){
  if(!value||typeof value!=='object')return;
  if(Object.hasOwn(value,'dataUrl')){
   // Old releases used size:0 for an unknown length. An unchanged historical
   // payload remains readable/saveable without rewriting its sealed metadata.
   const legacyUnchanged=value.size===0&&prior?.size===0&&value.dataUrl===prior.dataUrl&&value.sha256===prior.sha256;
   const measured=attachment(value,{validateMetadata:validateMetadata&&!legacyUnchanged});
   files.push([location,measured]);
  }
  for(const key of Object.keys(value).sort())if(key!=='dataUrl'&&value[key]&&typeof value[key]==='object'){
   const oldValue=Array.isArray(prior)&&value[key].id?prior.find(item=>item?.id===value[key].id):prior?.[key];
   visit(value[key],location+'/'+key,oldValue);
  }
 }
 visit(record,'',previous);
 return JSON.stringify(files);
}

function check(before,next){
 const nextCases=new Map((next.cases||[]).map(c=>[c.id,c]));
 for(const prior of before.cases||[]){
  if(nextCases.has(prior.id))continue;
  try{Lifecycle.assertDeletable(prior);}catch(e){fail(409,e.message);}
 }
 const nextDocuments=new Map((next.documents||[]).map(d=>[d.id,d]));
 for(const doc of before.documents||[]){
  if(!nextDocuments.has(doc.id)&&(doc.status==='approved'||doc.versions?.length>1))fail(409,'Un documento approvato o con versioni storiche non può essere eliminato con un salvataggio ordinario.');
 }
 const nextEvidence=new Map((next.evidence||[]).map(e=>[e.id,e]));
 // Verify all submitted evidence, including first uploads and nested attachments.
 const oldEvidence=new Map((before.evidence||[]).map(e=>[e.id,e]));
 const content=new Map((next.evidence||[]).map(e=>[e.id,evidenceContent(e,{previous:oldEvidence.get(e.id)})]));
 let snapshotRequired=false;
 for(const prior of before.evidence||[]){
  const current=nextEvidence.get(prior.id);
  if(current&&evidenceContent(prior,{validateMetadata:false})===content.get(prior.id))continue;
  const previousCase=before.cases?.find(c=>c.id===prior.caseId);
  const currentCase=nextCases.get(prior.caseId);
  if(Lifecycle.closed(previousCase)&&Lifecycle.closed(currentCase))fail(409,'Evidenza di una validazione conclusa: avvia un riesame motivato prima di modificare il contenuto.');
  if(prior.validationStatus==='validated'){
   if(current&&(current.validationStatus!=='pending'||current.validatedAt||current.validatedBy))fail(409,'Contenuto di una prova validata modificato: revocare la validazione e sottoporla a nuovo esame.');
   snapshotRequired=true;
  }
  if(Lifecycle.closed(previousCase))snapshotRequired=true;
 }
 return {snapshotRequired};
}

module.exports={attachment,evidenceContent,check};
