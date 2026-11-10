(function(root){'use strict';let serial=0;
function prepare(scope=document){
 const all=selector=>[...scope.querySelectorAll(selector)].filter(x=>!x.closest('[contenteditable="true"]'));
 all('.btn.primary').forEach(x=>x.classList.add('btn-primary'));
 all('.btn.success').forEach(x=>x.classList.add('btn-success'));
 all('input:not([type=checkbox]):not([type=radio]):not([type=hidden]),textarea').forEach(x=>x.classList.add('form-control'));
 all('select').forEach(x=>x.classList.add('form-select'));
 all('table').forEach(table=>{table.classList.add('table');table.querySelectorAll('thead th').forEach(th=>{if(!th.hasAttribute('scope'))th.scope='col'});});
 all('.table-wrap').forEach(w=>{w.tabIndex=0;w.setAttribute('role','region');if(!w.hasAttribute('aria-label'))w.setAttribute('aria-label',(w.closest('.panel')?.querySelector('h2,h3,h4')?.textContent||'Tabella dei dati')+' · scorrimento orizzontale');});
 // Associate explicit labels and keep labels usable by speech input as well as screen readers.
 all('.field').forEach(field=>{const x=field.querySelector('input:not([type=hidden]),select,textarea'),label=field.matches('label')?field:field.querySelector('label');if(x&&label){if(!x.id)x.id='field-'+(++serial);label.htmlFor=x.id;}});
 all('form').forEach(form=>{if(form.dataset.accessibleErrors)return;form.dataset.accessibleErrors='true';
  form.addEventListener('invalid',event=>{const x=event.target;if(!x.id)x.id='field-'+(++serial);x.setAttribute('aria-invalid','true');const errorId=x.id+'-error';let note=form.querySelector('#'+CSS.escape(errorId));if(!note){note=document.createElement('span');note.className='field-error';note.id=errorId;x.after(note);}note.textContent=x.validationMessage;const ids=new Set((x.getAttribute('aria-describedby')||'').split(' ').filter(Boolean));ids.add(errorId);x.setAttribute('aria-describedby',[...ids].join(' '));},true);
  form.addEventListener('input',event=>{const x=event.target;if(x.validity?.valid){x.removeAttribute('aria-invalid');const errorId=x.id+'-error';form.querySelector('#'+CSS.escape(errorId))?.remove();const ids=(x.getAttribute('aria-describedby')||'').split(' ').filter(id=>id&&id!==errorId);if(ids.length)x.setAttribute('aria-describedby',ids.join(' '));else x.removeAttribute('aria-describedby');}});
 });
 all('[role=toolbar]').forEach(toolbar=>{if(toolbar.dataset.keyboardReady)return;toolbar.dataset.keyboardReady='true';const buttons=[...toolbar.querySelectorAll('button')];buttons.forEach((b,i)=>b.tabIndex=i===0?0:-1);toolbar.addEventListener('keydown',event=>{const index=buttons.indexOf(event.target);if(index<0)return;let next;if(event.key==='ArrowRight')next=(index+1)%buttons.length;else if(event.key==='ArrowLeft')next=(index+buttons.length-1)%buttons.length;else if(event.key==='Home')next=0;else if(event.key==='End')next=buttons.length-1;else return;event.preventDefault();buttons.forEach((b,i)=>b.tabIndex=i===next?0:-1);buttons[next].focus();});});
 const headings=[...all('h1,h2,h3,h4,h5,h6')];let previous=0;for(const h of headings){let level=Number(h.tagName[1]);if(previous&&level>previous+1)level=previous+1;if(level!==Number(h.tagName[1])){const replacement=document.createElement('h'+level);for(const a of h.attributes)replacement.setAttribute(a.name,a.value);replacement.innerHTML=h.innerHTML;h.replaceWith(replacement);}previous=level;}
 const skip=document.querySelector('.skip');if(skip)skip.href=document.querySelector('#appShell')?.classList.contains('hidden')?'#loginTitle':'#main';
}
let wasOpen=false;
function syncNavigation(open){const sidebar=document.querySelector('#sidebar');if(!sidebar)return;sidebar.inert=!open;sidebar.setAttribute('aria-hidden',String(!open));const drawer=open&&window.innerWidth<=1080;const main=document.querySelector('#main'),header=document.querySelector('.app-header');if(main)main.inert=drawer;if(header)header.inert=drawer;if(drawer&&!wasOpen)sidebar.querySelector('button')?.focus();if(!open&&wasOpen)document.querySelector('#menuToggle')?.focus();wasOpen=open;}
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&wasOpen&&window.innerWidth<=1080&&!document.querySelector('dialog[open]'))document.querySelector('#menuToggle')?.click()});
root.AIGHAccessibility={prepare,syncNavigation};
})(window);
