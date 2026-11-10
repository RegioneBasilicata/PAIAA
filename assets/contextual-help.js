(function(){'use strict';
const owner=target=>target?.closest?.('details.context-help');
document.addEventListener('pointerover',event=>{if(event.pointerType==='touch')return;const help=owner(event.target);if(!help||help.contains(event.relatedTarget))return;help.open=true;});
document.addEventListener('pointerout',event=>{const help=owner(event.target);if(!help||help.contains(event.relatedTarget))return;if(help.dataset.pinned!=='true'&&!help.contains(document.activeElement))help.open=false;});
document.addEventListener('focusin',event=>{const help=owner(event.target);if(help)help.open=true;});
document.addEventListener('focusout',event=>{const help=owner(event.target);if(help&&!help.contains(event.relatedTarget)&&help.dataset.pinned!=='true')help.open=false;});
document.addEventListener('keydown',event=>{if(event.key!=='Escape')return;const open=[...document.querySelectorAll('details.context-help[open]')];if(!open.length)return;const focused=open.find(help=>help.contains(document.activeElement));for(const help of open){help.open=false;delete help.dataset.pinned;}if(focused&&document.activeElement!==focused.querySelector('summary'))focused.querySelector('summary').focus();event.preventDefault();});
document.addEventListener('click',event=>{const help=owner(event.target),summary=event.target?.closest?.('summary');if(help&&summary===help.querySelector('summary')){event.preventDefault();const pinned=help.dataset.pinned!=='true';help.dataset.pinned=String(pinned);help.open=pinned;}for(const other of document.querySelectorAll('details.context-help[open]'))if(!other.contains(event.target)){other.open=false;delete other.dataset.pinned;}});
})();
