/* ============================================================
   liao-core.js — 数据初始化 / 工具函数 / 入口 / 标签切换
   ============================================================ */

/* ---------- 存取工具 ---------- */
function lSave(key, val) {
  try { localStorage.setItem('liao_' + key, JSON.stringify(val)); } catch (e) {}
}
function lLoad(key, def) {
  try {
    const v = localStorage.getItem('liao_' + key);
    return v !== null ? JSON.parse(v) : def;
  } catch (e) { return def; }
}

/* ---------- 全局数据 ---------- */
let liaoRoles      = lLoad('roles', []);
let liaoChats      = lLoad('chats', []);
let liaoSuiyan     = lLoad('suiyan', []);
let liaoUserName   = lLoad('userName', '用户');
let liaoUserAvatar = lLoad('userAvatar', 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=user');
let liaoBgSrc      = lLoad('suiyanBg', '');

let currentChatIdx = -1;

/* ---------- 工具函数 ---------- */
function defaultAvatar() {
  return 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=default';
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatTime(ts) {
  if (!ts) return '';
  const now  = new Date();
  const date = new Date(ts);
  const diff = now - date;
  if (diff < 60000)    return '刚刚';
  if (diff < 3600000)  return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  const h  = String(date.getHours()).padStart(2, '0');
  const m  = String(date.getMinutes()).padStart(2, '0');
  const mo = date.getMonth() + 1;
  const d  = date.getDate();
  if (now.getFullYear() === date.getFullYear()) return mo + '/' + d + ' ' + h + ':' + m;
  return date.getFullYear() + '/' + mo + '/' + d;
}

function loadApiConfig() {
  try {
    const v = localStorage.getItem('halo9_apiActiveConfig');
    return v ? JSON.parse(v) : null;
  } catch (e) { return null; }
}

function loadApiModel() {
  try {
    const v = localStorage.getItem('halo9_apiCurrentModel');
    return v ? JSON.parse(v) : '';
  } catch (e) { return ''; }
}

function removeEmoji(str) {
  return str.replace(
    /[\u{1F300}-\u{1FFFF}\u{2600}-\u{27BF}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{1F000}-\u{1F02F}\u{1F0A0}-\u{1F0FF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/gu,
    ''
  ).replace(/[\u2702-\u27B0]/gu, '').trim();
}

function calcBubbleDelay(text) {
  const len = (text || '').replace(/\s/g, '').length;
  if (len <= 2)  return 200;
  if (len <= 5)  return 500;
  if (len <= 10) return 900;
  if (len <= 20) return 1400;
  return 2000;
}

/* ---------- 入口绑定 ---------- */
function bindLiaoEntry() {
  document.querySelectorAll('[data-app="chat"]').forEach(el => {
    el.addEventListener('click', openLiaoApp);
  });
  const dockChat = document.getElementById('dock-chat');
  if (dockChat) dockChat.addEventListener('click', openLiaoApp);
}
bindLiaoEntry();

function openLiaoApp() {
  document.getElementById('liao-app').classList.add('show');
  switchLiaoTab('chatlist');
  renderChatList();
}

function closeLiaoApp() {
  document.getElementById('liao-app').classList.remove('show');
}

document.getElementById('liao-close-btn').addEventListener('click', closeLiaoApp);

/* ---------- 标签切换 ---------- */
function switchLiaoTab(tabId) {
  document.querySelectorAll('.liao-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.liao-panel').forEach(panel => {
    panel.classList.toggle('active', panel.dataset.panel === tabId);
  });
  if (tabId === 'chatlist') renderChatList();
  if (tabId === 'rolelib')  { if (typeof renderRoleLib === 'function') renderRoleLib(); }
  if (tabId === 'suiyan')   renderSuiyan();
}

document.querySelectorAll('.liao-tab-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    if (this.id === 'liao-close-btn') return;
    switchLiaoTab(this.dataset.tab);
  });
});

/* ---------- 弹窗遮罩点击关闭 ---------- */
[
  'liao-new-role-modal',
  'liao-new-group-modal',
  'liao-import-modal',
  'liao-post-modal',
  'liao-comment-modal'
].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', function (e) {
    if (e.target === this) this.classList.remove('show');
  });
});

[
  'liao-suiyan-bg-modal',
  'liao-suiyan-avatar-modal',
  'liao-suiyan-name-modal'
].forEach(id => {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', function (e) {
    if (e.target === this) this.style.display = 'none';
  });
});
