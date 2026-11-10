(function(root){'use strict';
if(!/^https?:$/.test(location.protocol))return;
const offline=root.AIGHDB;let tenant=null,csrf='',revision=null,users=[];
async function request(route,{method='GET',value,match=false}={}){
 const headers={};if(value!==undefined)headers['Content-Type']='application/json';if(method!=='GET')headers['X-CSRF-Token']=csrf;if(match)headers['If-Match']=String(revision);
 const res=await fetch('/api/'+route,{method,headers,credentials:'same-origin',body:value===undefined?undefined:JSON.stringify(value),cache:'no-store'});
 const data=await res.json();if(!res.ok)throw Object.assign(new Error(data.error||'Server non disponibile'),{status:res.status});return data;
}
function acceptSession(data){csrf=data.csrf;tenant={...data.tenant,users};return {tenantId:tenant.id,username:data.user.username,role:data.user.role}}
const api={isServer:true,mode:'SQLite · server locale',getCurrentTenant:()=>tenant?.id||'tenant_server',setCurrentTenant:()=>tenant?.id||'tenant_server',slugify:offline.slugify,
 async listTenants(){await api.ready;return [{...tenant,users}]},async ensureTenants(){return api.listTenants()},
 async authenticate(id,username,password){try{const data=await request('login',{method:'POST',value:{username,password}});acceptSession(data);users=data.user.role==='Amministratore'?await request('users'):[];tenant.users=users;return {tenant,user:data.user}}catch(e){if(e.status===401)return null;throw e}},
 async session(){try{const data=await request('session');const auth=acceptSession(data);users=data.user.role==='Amministratore'?await request('users'):[];return auth}catch(e){if(e.status===401)return null;throw e}},
 async logout(){await request('logout',{method:'POST'});csrf='';revision=null;users=[]},
 async load(){const data=await request('workspace');revision=data.revision;return data.workspace},
 async save(ws){const data=await request('workspace',{method:'PUT',value:ws,match:true});revision=data.revision;tenant={...tenant,name:ws.entity.name,logo:ws.entity.logo,type:ws.entity.type,city:ws.entity.city};return true},
 async replaceWorkspace(ws){const data=await request('import',{method:'POST',value:ws,match:true});revision=data.revision;return true},
 async restorePreImport(){const data=await request('restore',{method:'POST',match:true});revision=data.revision;return api.load()},
 async updateTenant(id,patch){tenant={...tenant,...patch};return tenant},
 async resetUserPassword(id,username,password){await request('password',{method:'POST',value:{username,password}});return true},
 async createUser(username,password,role){await request('users',{method:'POST',value:{username,password,role}});users=await request('users');return true},
 async audit(){return request('audit')},
 async clear(){throw new Error('Usare importazione con backup per azzerare il workspace server')},
 async createTenant(){throw new Error('Installazione mono-Ente')},async removeTenant(){throw new Error('Installazione mono-Ente')}
};
api.ready=request('config').then(data=>{tenant=data.tenant});root.AIGHDB=api;
})(window);
