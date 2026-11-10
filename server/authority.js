'use strict';
function check(old,ws,actor){
 const deny=message=>{throw Object.assign(Error(message),{status:403})};
 const changed=(before,after)=>JSON.stringify(before)!==JSON.stringify(after);
 const verify=(before,after,label)=>{if(after&&changed(before,after)&&after.by!==actor.username)deny(label+': il verificatore deve coincidere con l’account autenticato')};
 for(const evidence of ws.evidence||[]){const before=old.evidence?.find(item=>item.id===evidence.id);if(evidence.validationStatus==='validated'&&changed([before?.validationStatus,before?.validatedAt,before?.validatedBy],[evidence.validationStatus,evidence.validatedAt,evidence.validatedBy])&&evidence.validatedBy!==actor.username)deny('Validazione prova attribuita a un altro account')}
 for(const item of ws.cases||[]){
  const prior=old.cases?.find(value=>value.id===item.id);const closure=item.workflow4?.validationClosure;if(closure?.status==='concluded'&&closure.id!==prior?.workflow4?.validationClosure?.id&&closure.by!==actor.username)deny('Chiusura validazione attribuita a un altro account');verify(prior?.regionalPolicy?.annexA?.review,item.regionalPolicy?.annexA?.review,'Verifica scheda Allegato A');
  for(const [code,record] of Object.entries(item.regionalPolicy?.records||{}))verify(prior?.regionalPolicy?.records?.[code],record,'Verifica regionale');
  for(const result of item.regionalPolicy?.kpiResults||[])if(!prior?.regionalPolicy?.kpiResults?.some(before=>JSON.stringify(before)===JSON.stringify(result))&&result.by!==actor.username)deny('Misurazione regionale attribuita ad altro account');
  for(const key of ['requirementAssets','requirementExaminations','requirementWorkflow'])for(const [code,record] of Object.entries(item.workflow4?.[key]||{}))verify(prior?.workflow4?.[key]?.[code],record,'Percorso dell’adempimento');
  for(const [code,record] of Object.entries(item.workflow4?.validations||{}))verify(prior?.workflow4?.validations?.[code],record,'Verifica formale');
  for(const entry of item.safetyPlan?.entries||[])verify(prior?.safetyPlan?.entries?.find(value=>value.id===entry.id)?.verification,entry.verification,'Efficacia misura');
  for(const condition of item.prescriptions||[]){const before=prior?.prescriptions?.find(value=>value.id===condition.id);if(condition.status==='verified'&&changed(before,condition)&&condition.verifiedBy!==actor.username)deny('Prescrizione verificata da un account diverso');}
  verify(prior?.workflow4?.consultation36,item.workflow4?.consultation36,'Screening privacy');
 }
 for(const task of ws.tasks||[])verify(old.tasks?.find(item=>item.id===task.id)?.documentEvidence,task.documentEvidence,'Riscontro documentale dell’attività');
 for(const decision of ws.authorizations||[]){if(old.authorizations?.some(value=>value.id===decision.id))continue;const item=ws.cases.find(value=>value.id===decision.caseId),profile=item?.workflow4?.profile;if(actor.role!=='Amministratore'||decision.author!==actor.username||profile?.decisionMaker!==actor.username)deny('Decisione riservata al decisore autenticato e qualificato');if(decision.role!==profile.decisionRole||decision.competenceRef!==profile.competenceRef)deny('Ruolo o atto di competenza non corrispondenti al profilo');}
}
module.exports={check};
