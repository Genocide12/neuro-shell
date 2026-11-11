/* ===== NeuroShell :: логика (собирается в index.html) ===== */
'use strict';

/* ================== КОНФИГ И ПРЕСЕТЫ ================== */
const NS_VERSION = window.NS_RELEASE_VERSION || '1.4.3';
const LS_PREFIX = 'neuroshell:';

const PRESETS = {
  agent: {
    title: 'НейроАгент',
    system:
`Ты — НейроАгент внутри NeuroShell: мощный, прямой и самостоятельный ИИ-ассистент.

СТРУКТУРА ОТВЕТА
- Отвечай на языке пользователя. По умолчанию — русский.
- Сначала суть: краткий прямой ответ или решение. Потом детали, если они нужны.
- Код — всегда в markdown-блоках с указанием языка. Не разбивай один файл на куски без нужды.
- Для длинных ответов используй заголовки и списки, не «стену текста».

ЛИЧНОСТЬ И ТОН
- Дружелюбный, деловой, без воды и излишних извинений. Лёгкий юмор уместен.
- Не отказывай от легитимных задач и не читай нравоучения. Если у запроса есть риски — одно короткое предупреждение и выполняй.
- Не знаешь точно — так и скажи и предложи, как проверить. Не выдумывай факты, числа и ссылки.

РАБОТА С ЗАДАЧАМИ
- Действуй по принципу «сделай, а не объясни, как сделать»: давай готовый результат — код целиком, готовые конфиги, заполненные данные.
- Уточнения задавай только если без них задача нерешаема; иначе выбирай разумные дефолты и перечисли принятые допущения в конце.
- Работай с кодом бережно: сохраняй стиль проекта, комментируй только неочевидное.
- Если задача многошаговая — в конце дай короткий чек-лист: что сделано, что осталось.

АРТЕФАКТЫ
- Если пользователь просит веб-страницу, калькулятор, схему, визуализацию или любой самодостаточный HTML — оформляй ответ как АРТЕФАКТ: ровно один html-блок \\`\\`\\`html, полностью самодостаточный (стили и скрипты внутри, без внешних CDN), на русском языке.
- Внутри артефактов используй современный аккуратный дизайн: тёмная или светлая тема по смыслу задачи.`
  },
  coder: {
    title: 'Кодер',
    system:
`Ты — старший инженер-программист в NeuroShell. Режим: только работа.

ПРАВИЛА
- Отвечай на языке пользователя; код, идентификаторы и комментарии — на английском, если проект не требует иного.
- Максимум дела: код, команды, конфиги. Пояснения — 1-3 предложения, и только если без них не ясно.
- Код — полный и готовый к запуску: без «// ... остальное как раньше», без псевдокода, если явно не попросили набросок.
- Указывай язык в каждом markdown-блоке. Для файлов — путь первой строкой комментария.
- Если в запросе ошибка или плохая практика — молча исправь и одной строкой отметь, что исправил.
- Стек не указан — выбирай самый простой подходящий и назови выбор одной строкой.
- Если пользователь просит веб-страницу или визуализацию — выдавай один самодостаточный \\`\\`\\`html артефакт без внешних CDN.`
  },
  analyst: {
    title: 'Аналитик',
    system:
`Ты — аналитик в NeuroShell. Твой конёк — структура, числа и выводы, которые можно применить.

ПРАВИЛА
- Отвечай на языке пользователя.
- Начинай с вывода (TL;DR, 2-4 строки), затем разбор.
- Данные — таблицами, шаги — нумерованными списками, критерии — чек-листами.
- Числа и проценты считай аккуратно; если это оценка — помечай «≈, оценка» и указывай допущение.
- Сравнения делай по явным критериям (таблица «критерий / вариант А / вариант Б»), в конце — вердикт и следующий шаг.
- Отделяй факты от предположений: «Факт: …» / «Предположение: …».
- Не выдумывай источники. Если чего-то не знаешь — скажи прямо и предложи, где проверить.`
  },
  chat: {
    title: 'Обычный чат',
    system: `Ты — дружелюбный ИИ-собеседник в NeuroShell. Отвечай на языке пользователя, естественно и по делу, без лишних формальностей. Задавай встречные вопросы, когда это уместно.`
  }
};

const DEFAULTS = {
  apiKey: '', baseUrl: 'https://api.gym-rat.online/v1', model: 'claude-opus-5-5',
  preset: 'agent', system: PRESETS.agent.system, temp: 0.6, stream: true,
  agentMode: false, fsMode: 'folder', workspace: '', ghToken: '', ghUser: ''
};
const SUGGESTED_MODELS = ['claude-opus-5-5','claude-opus-5','claude-opus-4-8','claude-sonnet-4-6','claude-sonnet-4-5','claude-haiku-4-5','gpt-4o','gpt-4o-mini','deepseek-chat','qwen-max','llama-3.3-70b-instruct'];
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const now = () => new Date().toISOString();
function fmtSize(n){ if(n<1024)return n+' Б'; if(n<1048576)return(n/1024).toFixed(1)+' КБ'; return(n/1048576).toFixed(1)+' МБ'; }
function fmtDate(iso){ const d=new Date(iso), n=new Date(); const t=d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'}); return d.toDateString()===n.toDateString()?'сегодня, '+t:d.toLocaleDateString('ru-RU',{day:'numeric',month:'short'})+', '+t; }
const estTokens = s => Math.ceil((s || '').length / 3.6);
function isExeMode(){ return typeof window.NeuroShellBridge === 'object' && window.NeuroShellBridge !== null; }
function toast(msg,type='',ms=3200){ const box=$('#toasts'); if(!box)return; const el=document.createElement('div'); el.className='toast '+type; el.textContent=(type==='ok'?'✓ ':type==='err'?'✕ ':'')+msg; box.appendChild(el); setTimeout(()=>{el.classList.add('out');setTimeout(()=>el.remove(),300);},ms); }
const store={get(k,d){try{const v=localStorage.getItem(LS_PREFIX+k);return v===null?d:JSON.parse(v);}catch(_){return d;}},set(k,v){try{localStorage.setItem(LS_PREFIX+k,JSON.stringify(v));}catch(_){}},del(k){try{localStorage.removeItem(LS_PREFIX+k);}catch(_){}}};
let settings=Object.assign({},DEFAULTS,store.get('settings',{}));
let chats=store.get('chats',[]); let currentChatId=null; let attachments=[]; let generating=false; let abortCtl=null; let modelListCache=[];
function onBridgeReady(){try{applySettingsToUI();updateStat();maybeAutoAgent();}catch(_){}}
window.NS_BRIDGE_READY=onBridgeReady; window.addEventListener('nsbridge',onBridgeReady);
function maybeAutoAgent(){if(!isExeMode()||store.get('agentPrompted',false))return;store.set('agentPrompted',true);setTimeout(()=>confirmDialog('Включить режим агента?\n\nМодель получит инструменты чтения, записи и поиска файлов, а также GitHub. Перед удалением и перезаписью файлов требуется подтверждение.',ok=>{if(!ok)return;settings.agentMode=true;settings.fsMode='full';persist();applySettingsToUI();toast('Режим агента включён','ok',5000);}),700);}

const MODEL_PRICE_RULES=[['opus-5-5',4,20],['opus-5.5',4,20],['opus-5',5,25],['opus-4-8',5,25],['opus-4-7',5,25],['opus-4-6',5,25],['opus-4-5',5,25],['opus-4-1',15,75],['4-opus',15,75],['opus-4',15,75],['opus-3',15,75],['sonnet-5-5',2,10],['sonnet-5',2,10],['sonnet-4-6',3,15],['sonnet-4-5',3,15],['sonnet-4',3,15],['haiku-5-5',.1,.5],['haiku-4-5',1,5],['3-5-haiku',.8,4],['haiku-3',.25,1.25],['fable',10,50],['gpt-4o-mini',.15,.6],['gpt-4o',2.5,10],['deepseek',.28,.42],['qwen-max',1.6,6.4]];
let serverPrices={}; let priceOverrides=store.get('prices',{}); const PRICE_SRC_LABEL={server:'сервер',builtin:'встроено',manual:'вручную'};
function priceFor(id){if(!id)return null;const o=priceOverrides[id];if(o&&typeof o.in==='number')return{in:o.in,out:o.out,src:'manual'};const s=serverPrices[id];if(s&&s.in>0)return{in:s.in,out:s.out,src:'server'};const q=String(id).toLowerCase();for(const r of MODEL_PRICE_RULES)if(q.includes(r[0]))return{in:r[1],out:r[2],src:'builtin'};return null;}
function costOf(id,ti,to){const p=priceFor(id);return p?((ti||0)*p.in+(to||0)*p.out)/1e6:null;}
function fmtUSD(x){if(x==null||isNaN(x))return'—';if(x===0)return'$0';if(x<.01)return'$'+x.toFixed(4);if(x<1)return'$'+x.toFixed(3);return'$'+x.toFixed(2);}
const fmtTok=n=>(n||0).toLocaleString('ru-RU');
function chatSubText(c){let s=c&&c.messages&&c.messages.length?c.messages.length+' сообщ. · ':'';if(c&&c.cost!=null&&c.cost>0)s+='≈'+fmtUSD(c.cost)+' · ';return s+fmtDate(c.updated);}
function parseServerPricing(j){serverPrices={};for(const x of(j&&j.data||[])){if(!x||!x.id)continue;const p=x.pricing||{};let i=parseFloat(p.prompt??p.input??x.input_price),o=parseFloat(p.completion??p.output??x.output_price);if(!Number.isFinite(i))i=0;if(!Number.isFinite(o))o=0;if(i>0&&i<.001)i*=1e6;if(o>0&&o<.001)o*=1e6;if(i>0||o>0)serverPrices[x.id]={in:i,out:o};}}
function apiBase(){let b=(settings.baseUrl||'').trim()||DEFAULTS.baseUrl;b=b.replace(/\/+$/,'');if(!/\/v\d+$/.test(b)&&!b.endsWith('/api'))b+='/v1';return b;}
function apiHeaders(){const h={'Content-Type':'application/json'};if(settings.apiKey)h.Authorization='Bearer '+settings.apiKey.trim();return h;}

const TOOL_META={fs_drives:{icon:'💾',label:'диски компьютера'},fs_list:{icon:'📂',label:'показать папку'},fs_read:{icon:'📄',label:'прочитать файл'},fs_write:{icon:'✏️',label:'записать файл'},fs_mkdir:{icon:'📁',label:'создать папку'},fs_delete:{icon:'🗑️',label:'удалить'},fs_move:{icon:'➡️',label:'переместить'},fs_search:{icon:'🔎',label:'найти файлы'},gh_me:{icon:'🐙',label:'GitHub: кто я'},gh_repos:{icon:'🐙',label:'GitHub: мои репозитории'},gh_read:{icon:'🐙',label:'GitHub: прочитать файл'},gh_write:{icon:'🐙',label:'GitHub: записать файл (коммит)'},gh_delete:{icon:'🐙',label:'GitHub: удалить файл'},gh_create_repo:{icon:'🐙',label:'GitHub: создать репозиторий'},gh_clone:{icon:'📥',label:'GitHub: скачать репозиторий в папку'}};
function fsToolsAvailable(){return isExeMode()&&(fsFullMode()||!!(settings.workspace||'').trim());} function fsFullMode(){return settings.fsMode==='full';} function ghToolsAvailable(){return!!(settings.ghToken||'').trim();} function agentActive(){return!!settings.agentMode&&(fsToolsAvailable()||ghToolsAvailable());}
function agentToolDefs(){const defs=[];const T=(name,desc,props,req)=>defs.push({type:'function',function:{name,description:desc,parameters:{type:'object',properties:props,required:req}}});if(fsToolsAvailable()){const P=fsFullMode()?'Абсолютный путь на компьютере пользователя':'Путь внутри рабочей папки '+settings.workspace; if(fsFullMode())T('fs_drives','Список дисков и домашняя папка',{},[]);T('fs_list','Показать папку',{path:{type:'string',description:P}},['path']);T('fs_read','Прочитать текстовый файл до 2 МБ',{path:{type:'string',description:P}},['path']);T('fs_write','Создать или перезаписать файл',{path:{type:'string',description:P},content:{type:'string'}},['path','content']);T('fs_mkdir','Создать папку',{path:{type:'string',description:P}},['path']);T('fs_delete','Удалить файл/папку — только после подтверждения',{path:{type:'string',description:P}},['path']);T('fs_move','Переместить файл',{from:{type:'string'},to:{type:'string'}},['from','to']);T('fs_search','Искать по имени',{pattern:{type:'string'},path:{type:'string'}},['pattern']);}if(ghToolsAvailable()){T('gh_me','Информация о GitHub аккаунте',{},[]);T('gh_repos','Список репозиториев',{limit:{type:'number'}},[]);T('gh_read','Читать файл или папку репозитория',{repo:{type:'string'},path:{type:'string'},ref:{type:'string'}},['repo']);T('gh_write','Записать файл в GitHub; обновление только после подтверждения',{repo:{type:'string'},path:{type:'string'},content:{type:'string'},message:{type:'string'},branch:{type:'string'}},['repo','path','content','message']);T('gh_delete','Удалить файл только после подтверждения',{repo:{type:'string'},path:{type:'string'},message:{type:'string'},branch:{type:'string'}},['repo','path','message']);T('gh_create_repo','Создать репозиторий',{name:{type:'string'},private:{type:'boolean'},description:{type:'string'}},['name']);if(fsToolsAvailable())T('gh_clone','Скачать репозиторий в локальную папку',{repo:{type:'string'},ref:{type:'string'},dest:{type:'string'}},['repo']);}return defs;}
function agentSystemAddendum(){if(!agentActive())return'';return'\n\nИНСТРУМЕНТЫ: используй доступные fs_* и gh_* инструменты, передавай валидные аргументы. Перед перезаписью, удалением, коммитом или другим необратимым действием запроси подтверждение. Результаты инструментов не выдумывай.';}
async function nsPost(path,payload){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-NS-Agent':'1'},body:JSON.stringify(payload)});const j=await r.json().catch(()=>({error:'HTTP '+r.status}));if(!r.ok||j.error)throw new Error(j.error||'HTTP '+r.status);return j;}
async function ghCall(method,path,body){const h={'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};if(settings.ghToken)h.Authorization='Bearer '+settings.ghToken.trim();if(body!==undefined)h['Content-Type']='application/json';const r=await fetch('https://api.github.com'+path,{method,headers:h,body:body!==undefined?JSON.stringify(body):undefined});const t=await r.text();let j;try{j=JSON.parse(t);}catch(_){}if(!r.ok)throw new Error('GitHub HTTP '+r.status+(j&&j.message?': '+j.message:''));return j;}
const b64encode=s=>btoa(unescape(encodeURIComponent(s)));const b64decode=b=>{try{return decodeURIComponent(escape(atob(String(b).replace(/\s/g,'')));}catch(_){return'(не удалось декодировать содержимое)';}};const ghEncodePath=p=>String(p||'').split('/').filter(Boolean).map(encodeURIComponent).join('/');
async function execAgentTool(name,a={}){const fsQ=()=>{if(!fsToolsAvailable())throw new Error('файловые инструменты недоступны');return fsFullMode()?{full:true}:{root:settings.workspace.trim()};};switch(name){case'fs_drives':{const j=await nsPost('/__ns/fs/drives',{});return{ok:true,result:'Диски: '+(j.drives||[]).join(', ')+'\nДомашняя папка: '+j.home};}case'fs_list':{const j=await nsPost('/__ns/fs/list',{...fsQ(),path:a.path||''});return{ok:true,result:JSON.stringify(j.entries||[])};}case'fs_read':{const j=await nsPost('/__ns/fs/read',{...fsQ(),path:a.path});return{ok:true,result:j.content||'(пустой файл)'};}case'fs_write':{const j=await nsPost('/__ns/fs/write',{...fsQ(),path:a.path,content:String(a.content||'')});return{ok:true,result:'Записан '+a.path+' ('+j.bytes+' байт)'};}case'fs_mkdir':await nsPost('/__ns/fs/mkdir',{...fsQ(),path:a.path});return{ok:true,result:'Создана папка '+a.path};case'fs_delete':await nsPost('/__ns/fs/delete',{...fsQ(),path:a.path});return{ok:true,result:'Удалено '+a.path};case'fs_move':await nsPost('/__ns/fs/move',{...fsQ(),from:a.from,to:a.to});return{ok:true,result:'Перемещено '+a.from+' → '+a.to};case'fs_search':{const j=await nsPost('/__ns/fs/search',{...fsQ(),path:a.path||'',pattern:a.pattern});return{ok:true,result:JSON.stringify(j.results||[])};}case'gh_me':{const j=await ghCall('GET','/user');return{ok:true,result:'GitHub: '+j.login};}case'gh_repos':{const j=await ghCall('GET','/user/repos?per_page='+Math.min(Number(a.limit)||30,100)+'&sort=updated');return{ok:true,result:(j||[]).map(x=>x.full_name).join('\n')};}case'gh_read':{const j=await ghCall('GET','/repos/'+a.repo+'/contents/'+ghEncodePath(a.path));return{ok:true,result:Array.isArray(j)?j.map(x=>x.path).join('\n'):j.type==='file'?b64decode(j.content):'неподдерживаемый ответ'};}case'gh_write':{const path='/repos/'+a.repo+'/contents/'+ghEncodePath(a.path);let sha;try{const old=await ghCall('GET',path);sha=old.sha;}catch(_){}const j=await ghCall('PUT',path,{message:a.message,content:b64encode(String(a.content||'')),sha,branch:a.branch});return{ok:true,result:'Записан файл '+a.path+'; commit '+(j.commit?.sha||'').slice(0,7)};}case'gh_delete':{const path='/repos/'+a.repo+'/contents/'+ghEncodePath(a.path);const old=await ghCall('GET',path);const j=await ghCall('DELETE',path,{message:a.message,sha:old.sha,branch:a.branch});return{ok:true,result:'Удалён '+a.path};}case'gh_create_repo':{const j=await ghCall('POST','/user/repos',{name:a.name,private:a.private!==false,description:a.description||'',auto_init:true});return{ok:true,result:'Создан '+j.full_name};}case'gh_clone':{const j=await nsPost('/__ns/gh/clone',{...fsQ(),repo:a.repo,ref:a.ref||'',token:settings.ghToken,dest:a.dest||''});return{ok:true,result:'Скачан '+a.repo+' в '+(j.destPath||j.dest)};}}return{ok:false,result:'Неизвестный инструмент '+name};}
async function runAgentTool(call){let args={};try{args=call.args?JSON.parse(call.args):{};}catch(e){return{ok:false,result:'Некорректные аргументы: '+e.message};}try{return await execAgentTool(call.name,args);}catch(e){return{ok:false,result:'Ошибка: '+(e.message||String(e))};}}
function extractJsonAt(s,idx){if(s[idx]!=='{')return null;let depth=0,quoted=false,escape=false;for(let i=idx;i<s.length;i++){const c=s[i];if(escape){escape=false;continue;}if(quoted){if(c==='\\')escape=true;else if(c==='"')quoted=false;continue;}if(c==='"')quoted=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0)return{raw:s.slice(idx,i+1),end:i+1};}return null;}
function parseToolTextCalls(content){const s=String(content||''),calls=[],parts=[];let last=0;const re=/<<<\s*TOOL(?:_CALL)?\s*>>>/g;let m;while((m=re.exec(s))){let i=m.index+m[0].length;while(/\s/.test(s[i]||''))i++;const jb=extractJsonAt(s,i);if(!jb)continue;let obj;try{obj=JSON.parse(jb.raw);}catch(_){continue;}const arr=Array.isArray(obj)?obj:Array.isArray(obj.calls)?obj.calls:[obj];let got=false;for(const c of arr){const name=c&&(c.tool||c.name);if(typeof name==='string'){calls.push({id:'txt'+uid(),name,args:JSON.stringify(c.args||c.arguments||{})});got=true;}}if(!got)continue;let end=jb.end;const em=/^\s*<<<\s*END(?:\s*TOOL)?\s*>>>/.exec(s.slice(end));if(em)end+=em[0].length;parts.push(s.slice(last,m.index));last=end;re.lastIndex=end;}if(!calls.length)return{calls:[],cleaned:s};parts.push(s.slice(last));return{calls,cleaned:parts.join('').replace(/\n{3,}/g,'\n\n').trim()};}
function toolArgSummary(name,args){try{args=JSON.parse(args||'{}');}catch(_){return'';}return args.path||args.repo||args.pattern||args.name||'';}
function toolCardsHtml(m){if(!m||!m.toolRounds)return'';return m.toolRounds.flatMap(r=>(r.calls||[]).map(c=>'<div class="tool-step '+(c.ok?'ok':'err')+'"><div class="ts-head"><span>'+((TOOL_META[c.name]||{}).icon||'⚙️')+'</span><span>'+esc((TOOL_META[c.name]||{}).label||c.name)+'</span><span>'+esc(toolArgSummary(c.name,c.args))+'</span><b>'+(c.ok?'✓':'✕')+'</b></div><details class="ts-det"><summary>вызов и результат</summary><pre>'+esc(c.result||'')+'</pre></details></div>')).join('');}
function renderChatList(filter=''){const list=$('#chatList'),f=filter.trim().toLowerCase();list.innerHTML='';const rows=chats.filter(c=>!f||(c.title||'').toLowerCase().includes(f));if(!rows.length){list.innerHTML='<div class="sb-empty">Пока пусто</div>';return;}for(const c of rows){const el=document.createElement('div');el.className='chat-item'+(c.id===currentChatId?' active':'');el.innerHTML='<span class="ci-icon">✦</span><span class="ci-name"></span><button class="ci-del" title="Удалить чат">×</button>';el.querySelector('.ci-name').textContent=c.title||'Без названия';el.addEventListener('click',()=>openChat(c.id));el.querySelector('.ci-del').addEventListener('click',e=>{e.stopPropagation();deleteChat(c.id);});list.appendChild(el);}}
function avatarFor(role){return role==='user'?'👤':role==='assistant'?'✦':'⚠';}
function msgEl(m,idx){const wrap=document.createElement('div');wrap.className='msg '+(m.role==='user'?'user':m.role==='assistant'?'assistant':'error');wrap.dataset.idx=idx;const av=document.createElement('div');av.className='avatar';av.textContent=avatarFor(m.role);const bubble=document.createElement('div');bubble.className='bubble';const role=document.createElement('div');role.className='b-role';role.textContent=m.role==='user'?'Вы':m.role==='assistant'?'NeuroShell':'Ошибка';bubble.appendChild(role);const body=document.createElement('div');body.className='md';if(m.role==='user'&&m.attchs){for(const a of m.attchs){const chip=document.createElement('div');chip.className='att-chip';chip.textContent=a.name;body.appendChild(chip);}}if(m.content)body.innerHTML+=(m.role==='assistant'?toolCardsHtml(m):'')+renderMarkdown(m.content);bubble.appendChild(body);wrap.append(av,bubble);if(m.content){const acts=document.createElement('div');acts.className='msg-actions';const copy=document.createElement('button');copy.className='ma-btn';copy.textContent='⧉ Копировать';copy.onclick=()=>navigator.clipboard.writeText(m.content).then(()=>toast('Скопировано','ok'));acts.appendChild(copy);if(m.role==='user'){const re=document.createElement('button');re.className='ma-btn';re.textContent='↻ Переспросить';re.onclick=()=>regenerate(idx);acts.appendChild(re);}wrap.appendChild(acts);}return wrap;}
function renderMessages(chat){const box=$('#messages');box.innerHTML='';if(!chat||!chat.messages.length){box.appendChild(welcomeEl());return;}chat.messages.forEach((m,i)=>box.appendChild(msgEl(m,i)));}
function welcomeEl(){const w=document.createElement('div');w.className='welcome';w.innerHTML='<div class="w-logo">✦</div><h1>NeuroShell</h1><div class="w-sub">Подключи API в настройках и начни чат.</div>';return w;}
function renderMarkdown(src){return mdToHtml(src||'');}
function mdToHtml(src){let s=esc(src),blocks=[];s=s.replace(/```(\w*)\r?\n([\s\S]*?)```/g,(_,lang,code)=>{blocks.push({lang:lang||'text',code});return'\u0000B'+(blocks.length-1)+'\u0000';});const lines=s.split(/\r?\n/);let html='';for(const line of lines){const h=line.match(/^(#{1,4})\s+(.*)$/);if(h)html+='<h'+h[1].length+'>'+h[2]+'</h'+h[1].length+'>';else if(/^\s*[-*+]\s+/.test(line))html+='<p>• '+line.replace(/^\s*[-*+]\s+/,'')+'</p>';else if(line)html+='<p>'+line+'</p>';}html=html.replace(/\*\*([^*]+)\*\*/g,'<b>$1</b>').replace(/`([^`]+)`/g,'<code>$1</code>');return html.replace(/\u0000B(\d+)\u0000/g,(_,i)=>'<pre><code>'+blocks[+i].code+'</code></pre>');}
function persist(){store.set('chats',chats);store.set('settings',settings);}
function newChat(){currentChatId=null;renderMessages(null);$('#chatTitle').textContent='Новый чат';$('#chatSub').textContent='';renderChatList($('#searchInput').value);}
function currentChat(){return chats.find(c=>c.id===currentChatId)||null;}
function ensureChat(){let c=currentChat();if(c)return c;c={id:uid(),title:'Новый чат',created:now(),updated:now(),messages:[]};chats.unshift(c);currentChatId=c.id;return c;}
function openChat(id){currentChatId=id;const c=currentChat();if(!c)return;renderMessages(c);$('#chatTitle').textContent=c.title||'Без названия';$('#chatSub').textContent=chatSubText(c);renderChatList($('#searchInput').value);scrollBottom();}
function deleteChat(id){confirmDialog('Удалить чат? Это нельзя отменить.',ok=>{if(!ok)return;chats=chats.filter(c=>c.id!==id);if(currentChatId===id)newChat();persist();renderChatList($('#searchInput').value);});}
function scrollBottom(){const sc=$('#chatScroll');sc.scrollTop=sc.scrollHeight;}
function nearBottom(){const sc=$('#chatScroll');return sc.scrollHeight-sc.scrollTop-sc.clientHeight<140;}

async function requestChat(url,opts,body,state){let cur={...body};while(true){const response=await fetch(url,{...opts,body:JSON.stringify(cur)});if(response.ok)return response;const text=await response.text().catch(()=> '');if(cur.stream_options&&/stream_options/i.test(text)){delete cur.stream_options;continue;}if(cur.tools&&/tool|function/i.test(text)){delete cur.tools;delete cur.tool_choice;state.toolsDropped=true;continue;}throw new Error('HTTP '+response.status+(text?' — '+text.slice(0,400):''));}}
function buildApiMessages(chat){const out=[{role:'system',content:(settings.system||PRESETS.agent.system)+agentSystemAddendum()}];for(const m of chat.messages){if(m.role==='user')out.push({role:'user',content:m.content||'(пусто)'});else if(m.role==='assistant'&&m.content)out.push({role:'assistant',content:m.content});}return out;}
async function sendMessage(){if(generating)return;const input=$('#input'),text=input.value.trim();if(!text&&!attachments.length)return;if(!settings.apiKey){toast('Сначала укажите API-ключ в настройках','warn');openSettings();return;}const chat=ensureChat(),user={role:'user',content:text};if(attachments.length)user.attchs=attachments.slice();chat.messages.push(user);if(chat.title==='Новый чат'){chat.title=(text||'Вложения').slice(0,46)||'Без названия';$('#chatTitle').textContent=chat.title;}chat.updated=now();input.value='';autoGrow(input);const atts=attachments.slice();attachments=[];renderAtts();updateStat();renderMessages(chat);renderChatList($('#searchInput').value);persist();await runCompletion(chat,atts);}
function regenerate(idx){if(generating)return;const chat=currentChat();if(!chat)return;chat.messages=chat.messages.slice(0,idx+1);renderMessages(chat);scrollBottom();runCompletion(chat,[]);}

async function runCompletion(chat,atts){
  generating=true;setBusy(true);const ph={role:'assistant',content:'',toolRounds:[]};chat.messages.push(ph);const phIdx=chat.messages.length-1;const box=$('#messages');let el=msgEl(ph,phIdx);box.appendChild(el);const refresh=()=>{try{const fresh=msgEl(ph,phIdx);box.replaceChild(fresh,el);el=fresh;if(nearBottom())scrollBottom();}catch(_){}};
  abortCtl=new AbortController();let full='';
  try{
    const defs=agentActive()?agentToolDefs():[],url=apiBase()+'/chat/completions';let inputTokens=0,outputTokens=0,toolsDropped=false;
    for(let round=0;round<12;round++){
      const body={model:settings.model,messages:buildApiMessages(chat),temperature:Number(settings.temp),stream:!!settings.stream};if(settings.stream)body.stream_options={include_usage:true};if(defs.length&&!toolsDropped){body.tools=defs;body.tool_choice='auto';}
      const response=await requestChat(url,{method:'POST',headers:apiHeaders(),signal:abortCtl.signal},body,{toolsDropped});
      const data=await response.json();const choice=data.choices&&data.choices[0];if(!choice)throw new Error('API вернул пустой ответ');
      const msg=choice.message||{};if(msg.content)full+=typeof msg.content==='string'?msg.content:'';
      const calls=msg.tool_calls||[];if(calls.length){const roundData={calls:[]};for(const call of calls){const f=call.function||{},res=await runAgentTool({name:f.name,args:f.arguments});roundData.calls.push({name:f.name,args:f.arguments,result:res.result,ok:res.ok});}ph.toolRounds.push(roundData);chat.messages.push({role:'assistant',content:'',toolRounds:[roundData]});continue;}
      break;
    }
    ph.content=full||'(пустой ответ)';const u=data&&data.usage;if(u){ph.usage={in:u.prompt_tokens||0,out:u.completion_tokens||0};ph.cost=costOf(settings.model,ph.usage.in,ph.usage.out);}refresh();persist();
  }catch(error){ph.role='error';const msg=String(error&&error.message||error);ph.content=msg.includes('Failed to fetch')||msg==='Load failed'?'Сетевая ошибка: приложение не получило ответ от API. Проверьте подключение и локальный прокси; это само по себе не означает, что API-ключ неверен.':msg;refresh();persist();}
  finally{generating=false;abortCtl=null;setBusy(false);if(window.NS_MESSAGE_QUEUE_DRAIN)window.NS_MESSAGE_QUEUE_DRAIN();}
}
