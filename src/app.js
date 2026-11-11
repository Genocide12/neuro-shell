/* ===== NeuroShell :: логика (собирается в index.html) ===== */
'use strict';

/* ================== КОНФИГ И ПРЕСЕТЫ ================== */
const NS_VERSION = '1.1.0';
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

/* ================== ЦЕНЫ НА ТОКЕНЫ ================== */
// Встроенные тарифы — $ за 1 млн токенов (вход/выход): официальные цены
// Anthropic на ноябрь 2026 и приближения для сторонних моделей.
// Правила проверяются по подстроке, порядок — от частного к общему.
const MODEL_PRICE_RULES = [
  ['opus-5-5', 4, 20],    ['opus-5.5', 4, 20],    // Opus 5.5
  ['opus-5', 5, 25],                              // Opus 5
  ['opus-4-8', 5, 25],    ['opus-4-7', 5, 25],    // Opus 4.5–4.8
  ['opus-4-6', 5, 25],    ['opus-4-5', 5, 25],
  ['opus-4-1', 15, 75],   ['opus-4-2025', 15, 75], ['4-opus', 15, 75], // Opus 4 / 4.1
  ['opus-4', 15, 75],
  ['opus-3', 15, 75],     ['3-opus', 15, 75],     // Claude 3 Opus
  ['sonnet-5-5', 2, 10],  ['sonnet-5.5', 2, 10],  // Sonnet 5.5
  ['sonnet-5', 2, 10],                            // Sonnet 5
  ['sonnet-4-6', 3, 15],  ['sonnet-4-5', 3, 15],  // Sonnet 4.x
  ['sonnet-4', 3, 15],    ['3-7-sonnet', 3, 15],  ['3-5-sonnet', 3, 15], ['sonnet-3', 3, 15],
  ['haiku-5-5', 0.10, 0.50], ['haiku-5.5', 0.10, 0.50], // Haiku 5.5
  ['haiku-4-5', 1, 5],                            // Haiku 4.5
  ['3-5-haiku', 0.80, 4],
  ['haiku-3', 0.25, 1.25], ['3-haiku', 0.25, 1.25], // Claude 3 Haiku
  ['fable', 10, 50],                              // Fable
  ['gpt-4o-mini', 0.15, 0.60],
  ['gpt-4o', 2.50, 10],
  ['deepseek', 0.28, 0.42],                       // DeepSeek, приблизительно
  ['qwen-max', 1.60, 6.40]                        // Qwen Max, приблизительно
];

let serverPrices = {};                        // цены из /v1/models, если сервер их отдаёт
let priceOverrides = store.get('prices', {}); // цены, заданные вручную (localStorage)

const PRICE_SRC_LABEL = { server: 'сервер', builtin: 'встроено', manual: 'вручную' };

// priceFor — тариф модели {in, out, src} или null. Приоритет: вручную > сервер > встроенные.
function priceFor(id){
  if (!id) return null;
  const o = priceOverrides[id];
  if (o && typeof o.in === 'number') return { in: o.in, out: o.out, src: 'manual' };
  const s = serverPrices[id];
  if (s && s.in > 0) return { in: s.in, out: s.out, src: 'server' };
  const q = String(id).toLowerCase();
  for (const r of MODEL_PRICE_RULES){
    if (q.indexOf(r[0]) >= 0) return { in: r[1], out: r[2], src: 'builtin' };
  }
  return null;
}

// costOf — стоимость запроса по тарифу модели: (вх×цена вх + вых×цена вых) / 1M
function costOf(modelId, tokIn, tokOut){
  const p = priceFor(modelId);
  if (!p) return null;
  return (tokIn || 0) * p.in / 1e6 + (tokOut || 0) * p.out / 1e6;
}

function fmtUSD(x){
  if (x == null || isNaN(x)) return '—';
  if (x === 0) return '$0';
  if (x < 0.01) return '$' + x.toFixed(4);
  if (x < 1) return '$' + x.toFixed(3);
  return '$' + x.toFixed(2);
}
const fmtTok = n => (n || 0).toLocaleString('ru-RU');

// chatSubText — подпись чата: сообщения, накопленная стоимость, дата
function chatSubText(c){
  let s = c && c.messages && c.messages.length ? c.messages.length + ' сообщ. · ' : '';
  if (c && c.cost != null && c.cost > 0) s += '≈' + fmtUSD(c.cost) + ' · ';
  return s + fmtDate(c.updated);
}

// parseServerPricing читает цены из /v1/models (формат OpenRouter и похожих).
// Значение меньше 0.001 — цена за один токен: переводим в $/1M.
function parseServerPricing(j){
  serverPrices = {};
  const arr = (j && j.data) || [];
  for (const x of arr){
    if (!x || !x.id) continue;
    const pr = x.pricing || {};
    let pin = parseFloat(pr.prompt != null ? pr.prompt : (pr.input != null ? pr.input : x.input_price));
    let pout = parseFloat(pr.completion != null ? pr.completion : (pr.output != null ? pr.output : x.output_price));
    if (isNaN(pin)) pin = 0;
    if (isNaN(pout)) pout = 0;
    if (pin > 0 && pin < 0.001) pin *= 1e6;
    if (pout > 0 && pout < 0.001) pout *= 1e6;
    if (pin > 0 || pout > 0) serverPrices[x.id] = { in: pin, out: pout };
  }
}

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

  // расход токенов и стоимость ответа
  if (m.role === 'assistant' && m.usage){
    const meta = document.createElement('div');
    meta.className = 'msg-meta';
    meta.textContent =
      (m.usage.est ? '~' : '') + fmtTok(m.usage.in) + ' вх · ' +
      (m.usage.est ? '~' : '') + fmtTok(m.usage.out) + ' вых' +
      (m.cost != null ? ' · ≈' + fmtUSD(m.cost) : '');
    meta.title = 'Токены и стоимость ответа по тарифу модели ' + (settings.model || '');
    bubble.appendChild(meta);
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
  $('#chatSub').textContent = chatSubText(c);
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

// requestChat выполняет запрос к /chat/completions; если строгий прокси не принял
// stream_options (поле с фактическим расходом токенов), повторяет без него.
async function requestChat(url, fetchOpts, body){
  let resp = await fetch(url, fetchOpts);
  if (!resp.ok){
    let errText = await resp.text().catch(() => '');
    if (body.stream && body.stream_options && /stream_options/i.test(errText)){
      const b2 = Object.assign({}, body);
      delete b2.stream_options;
      const o2 = Object.assign({}, fetchOpts, { body: JSON.stringify(b2) });
      resp = await fetch(url, o2);
      if (resp.ok) return resp;
      errText = await resp.text().catch(() => '');
    }
    throw new Error('HTTP ' + resp.status + (errText ? ' — ' + errText.slice(0, 500) : ''));
  }
  return resp;
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
    // просим сервер прислать фактический расход токенов прямо в стриме
    // (нестрогие прокси поле просто игнорируют)
    if (settings.stream) body.stream_options = { include_usage: true };

    const url = apiBase() + '/chat/completions';
    const fetchOpts = { method: 'POST', headers: apiHeaders(), body: JSON.stringify(body) };
    if (abortCtl) fetchOpts.signal = abortCtl.signal;
    // в exe-режиме window.fetch перехвачен мостом NeuroShellBridge (см. обёртку):
    // запросы к API уходят через локальный прокси, поэтому CORS не важен

    let usage = null; // фактический расход токенов, если сервер его присылает

    if (settings.stream){
      const resp = await requestChat(url, fetchOpts, body);
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
            if (j.usage) usage = j.usage; // расход приходит в последнем чанке
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
      const resp = await requestChat(url, fetchOpts, body);
      setConn('ok');
      const j = await resp.json();
      if (j.usage) usage = j.usage;
      full = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
      ph.content = full;
    }

    ph.content = full || '(пустой ответ)';

    // расход токенов: фактический (usage) или оценка ~3.6 симв/ток; стоимость — по тарифу
    let uIn = null, uOut = null;
    if (usage){
      uIn = usage.prompt_tokens != null ? usage.prompt_tokens : usage.input_tokens;
      uOut = usage.completion_tokens != null ? usage.completion_tokens : usage.output_tokens;
    }
    let est = false;
    if (uIn == null || uOut == null){
      est = true;
      let all = settings.system || '';
      for (const m of chat.messages) if (m.role !== 'error') all += '\n' + (m.content || '');
      if (uIn == null) uIn = estTokens(all);
      if (uOut == null) uOut = estTokens(full);
    }
    ph.usage = { in: uIn, out: uOut, est: est };
    ph.cost = costOf(settings.model, uIn, uOut);
    if (ph.cost != null) chat.cost = (chat.cost || 0) + ph.cost;
    chat.tokIn = (chat.tokIn || 0) + uIn;
    chat.tokOut = (chat.tokOut || 0) + uOut;

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
      const isNetErr = klassifyFetchError(err) === 'network';
      const corsNote = (isNetErr && !isExeMode())
        ? '\n\nСкорее всего это CORS-ограничение браузера: сервер не проходит preflight-проверку (ответ OPTIONS без Access-Control-Allow-Origin). Ключ при этом может быть рабочим. Решения:\n1) Скачайте настольную NeuroShell.exe (ссылка в README) — она ходит в API напрямую, без CORS.\n2) Почините CORS на сервере: в nginx нужно, чтобы ответ на OPTIONS содержал заголовок Access-Control-Allow-Origin (инструкция в README, раздел «CORS»).'
        : '\n\nПроверьте ключ, Base URL и модель в настройках. Код ошибки HTTP 401 обычно означает неверный ключ, 404 — неверный адрес или имя модели.';
      const em = { role: 'error', content: 'Ошибка запроса: ' + (err && err.message ? err.message : String(err)) + corsNote };
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
    const c = currentChat() || chat;
    $('#chatSub').textContent = chatSubText(c);
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

// estPromptTokens — оценка всего промпта: системные инструкции + история + ввод
function estPromptTokens(){
  let s = settings.system || '';
  const c = currentChat();
  if (c) for (const m of c.messages){ if (m.role !== 'error') s += '\n' + (m.content || ''); }
  return estTokens(s) + estTokens($('#input').value);
}

function updateStat(){
  const t = estPromptTokens();
  const cost = costOf(settings.model, t, 0);
  $('#stat').textContent = '~' + fmtTok(t) + ' ток.' + (cost != null ? ' · ≈' + fmtUSD(cost) : '');
  $('#stat').title = 'Оценка промпта (инструкции + история + ввод)' + (cost != null ? ' и стоимость его отправки по тарифу модели' : '');
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
  updateModelPriceHint();
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
    parseServerPricing(j);
    const list = (j.data || []).map(x => x.id).filter(Boolean);
    if (list.length){
      modelListCache = list;
      fillModelList(list);
      refreshPriceUI();
      if (!silent) toast('Найдено моделей: ' + list.length, 'ok');
    } else if (!silent) toast('Список моделей пуст', 'warn');
  } catch(e){
    // fallback: в веб-версии CORS-preflight может резать запрос с Authorization.
    // Простой GET без кастомных заголовков preflight не требует — список моделей
    // /v1/models на большинстве прокси доступен и без ключа.
    if (!isExeMode() && klassifyFetchError(e) === 'network'){
      try {
        const resp2 = await fetch(apiBase() + '/models');
        if (resp2.ok){
          const j2 = await resp2.json();
          parseServerPricing(j2);
          const list2 = (j2.data || []).map(x => x.id).filter(Boolean);
          if (list2.length){
            modelListCache = list2;
            fillModelList(list2);
            refreshPriceUI();
            if (!silent) toast('Модели загружены (без ключа, из-за CORS веб-версии)', 'ok');
            return;
          }
        }
      } catch(e2){ /* останемся с диагностикой ниже */ }
    }
    if (!silent) toast('Не удалось получить список моделей: ' + e.message, 'err');
  }
}

// klassifyFetchError различает «нет сети», «CORS/preflight» и «сервер ответил».
// TypeError из fetch в браузере возникает ДО отправки/получения ответа (сеть или CORS),
// а ответ сервера (401/404/500) приходит как обычный resp.status — их не путаем.
function klassifyFetchError(err){
  const m = err && err.message ? String(err.message) : String(err);
  // «Failed to fetch» (Firefox: NetworkError) — браузер не смог завершить запрос
  if (/failed to fetch|networkerror|load failed|network error/i.test(m))
    return 'network';
  return 'unknown';
}

// corsAllowed проверяет CORS-дружелюбие сервера для веб-версии:
// простой GET без кастомных заголовков не требует preflight, поэтому ответ сервера
// виден как normally: 200/401/… → CORS на обычные запросы не мешает.
// Если даже такой GET падает с TypeError — сервер недоступен или полностью блокирует origin.
async function corsAllowed(base){
  try {
    await fetch(base + '/models', { mode: 'cors' }); // без Authorization — нет preflight
    return true; // любой HTTP-статус означает: запрос прошёл, CORS обычный пропускает
  } catch(e){
    return false;
  }
}

async function testKey(){
  const key = $('#setKey').value.trim();
  const base = $('#setBase').value.trim() || DEFAULTS.baseUrl;
  const btn = $('#btnTestKey');
  btn.disabled = true; btn.textContent = '…';
  let b = base.replace(/\/+$/, '');
  if (!/\/v\d+$/.test(b) && !b.endsWith('/api')) b += '/v1';
  try {
    // 1) сначала авторизованный запрос — в exe-режиме он идёт через локальный прокси (без CORS),
    //    в вебе при «сыром» прокси без CORS-заголовков браузер ругнётся «Failed to fetch»
    const resp = await fetch(b + '/models', { headers: key ? { 'Authorization': 'Bearer ' + key } : {} });
    if (resp.status === 401 || resp.status === 403) throw new Error('HTTP ' + resp.status + ' — ключ отклонён');
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    const j = await resp.json().catch(() => null);
    if (j) parseServerPricing(j);
    const list = j && j.data ? j.data.map(x => x.id).filter(Boolean) : [];
    modelListCache = list;
    fillModelList(list);
    refreshPriceUI();
    const hasModel = !$('#setModel').value.trim() || list.length === 0 || list.includes($('#setModel').value.trim());
    toast('Соединение успешно' + (list.length ? ' · моделей: ' + list.length : '') + (!hasModel ? ' · выбранной модели нет в списке!' : ''), hasModel ? 'ok' : 'warn', 4200);
    setConn('ok');
  } catch(e){
    // 2) диагностируем причину, чтобы не гадать «ключ» vs «сеть» vs «CORS»
    let why = '';
    let cls = klassifyFetchError(e);
    if (cls === 'network' && !isExeMode()){
      const plainOk = await corsAllowed(b);
      if (plainOk){
        // простой GET без ключа проходит, а с заголовком Authorization — нет:
        // это классический CORS-preflight провал на стороне API-сервера
        why = ' — сервер не проходит CORS-preflight (ответ OPTIONS без Access-Control-Allow-Origin). Ваш ключ и сервер в порядке: в чате это проявится как «Failed to fetch». Веб-версию браузер ограничивает, а настольная (NeuroShell.exe) ходит в API напрямую — скачайте её в README или почините CORS на сервере (см. подсказку ниже)';
        setConn('err');
        toast('Проверка не удалась' + why, 'err', 12000);
        showCorsHint();
        return;
      }
      why = ' — сервер недоступен (проверьте адрес и интернет)';
    } else if (e && e.message) {
      why = ' — ' + e.message;
    }
    setConn('err');
    toast('Проверка не удалась: ' + (cls === 'network' ? 'нет соединения с сервером' : (e && e.message ? e.message : String(e))) + why, 'err', 8000);
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
  const p = priceFor(settings.model);
  $('#modelBadge').title = 'Модель: ' + settings.model +
    (p ? '\nТариф: ' + fmtUSD(p.in) + ' вход · ' + fmtUSD(p.out) + ' выход за 1M токенов (' + PRICE_SRC_LABEL[p.src] + ')' : '\nТариф не известен — задайте в таблице цен') +
    '\nBase URL: ' + apiBase() + '\nКлик — таблица цен';
  setConn('');
  updateModelPriceHint();
}

// showCorsHint показывает развёрнутую подсказку в настройках, когда веб-версию
// блокирует CORS API-сервера (префикс OPTIONS без Access-Control-Allow-Origin).
// Вызывается из testKey() при соответствующей диагностике.
function showCorsHint(){
  const hint = $('#corsHint');
  if (!hint) return;
  hint.classList.remove('hidden');
}

function applyPresetToTextarea(){
  const p = PRESETS[$('#setPreset').value];
  if (p) $('#setSystem').value = p.system;
}

/* ================== ЦЕНЫ: ТАБЛИЦА И ПОДСКАЗКИ ================== */

// updateModelPriceHint — тариф выбранной модели прямо в настройках
function updateModelPriceHint(){
  const el = $('#modelPriceHint');
  if (!el) return;
  const id = $('#setModel').value.trim();
  if (!id){ el.textContent = ''; return; }
  const p = priceFor(id);
  if (p){
    el.innerHTML = 'Тариф: <b>' + fmtUSD(p.in) + '</b> вход · <b>' + fmtUSD(p.out) +
      '</b> выход за 1M токенов — ' + esc(PRICE_SRC_LABEL[p.src]) +
      (p.src === 'manual' ? '' : '. Если ваш прокси считает иначе — поправьте в таблице цен.');
  } else {
    el.textContent = 'Тариф не известен — задайте вручную в таблице «Цены на токены».';
  }
}

// refreshPriceUI — обновить всё, что показывает цены
function refreshPriceUI(){
  applySettingsToUI();
  updateStat();
  const pm = $('#priceModal');
  if (pm && !pm.classList.contains('hidden')) renderPrices();
}

function openPrices(){
  renderPrices();
  $('#priceModal').classList.remove('hidden');
  const f = $('#priceFilter');
  f.value = '';
  setTimeout(() => f.focus(), 60);
}

function renderPrices(){
  const tb = $('#priceBody');
  if (!tb) return;
  const f = ($('#priceFilter').value || '').trim().toLowerCase();
  const ids = new Set(modelListCache || []);
  for (const m of SUGGESTED_MODELS) ids.add(m);
  for (const k of Object.keys(priceOverrides)) ids.add(k);
  for (const k of Object.keys(serverPrices)) ids.add(k);
  if (settings.model) ids.add(settings.model);
  let list = Array.from(ids);
  if (f) list = list.filter(m => m.toLowerCase().includes(f));
  list.sort((a, b) => (b === settings.model) - (a === settings.model) || a.localeCompare(b));
  tb.innerHTML = '';
  if (!list.length){
    tb.innerHTML = '<tr><td colspan="5" class="price-empty">Ничего не найдено</td></tr>';
    return;
  }
  for (const id of list) tb.appendChild(priceRow(id));
}

function priceRow(id){
  const p = priceFor(id);
  const tr = document.createElement('tr');
  if (id === settings.model) tr.className = 'price-cur';

  const tdM = document.createElement('td');
  tdM.className = 'price-model';
  tdM.textContent = id;
  tdM.title = id;
  if (id === settings.model){
    const mk = document.createElement('span');
    mk.className = 'price-mark';
    mk.textContent = ' · текущая';
    tdM.appendChild(mk);
  }
  tr.appendChild(tdM);

  for (const kind of ['in', 'out']){
    const td = document.createElement('td');
    td.className = 'price-cell';
    td.textContent = p ? fmtUSD(p[kind]) : '—';
    td.title = 'Нажмите, чтобы изменить цену';
    td.addEventListener('click', () => editPrice(id, kind, td));
    tr.appendChild(td);
  }

  const tdS = document.createElement('td');
  tdS.className = 'price-src';
  tdS.textContent = p ? PRICE_SRC_LABEL[p.src] : 'нет';
  tr.appendChild(tdS);

  const tdX = document.createElement('td');
  if (priceOverrides[id]){
    const btn = document.createElement('button');
    btn.className = 'price-reset';
    btn.textContent = 'сброс';
    btn.title = 'Вернуть цену по умолчанию';
    btn.addEventListener('click', () => {
      delete priceOverrides[id];
      store.set('prices', priceOverrides);
      refreshPriceUI();
      toast('Цена сброшена', 'ok', 1600);
    });
    tdX.appendChild(btn);
  }
  tr.appendChild(tdX);
  return tr;
}

// editPrice — редактирование цены кликом по ячейке (сохраняется в localStorage)
function editPrice(id, kind, td){
  if (td.querySelector('input')) return;
  const cur = priceFor(id);
  td.innerHTML = '';
  const inp = document.createElement('input');
  inp.type = 'number';
  inp.step = 'any';
  inp.min = '0';
  inp.value = cur ? String(cur[kind]) : '';
  inp.className = 'price-input';
  td.appendChild(inp);
  inp.focus();
  inp.select();
  let closed = false;
  const done = save => {
    if (closed) return;
    closed = true;
    if (save){
      const v = parseFloat(String(inp.value).replace(',', '.'));
      if (!isNaN(v) && v >= 0){
        const base = priceFor(id);
        priceOverrides[id] = { in: base ? base.in : 0, out: base ? base.out : 0 };
        priceOverrides[id][kind] = v;
        store.set('prices', priceOverrides);
        toast('Цена «' + id + '» сохранена', 'ok', 1600);
      }
    }
    refreshPriceUI();
  };
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter'){ e.preventDefault(); done(true); }
    else if (e.key === 'Escape'){ e.preventDefault(); done(false); }
    e.stopPropagation();
  });
  inp.addEventListener('blur', () => done(true));
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
  $('#btnHideCorsHint').addEventListener('click', () => $('#corsHint').classList.add('hidden'));
  $('#btnPrices').addEventListener('click', openPrices);
  $('#btnClosePrices').addEventListener('click', () => $('#priceModal').classList.add('hidden'));
  $('#priceModal').addEventListener('click', e => { if (e.target === e.currentTarget) $('#priceModal').classList.add('hidden'); });
  $('#priceFilter').addEventListener('input', renderPrices);
  $('#modelBadge').addEventListener('click', openPrices);
  $('#setModel').addEventListener('input', updateModelPriceHint);
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
      else if (!$('#priceModal').classList.contains('hidden')) $('#priceModal').classList.add('hidden');
      else if (!$('#confirmModal').classList.contains('hidden')) $('#confirmModal').classList.add('hidden');
      else if (!$('#artifactPanel').classList.contains('hidden')) $('#artifactPanel').classList.add('hidden');
    }
  });

  // подсказка, если ключа нет
  if (!settings.apiKey) setTimeout(() => { if (!settings.apiKey) toast('Вставьте API-ключ в настройках — и начните работу', 'warn', 5000); }, 900);

  console.log('NeuroShell v' + NS_VERSION + ' ready · mode: ' + (isExeMode() ? 'desktop' : 'web'));
}

document.addEventListener('DOMContentLoaded', init);
