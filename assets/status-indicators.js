(function(root){'use strict';
const definitions={
 INCOMPLETO:{label:'DA COMPLETARE',tone:'incompleto',icon:'partial',description:'Informazioni o risposte ancora mancanti.'},
 GIALLO:{label:'IN VERIFICA',tone:'giallo',icon:'clipboard',description:'Controlli, prove o documenti ancora da completare o riesaminare.'},
 VERDE:{label:'COMPLETO',tone:'verde',icon:'shield',description:'Requisiti del fascicolo soddisfatti. La decisione autorizzativa è distinta e non è una certificazione normativa.'},
 'ROSSO/HOLD':{label:'BLOCCATO',tone:'rosso',icon:'stop',description:'Condizione impeditiva da risolvere prima di proseguire.'},
 'DA RIESAMINARE':{label:'DA RIESAMINARE',tone:'review',icon:'review',description:'Il fascicolo richiede una nuova valutazione delle condizioni di utilizzo.'}
};
const paths={partial:'<path d="M12 3a9 9 0 0 1 9 9M21 16a9 9 0 0 1-15 3M3 12a9 9 0 0 1 3-7"/>',clipboard:'<path d="M9 4H6a2 2 0 0 0-2 2v14h10M15 4h3a2 2 0 0 1 2 2v4"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M8 10h5M8 14h3"/><circle cx="17" cy="17" r="5"/><path d="M17 14v3l2 1"/>',shield:'<path d="m12 2 8 3v6c0 5-4 8-8 11-4-3-8-6-8-11V5Z"/><path d="m8 12 3 3 5-6"/>',stop:'<path d="m8 2-6 6v8l6 6h8l6-6V8l-6-6Z"/><path d="M12 7v6M12 17h.01"/>',review:'<path d="M20 8a8 8 0 0 0-14-3L3 8M3 3v5h5M4 16a8 8 0 0 0 14 3l3-3M21 21v-5h-5"/>'};
const escape=value=>String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
function describe(value){const code=String(value||'').trim().toUpperCase();return Object.hasOwn(definitions,code)?{code,...definitions[code]}:{code,label:'DA VERIFICARE',tone:'incompleto',icon:'partial',description:'Stato non riconosciuto: verificare il fascicolo senza presumere il completamento.'};}
function render(value){const state=describe(value);return '<span class="status case-status '+state.tone+'" data-case-state="'+escape(state.code)+'" title="'+escape(state.description)+'"><span class="case-status-symbol" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false">'+paths[state.icon]+'</svg></span><span class="case-status-label">'+escape(state.label)+'</span><span class="case-status-dot" aria-hidden="true"></span></span>';}
const api={describe,render};if(typeof module!=='undefined'&&module.exports)module.exports=api;root.PAIAAStatusIndicators=api;
})(typeof window!=='undefined'?window:globalThis);
