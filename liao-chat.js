/* ============================================================
   liao-chat.js — 聊天列表 / 聊天界面基础 / 聊天设置
   ============================================================ */

/* ---- 时间戳格式全局状态 ---- */
let currentTimestampFormat = 'full';
let currentTimestampCustom = '';

function applyTimestampFormat(format, custom) {
  currentTimestampFormat = format || 'full';
  currentTimestampCustom = custom || '';
}

function getFormattedTimestamp(ts) {
  if (!ts) return '';
  if (currentTimestampFormat === 'full' || !currentTimestampFormat) {
    return formatFullTime(ts);
  }
  if (currentTimestampFormat === 'hm') {
    const d  = new Date(ts);
    const H  = String(d.getHours()).padStart(2, '0');
    const Mi = String(d.getMinutes()).padStart(2, '0');
    return H + ':' + Mi;
  }
  if (currentTimestampFormat === 'custom') {
    return currentTimestampCustom || formatFullTime(ts);
  }
  const mapped = {
    read: '已读', check: '√', owo: '>ω<', caret: '^^',
    face1: 'ㅂ_ㅂ', face2: 'ㅎ_ㅎ', heart: '♡'
  };
  return mapped[currentTimestampFormat] || formatFullTime(ts);
}

/* ============================================================
   聊天列表
   ============================================================ */
function renderChatList() {
  const list = document.getElementById('liao-chat-list');
  list.innerHTML = '';

  if (!liaoChats.length) {
    list.innerHTML = '<div style="text-align:center;padding:40px 20px;color:var(--text-light);font-size:13px;">还没有聊天，点击下方新建角色开始吧</div>';
    return;
  }

  liaoChats.forEach((chat, idx) => {
    const role = liaoRoles.find(r => r.id === chat.roleId);
    if (!role) return;
    const msgs    = (chat.messages || []).filter(m => !m.hidden);
    const lastMsg = msgs.length ? msgs[msgs.length - 1] : null;
    let preview   = '暂无消息';
    if (lastMsg) {
      if (lastMsg.recalled)              preview = '[撤回了一条消息]';
      else if (lastMsg.type === 'image') preview = '[图片]';
      else                               preview = lastMsg.content || '暂无消息';
    }
    const lastTime = lastMsg ? formatTime(lastMsg.ts) : '';

    const item = document.createElement('div');
    item.className = 'chat-list-item';
    item.innerHTML =
      '<img class="chat-item-avatar" src="' + escHtml(role.avatar || defaultAvatar()) + '" alt="">' +
      '<div class="chat-item-body">' +
        '<div class="chat-item-name">' + escHtml(role.nickname || role.realname) + '</div>' +
        '<div class="chat-item-preview">' + escHtml(preview.slice(0, 40)) + '</div>' +
      '</div>' +
      '<div class="chat-item-meta">' +
        '<div class="chat-item-time">' + lastTime + '</div>' +
      '</div>';
    item.addEventListener('click', () => openChatView(idx));
    list.appendChild(item);
  });
}

/* ---------- 底部操作栏 ---------- */
document.getElementById('liao-btn-new-role').addEventListener('click', openNewRoleModal);
document.getElementById('liao-btn-new-group').addEventListener('click', () => {
  document.getElementById('liao-new-group-modal').classList.add('show');
});
document.getElementById('liao-btn-import').addEventListener('click', () => {
  document.getElementById('liao-import-modal').classList.add('show');
});

/* ---------- 新建角色弹窗 ---------- */
let newRoleAvatarSrc = '';

function openNewRoleModal() {
  newRoleAvatarSrc = '';
  document.getElementById('liao-role-avatar-preview').src = defaultAvatar();
  document.getElementById('liao-role-nickname').value     = '';
  document.getElementById('liao-role-realname').value     = '';
  document.getElementById('liao-role-setting').value      = '';
  document.getElementById('liao-role-avatar-url').value   = '';
  document.getElementById('liao-new-role-modal').classList.add('show');
}

document.getElementById('liao-role-avatar-url').addEventListener('input', function () {
  const url = this.value.trim();
  if (url) {
    document.getElementById('liao-role-avatar-preview').src = url;
    newRoleAvatarSrc = url;
  }
});

document.getElementById('liao-role-avatar-local-btn').addEventListener('click', () => {
  document.getElementById('liao-role-avatar-file').click();
});
document.getElementById('liao-role-avatar-file').addEventListener('change', function () {
  const file = this.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    newRoleAvatarSrc = e.target.result;
    document.getElementById('liao-role-avatar-preview').src = newRoleAvatarSrc;
  };
  reader.readAsDataURL(file);
  this.value = '';
});

document.getElementById('liao-role-confirm-btn').addEventListener('click', () => {
  const nickname = document.getElementById('liao-role-nickname').value.trim();
  const realname = document.getElementById('liao-role-realname').value.trim();
  const setting  = document.getElementById('liao-role-setting').value.trim();
  if (!nickname && !realname) { alert('请至少填写备注名或真实名字'); return; }

  const role = {
    id:       'role_' + Date.now(),
    nickname: nickname || realname,
    realname: realname || nickname,
    avatar:   newRoleAvatarSrc || defaultAvatar(),
    setting
  };
  liaoRoles.push(role);
  lSave('roles', liaoRoles);

  liaoChats.push(initChatMemory({
    roleId: role.id, messages: [],
    chatUserName: liaoUserName, chatUserAvatar: liaoUserAvatar, chatUserSetting: ''
  }));
  lSave('chats', liaoChats);

  document.getElementById('liao-new-role-modal').classList.remove('show');
  renderChatList();
  renderRoleLib();
});

document.getElementById('liao-role-cancel-btn').addEventListener('click', () => {
  document.getElementById('liao-new-role-modal').classList.remove('show');
});

/* ---------- 新建群聊 ---------- */
document.getElementById('liao-group-confirm').addEventListener('click', () => {
  const name = document.getElementById('liao-group-name').value.trim();
  if (!name) { alert('请填写群聊名称'); return; }
  alert('群聊「' + name + '」功能建设中，敬请期待');
  document.getElementById('liao-new-group-modal').classList.remove('show');
});
document.getElementById('liao-group-cancel').addEventListener('click', () => {
  document.getElementById('liao-new-group-modal').classList.remove('show');
});

/* ---------- 文件导入角色 ---------- */
document.getElementById('liao-import-file-btn').addEventListener('click', () => {
  document.getElementById('liao-import-file').click();
});
document.getElementById('liao-import-file').addEventListener('change', function () {
  const file = this.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const data  = JSON.parse(e.target.result);
      const roles = Array.isArray(data) ? data : [data];
      let imported = 0;
      roles.forEach(r => {
        if (!r.id) r.id = 'role_' + Date.now() + '_' + Math.random().toString(36).slice(2);
        if (!r.nickname && !r.realname) return;
        r.nickname = r.nickname || r.realname;
        r.realname = r.realname || r.nickname;
        r.avatar   = r.avatar   || defaultAvatar();
        r.setting  = r.setting  || '';
        if (!liaoRoles.find(ex => ex.id === r.id)) {
          liaoRoles.push(r);
          liaoChats.push(initChatMemory({
            roleId: r.id, messages: [],
            chatUserName: liaoUserName, chatUserAvatar: liaoUserAvatar, chatUserSetting: ''
          }));
          imported++;
        }
      });
      lSave('roles', liaoRoles);
      lSave('chats', liaoChats);
      document.getElementById('liao-import-modal').classList.remove('show');
      renderChatList();
      renderRoleLib();
      alert('成功导入 ' + imported + ' 个角色');
    } catch (err) {
      alert('导入失败：JSON 格式错误');
    }
  };
  reader.readAsText(file);
  this.value = '';
});
document.getElementById('liao-import-cancel').addEventListener('click', () => {
  document.getElementById('liao-import-modal').classList.remove('show');
});

/* ============================================================
   记忆数据结构初始化工具
   ============================================================ */
function initChatMemory(chat) {
  if (!chat.memory) {
    chat.memory = { longTerm: [], shortTerm: [], important: [], other: {} };
  } else {
    if (!chat.memory.longTerm)  chat.memory.longTerm  = [];
    if (!chat.memory.shortTerm) chat.memory.shortTerm = [];
    if (!chat.memory.important) chat.memory.important = [];
    if (!chat.memory.other)     chat.memory.other     = {};
  }
  return chat;
}

liaoChats.forEach(c => initChatMemory(c));

/* ============================================================
   聊天界面 — openChatView
   ============================================================ */
function openChatView(chatIdx) {
  currentChatIdx = chatIdx;
  const chat = liaoChats[chatIdx];
  const role = liaoRoles.find(r => r.id === chat.roleId);
  if (!role) return;

  initChatMemory(chat);

  document.getElementById('chat-view-title').textContent = role.nickname || role.realname;

  currentQuoteMsgIdx = -1;
  const quoteBar = document.getElementById('chat-quote-bar');
  if (quoteBar) quoteBar.style.display = 'none';

  const suggestBar = document.getElementById('emoji-suggest-bar');
  if (suggestBar) {
    suggestBar.innerHTML = '';
    suggestBar.classList.remove('visible');
  }

  const emojiPanel = document.getElementById('emoji-panel');
  if (emojiPanel) emojiPanel.style.display = 'none';
  emojiPanelOpen = false;
  const csbEmoji = document.getElementById('csb-emoji');
  if (csbEmoji) csbEmoji.classList.remove('active');

  const hidden = !!(chat.chatSettings && chat.chatSettings.hideTimestamp);
  document.body.classList.toggle('timestamp-hidden', hidden);

  renderChatMessages();
  applyCurrentChatBeauty();

  const csCloseBtn = document.getElementById('cs-close-btn');
  if (csCloseBtn) csCloseBtn.dataset.returnTo = '';

/* 更新在线状态显示 */
if (typeof arUpdateStatusBar === 'function') {
  arUpdateStatusBar(chat.roleId);
}

/* 绑定在线状态点击切换 */
const statusRow = document.getElementById('chat-status-row');
if (statusRow && !statusRow._arBound) {
  statusRow._arBound = true;
  statusRow.addEventListener('click', () => {
    if (currentChatIdx < 0) return;
    const c      = liaoChats[currentChatIdx];
    const cur    = arGetStatus(c.roleId);
    const newSt  = cur === 'online' ? 'offline' : 'online';
    arSetStatus(c.roleId, newSt);
    arUpdateStatusBar(c.roleId);
  });
}

  document.getElementById('liao-chat-view').classList.add('show');
  setTimeout(scrollChatToBottom, 100);
}

function closeChatView() {
  document.getElementById('liao-chat-view').classList.remove('show');
  currentChatIdx = -1;

  const emojiPanel = document.getElementById('emoji-panel');
  if (emojiPanel) emojiPanel.style.display = 'none';
  emojiPanelOpen = false;

  const suggestBar = document.getElementById('emoji-suggest-bar');
  if (suggestBar) {
    suggestBar.innerHTML = '';
    suggestBar.classList.remove('visible');
  }
}

document.getElementById('chat-view-back').addEventListener('click', closeChatView);

/* ============================================================
   消息渲染 — 默认加载40条，超出显示"加载过往消息"
   ============================================================ */
function renderChatMessages() {
  if (currentChatIdx < 0) return;
  const chat = liaoChats[currentChatIdx];
  const role = liaoRoles.find(r => r.id === chat.roleId);
  const area = document.getElementById('liao-chat-messages');
  area.innerHTML = '';

  const chatUserAvatar = chat.chatUserAvatar || liaoUserAvatar;
  const settings       = chat.chatSettings || {};
  const maxLoad        = settings.maxLoadMsgs > 0 ? settings.maxLoadMsgs : 40;
  const msgs           = chat.messages.filter(m => !m.hidden);

  /* 超出条数时显示加载过往按钮 */
  if (msgs.length > maxLoad) {
    const loadBtn = document.createElement('div');
    loadBtn.style.cssText =
      'text-align:center;padding:10px 0 6px;cursor:pointer;' +
      'font-size:11.5px;color:#4a7abf;user-select:none;-webkit-user-select:none;' +
      'letter-spacing:.04em;';
    loadBtn.textContent = '↑ 加载过往消息';
    loadBtn.addEventListener('click', () => {
      if (!chat.chatSettings) chat.chatSettings = {};
      chat.chatSettings.maxLoadMsgs = msgs.length;
      renderChatMessages();
    });
    area.appendChild(loadBtn);
  }

  const toRender = msgs.length > maxLoad ? msgs.slice(-maxLoad) : msgs;
  toRender.forEach(msg => {
    appendMessageBubble(msg, role, chatUserAvatar, false);
  });
  scrollChatToBottom();
}

function scrollChatToBottom() {
  const area = document.getElementById('liao-chat-messages');
  if (area) area.scrollTop = area.scrollHeight;
}

function showTypingIndicator(show) {
  const el = document.getElementById('chat-typing');
  if (el) el.classList.toggle('show', show);
  if (show) scrollChatToBottom();
}

/* ---------- 发送用户消息 ---------- */
document.getElementById('chat-send-btn').addEventListener('click', sendUserMessage);
document.getElementById('chat-view-input').addEventListener('keydown', function (e) {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendUserMessage(); }
});

/* ============================================================
   输入框联想表情包推荐栏
   ============================================================ */
document.getElementById('chat-view-input').addEventListener('input', function () {
  updateEmojiSuggestBar(this.value);
});

function updateEmojiSuggestBar(inputVal) {
  const bar = document.getElementById('emoji-suggest-bar');
  if (!bar) return;
  const keyword = (inputVal || '').trim();
  if (!keyword) { bar.innerHTML = ''; bar.classList.remove('visible'); return; }
  const emojiList = (typeof liaoEmojis !== 'undefined' && Array.isArray(liaoEmojis)) ? liaoEmojis : [];
  if (!emojiList.length) { bar.innerHTML = ''; bar.classList.remove('visible'); return; }
  const lower   = keyword.toLowerCase();
  const matched = emojiList.filter(e => e.name && e.name.toLowerCase().includes(lower));
  if (!matched.length) { bar.innerHTML = ''; bar.classList.remove('visible'); return; }
  bar.innerHTML = '';
  matched.slice(0, 20).forEach(emoji => {
    const item = document.createElement('div');
    item.className = 'emoji-suggest-item';
    const img = document.createElement('img');
    img.src = emoji.url; img.alt = emoji.name || ''; img.title = emoji.name || ''; img.loading = 'lazy';
    const nameEl = document.createElement('span');
    nameEl.className = 'emoji-suggest-item-name';
    nameEl.textContent = emoji.name || '';
    item.appendChild(img); item.appendChild(nameEl);
    item.addEventListener('click', () => {
      if (typeof sendEmojiMsg === 'function') sendEmojiMsg(emoji);
      const inputEl = document.getElementById('chat-view-input');
      if (inputEl) inputEl.value = '';
      bar.innerHTML = ''; bar.classList.remove('visible');
    });
    bar.appendChild(item);
  });
  bar.classList.add('visible');
}

function sendUserMessage() {
  if (currentChatIdx < 0) return;
  const input   = document.getElementById('chat-view-input');
  const content = input.value.trim();
  if (!content) return;
  const chat = liaoChats[currentChatIdx];
  const role = liaoRoles.find(r => r.id === chat.roleId);
  const uAvt = chat.chatUserAvatar || liaoUserAvatar;
  const quoteContent = (currentQuoteMsgIdx >= 0 && chat.messages[currentQuoteMsgIdx])
    ? (chat.messages[currentQuoteMsgIdx].content || '') : '';
  const msgObj = {
    role: 'user', type: 'text', content,
    quoteContent: quoteContent || undefined,
    ts: Date.now(),
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2)
  };
  chat.messages.push(msgObj);
  lSave('chats', liaoChats);
  input.value = '';
  const suggestBar = document.getElementById('emoji-suggest-bar');
  if (suggestBar) { suggestBar.innerHTML = ''; suggestBar.classList.remove('visible'); }
  currentQuoteMsgIdx = -1;
  const quoteBar = document.getElementById('chat-quote-bar');
  if (quoteBar) quoteBar.style.display = 'none';
  appendMessageBubble(msgObj, role, uAvt, true);

/* 自动回复判断 */
if (typeof arTryAutoReply === 'function') {
  arTryAutoReply(currentChatIdx, content);
}

}

/* ============================================================
   聊天设置界面
   ============================================================ */
function openChatSettings() {
  if (currentChatIdx < 0) return;
  const chat = liaoChats[currentChatIdx];
  const role = liaoRoles.find(r => r.id === chat.roleId);
  if (!role) return;

  document.getElementById('cs-role-avatar-preview').src = role.avatar || defaultAvatar();
  document.getElementById('cs-role-avatar-url').value   = '';
  document.getElementById('cs-role-nickname').value     = role.nickname || '';
  document.getElementById('cs-role-realname').value     = role.realname || '';
  document.getElementById('cs-role-setting').value      = role.setting  || '';

  csRoleCardImageSrc = '';
  const cardImgPreview = document.getElementById('cs-role-cardimage-preview');
  const cardImgUrl     = document.getElementById('cs-role-cardimage-url');
  if (cardImgPreview) cardImgPreview.src = role.cardImage || '';
  if (cardImgUrl)     cardImgUrl.value   = '';

  const chatUserAvatar3  = chat.chatUserAvatar  || liaoUserAvatar;
  const chatUserName3    = chat.chatUserName    || liaoUserName;
  const chatUserSetting3 = chat.chatUserSetting || '';
  document.getElementById('cs-user-avatar-preview').src = chatUserAvatar3;
  document.getElementById('cs-user-avatar-url').value   = '';
  document.getElementById('cs-user-name').value         = chatUserName3;
  document.getElementById('cs-user-setting').value      = chatUserSetting3;

  const beauty    = (chat.chatSettings && chat.chatSettings.beauty) || {};
  const usePreset = beauty.usePresetBubble !== undefined ? beauty.usePresetBubble : true;

  const rcEl = document.getElementById('cs-role-bubble-color');
  const ucEl = document.getElementById('cs-user-bubble-color');
  const brEl = document.getElementById('cs-bubble-radius');
  const bmEl = document.getElementById('cs-bubble-max-chars');
  const fsEl = document.getElementById('cs-font-size');
  const bgEl = document.getElementById('cs-chat-bg-url');
  const ccEl = document.getElementById('cs-custom-css');
  const tfEl = document.getElementById('cs-timestamp-format');
  const tcEl = document.getElementById('cs-timestamp-custom');

  if (rcEl) rcEl.value = beauty.roleBubbleColor || '#ffffff';
  if (ucEl) ucEl.value = beauty.userBubbleColor || '#99C8ED';
  if (brEl) brEl.value = beauty.bubbleRadius    !== undefined ? beauty.bubbleRadius : 999;
  if (bmEl) bmEl.value = beauty.bubbleMaxChars  || 0;
  if (fsEl) fsEl.value = beauty.fontSize        || '12';
  if (bgEl) bgEl.value = beauty.chatBgUrl       || '';
  if (ccEl) ccEl.value = beauty.customCSS       || '';

  const tsFormat = beauty.timestampFormat || 'full';
  const tsCustom = beauty.timestampCustom || '';
  if (tfEl) tfEl.value = tsFormat;
  if (tcEl) { tcEl.value = tsCustom; tcEl.style.display = tsFormat === 'custom' ? '' : 'none'; }

  const presetToggle = document.getElementById('cs-use-preset-bubble');
  if (presetToggle) presetToggle.checked = usePreset;
  const presetFields = document.getElementById('cs-preset-bubble-fields');
  if (presetFields) presetFields.style.display = usePreset ? '' : 'none';

  const settings = chat.chatSettings || {};
  document.getElementById('cs-max-api-msgs').value         = settings.maxApiMsgs         !== undefined ? settings.maxApiMsgs         : 0;
  document.getElementById('cs-max-load-msgs').value        = settings.maxLoadMsgs        !== undefined ? settings.maxLoadMsgs        : 40;
  document.getElementById('cs-auto-memory-interval').value = settings.autoMemoryInterval !== undefined ? settings.autoMemoryInterval : 0;

  const tsCheck = document.getElementById('cs-hide-timestamp');
  if (tsCheck) tsCheck.checked = !!(settings.hideTimestamp);

  switchChatSettingsTab('cs-tab-role');
  document.getElementById('liao-chat-settings').classList.add('show');
}

/* 预设气泡开关监听 */
document.getElementById('cs-use-preset-bubble').addEventListener('change', function () {
  const presetFields = document.getElementById('cs-preset-bubble-fields');
  if (presetFields) presetFields.style.display = this.checked ? '' : 'none';
});

document.getElementById('chat-settings-open-btn').addEventListener('click', openChatSettings);

document.getElementById('cs-close-btn').addEventListener('click', function () {
  document.getElementById('liao-chat-settings').classList.remove('show');
  const returnTo = this.dataset.returnTo;
  if (returnTo === 'rolelib') {
    currentChatIdx = -1;
    switchLiaoTab('rolelib');
  }
});

function switchChatSettingsTab(tabId) {
  document.querySelectorAll('.cs-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.cstab === tabId);
  });
  document.querySelectorAll('.cs-page').forEach(page => {
    page.classList.toggle('active', page.id === tabId + '-page');
  });
  if (tabId === 'cs-tab-memory') {
    renderMemoryLists();
    renderOtherMemoryList();
  }
  /* 加这一段 */
  if (tabId === 'cs-tab-schedule') {
    if (currentChatIdx >= 0 && typeof schInitUI === 'function') {
      const chat = liaoChats[currentChatIdx];
      if (chat) schInitUI(chat.roleId);
    }
  }
  if (tabId === 'cs-tab-autoreply') {
  if (currentChatIdx >= 0 && typeof arInitTab === 'function') {
    const chat = liaoChats[currentChatIdx];
    if (chat) arInitTab(chat.roleId);
  }
}

}


document.querySelectorAll('.cs-tab-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    switchChatSettingsTab(this.dataset.cstab);
  });
});

/* ---- 记忆子页切换 ---- */
document.querySelectorAll('.memory-sub-tab-btn').forEach(btn => {
  btn.addEventListener('click', function () {
    const target = this.dataset.memorytab;
    document.querySelectorAll('.memory-sub-tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.memory-sub-page').forEach(p => p.classList.remove('active'));
    this.classList.add('active');
    const page = document.getElementById(target + '-page');
    if (page) page.classList.add('active');
  });
});

/* ---------- 角色设置 ---------- */
let csRoleAvatarSrc    = '';
let csUserAvatarSrc    = '';
let csRoleCardImageSrc = '';

document.getElementById('cs-role-cardimage-url').addEventListener('input', function () {
  const url = this.value.trim();
  if (url) { csRoleCardImageSrc = url; document.getElementById('cs-role-cardimage-preview').src = url; }
});
document.getElementById('cs-role-cardimage-local-btn').addEventListener('click', () => {
  document.getElementById('cs-role-cardimage-file').click();
});
document.getElementById('cs-role-cardimage-file').addEventListener('change', function () {
  const file = this.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    csRoleCardImageSrc = e.target.result;
    document.getElementById('cs-role-cardimage-preview').src = csRoleCardImageSrc;
  };
  reader.readAsDataURL(file);
  this.value = '';
});

document.getElementById('cs-role-avatar-local-btn').addEventListener('click', () => {
  document.getElementById('cs-role-avatar-file').click();
});
document.getElementById('cs-role-avatar-file').addEventListener('change', function () {
  const file = this.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => { csRoleAvatarSrc = e.target.result; document.getElementById('cs-role-avatar-preview').src = csRoleAvatarSrc; };
  reader.readAsDataURL(file);
  this.value = '';
});
document.getElementById('cs-role-avatar-url').addEventListener('input', function () {
  const url = this.value.trim();
  if (url) { csRoleAvatarSrc = url; document.getElementById('cs-role-avatar-preview').src = url; }
});

document.getElementById('cs-role-save-btn').addEventListener('click', () => {
  if (currentChatIdx < 0) return;
  const chat = liaoChats[currentChatIdx];
  const role = liaoRoles.find(r => r.id === chat.roleId);
  if (!role) return;
  if (csRoleAvatarSrc) role.avatar = csRoleAvatarSrc;
  const nn = document.getElementById('cs-role-nickname').value.trim();
  const rn = document.getElementById('cs-role-realname').value.trim();
  const st = document.getElementById('cs-role-setting').value.trim();
  if (nn) role.nickname = nn;
  if (rn) role.realname = rn;
  role.setting = st;
  if (csRoleCardImageSrc) role.cardImage = csRoleCardImageSrc;
  lSave('roles', liaoRoles);
  csRoleAvatarSrc = '';
  document.getElementById('chat-view-title').textContent = role.nickname || role.realname;
  renderChatList();
  renderRoleLib();
  alert('角色设置已保存');
});

/* ---------- 用户设置 ---------- */
document.getElementById('cs-user-avatar-local-btn').addEventListener('click', () => {
  document.getElementById('cs-user-avatar-file').click();
});
document.getElementById('cs-user-avatar-file').addEventListener('change', function () {
  const file = this.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => { csUserAvatarSrc = e.target.result; document.getElementById('cs-user-avatar-preview').src = csUserAvatarSrc; };
  reader.readAsDataURL(file);
  this.value = '';
});
document.getElementById('cs-user-avatar-url').addEventListener('input', function () {
  const url = this.value.trim();
  if (url) { csUserAvatarSrc = url; document.getElementById('cs-user-avatar-preview').src = url; }
});

document.getElementById('cs-user-save-btn').addEventListener('click', () => {
  if (currentChatIdx < 0) return;
  const chat = liaoChats[currentChatIdx];
  if (csUserAvatarSrc) chat.chatUserAvatar = csUserAvatarSrc;
  const un = document.getElementById('cs-user-name').value.trim();
  const us = document.getElementById('cs-user-setting').value.trim();
  if (un) chat.chatUserName = un;
  chat.chatUserSetting = us;
  lSave('chats', liaoChats);
  csUserAvatarSrc = '';
  alert('用户设置已保存');
});

/* ---------- 从人设库导入 ---------- */
document.getElementById('cs-import-persona-btn').addEventListener('click', () => {
  const personas = lLoad('personas', []);
  const list     = document.getElementById('liao-persona-pick-list');
  list.innerHTML = '';
  if (!personas.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'font-size:13px;color:var(--text-light);padding:8px 0;';
    empty.textContent   = '人设库为空，请先在我的人设库中新建';
    list.appendChild(empty);
  } else {
    personas.forEach(p => {
      const card = document.createElement('div');
      card.className = 'persona-card';
      const avatarImg = document.createElement('img');
      avatarImg.className = 'persona-card-avatar';
      avatarImg.src       = p.avatar || defaultAvatar();
      avatarImg.alt       = '';
      const infoDiv = document.createElement('div');
      infoDiv.className = 'persona-card-info';
      const nameDiv = document.createElement('div');
      nameDiv.className = 'persona-card-name';
      nameDiv.textContent = p.name;
      const settingDiv = document.createElement('div');
      settingDiv.className = 'persona-card-setting';
      settingDiv.textContent = (p.setting || '').slice(0, 40);
      infoDiv.appendChild(nameDiv);
      infoDiv.appendChild(settingDiv);
      card.appendChild(avatarImg);
      card.appendChild(infoDiv);
      card.addEventListener('click', () => {
        document.getElementById('cs-user-name').value    = p.name    || '';
        document.getElementById('cs-user-setting').value = p.setting || '';
        if (p.avatar) {
          document.getElementById('cs-user-avatar-preview').src = p.avatar;
          csUserAvatarSrc = p.avatar;
        }
        document.getElementById('liao-persona-pick-modal').style.display = 'none';
      });
      list.appendChild(card);
    });
  }
  document.getElementById('liao-persona-pick-modal').style.display = 'flex';
});

document.getElementById('liao-persona-pick-cancel').addEventListener('click', () => {
  document.getElementById('liao-persona-pick-modal').style.display = 'none';
});

/* ---------- 聊天美化 ---------- */
function applyBeautySettings(beauty) {
  const styleId = 'liao-beauty-style';
  let styleEl = document.getElementById(styleId);
  if (!styleEl) {
    styleEl    = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }

  const custom    = beauty.customCSS      || '';
  const usePreset = beauty.usePresetBubble !== undefined ? beauty.usePresetBubble : true;

  let presetStyles = '';
  if (usePreset) {
    const rColor   = beauty.roleBubbleColor || 'rgba(210,230,255,0.55)';
    const uColor   = beauty.userBubbleColor || 'rgba(70,130,220,0.68)';
    const radius   = beauty.bubbleRadius    !== undefined ? beauty.bubbleRadius : 999;
    const fSize    = beauty.fontSize        || '12';
    const maxChars = parseInt(beauty.bubbleMaxChars) || 0;
    const maxWidthStyle = maxChars > 0
      ? 'max-width:' + maxChars + 'em !important;'
      : 'max-width:80vw !important;';

    presetStyles =
      '#liao-chat-messages .chat-msg-row:not(.user-row) .chat-msg-bubble {' +
        'background:' + rColor + ' !important;' +
        'border-radius:' + radius + 'px !important;' +
        'font-size:' + fSize + 'px !important;' +
        maxWidthStyle +
        'width:fit-content !important;' +
        'word-break:break-word !important;' +
        'overflow-wrap:break-word !important;' +
        'white-space:pre-wrap !important;' +
        'box-sizing:border-box !important;' +
      '}' +
      '#liao-chat-messages .chat-msg-row.user-row .chat-msg-bubble {' +
        'background:' + uColor + ' !important;' +
        'border-radius:' + radius + 'px !important;' +
        'font-size:' + fSize + 'px !important;' +
        maxWidthStyle +
        'width:fit-content !important;' +
        'word-break:break-word !important;' +
        'overflow-wrap:break-word !important;' +
        'white-space:pre-wrap !important;' +
        'box-sizing:border-box !important;' +
      '}';
  }

  /* 聊天背景图 */
  const bgUrl = beauty.chatBgUrl || '';
  const bgStyle = bgUrl
    ? '#liao-chat-messages{background-image:url("' + bgUrl + '") !important;background-size:cover !important;background-position:center !important;}'
    : '';

  styleEl.textContent = presetStyles + '\n' + bgStyle + '\n' + custom;
}

function applyCurrentChatBeauty() {
  if (currentChatIdx < 0) return;
  const chat   = liaoChats[currentChatIdx];
  const beauty = (chat.chatSettings && chat.chatSettings.beauty) || {};
  applyBeautySettings(beauty);
  applyTimestampFormat(beauty.timestampFormat, beauty.timestampCustom);
}

document.getElementById('cs-beauty-save-btn').addEventListener('click', () => {
  if (currentChatIdx < 0) return;
  const chat = liaoChats[currentChatIdx];
  if (!chat.chatSettings) chat.chatSettings = {};

  const tfEl = document.getElementById('cs-timestamp-format');
  const tcEl = document.getElementById('cs-timestamp-custom');
  const tsFormat = tfEl ? tfEl.value : 'full';
  const tsCustom = tcEl ? tcEl.value.trim() : '';

  const beauty = {
    usePresetBubble:  document.getElementById('cs-use-preset-bubble').checked,
    roleBubbleColor:  document.getElementById('cs-role-bubble-color').value,
    userBubbleColor:  document.getElementById('cs-user-bubble-color').value,
    bubbleRadius:     parseInt(document.getElementById('cs-bubble-radius').value)      || 999,
    bubbleMaxChars:   parseInt(document.getElementById('cs-bubble-max-chars').value)   || 0,
    fontSize:         document.getElementById('cs-font-size').value                    || '12',
    chatBgUrl:        (document.getElementById('cs-chat-bg-url').value || '').trim(),
    timestampFormat:  tsFormat,
    timestampCustom:  tsCustom,
    customCSS:        document.getElementById('cs-custom-css').value                   || ''
  };
  chat.chatSettings.beauty = beauty;
  lSave('chats', liaoChats);
  applyBeautySettings(beauty);
  applyTimestampFormat(tsFormat, tsCustom);
  alert('美化设置已保存');
});

document.getElementById('cs-beauty-reset-btn').addEventListener('click', () => {
  if (currentChatIdx < 0) return;
  const chat = liaoChats[currentChatIdx];
  if (chat.chatSettings) chat.chatSettings.beauty = {};
  lSave('chats', liaoChats);
  applyBeautySettings({});
  applyTimestampFormat('full', '');
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  document.getElementById('cs-use-preset-bubble').checked = true;
  const pf = document.getElementById('cs-preset-bubble-fields');
  if (pf) pf.style.display = '';
  set('cs-role-bubble-color',  '#ffffff');
  set('cs-user-bubble-color',  '#99C8ED');
  set('cs-bubble-radius',      '999');
  set('cs-bubble-max-chars',   '0');
  set('cs-font-size',          '12');
  set('cs-chat-bg-url',        '');
  set('cs-custom-css',         '');
  const tfEl = document.getElementById('cs-timestamp-format');
  const tcEl = document.getElementById('cs-timestamp-custom');
  if (tfEl) tfEl.value = 'full';
  if (tcEl) { tcEl.value = ''; tcEl.style.display = 'none'; }
  alert('美化已重置');
});

/* ---- 时间戳格式选择器联动 ---- */
document.addEventListener('change', function (e) {
  if (e.target && e.target.id === 'cs-timestamp-format') {
    const tcEl = document.getElementById('cs-timestamp-custom');
    if (tcEl) tcEl.style.display = e.target.value === 'custom' ? '' : 'none';
  }
});

/* ---- 聊天背景图本地上传 ---- */
document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'cs-chat-bg-local-btn') {
    const fi = document.getElementById('cs-chat-bg-file');
    if (fi) fi.click();
  }
  if (e.target && e.target.id === 'cs-chat-bg-clear-btn') {
    const urlEl = document.getElementById('cs-chat-bg-url');
    if (urlEl) urlEl.value = '';
  }
});
document.addEventListener('change', function (e) {
  if (e.target && e.target.id === 'cs-chat-bg-file') {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const urlEl = document.getElementById('cs-chat-bg-url');
      if (urlEl) urlEl.value = ev.target.result;
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  }
});

/* ---------- 消息数量设置 ---------- */
document.getElementById('cs-msgs-save-btn').addEventListener('click', () => {
  if (currentChatIdx < 0) return;
  const chat = liaoChats[currentChatIdx];
  if (!chat.chatSettings) chat.chatSettings = {};
  chat.chatSettings.maxApiMsgs         = parseInt(document.getElementById('cs-max-api-msgs').value)         || 0;
  chat.chatSettings.maxLoadMsgs        = parseInt(document.getElementById('cs-max-load-msgs').value)        || 40;
  chat.chatSettings.autoMemoryInterval = parseInt(document.getElementById('cs-auto-memory-interval').value) || 0;
  lSave('chats', liaoChats);
  alert('消息数量设置已保存');
});

/* ---------- 时间戳隐藏（视觉隐藏，仍可点击） ---------- */
document.getElementById('cs-timestamp-save-btn').addEventListener('click', () => {
  if (currentChatIdx < 0) return;
  const chat   = liaoChats[currentChatIdx];
  const hidden = document.getElementById('cs-hide-timestamp').checked;
  if (!chat.chatSettings) chat.chatSettings = {};
  chat.chatSettings.hideTimestamp = hidden;
  lSave('chats', liaoChats);
  document.body.classList.toggle('timestamp-hidden', hidden);
  alert('时间戳设置已保存');
});

/* ============================================================
   弹窗遮罩点击关闭
   ============================================================ */
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
