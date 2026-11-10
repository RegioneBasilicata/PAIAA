(function(root){'use strict';
function render(C,ws,c,phase,escape){
 if(!c.presentationDemo)return '';const step=c.presentationGuide?.find(item=>item.phase===phase);if(!step)return '';const titles=Object.fromEntries([...C.DOC_TYPES.case,...C.DOC_TYPES.entity]);
 return '<details class="panel presentation-study" open><summary>Caso di studio · '+escape(step.title)+'</summary><p class="microcopy">PRESENTAZIONE R2 · revisione '+escape(String(c.presentationRevision))+'</p><p>'+escape(step.text)+'</p><p><strong>Risultato:</strong> '+escape(step.result)+'</p><ul>'+step.documents.map(type=>{const document=ws.documents.filter(item=>item.caseId===c.id&&item.type===type).at(-1);return '<li>'+escape(titles[type]||type)+' · '+(document?.status==='approved'&&!document.stale?'Approvato e attuale':'Da verificare')+'</li>';}).join('')+'</ul><small>Dati, pareri, prove e decisione sono sintetici: questo percorso illustra le funzioni, non autorizza un servizio reale.</small></details>';
}
const api={render};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.PAIAAPresentationStudy=api;
})(typeof window!=='undefined'?window:globalThis);
