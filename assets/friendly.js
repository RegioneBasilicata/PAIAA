/* 3.0.9 finale — livello di usabilità: sola presentazione, nessuna mutazione del fascicolo */
(function(){
 const HELP={overview:['Inizia da qui','Controlla il quadro generale e individua cosa manca.'],assessment:['Descrivi come funziona il sistema','Rispondi alle domande. Se non conosci una risposta, indica che è da verificare.'],risks:['Esamina i rischi','Confronta le stime del sistema con le valutazioni validate dai responsabili.'],tasks:['Controlla gli adempimenti','Completa le attività richieste e registra i soggetti incaricati.'],evidence:['Raccogli le prove','Associa documenti e riferimenti a ciò che è stato verificato.'],documents:['Prepara gli atti','Consulta e verifica i documenti prodotti per il fascicolo.'],authorization:['Prepara la decisione','Acquisisci i contributi, verifica le prescrizioni e registra la decisione competente.'],monitoring:['Segui il sistema nel tempo','Controlla scadenze, prescrizioni e riesami dopo la decisione.']};
 function init(){
  const shell=document.querySelector('.case-shell');if(!shell)return;
  const tabs=document.querySelector('.case-tabs');if(!tabs)return;
  const active=tabs.querySelector('.case-tab.active');const step=active&&active.dataset.tab||'overview';const info=HELP[step]||HELP.overview;
  const wizard=shell.querySelector('.wizard-panel');
  if(wizard){
   wizard.classList.add('friendly-wizard');
   const steps=wizard.querySelector('.wizard-steps');
   if(steps){const details=document.createElement('details');details.className='friendly-all-steps';details.innerHTML='<summary>Visualizza tutte le 8 fasi del procedimento</summary>';steps.parentNode.insertBefore(details,steps);details.appendChild(steps);}
   const actions=wizard.querySelector('.wizard-actions');if(actions){const save=actions.querySelector('#wizardSave');if(save)save.textContent='Salva il lavoro';const next=actions.querySelector('#wizardNextOpen');if(next)next.textContent='Vai alla prossima attività';const resume=actions.querySelector('#wizardResume');if(resume)resume.textContent='Riprendi da dove ero rimasto';}
  }
  const bar=document.createElement('section');bar.className='friendly-focus';bar.setAttribute('aria-label','Guida alla fase corrente');
  const num=[...tabs.querySelectorAll('.case-tab')].findIndex(x=>x===active)+1;
  bar.innerHTML='<div class="friendly-focus-copy"><span class="friendly-kicker">FASE '+num+' DI 8 · GUIDA RAPIDA</span><h3>'+info[0]+'</h3><p>'+info[1]+'</p></div><div class="friendly-focus-actions"><button type="button" class="btn primary" id="friendlyGoContent">Vai alle attività di questa fase ↓</button><button type="button" class="btn" id="friendlyShowSteps">Tutte le fasi</button></div>';
  const content=shell.querySelector('.case-content');if(content){content.parentNode.insertBefore(bar,content);bar.querySelector('#friendlyGoContent').addEventListener('click',()=>content.scrollIntoView({behavior:'smooth',block:'start'}));bar.querySelector('#friendlyShowSteps').addEventListener('click',()=>{const d=shell.querySelector('.friendly-all-steps');if(d){d.open=true;d.scrollIntoView({behavior:'smooth',block:'center'});}else tabs.scrollIntoView({behavior:'smooth'});});}
  tabs.querySelectorAll('.case-tab').forEach((btn,i)=>{btn.setAttribute('title',(i+1)+'. '+(HELP[btn.dataset.tab]||[''])[0]);});
  shell.querySelectorAll('button').forEach(b=>{if(b.textContent.trim()==='Esporta dossier HTML')b.textContent='Scarica il dossier istruttorio';if(b.textContent.trim()==='Esporta relazione conclusiva')b.textContent='Scarica la relazione conclusiva';});
 }
 window.AIGHFriendly={init};
})();
