(function(root){'use strict';
const MODEL='validation-closure-v1';
const closed=c=>c?.workflow4?.validationClosure?.status==='concluded';
function assertEditable(c){if(closed(c)){const error=Error('Validazione conclusa: avvia un riesame motivato prima di modificare il fascicolo validato.');error.code='VALIDATION_REVIEW_REQUIRED';throw error;}}
function assertDeletable(c){
 if(!c)return;
 if(c.authorized||c.workflow4?.validationClosure||c.workflow4?.validationReviews?.length||c.workflow4?.dossiers?.length||c.regionalPolicy?.history?.length||c.regionalPolicy?.kpiResults?.length||c.denial){
  const error=Error('Il fascicolo contiene validazioni, decisioni o storici: conservarlo e usare un riesame motivato, senza eliminarlo.');
  error.code='CASE_HISTORY_PROTECTED';throw error;
 }
}
function canonical(value){if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(key=>value[key]!==undefined).map(key=>[key,canonical(value[key])]));return value;}
function scope(W,ws,c){
 const fields=['name','system','model','configuration','purpose','vendor','vendorId','owner','area','answers','assessmentExclusions','aiClassification','aiClassReason','aiClassBy','aiClassAt','dpiaDecision','dpiaReason','dpiaValidatedBy','dpiaValidatedAt','friaDecision','friaReason','friaBy','friaAt','ropaStatus','ropaNote','oversightOwner','oversightMethod','oversightAuthority','oversightEvidence','processorName','processorActRef','processorActDate','processorScope','riskValidation','riskValidationReason','riskValidatedBy','riskValidatedAt','riskHistory','regionalPolicy','acceptanceCriteria','acceptanceCriteriaReview','specialistContributions','specialistAttachments','validationSectionReviews','prescriptionAttachments','individualRiskValidations','riskMethodVersion'];
 const facts=Object.fromEntries(fields.map(key=>[key,c[key]??null]));
 const plan=JSON.parse(JSON.stringify(c.safetyPlan||{}));if(plan.measureJourney)delete plan.measureJourney.index;
 const workflow=Object.fromEntries(['profile','validations','requirementAnswers','consultation36','contextSources'].map(key=>[key,c.workflow4?.[key]??null]));
 for(const key of ['requirementAssets','requirementExaminations','requirementWorkflow'])if(c.workflow4?.[key]!==undefined)workflow[key]=c.workflow4[key];
 const docs=(ws.documents||[]).filter(item=>item.caseId===c.id&&(!['authorization_minutes','monitoring_plan','review_minutes','incident_sheet'].includes(item.type)||item.requirementCodes?.length)).map(item=>Object.fromEntries(['id','type','version','html','status','stale','approvedAt','approvedBy','updatedAt','taskIds','requirementCodes'].map(key=>[key,item[key]??null]))).sort((a,b)=>a.id.localeCompare(b.id));
 const evidence=(ws.evidence||[]).filter(item=>item.caseId===c.id).map(item=>Object.fromEntries(['id','name','size','sha256','updatedAt','validationStatus','validatedAt','validatedBy','requirementCodes','taskId','measureControlId'].map(key=>[key,item[key]??null]))).sort((a,b)=>a.id.localeCompare(b.id));
 const prescriptions=(c.prescriptions||[]).filter(item=>item.phase==='pre');
 let recordedTaskIds=null;if(closed(c))try{const recorded=JSON.parse(c.workflow4.validationClosure.scope);if(Array.isArray(recorded.tasks))recordedTaskIds=new Set(recorded.tasks.map(item=>item.id));}catch{}
 const tasks=(ws.tasks||[]).filter(item=>item.caseId===c.id&&item.code!=='REASSESS'&&(recordedTaskIds?.has(item.id)||!W.validationTaskExcluded(c,item))).map(item=>Object.fromEntries(['id','code','title','docType','status','owner','validatedAt','validatedBy','completedAt','completedBy','documentEvidence','evidenceIds','notes','note'].map(key=>[key,item[key]??null]))).sort((a,b)=>a.id.localeCompare(b.id));
 return JSON.stringify(canonical({facts,plan,workflow,docs,evidence,prescriptions,tasks}));
}
function conclude(C,W,V,ws,c,by){
 if(closed(c))return c.workflow4.validationClosure;
 let progress=V.state(C,W,ws,c,{live:true});if(progress.percent!==100||!progress.phaseReady)throw Error('Completa le attività applicabili e le relative evidenze prima di concludere la validazione.');
 if(!String(by||'').trim())throw Error('Indica il responsabile della chiusura della validazione.');
 if(c.workflow4?.validationClosure?.status==='review'){c.reassessmentRequired=false;C.applyRules(ws,c.id,'VALIDATION_REVIEW_COMPLETED');progress=V.state(C,W,ws,c,{live:true});if(progress.percent!==100||!progress.phaseReady)throw Error('Completare i riscontri del riesame prima della chiusura.');}
 c.workflow4||={model:W.MODEL};const history=c.workflow4.validationReviews||[];
 const record={model:MODEL,id:C.uid('validation'),revision:history.length+1,status:'concluded',at:C.nowISO(),by:String(by).trim(),scope:scope(W,ws,c),progress:C.clone(progress),requirements:W.requirementJourneyState(ws,c).rows.map(row=>({code:row.code,answer:row.reviewAnswer,status:row.status,validationApplicable:row.validationApplicable})),documents:ws.documents.filter(doc=>doc.caseId===c.id&&doc.status==='approved'&&!doc.stale).map(doc=>({id:doc.id,version:doc.version})),evidence:ws.evidence.filter(item=>item.caseId===c.id&&item.validationStatus==='validated').map(item=>({id:item.id,at:item.validatedAt}))};
 c.workflow4.validationClosure=record;C.event(ws,'CASE_UPDATED',c.id,{operation:'VALIDATION_CONCLUDED',validationId:record.id,revision:record.revision,by:record.by});return record;
}
function captureCompleted(C,W,V,ws,by){let count=0;for(const c of ws.cases||[]){if(closed(c))continue;const p=V.state(C,W,ws,c),review=c.workflow4?.validationClosure;if(review?.status==='review')continue;if(p.percent===100&&p.phaseReady){conclude(C,W,V,ws,c,by||c.owner);count++;}}return count;}
function beginReview(C,W,ws,c,by,reason){
 if(!closed(c))throw Error('Non è presente una validazione conclusa da sottoporre a riesame.');
 if(!String(by||'').trim()||String(reason||'').trim().length<20)throw Error('Indica responsabile e motivo del riesame (almeno 20 caratteri).');
 const previous=C.clone(c.workflow4.validationClosure),review={id:C.uid('validationReview'),validationId:previous.id,by:String(by).trim(),reason:String(reason).trim(),at:C.nowISO(),previous,snapshot:{validations:C.clone(c.workflow4.validations||{}),requirementAnswers:C.clone(c.workflow4.requirementAnswers||{})}};
 for(const key of ['requirementAssets','requirementExaminations','requirementWorkflow'])if(c.workflow4[key]!==undefined)review.snapshot[key]=C.clone(c.workflow4[key]);c.workflow4.validationReviews||=[];c.workflow4.validationReviews.push(review);c.workflow4.validationClosure={model:MODEL,status:'review',previousId:previous.id,reviewId:review.id,by:review.by,at:review.at,reason:review.reason};c.authorized=false;c.reassessmentRequired=true;C.event(ws,'REASSESSMENT_REQUIRED',c.id,{operation:'VALIDATION_REVIEW_OPENED',reviewId:review.id,validationId:previous.id,by:review.by,reason:review.reason});return review;
}
function enforce(W,before,next,actor=null){
 for(const prior of before.cases||[]){const current=(next.cases||[]).find(item=>item.id===prior.id);if(!current){assertDeletable(prior);continue;}const history=prior.workflow4?.validationReviews||[],nextHistory=current.workflow4?.validationReviews||[];if(JSON.stringify(nextHistory.slice(0,history.length))!==JSON.stringify(history)||!closed(prior)&&nextHistory.length!==history.length){const error=Error('Lo storico delle validazioni concluse non può essere modificato o eliminato.');error.code='VALIDATION_REVIEW_REQUIRED';throw error;}if(!closed(prior))continue;
  const old=prior.workflow4.validationClosure,newRecord=current.workflow4?.validationClosure,reviews=current.workflow4?.validationReviews||[],oldHistory=prior.workflow4.validationReviews||[],review=reviews[oldHistory.length];
  const validReview=reviews.length===oldHistory.length+1&&JSON.stringify(reviews.slice(0,oldHistory.length))===JSON.stringify(oldHistory)&&review?.validationId===old.id&&JSON.stringify(review.previous)===JSON.stringify(old)&&String(review.reason||'').trim().length>=20&&review.by&&review.at&&(!actor||review.by===actor)&&(newRecord?.status==='review'&&newRecord.reviewId===review.id&&newRecord.previousId===old.id||newRecord?.status==='concluded'&&newRecord.id!==old.id&&newRecord.revision===old.revision+1);
  if(validReview)continue;
  if(old.scope!==scope(W,before,prior)||JSON.stringify(newRecord)!==JSON.stringify(old)||JSON.stringify(reviews)!==JSON.stringify(oldHistory)||scope(W,next,current)!==scope(W,before,prior)){const error=Error('Validazione conclusa di «'+prior.name+'»: per modificare le attività o le evidenze avvia prima un riesame motivato.');error.code='VALIDATION_REVIEW_REQUIRED';throw error;}
 }
}
function validateNewClosures(C,W,V,before,next){for(const c of next.cases||[]){const record=c.workflow4?.validationClosure,prior=before.cases?.find(item=>item.id===c.id)?.workflow4?.validationClosure;if(record?.status!=='concluded'||record.id===prior?.id)continue;const live=V.state(C,W,next,c,{live:true});if(record.model!==MODEL||record.scope!==scope(W,next,c)||live.percent!==100||!live.phaseReady||!record.by||!record.at)throw Error('Chiusura della validazione non coerente con le attività e le evidenze del caso.');}}
function prepareEditor(document,ws,docId){const doc=ws.documents.find(item=>item.id===docId),c=doc?.caseId&&ws.cases.find(item=>item.id===doc.caseId);if(!closed(c)||['authorization_minutes','monitoring_plan','review_minutes','incident_sheet'].includes(doc.type)&&!doc.requirementCodes?.length)return false;const editor=document.querySelector('#docEditor');if(editor){editor.contentEditable='false';editor.setAttribute('aria-readonly','true');}for(const control of document.querySelectorAll('#saveDoc,#approveDoc,#newModelDraft,#insertTable,#insertField,#insertHeader,#insertSignature,[data-cmd],[data-block]'))control.disabled=true;return true;}
function prepareReadOnly(document){for(const panel of document.querySelectorAll('[data-validation-readonly]')){for(const control of panel.querySelectorAll('form input,form select,form textarea,form button:not([type="button"]),[data-generate-requirement],.gen-required-doc,.gen-task-doc,.validate-task,.complete-task,.reopen-task,.upload-for-task,.confirm-task-exclusion,#genCaseDoc'))control.disabled=true;}}
const api={prepareEditor,prepareReadOnly,validateNewClosures,MODEL,closed,assertEditable,assertDeletable,scope,conclude,captureCompleted,beginReview,enforce};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.PAIAAValidationLifecycle=api;
})(typeof window!=='undefined'?window:globalThis);
