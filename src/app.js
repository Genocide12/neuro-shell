/* ===== NeuroShell :: логика (собирается в index.html) ===== */
'use strict';

/* ================== КОНФИГ И ПРЕСЕТЫ ================== */
const NS_VERSION = '1.0.0';
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
- Если пользователь просит веб-страницу, калькулятор, схему, визуализацию или любой самодостаточный HTML — оформляй ответ как АРТЕФАКТ: ровно один html-блок \`\`\`html, полностью самодостаточный (стили и скрипты внутри, без внешних CDN), на русском языке.
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
- Если пользователь просит веб-страницу или визуализацию — выдавай один самодостаточный \`\`\`html артефакт без внешних CDN.`
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
    system:
`Ты — дружелюбный ИИ-собеседник в NeuroShell. Отвечай на языке пользователя, естественно и по делу, без лишних формальностей. Задавай встречные вопросы, когда это уместно.`
  }
};

const DEFAULTS = {
  apiKey: '',
  baseUrl: 'https://api.gym-rat.online/v1',
  model: 'claude-opus-5-5',
  preset: 'agent',
  system: PRESETS.agent.system,
  temp: 0.6,
  stream: true
};

const SUGGESTED_MODELS = [
  'claude-opus-5-5','claude-opus-5','claude-opus-4-8','claude-sonnet-4-6',
  'claude-sonnet-4-5','claude-haiku-4-5','gpt-4o','gpt-4o-mini',
  'deepseek-chat','qwen-max','llama-3.3-70b-instruct'
];

/* ================== УТИЛИТЫ ================== */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const now = () => new Date().toISOString();

function fmtSize(n){
  if (n < 1024) return n + ' Б';
  if (n < 1048576) return (n/1024).toFixed(1) + ' КБ';
  return (n/1048576).toFixed(1) + ' МБ';
}
function fmtDate(iso){
  const d = new Date(iso), now2 = new Date();
  const sameDay = d.toDateString() === now2.toDateString();
  const t = d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
  if (sameDay) return 'сегодня, ' + t;
  return d.toLocaleDateString('ru-RU',{day:'numeric',month:'short'}) + ', ' + t;
}
// грубая оценка токенов: ~3.6 символа на токен для смешанного ру/ен текста
const estTokens = s => Math.ceil((s || '').length / 3.6);

function isExeMode(){
  // exe-режим включается мостом NeuroShellBridge
  return typeof window.NeuroShellBridge === 'object' && window.NeuroShellBridge !== null;
}

/* ================== ТОСТЫ ================== */
function toast(msg, type = '', ms = 3200){
  const box = $('#toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast ' + type;
  el.innerHTML = (type === 'ok' ? '✓ ' : type === 'err' ? '✕ ' : '') + esc(msg);
  box.appendChild(el);
  setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 300); }, ms);
}

/* ================== ХРАНИЛИЩЕ ================== */
const store = {
  get(k, d){ try{ const v = localStorage.getItem(LS_PREFIX + k); return v === null ? d : JSON.parse(v); }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem(LS_PREFIX + k, JSON.stringify(v)); }catch(e){} },
  del(k){ try{ localStorage.removeItem(LS_PREFIX + k); }catch(e){} }
};

let settings = Object.assign({}, DEFAULTS, store.get('settings', {}));
let chats = store.get('chats', []);        // [{id,title,created,updated,messages:[{role,content,attchs?,error?}]}]
let currentChatId = null;
let attachments = [];                       // [{name,size,type,text?,dataUrl?}]
let generating = false;
let abortCtl = null;
let modelListCache = [];

/* ================== КОНФИГУРАЦИЯ API ================== */
function apiBase(){
  let b = (settings.baseUrl || '').trim();
  if (!b) b = DEFAULTS.baseUrl;
  b = b.replace(/\/+$/, '');
  if (!/\/v\d+$/.test(b) && !b.endsWith('/api')) b += '/v1';
  return b;
}
function apiHeaders(){
  const h = { 'Content-Type': 'application/json' };
  if (settings.apiKey) h['Authorization'] = 'Bearer ' + settings.apiKey.trim();
  return h;
}

/* ================== РЕНДЕР: СПИСОК ЧАТОВ ================== */
function chatIconSvg(){
  return '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
}
function renderChatList(filter = ''){
  const list = $('#chatList');
  const f = filter.trim().toLowerCase();
  const items = chats.filter(c => !f || (c.title || '').toLowerCase().includes(f));
  list.innerHTML = '';
  if (!items.length){
    list.innerHTML = '<div class="sb-empty">' + (f ? 'Ничего не найдено' : 'Пока пусто — начните первый чат') + '</div>';
    return;
  }
  for (const c of items){
    const el = document.createElement('div');
    el.className = 'chat-item' + (c.id === currentChatId ? ' active' : '');
    el.innerHTML =
      '<span class="ci-icon">' + chatIconSvg() + '</span>' +
      '<span class="ci-name"></span>' +
      '<button class="ci-del" title="Удалить чат">' +
        '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>' +
      '</button>';
    el.querySelector('.ci-name').textContent = c.title || 'Без названия';
    el.addEventListener('click', () => openChat(c.id));
    el.querySelector('.ci-del').addEventListener('click', e => { e.stopPropagation(); deleteChat(c.id); });
    list.appendChild(el);
  }
}

/* ================== РЕНДЕР: СООБЩЕНИЯ ================== */
function avatarFor(role){
  if (role === 'user') return '👤';
  if (role === 'assistant') return '✦';
  return '⚠';
}

function msgEl(m, idx){
  const wrap = document.createElement('div');
  wrap.className = 'msg ' + (m.role === 'user' ? 'user' : m.role === 'assistant' ? 'assistant' : 'error');
  wrap.dataset.idx = idx;

  const av = document.createElement('div');
  av.className = 'avatar';
  av.textContent = avatarFor(m.role);

  const bubble = document.createElement('div');
  bubble.className = 'bubble';

  const role = document.createElement('div');
  role.className = 'b-role';
  role.textContent = m.role === 'user' ? 'Вы' : m.role === 'assistant' ? 'NeuroShell' : 'Ошибка';
  bubble.appendChild(role);

  const body = document.createElement('div');
  body.className = 'md';
  if (m.role === 'user' && m.attchs && m.attchs.length){
    for (const a of m.attchs){
      const chip = document.createElement('div');
      chip.className = 'att-chip';
      if (a.dataUrl){
        const img = document.createElement('img');
        img.src = a.dataUrl;
        chip.appendChild(img);
      }
      const nm = document.createElement('span');
      nm.className = 'ac-name';
      nm.textContent = a.name;
      const sz = document.createElement('span');
      sz.className = 'ac-size';
      sz.textContent = fmtSize(a.size);
      chip.appendChild(nm); chip.appendChild(sz);
      body.appendChild(chip);
    }
    if (m.content){
      const p = document.createElement('p');
      p.textContent = m.content;
      body.appendChild(p);
    }
  } else {
    body.innerHTML = renderMarkdown(m.content || '');
  }
  bubble.appendChild(body);

  // артефакт: кнопка предпросмотра, если есть ```html блок
  if (m.role === 'assistant'){
    const arts = extractArtifacts(m.content || '');
    if (arts.length){
      const btnRow = document.createElement('div');
      btnRow.style.marginTop = '10px';
      for (let i = 0; i < arts.length; i++){
        const b = document.createElement('button');
        b.className = 'code-copy';
        b.style.marginRight = '8px';
        b.textContent = '⧉ Открыть артефакт ' + (arts.length > 1 ? (i + 1) + ' ' : '') + 'в панели';
        b.addEventListener('click', () => openArtifact(arts, i, m));
        btnRow.appendChild(b);
      }
      body.appendChild(btnRow);
    }
  }

  wrap.appendChild(av);
  wrap.appendChild(bubble);

  if (m.role !== 'error' && m.content){
    const acts = document.createElement('div');
    acts.className = 'msg-actions';
    const copyBtn = document.createElement('button');
    copyBtn.className = 'ma-btn';
    copyBtn.innerHTML = '⧉ Копировать';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(m.content).then(
        () => toast('Скопировано в буфер', 'ok', 1600),
        () => toast('Не удалось скопировать', 'err')
      );
    });
    acts.appendChild(copyBtn);

    if (m.role === 'user'){
      const reBtn = document.createElement('button');
      reBtn.className = 'ma-btn';
      reBtn.innerHTML = '↻ Переспросить';
      reBtn.addEventListener('click', () => regenerate(idx));
      acts.appendChild(reBtn);
    }
    wrap.appendChild(acts);
  }
  return wrap;
}

function renderMessages(chat){
  const box = $('#messages');
  box.innerHTML = '';
  if (!chat || !chat.messages.length){
    box.appendChild(welcomeEl());
    return;
  }
  chat.messages.forEach((m, i) => box.appendChild(msgEl(m, i)));
}

function welcomeEl(){
  const w = document.createElement('div');
  w.className = 'welcome';
  w.innerHTML =
    '<div class="w-logo"><svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a4 4 0 0 0-4 4v2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V10a2 2 0 0 0-2-2h-2V6a4 4 0 0 0-4-4z"/><path d="M9 12h.01M15 12h.01M9 16c.6.7 1.8 1 3 1s2.4-.3 3-1"/></svg></div>' +
    '<h1>NeuroShell</h1>' +
    '<div class="w-sub">Красивая оболочка для вашего API-ключа. Вставьте ключ в настройках — и работайте.</div>' +
    '<div class="w-cards"></div>';
  const cards = [
    ['💬', 'Поговорить', 'Спросите что угодно — от объяснения квантовой физики до плана на день'],
    ['🧑‍💻', 'Написать код', '«Напиши_telegram-бота на Python, который ведёт дневник трат»'],
    ['📊', 'Разобрать данные', '«Составь таблицу сравнения облачных хостингов для маленького проекта»'],
    ['🌐', 'Собрать страницу', '«Сделай красивую HTML-страницу с таймером до Нового года» — откроется как артефакт']
  ];
  const cardsBox = w.querySelector('.w-cards');
  const prompts = [
    'Привет! Расскажи, на что ты способен и как лучше тобой пользоваться.',
    'Напиши на Python telegram-бота, который ведёт дневник трат: команды /add, /list, /stats, хранение в SQLite. Дай полный код.',
    'Составь таблицу сравнения облачных хостингов для маленького проекта: цена, простота, лимиты. Сделай вывод.',
    'Сделай красивую HTML-страницу с таймером до Нового года: тёмная тема, конфетти на канвасе, всё в одном файле.'
  ];
  cards.forEach((c, i) => {
    const el = document.createElement('div');
    el.className = 'w-card';
    el.innerHTML = '<div class="wc-t">' + c[0] + ' ' + esc(c[1]) + '</div><div class="wc-d">' + esc(c[2]) + '</div>';
    el.addEventListener('click', () => {
      const inp = $('#input');
      inp.value = prompts[i];
      autoGrow(inp);
      inp.focus();
    });
    cardsBox.appendChild(el);
  });
  return w;
}

/* ================== MARKDOWN ================== */
function renderMarkdown(src){
  const out = mdToHtml(src || '');
  return out;
}

function extractArtifacts(text){
  // ```html ... ``` блоки длиной > 200 символов считаем артефактами
  const arts = [];
  const re = /```html\r?\n([\s\S]*?)```/g;
  let m;
  while ((m = re.exec(text)) !== null){
    if (m[1] && m[1].trim().length > 200) arts.push(m[1].trim());
  }
  return arts;
}

/* --- мини-маркдаун (без внешних библиотек) --- */
function mdToHtml(src){
  // 1) экранирование
  let s = esc(src);

  // 2) извлекаем код-блоки, чтобы не трогать их содержимое
  const blocks = [];
  s = s.replace(/```(\w*)\r?\n([\s\S]*?)```/g, (all, lang, code) => {
    blocks.push({ lang: lang || 'text', code });
    return '\u0000B' + (blocks.length - 1) + '\u0000';
  });

  const inl = [];
  s = s.replace(/`([^`\n]+)`/g, (all, c) => {
    inl.push(c);
    return '\u0000I' + (inl.length - 1) + '\u0000';
  });

  // 3) заголовки, линии
  const lines = s.split(/\r?\n/);
  const outLines = [];
  let inList = null; // 'ul' | 'ol'
  const closeList = () => { if (inList){ outLines.push('</' + inList + '>'); inList = null; } };

  for (let i = 0; i < lines.length; i++){
    let L = lines[i];
    const h = L.match(/^(#{1,4})\s+(.*)$/);
    if (h){ closeList(); outLines.push('<h' + h[1].length + '>' + h[2] + '</h' + h[1].length + '>'); continue; }
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(L)){ closeList(); outLines.push('<hr>'); continue; }
    if (/^\s*>\s?/.test(L)){
      closeList();
      const q = L.replace(/^\s*>\s?/, '');
      const prev = outLines[outLines.length - 1];
      if (prev && prev.startsWith('<blockquote>') && !prev.endsWith('</blockquote>'))
        outLines[outLines.length - 1] = prev + '<br>' + q;
      else outLines.push('<blockquote>' + q + '</blockquote>');
      continue;
    }
    const ul = L.match(/^\s*[-*+]\s+(.*)$/);
    if (ul){ if (inList !== 'ul'){ closeList(); outLines.push('<ul>'); inList = 'ul'; } outLines.push('<li>' + ul[1] + '</li>'); continue; }
    const ol = L.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ol){ if (inList !== 'ol'){ closeList(); outLines.push('<ol>'); inList = 'ol'; } outLines.push('<li>' + ol[1] + '</li>'); continue; }
    if (/^\s*$/.test(L)){ closeList(); outLines.push(''); continue; }
    closeList();
    outLines.push('<p>' + L + '</p>');
  }
  closeList();
  let html = outLines.join('\n');

  // 4) таблицы (gfm-подобные)
  html = html.replace(/(<p>\|[\s\S]*?<\/p>(?:\n<p>\|[\s\S]*?<\/p>)*)/g, chunk => {
    const rows = chunk.match(/<p>[\s\S]*?<\/p>/g) || [];
    const parsed = rows.map(r => r.slice(3, -4).trim());
    if (parsed.length < 2 || !/^\|?\s*:?-{2,}/.test(parsed[1].replace(/\|/g, ' '))) return chunk;
    const cells = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
    let t = '<table><thead><tr>';
    for (const c of cells(parsed[0])) t += '<th>' + c + '</th>';
    t += '</tr></thead><tbody>';
    for (let i = 2; i < parsed.length; i++){
      t += '<tr>';
      for (const c of cells(parsed[i])) t += '<td>' + c + '</td>';
      t += '</tr>';
    }
    return t + '</tbody></table>';
  });

  // 5) инлайн-разметка
  html = html
    .replace(/\*\*\*([^*]+)\*\*\*/g, '<b><i>$1</i></b>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, '$1<i>$2</i>')
    .replace(/(^|[\s(])_([^_\n]+)_/g, '$1<i>$2</i>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  // 6) возвращаем код
  html = html.replace(/\u0000I(\d+)\u0000/g, (all, i) => '<code>' + inl[+i] + '</code>');
  html = html.replace(/<p>\u0000B(\d+)\u0000<\/p>/g, (all, i) => codeBlockHtml(blocks[+i]));
  html = html.replace(/\u0000B(\d+)\u0000/g, (all, i) => codeBlockHtml(blocks[+i]));
  return html;
}

function codeBlockHtml(b){
  const id = 'cb' + uid();
  return '<div class="codewrap"><div class="code-head"><span class="lang">' + esc(b.lang) + '</span>' +
    '<button class="code-copy" data-copy="' + id + '">⧉ Копировать</button></div>' +
    '<pre><code id="' + id + '">' + b.code + '</code></pre></div>';
}

// делегированный обработчик копирования кода
document.addEventListener('click', e => {
  const btn = e.target.closest('[data-copy]');
  if (!btn) return;
  const code = document.getElementById(btn.dataset.copy);
  if (code) navigator.clipboard.writeText(code.textContent).then(
    () => { btn.textContent = '✓ Скопировано'; setTimeout(() => btn.textContent = '⧉ Копировать', 1500); },
    () => toast('Не удалось скопировать', 'err')
  );
});

/* ================== АРТЕФАКТЫ ================== */
let artifactTabs = [];
let artifactActive = 0;

function openArtifact(arts, idx, msg){
  artifactTabs = arts.map((a, i) => ({ label: 'Артефакт ' + (i + 1), html: a }));
  artifactActive = idx;
  const panel = $('#artifactPanel');
  panel.classList.remove('hidden');
  renderArtifactTabs();
  loadArtifact(artifactActive);
}

function renderArtifactTabs(){
  const box = $('#artifactTabs');
  box.innerHTML = '';
  artifactTabs.forEach((t, i) => {
    const b = document.createElement('button');
    b.className = 'ap-tab' + (i === artifactActive ? ' active' : '');
    b.textContent = t.label;
    b.addEventListener('click', () => { artifactActive = i; renderArtifactTabs(); loadArtifact(i); });
    box.appendChild(b);
  });
}

function loadArtifact(i){
  const fr = $('#artifactFrame');
  fr.srcdoc = artifactTabs[i].html;
}

/* ================== ЧАТЫ: ОПЕРАЦИИ ================== */
function persist(){
  store.set('chats', chats);
  store.set('settings', settings);
}

function newChat(){
  currentChatId = null;
  renderMessages(null);
  $('#chatTitle').textContent = 'Новый чат';
  $('#chatSub').textContent = '';
  renderChatList($('#searchInput').value);
}

function currentChat(){
  return chats.find(c => c.id === currentChatId) || null;
}

function ensureChat(){
  if (currentChatId){
    const c = currentChat();
    if (c) return c;
  }
  const c = { id: uid(), title: 'Новый чат', created: now(), updated: now(), messages: [] };
  chats.unshift(c);
  currentChatId = c.id;
  return c;
}

function openChat(id){
  currentChatId = id;
  const c = currentChat();
  if (!c) return;
  renderMessages(c);
  $('#chatTitle').textContent = c.title || 'Без названия';
  const lastMsg = c.messages[c.messages.length - 1];
  $('#chatSub').textContent = (c.messages.length ? c.messages.length + ' сообщ. · ' : '') + fmtDate(c.updated);
  renderChatList($('#searchInput').value);
  scrollBottom();
  if (window.innerWidth <= 760) toggleSidebar(false);
}

function deleteChat(id){
  const c = chats.find(x => x.id === id);
  if (!c) return;
  confirmDialog('Удалить чат «' + (c.title || 'Без названия') + '»? Действие необратимо.', () => {
    chats = chats.filter(x => x.id !== id);
    if (currentChatId === id) newChat();
    persist();
    renderChatList($('#searchInput').value);
    toast('Чат удалён', 'ok', 1800);
  });
}

function scrollBottom(){
  const sc = $('#chatScroll');
  sc.scrollTop = sc.scrollHeight;
}
function nearBottom(){
  const sc = $('#chatScroll');
  return sc.scrollHeight - sc.scrollTop - sc.clientHeight < 140;
}

/* ================== ОТПРАВКА ================== */
async function sendMessage(){
  if (generating) return;
  const input = $('#input');
  const text = input.value.trim();
  if (!text && !attachments.length) return;

  if (!settings.apiKey){
    toast('Сначала укажите API-ключ в настройках', 'warn');
    openSettings();
    return;
  }

  const chat = ensureChat();
  const userMsg = { role: 'user', content: text };
  if (attachments.length) userMsg.attchs = attachments.slice();
  chat.messages.push(userMsg);

  if (chat.title === 'Новый чат' || !chat.title){
    chat.title = (text || 'Вложения').slice(0, 46) || 'Без названия';
    $('#chatTitle').textContent = chat.title;
  }
  chat.updated = now();

  input.value = '';
  autoGrow(input);
  const atts = attachments.slice();
  attachments = [];
  renderAtts();
  updateStat();

  renderMessages(chat);
  renderChatList($('#searchInput').value);
  scrollBottom();
  persist();

  await runCompletion(chat, atts);
}

function regenerate(idx){
  if (generating) return;
  const chat = currentChat();
  if (!chat) return;
  // отрезаем всё начиная с сообщения idx (само сообщение пользователя остаётся)
  chat.messages = chat.messages.slice(0, idx + 1);
  renderMessages(chat);
  scrollBottom();
  runCompletion(chat, []);
}

async function runCompletion(chat, atts){
  generating = true;
  setBusy(true);

  // плейсхолдер ответа
  const ph = { role: 'assistant', content: '' };
  const phIdx = chat.messages.length;
  chat.messages.push(ph);
  if (nearBottom()) scrollBottom();

  const box = $('#messages');
  const el = msgEl(ph, phIdx);
  // заменим содержимое на «печатает»
  const bubble = el.querySelector('.md');
  bubble.innerHTML = '<div class="typing"><span></span><span></span><span></span></div>';
  box.appendChild(el);
  if (nearBottom()) scrollBottom();

  abortCtl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
  let full = '';
  let hadError = false;

  try {
    const msgs = [];
    msgs.push({ role: 'system', content: settings.system || PRESETS.agent.system });
    for (const m of chat.messages){
      if (m.role === 'user'){
        const parts = [];
        if (m.content) parts.push({ type: 'text', text: m.content });
        if (m.attchs){
          for (const a of m.attchs){
            if (a.kind === 'image' && a.dataUrl){
              parts.push({ type: 'image_url', image_url: { url: a.dataUrl } });
            } else if (a.kind === 'text' && a.text){
              parts.push({ type: 'text', text: 'Файл «' + a.name + '»:\n```\n' + a.text.slice(0, 60000) + '\n```' });
            }
          }
        }
        if (!parts.length) parts.push({ type: 'text', text: '(пусто)' });
        msgs.push(parts.length === 1 && parts[0].type === 'text' ? { role: 'user', content: parts[0].text } : { role: 'user', content: parts });
      } else if (m.role === 'assistant' && m.content){
        msgs.push({ role: 'assistant', content: m.content });
      }
    }

    const body = {
      model: settings.model,
      messages: msgs,
      temperature: Number(settings.temp),
      stream: !!settings.stream
    };

    const url = apiBase() + '/chat/completions';
    const fetchOpts = { method: 'POST', headers: apiHeaders(), body: JSON.stringify(body) };
    if (abortCtl) fetchOpts.signal = abortCtl.signal;
    // в exe-режиме window.fetch перехвачен мостом NeuroShellBridge (см. обёртку):
    // запросы к API уходят через локальный прокси, поэтому CORS не важен

    if (settings.stream){
      const resp = await fetch(url, fetchOpts);
      if (!resp.ok){
        const errText = await resp.text().catch(() => '');
        throw new Error('HTTP ' + resp.status + (errText ? ' — ' + errText.slice(0, 500) : ''));
      }
      setConn('ok');
      const reader = resp.body.getReader();
      const dec = new TextDecoder();
      let buf = '';
      let lastRender = 0;
      while (true){
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0){
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') continue;
          try {
            const j = JSON.parse(data);
            const d = j.choices && j.choices[0] && j.choices[0].delta;
            if (d && d.content) full += d.content;
          } catch(e){}
        }
        const t = Date.now();
        if (t - lastRender > 60){
          lastRender = t;
          ph.content = full;
          bubble.innerHTML = renderMarkdown(full);
          if (nearBottom()) scrollBottom();
        }
      }
    } else {
      const resp = await fetch(url, fetchOpts);
      if (!resp.ok){
        const errText = await resp.text().catch(() => '');
        throw new Error('HTTP ' + resp.status + (errText ? ' — ' + errText.slice(0, 500) : ''));
      }
      setConn('ok');
      const j = await resp.json();
      full = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
      ph.content = full;
    }

    ph.content = full || '(пустой ответ)';
    // пересобираем элемент: появляются кнопки «копировать» и «артефакт»
    try { box.replaceChild(msgEl(ph, phIdx), el); } catch(e){ bubble.innerHTML = renderMarkdown(ph.content); }
  } catch(err){
    hadError = true;
    const aborted = err && (err.name === 'AbortError');
    if (aborted && full){
      ph.content = full + '\n\n*(остановлено)*';
      try { box.replaceChild(msgEl(ph, phIdx), el); } catch(e){ bubble.innerHTML = renderMarkdown(ph.content); }
    } else if (aborted){
      chat.messages.splice(phIdx, 1);
      box.removeChild(el);
    } else {
      setConn('err');
      const em = { role: 'error', content: 'Ошибка запроса: ' + (err && err.message ? err.message : String(err)) + '\n\nПроверьте ключ, Base URL и модель в настройках. Код ошибки HTTP 401 обычно означает неверный ключ, 404 — неверный адрес или имя модели.' };
      chat.messages[phIdx] = em;
      renderMessages(chat);
    }
  } finally {
    generating = false;
    abortCtl = null;
    setBusy(false);
    chat.updated = now();
    persist();
    renderChatList($('#searchInput').value);
    const c = currentChat();
    $('#chatSub').textContent = (c && c.messages.length ? c.messages.length + ' сообщ. · ' : '') + fmtDate(chat.updated);
    if (nearBottom()) scrollBottom();
  }
}

function setBusy(b){
  $('#btnSend').classList.toggle('hidden', b);
  $('#btnStop').classList.toggle('hidden', !b);
  $('#connDot').classList.toggle('busy', b);
  const inp = $('#input');
  inp.disabled = false;
}

function setConn(state){
  const d = $('#connDot');
  d.classList.remove('ok', 'err', 'busy');
  if (state) d.classList.add(state);
  d.title = state === 'ok' ? 'API отвечает' : state === 'err' ? 'Ошибка соединения' : 'Не проверено';
}

/* ================== ФАЙЛЫ ================== */
function handleFiles(files){
  const maxTotal = 8 * 1024 * 1024;
  let total = attachments.reduce((s, a) => s + a.size, 0);
  for (const f of files){
    if (total + f.size > maxTotal){ toast('Слишком много файлов (лимит 8 МБ). Файл «' + f.name + '» пропущен', 'warn'); continue; }
    total += f.size;
    const isImg = /^image\/(png|jpe?g|webp|gif)$/i.test(f.type);
    const reader = new FileReader();
    if (isImg){
      reader.onload = () => {
        attachments.push({ name: f.name, size: f.size, type: f.type, kind: 'image', dataUrl: reader.result });
        renderAtts();
      };
      reader.readAsDataURL(f);
    } else {
      reader.onload = () => {
        const t = String(reader.result || '');
        if (/\u0000/.test(t)){ toast('«' + f.name + '» — бинарный файл, прикрепить нельзя', 'warn'); return; }
        attachments.push({ name: f.name, size: f.size, type: f.type, kind: 'text', text: t });
        renderAtts();
      };
      reader.readAsText(f);
    }
  }
}

function renderAtts(){
  const bar = $('#attsBar');
  if (!attachments.length){ bar.classList.add('hidden'); bar.innerHTML = ''; return; }
  bar.classList.remove('hidden');
  bar.innerHTML = '';
  attachments.forEach((a, i) => {
    const chip = document.createElement('div');
    chip.className = 'att-chip';
    if (a.kind === 'image'){
      const img = document.createElement('img');
      img.src = a.dataUrl;
      chip.appendChild(img);
    }
    const nm = document.createElement('span');
    nm.className = 'ac-name';
    nm.textContent = a.name;
    const sz = document.createElement('span');
    sz.className = 'ac-size';
    sz.textContent = fmtSize(a.size);
    const x = document.createElement('button');
    x.className = 'ac-x';
    x.textContent = '✕';
    x.addEventListener('click', () => { attachments.splice(i, 1); renderAtts(); });
    chip.appendChild(nm); chip.appendChild(sz); chip.appendChild(x);
    bar.appendChild(chip);
  });
}

function updateStat(){
  $('#stat').textContent = '~' + estTokens($('#input').value) + ' ток.';
}

function autoGrow(t){
  t.style.height = 'auto';
  t.style.height = Math.min(t.scrollHeight, 220) + 'px';
}

/* ================== НАСТРОЙКИ ================== */
function openSettings(){
  $('#setKey').value = settings.apiKey;
  $('#setBase').value = settings.baseUrl;
  $('#setModel').value = settings.model;
  $('#setPreset').value = settings.preset;
  $('#setSystem').value = settings.system;
  $('#setTemp').value = settings.temp;
  $('#tempVal').textContent = settings.temp;
  $('#setStream').checked = !!settings.stream;
  fillModelList();
  $('#settingsModal').classList.remove('hidden');
  if (!$('#setKey').value) setTimeout(() => $('#setKey').focus(), 60);
}

function closeSettings(){ $('#settingsModal').classList.add('hidden'); }

function fillModelList(list){
  const dl = $('#modelList');
  const models = (list || modelListCache || []).slice();
  for (const m of SUGGESTED_MODELS) if (!models.includes(m)) models.push(m);
  dl.innerHTML = models.map(m => '<option value="' + esc(m) + '">').join('');
}

async function loadModels(silent){
  try {
    const url = apiBase() + '/models';
    const resp = await fetch(url, { headers: apiHeaders() });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const j = await resp.json();
    const list = (j.data || []).map(x => x.id).filter(Boolean);
    if (list.length){
      modelListCache = list;
      fillModelList(list);
      if (!silent) toast('Найдено моделей: ' + list.length, 'ok');
    } else if (!silent) toast('Список моделей пуст', 'warn');
  } catch(e){
    if (!silent) toast('Не удалось получить список моделей: ' + e.message, 'err');
  }
}

async function testKey(){
  const key = $('#setKey').value.trim();
  const base = $('#setBase').value.trim() || DEFAULTS.baseUrl;
  const btn = $('#btnTestKey');
  btn.disabled = true; btn.textContent = '…';
  try {
    let b = base.replace(/\/+$/, '');
    if (!/\/v\d+$/.test(b) && !b.endsWith('/api')) b += '/v1';
    const resp = await fetch(b + '/models', { headers: key ? { 'Authorization': 'Bearer ' + key } : {} });
    if (resp.status === 401 || resp.status === 403) throw new Error('HTTP ' + resp.status + ' — ключ отклонён');
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const j = await resp.json().catch(() => null);
    const list = j && j.data ? j.data.map(x => x.id).filter(Boolean) : [];
    modelListCache = list;
    fillModelList(list);
    const hasModel = !$('#setModel').value.trim() || list.length === 0 || list.includes($('#setModel').value.trim());
    toast('Соединение успешно' + (list.length ? ' · моделей: ' + list.length : '') + (!hasModel ? ' · выбранной модели нет в списке!' : ''), hasModel ? 'ok' : 'warn', 4200);
    setConn('ok');
  } catch(e){
    setConn('err');
    toast('Проверка не удалась: ' + e.message, 'err', 4200);
  } finally {
    btn.disabled = false; btn.textContent = 'Проверить';
  }
}

function saveSettings(){
  const prevPreset = settings.preset;
  settings.apiKey = $('#setKey').value.trim();
  settings.baseUrl = $('#setBase').value.trim() || DEFAULTS.baseUrl;
  settings.model = $('#setModel').value.trim() || DEFAULTS.model;
  settings.preset = $('#setPreset').value;
  // если системник не меняли руками от старого пресета — обновляем под новый
  const oldSys = (PRESETS[prevPreset] || PRESETS.agent).system;
  if ($('#setSystem').value === oldSys || !$('#setSystem').value){
    settings.system = (PRESETS[settings.preset] || PRESETS.agent).system;
  } else {
    settings.system = $('#setSystem').value;
  }
  settings.temp = $('#setTemp').value;
  settings.stream = $('#setStream').checked;
  persist();
  applySettingsToUI();
  closeSettings();
  toast('Настройки сохранены', 'ok', 1800);
}

function applySettingsToUI(){
  $('#modelBadge').textContent = settings.model || '—';
  $('#modelBadge').title = 'Модель: ' + settings.model + '\nBase URL: ' + apiBase();
  setConn('');
}

function applyPresetToTextarea(){
  const p = PRESETS[$('#setPreset').value];
  if (p) $('#setSystem').value = p.system;
}

/* ================== ЭКСПОРТ / ИМПОРТ ================== */
function exportSettings(){
  const data = JSON.stringify({ app: 'NeuroShell', version: NS_VERSION, exported: now(), settings, chats }, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'neuroshell-backup-' + new Date().toISOString().slice(0, 10) + '.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

function importSettings(){
  const inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json,application/json';
  inp.onchange = () => {
    const f = inp.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const j = JSON.parse(r.result);
        if (!j || j.app !== 'NeuroShell') throw new Error('это не бэкап NeuroShell');
        if (j.settings) settings = Object.assign({}, DEFAULTS, j.settings);
        if (Array.isArray(j.chats)){
          chats = j.chats;
          currentChatId = null;
        }
        persist();
        applySettingsToUI();
        newChat();
        toast('Импортировано: ' + (j.chats ? j.chats.length + ' чатов, ' : '') + 'настройки', 'ok');
      } catch(e){
        toast('Импорт не удался: ' + e.message, 'err');
      }
    };
    r.readAsText(f);
  };
  inp.click();
}

function wipeAll(){
  confirmDialog('Стереть ВСЁ: настройки (включая ключ), все чаты и вложения из памяти браузера?', () => {
    Object.keys(localStorage).filter(k => k.startsWith(LS_PREFIX)).forEach(k => localStorage.removeItem(k));
    settings = Object.assign({}, DEFAULTS);
    chats = [];
    currentChatId = null;
    attachments = [];
    renderAtts();
    applySettingsToUI();
    newChat();
    toast('Данные стёрты', 'ok');
  });
}

/* ================== ДИАЛОГ ПОДТВЕРЖДЕНИЯ ================== */
let confirmCb = null;
function confirmDialog(text, cb){
  $('#confirmText').textContent = text;
  confirmCb = cb;
  $('#confirmModal').classList.remove('hidden');
}

/* ================== САЙДБАР ================== */
function toggleSidebar(show){
  const sb = $('#sidebar');
  const ov = $('#sbOverlay');
  const mobile = window.innerWidth <= 760;
  const willShow = typeof show === 'boolean' ? show : sb.classList.contains('collapsed');
  if (mobile){
    sb.classList.toggle('collapsed', !willShow);
    ov.classList.toggle('show', willShow);
  } else {
    sb.classList.toggle('collapsed', !willShow);
  }
  try { localStorage.setItem(LS_PREFIX + 'sidebar', willShow ? '1' : '0'); } catch(e){}
}

/* ================== ИНИЦИАЛИЗАЦИЯ ================== */
function init(){
  // сайдбар: состояние из localStorage (по умолчанию открыт)
  const sbState = store.get('sidebar', '1');
  if (sbState === '0' && window.innerWidth > 760) $('#sidebar').classList.add('collapsed');

  // режим
  if (isExeMode()){
    $('#modeBadge').textContent = 'настольная версия';
    $('#btnExit').classList.remove('hidden');
    try { if (window.NeuroShellBridge && window.NeuroShellBridge.onReady) window.NeuroShellBridge.onReady(); } catch(e){}
  } else {
    $('#modeBadge').textContent = 'веб-версия';
  }

  // сортировка чатов по updated
  chats.sort((a, b) => (b.updated || '').localeCompare(a.updated || ''));

  renderChatList();
  newChat();
  applySettingsToUI();
  updateStat();

  // события
  $('#btnNew').addEventListener('click', newChat);
  $('#btnSettings').addEventListener('click', openSettings);
  $('#btnExit').addEventListener('click', () => {
    if (window.NeuroShellBridge && window.NeuroShellBridge.exit) window.NeuroShellBridge.exit();
  });
  $('#btnCloseSidebar').addEventListener('click', () => toggleSidebar(false));
  $('#btnOpenSidebar').addEventListener('click', () => toggleSidebar(true));
  $('#sbOverlay').addEventListener('click', () => toggleSidebar(false));
  $('#searchInput').addEventListener('input', e => renderChatList(e.target.value));

  $('#btnSend').addEventListener('click', sendMessage);
  $('#btnStop').addEventListener('click', () => { if (abortCtl) abortCtl.abort(); });
  const inp = $('#input');
  inp.addEventListener('input', () => { autoGrow(inp); updateStat(); });
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing){
      e.preventDefault();
      sendMessage();
    }
  });

  $('#btnAttach').addEventListener('click', () => $('#filePick').click());
  $('#filePick').addEventListener('change', e => { handleFiles(e.target.files); e.target.value = ''; });

  // drag&drop
  const mainEl = $('#main');
  ['dragover', 'drop'].forEach(ev => mainEl.addEventListener(ev, e => e.preventDefault()));
  mainEl.addEventListener('drop', e => {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  });

  // вставка картинок из буфера
  document.addEventListener('paste', e => {
    if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length){
      const imgs = Array.from(e.clipboardData.files).filter(f => /^image\//.test(f.type));
      if (imgs.length){ e.preventDefault(); handleFiles(imgs); }
    }
  });

  // настройки
  $('#btnCloseSettings').addEventListener('click', closeSettings);
  $('#settingsModal').addEventListener('click', e => { if (e.target === e.currentTarget) closeSettings(); });
  $('#btnSaveSettings').addEventListener('click', saveSettings);
  $('#btnRevealKey').addEventListener('click', () => {
    const k = $('#setKey');
    k.type = k.type === 'password' ? 'text' : 'password';
  });
  $('#btnTestKey').addEventListener('click', testKey);
  $('#btnReloadModels').addEventListener('click', () => loadModels(false));
  $('#setTemp').addEventListener('input', e => $('#tempVal').textContent = e.target.value);
  $('#setPreset').addEventListener('change', applyPresetToTextarea);
  $('#btnExportSettings').addEventListener('click', exportSettings);
  $('#btnImportSettings').addEventListener('click', importSettings);
  $('#btnWipe').addEventListener('click', wipeAll);

  // подтверждение
  $('#confirmYes').addEventListener('click', () => { $('#confirmModal').classList.add('hidden'); if (confirmCb) confirmCb(); confirmCb = null; });
  $('#confirmNo').addEventListener('click', () => { $('#confirmModal').classList.add('hidden'); confirmCb = null; });

  // артефакты
  $('#btnArtifactClose').addEventListener('click', () => $('#artifactPanel').classList.add('hidden'));
  $('#btnArtifactNewTab').addEventListener('click', () => {
    if (!artifactTabs.length) return;
    const w = window.open('', '_blank');
    if (w){ w.document.open(); w.document.write(artifactTabs[artifactActive].html); w.document.close(); }
  });

  // esc закрывает панели
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape'){
      if (!$('#settingsModal').classList.contains('hidden')) closeSettings();
      else if (!$('#confirmModal').classList.contains('hidden')) $('#confirmModal').classList.add('hidden');
      else if (!$('#artifactPanel').classList.contains('hidden')) $('#artifactPanel').classList.add('hidden');
    }
  });

  // подсказка, если ключа нет
  if (!settings.apiKey) setTimeout(() => { if (!settings.apiKey) toast('Вставьте API-ключ в настройках — и начните работу', 'warn', 5000); }, 900);

  console.log('NeuroShell v' + NS_VERSION + ' ready · mode: ' + (isExeMode() ? 'desktop' : 'web'));
}

document.addEventListener('DOMContentLoaded', init);
