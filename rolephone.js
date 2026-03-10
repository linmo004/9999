/* ============================================================
   rolephone.js — 角色手机 App 完整逻辑
   ============================================================ */

/* ================================================================
   数据工具函数
   ================================================================ */
function rpDefaultData() {
  return {
    pin: '',
    wallpaper: '',
    memoWidgetItems: [],
    polaroidImg: '',
    appIcons: {},
    appPromptLimits: {},
    liaoChats: [],
    notes: { todos: [], diaries: [], memos: [] },
    screenHealth: [],
    forum: []
  };
}

function rpLoad(roleId) {
  try {
    var raw = localStorage.getItem('halo9_rolephone_' + roleId);
    if (!raw) return rpDefaultData();
    var data = JSON.parse(raw);
    if (!data.notes)              data.notes = { todos: [], diaries: [], memos: [] };
    if (!data.notes.todos)        data.notes.todos = [];
    if (!data.notes.diaries)      data.notes.diaries = [];
    if (!data.notes.memos)        data.notes.memos = [];
    if (!data.liaoChats)          data.liaoChats = [];
    if (!data.screenHealth)       data.screenHealth = [];
    if (!data.forum)              data.forum = [];
    if (!data.memoWidgetItems)    data.memoWidgetItems = [];
    return data;
  } catch (e) { return rpDefaultData(); }
}

function rpSave(roleId, data) {
  try { localStorage.setItem('halo9_rolephone_' + roleId, JSON.stringify(data)); } catch (e) {}
}

/* ================================================================
   API 调用
   ================================================================ */
function rpCallAPI(messages, onSuccess, onError) {
  var cfg   = null;
  var model = '';
  try { cfg   = JSON.parse(localStorage.getItem('halo9_apiActiveConfig') || 'null'); } catch (e) {}
  try { model = JSON.parse(localStorage.getItem('halo9_apiCurrentModel') || '""'); } catch (e) {}
  if (!cfg || !cfg.url) { onError('未配置API'); return; }
  var headers = { 'Content-Type': 'application/json' };
  if (cfg.key) headers['Authorization'] = 'Bearer ' + cfg.key;
  fetch(cfg.url.replace(/\/$/, '') + '/chat/completions', {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({ model: model || 'gpt-3.5-turbo', messages: messages, stream: false })
  })
  .then(function (r) { return r.json(); })
  .then(function (j) {
    var content = (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
    onSuccess(content);
  })
  .catch(function (e) { onError(e.message || '请求失败'); });
}

/* ================================================================
   全局状态
   ================================================================ */
var rpCurrentRoleId   = '';
var rpCurrentRoleData = null;
var rpCurrentRole     = null;
var rpPinBuffer       = '';
var rpPinErrorCount   = 0;
var rpPinLength       = 4;
var rpWeatherStr      = '获取中…';
var rpClockTimer      = null;
var rpCurrentNotesTab = 'rp-todo-tab';
var rpCurrentForumPostId = '';
var rpLoadingCount    = 0;

/* ================================================================
   加载弹窗
   ================================================================ */
function rpShowLoading() {
  rpLoadingCount++;
  var el = document.getElementById('rp-loading-modal');
  if (el) el.style.display = 'flex';
}

function rpHideLoading() {
  rpLoadingCount = Math.max(0, rpLoadingCount - 1);
  if (rpLoadingCount === 0) {
    var el = document.getElementById('rp-loading-modal');
    if (el) el.style.display = 'none';
  }
}

/* ================================================================
   视图切换
   ================================================================ */
var RP_VIEWS = [
  'rp-lockscreen-view',
  'rp-home-view',
  'rp-liao-view',
  'rp-liao-chat-view',
  'rp-notes-view',
  'rp-diary-detail-view',
  'rp-health-view',
  'rp-forum-view',
  'rp-forum-detail-view'
];

function rpShowView(id) {
  RP_VIEWS.forEach(function (v) {
    var el = document.getElementById(v);
    if (el) el.style.display = (v === id) ? 'flex' : 'none';
  });
}

/* ================================================================
   打开 / 关闭角色手机
   ================================================================ */
function rpOpen(roleId) {
  rpCurrentRoleId = roleId;

  /* 找到角色信息 */
  rpCurrentRole = null;
  if (typeof liaoRoles !== 'undefined') {
    rpCurrentRole = liaoRoles.find(function (r) { return r.id === roleId; }) || null;
  }

  rpCurrentRoleData = rpLoad(roleId);

  var app = document.getElementById('rolephone-app');
  if (app) app.style.display = 'flex';

  /* 有壁纸则应用 */
  rpApplyWallpaper();

  if (rpCurrentRoleData.pin && rpCurrentRoleData.pin.length === rpPinLength) {
    rpInitLockscreen();
    rpShowView('rp-lockscreen-view');
  } else {
    rpShowView('rp-home-view');
    rpInitHome();
  }
}

function rpClose() {
  var app = document.getElementById('rolephone-app');
  if (app) app.style.display = 'none';
  if (rpClockTimer) { clearInterval(rpClockTimer); rpClockTimer = null; }
}

function rpApplyWallpaper() {
  var homeView = document.getElementById('rp-home-view');
  if (!homeView) return;
  var wp = rpCurrentRoleData.wallpaper || '';
  if (wp) {
    homeView.style.backgroundImage    = 'url(' + wp + ')';
    homeView.style.backgroundSize     = 'cover';
    homeView.style.backgroundPosition = 'center';
  } else {
    homeView.style.backgroundImage = '';
  }
}

/* ================================================================
   锁屏逻辑
   ================================================================ */
function rpInitLockscreen() {
  rpPinBuffer     = '';
  rpPinErrorCount = 0;

  /* 注入角色信息 */
  var avatarEl = document.getElementById('rp-ls-avatar');
  var nameEl   = document.getElementById('rp-ls-name');
  if (avatarEl && rpCurrentRole) avatarEl.src = rpCurrentRole.avatar || '';
  if (nameEl   && rpCurrentRole) nameEl.textContent = rpCurrentRole.nickname || rpCurrentRole.realname || '角色';

  rpUpdateLsTime();
  if (rpClockTimer) clearInterval(rpClockTimer);
  rpClockTimer = setInterval(rpUpdateLsTime, 10000);

  rpRenderPinDots();
  rpClearPinError();
}

function rpUpdateLsTime() {
  var now = new Date();
  var h   = String(now.getHours()).padStart(2, '0');
  var m   = String(now.getMinutes()).padStart(2, '0');
  var mo  = now.getMonth() + 1;
  var d   = now.getDate();

  var timeEl = document.getElementById('rp-ls-time');
  var dateEl = document.getElementById('rp-ls-date');
  if (timeEl) timeEl.textContent = h + ':' + m;
  if (dateEl) dateEl.textContent = mo + '月' + d + '日';
}

function rpRenderPinDots() {
  document.querySelectorAll('.rp-pin-dot').forEach(function (dot, i) {
    dot.classList.toggle('filled', i < rpPinBuffer.length);
    dot.classList.remove('error');
  });
}

function rpShowPinError(msg) {
  document.querySelectorAll('.rp-pin-dot').forEach(function (dot) {
    dot.classList.add('error');
  });
  var errEl = document.getElementById('rp-pin-error');
  if (errEl) { errEl.textContent = msg; errEl.classList.add('show'); }
  setTimeout(function () {
    document.querySelectorAll('.rp-pin-dot').forEach(function (dot) {
      dot.classList.remove('error');
    });
    if (errEl) errEl.classList.remove('show');
    rpPinBuffer = '';
    rpRenderPinDots();
  }, 900);
}

function rpClearPinError() {
  var errEl = document.getElementById('rp-pin-error');
  if (errEl) { errEl.textContent = ''; errEl.classList.remove('show'); }
}

function rpHandlePinKey(val) {
  if (val === 'del') {
    if (rpPinBuffer.length > 0) {
      rpPinBuffer = rpPinBuffer.slice(0, -1);
      rpRenderPinDots();
      rpClearPinError();
    }
    return;
  }
  if (rpPinBuffer.length >= rpPinLength) return;
  rpPinBuffer += val;
  rpRenderPinDots();

  if (rpPinBuffer.length === rpPinLength) {
    var correct = rpCurrentRoleData.pin || '';
    if (rpPinBuffer === correct) {
      rpPinErrorCount = 0;
      rpShowView('rp-home-view');
      rpInitHome();
    } else {
      rpPinErrorCount++;
      if (rpPinErrorCount >= 3) {
        rpShowPinError('密码错误，请联系角色重置');
      } else {
        rpShowPinError('密码错误，请重试（' + rpPinErrorCount + '/3）');
      }
    }
  }
}

/* 绑定锁屏键盘 */
(function bindRpPinKeys() {
  document.addEventListener('click', function (e) {
    var key = e.target.closest('.rp-pin-key[data-key]');
    if (!key) return;
    if (!document.getElementById('rp-lockscreen-view') ||
        document.getElementById('rp-lockscreen-view').style.display === 'none') return;
    rpHandlePinKey(key.dataset.key);
  });

  document.addEventListener('touchstart', function (e) {
    var key = e.target.closest('.rp-pin-key[data-key]');
    if (!key) return;
    if (!document.getElementById('rp-lockscreen-view') ||
        document.getElementById('rp-lockscreen-view').style.display === 'none') return;
    e.preventDefault();
    key.classList.add('pressed');
    rpHandlePinKey(key.dataset.key);
  }, { passive: false });

  document.addEventListener('touchend', function (e) {
    var key = e.target.closest('.rp-pin-key');
    if (key) key.classList.remove('pressed');
  }, { passive: true });
})();

/* 忘记密码 */
document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'rp-pin-forget') {
    alert('请在聊天设置 — 角色手机中重置密码');
  }
});

/* ================================================================
   主页逻辑
   ================================================================ */
function rpInitHome() {
  rpApplyWallpaper();
  rpUpdateHomeTime();
  if (rpClockTimer) clearInterval(rpClockTimer);
  rpClockTimer = setInterval(rpUpdateHomeTime, 30000);
  rpFetchWeather();
  rpRenderMemoWidget();
  rpRenderPolaroid();
}

function rpUpdateHomeTime() {
  var now  = new Date();
  var h    = String(now.getHours()).padStart(2, '0');
  var m    = String(now.getMinutes()).padStart(2, '0');
  var mo   = now.getMonth() + 1;
  var d    = now.getDate();
  var timeEl = document.getElementById('rp-home-time');
  var dateEl = document.getElementById('rp-home-date');
  if (timeEl) timeEl.textContent = h + ':' + m;
  if (dateEl) dateEl.textContent = mo + '月' + d + '日';
}

function rpFetchWeather() {
  var weatherEl = document.getElementById('rp-home-weather');
  if (!weatherEl) return;
  fetch('https://wttr.in/?format=%c+%t')
    .then(function (r) { return r.text(); })
    .then(function (t) {
      rpWeatherStr = t.trim() || '☀️ --°C';
      if (weatherEl) weatherEl.textContent = rpWeatherStr;
    })
    .catch(function () {
      rpWeatherStr = '天气获取失败';
      if (weatherEl) weatherEl.textContent = rpWeatherStr;
    });
}

function rpRenderMemoWidget() {
  var list = document.getElementById('rp-memo-list');
  if (!list) return;
  var items = (rpCurrentRoleData.memoWidgetItems || []).slice(0, 3);
  if (!items.length) {
    list.innerHTML = '<div class="rp-memo-empty">暂无备忘</div>';
    return;
  }
  list.innerHTML = '';
  items.forEach(function (item) {
    var div       = document.createElement('div');
    div.className = 'rp-memo-item';
    div.textContent = item.text;
    list.appendChild(div);
  });
}

function rpRenderPolaroid() {
  var img      = document.getElementById('rp-photo-img');
  var emptyEl  = document.getElementById('rp-photo-empty');
  var polaroid = rpCurrentRoleData.polaroidImg || '';
  if (img && emptyEl) {
    if (polaroid) {
      img.src           = polaroid;
      img.style.display = 'block';
      emptyEl.style.display = 'none';
    } else {
      img.style.display = 'none';
      emptyEl.style.display = 'flex';
    }
  }
}

/* 备忘录小组件 + 按钮 */
document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'rp-memo-add-btn') {
    var text = prompt('添加备忘内容');
    if (!text || !text.trim()) return;
    if (!rpCurrentRoleData.memoWidgetItems) rpCurrentRoleData.memoWidgetItems = [];
    rpCurrentRoleData.memoWidgetItems.unshift({
      id:   'memo_' + Date.now(),
      text: text.trim(),
      ts:   Date.now()
    });
    rpSave(rpCurrentRoleId, rpCurrentRoleData);
    rpRenderMemoWidget();
  }
});

/* 拍立得点击换图 */
document.addEventListener('click', function (e) {
  if (e.target && (e.target.id === 'rp-photo-img' || e.target.id === 'rp-photo-empty' ||
      e.target.closest('.rp-widget-photo'))) {
    if (document.getElementById('rp-home-view') &&
        document.getElementById('rp-home-view').style.display !== 'none') {
      var url = prompt('输入拍立得图片URL');
      if (url && url.trim()) {
        rpCurrentRoleData.polaroidImg = url.trim();
        rpSave(rpCurrentRoleId, rpCurrentRoleData);
        rpRenderPolaroid();
      }
    }
  }
});

/* App 图标点击 */
document.addEventListener('click', function (e) {
  var item = e.target.closest('.rp-app-item[data-rpapp]');
  if (!item) return;
  if (document.getElementById('rp-home-view') &&
      document.getElementById('rp-home-view').style.display === 'none') return;
  var app = item.dataset.rpapp;
  if (app === 'liao')   { rpShowView('rp-liao-view');   rpInitLiaoApp(); }
  if (app === 'notes')  { rpShowView('rp-notes-view');  rpInitNotesApp(); }
  if (app === 'health') { rpShowView('rp-health-view'); rpInitHealthApp(); }
  if (app === 'forum')  { rpShowView('rp-forum-view');  rpInitForumApp(); }
});

/* Dock 按钮 */
document.addEventListener('click', function (e) {
  if (e.target && (e.target.id === 'rp-dock-home-btn' ||
      e.target.closest('#rp-dock-home-btn'))) {
    rpShowView('rp-home-view');
    rpInitHome();
  }
  if (e.target && (e.target.id === 'rp-dock-back-btn' ||
      e.target.closest('#rp-dock-back-btn'))) {
    rpClose();
  }
});

/* ================================================================
   通用返回按钮
   ================================================================ */
document.addEventListener('click', function (e) {
  var btn = e.target.closest('.rp-back-btn[data-rpback]');
  if (!btn) return;
  var target = btn.dataset.rpback;
  rpShowView(target);
  if (target === 'rp-home-view')   rpInitHome();
  if (target === 'rp-liao-view')   rpRenderLiaoList();
  if (target === 'rp-notes-view')  rpRenderCurrentNotesTab();
  if (target === 'rp-forum-view')  rpRenderForumList();
});

/* ================================================================
   了了 App
   ================================================================ */
function rpInitLiaoApp() {
  rpRenderLiaoList();
}

function rpRenderLiaoList() {
  var list = document.getElementById('rp-liao-chat-list');
  if (!list) return;
  var chats = rpCurrentRoleData.liaoChats || [];
  if (!chats.length) {
    list.innerHTML = '<div class="rp-list-empty">暂无聊天记录，点右上角＋生成</div>';
    return;
  }
  list.innerHTML = '';
  chats.forEach(function (chat) {
    var last    = (chat.messages && chat.messages.length)
                    ? chat.messages[chat.messages.length - 1]
                    : null;
    var preview = last ? (last.content || '').slice(0, 24) : '暂无消息';
    var timeStr = last ? rpFormatTime(last.ts) : '';

    var item       = document.createElement('div');
    item.className = 'rp-chat-item';
    item.dataset.chatId = chat.id;

    var avatarEl       = document.createElement('img');
    avatarEl.className = 'rp-chat-item-avatar';
    avatarEl.src       = chat.avatar || '';

    var body       = document.createElement('div');
    body.className = 'rp-chat-item-body';

    var nameEl       = document.createElement('div');
    nameEl.className = 'rp-chat-item-name';
    nameEl.textContent = chat.name || '未知';

    var previewEl       = document.createElement('div');
    previewEl.className = 'rp-chat-item-preview';
    previewEl.textContent = preview;

    var timeEl       = document.createElement('div');
    timeEl.className = 'rp-chat-item-time';
    timeEl.textContent = timeStr;

    body.appendChild(nameEl);
    body.appendChild(previewEl);
    item.appendChild(avatarEl);
    item.appendChild(body);
    item.appendChild(timeEl);

    item.addEventListener('click', function () {
      rpOpenLiaoChat(chat.id);
    });
    list.appendChild(item);
  });
}

function rpOpenLiaoChat(chatId) {
  var chat = (rpCurrentRoleData.liaoChats || []).find(function (c) { return c.id === chatId; });
  if (!chat) return;

  var avatarEl = document.getElementById('rp-liao-chat-avatar');
  var nameEl   = document.getElementById('rp-liao-chat-name');
  if (avatarEl) avatarEl.src = chat.avatar || '';
  if (nameEl)   nameEl.textContent = chat.name || '聊天';

  rpShowView('rp-liao-chat-view');
  rpRenderLiaoMessages(chat);
}

function rpRenderLiaoMessages(chat) {
  var area = document.getElementById('rp-liao-messages');
  if (!area) return;
  area.innerHTML = '';
  var msgs = chat.messages || [];
  msgs.forEach(function (msg) {
    var row       = document.createElement('div');
    row.className = 'rp-msg-row' + (msg.role === 'self' ? ' rp-user-row' : '');

    var avatarEl       = document.createElement('img');
    avatarEl.className = 'rp-msg-avatar';
    if (msg.role === 'self') {
      avatarEl.src = (rpCurrentRole && rpCurrentRole.avatar) ? rpCurrentRole.avatar : '';
    } else {
      avatarEl.src = chat.avatar || '';
    }

    var bubble       = document.createElement('div');
    bubble.className = 'rp-msg-bubble';
    bubble.textContent = msg.content || '';

    if (msg.role === 'self') {
      row.appendChild(bubble);
      row.appendChild(avatarEl);
    } else {
      row.appendChild(avatarEl);
      row.appendChild(bubble);
    }
    area.appendChild(row);
  });
  area.scrollTop = area.scrollHeight;
}

/* 了了 + 按钮：生成新聊天 */
document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'rp-liao-compose-btn') {
    if (!rpCurrentRole) { alert('角色信息未加载'); return; }
    var roleName    = rpCurrentRole.nickname || rpCurrentRole.realname || '角色';
    var roleSetting = rpCurrentRole.setting || '';
    var systemPrompt =
      '你扮演角色' + roleName + '，' + roleSetting + '。' +
      '请生成一条角色手机里"了了"App中，角色与某个人的聊天记录，' +
      '以JSON数组格式输出，格式：' +
      '[{"role":"other","name":"对方名字","avatar":"","content":"消息内容","ts":时间戳},' +
      '{"role":"self","content":"消息内容","ts":时间戳}]，' +
      '生成8到15条消息，贴合角色人设，内容生活化。只输出JSON数组，不输出其他内容。';
    rpShowLoading();
    rpCallAPI(
      [{ role: 'system', content: systemPrompt }],
      function (raw) {
        rpHideLoading();
        try {
          var jsonStr = raw.trim();
          var m = jsonStr.match(/\[[\s\S]*\]/);
          if (m) jsonStr = m[0];
          var msgs = JSON.parse(jsonStr);
          if (!Array.isArray(msgs) || !msgs.length) throw new Error('empty');
          var otherName   = '';
          var otherAvatar = '';
          msgs.forEach(function (msg) {
            if (msg.role === 'other' && !otherName) {
              otherName   = msg.name   || '好友';
              otherAvatar = msg.avatar || '';
            }
          });
          var newChat = {
            id:       'rpchat_' + Date.now(),
            name:     otherName,
            avatar:   otherAvatar,
            messages: msgs
          };
          rpCurrentRoleData.liaoChats.unshift(newChat);
          rpSave(rpCurrentRoleId, rpCurrentRoleData);
          rpRenderLiaoList();
        } catch (err) {
          alert('生成失败，请重试：' + err.message);
        }
      },
      function (err) {
        rpHideLoading();
        alert('API 请求失败：' + err);
      }
    );
  }
});

/* 了了聊天详情 + 按钮：生成新消息 */
document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'rp-liao-gen-btn') {
    var nameEl  = document.getElementById('rp-liao-chat-name');
    var chatName = nameEl ? nameEl.textContent : '';
    var chat = (rpCurrentRoleData.liaoChats || []).find(function (c) { return c.name === chatName; });
    if (!chat) return;
    var roleName    = (rpCurrentRole && (rpCurrentRole.nickname || rpCurrentRole.realname)) || '角色';
    var roleSetting = (rpCurrentRole && rpCurrentRole.setting) || '';
    var systemPrompt =
      '你扮演角色' + roleName + '，' + roleSetting + '。' +
      '请继续以下聊天，再生成3到5条消息，格式与之前相同的JSON数组。' +
      '只输出JSON数组，不输出其他内容。';
    rpShowLoading();
    rpCallAPI(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: JSON.stringify(chat.messages.slice(-6)) }
      ],
      function (raw) {
        rpHideLoading();
        try {
          var jsonStr = raw.trim();
          var m = jsonStr.match(/\[[\s\S]*\]/);
          if (m) jsonStr = m[0];
          var newMsgs = JSON.parse(jsonStr);
          if (!Array.isArray(newMsgs)) throw new Error('empty');
          newMsgs.forEach(function (msg) { chat.messages.push(msg); });
          rpSave(rpCurrentRoleId, rpCurrentRoleData);
          rpRenderLiaoMessages(chat);
        } catch (err) {
          alert('生成失败：' + err.message);
        }
      },
      function (err) {
        rpHideLoading();
        alert('API 请求失败：' + err);
      }
    );
  }
});

/* ================================================================
   便签 App
   ================================================================ */
function rpInitNotesApp() {
  rpCurrentNotesTab = 'rp-todo-tab';
  rpRenderCurrentNotesTab();
}

function rpRenderCurrentNotesTab() {
  if (rpCurrentNotesTab === 'rp-todo-tab')   rpRenderTodoList();
  if (rpCurrentNotesTab === 'rp-diary-tab')  rpRenderDiaryList();
  if (rpCurrentNotesTab === 'rp-memo-tab')   rpRenderMemoList();
}

/* Tab 切换 */
document.addEventListener('click', function (e) {
  var btn = e.target.closest('.rp-tab-btn[data-rptab]');
  if (!btn) return;
  document.querySelectorAll('.rp-tab-btn').forEach(function (b) {
    b.classList.remove('active');
  });
  document.querySelectorAll('.rp-tab-panel').forEach(function (p) {
    p.classList.remove('active');
  });
  btn.classList.add('active');
  var panelId = btn.dataset.rptab;
  rpCurrentNotesTab = panelId;
  var panel = document.getElementById(panelId);
  if (panel) panel.classList.add('active');
  rpRenderCurrentNotesTab();
});

/* 便签 + 按钮 */
document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'rp-notes-add-btn') {
    if (rpCurrentNotesTab === 'rp-todo-tab') {
      rpAddTodo();
    } else if (rpCurrentNotesTab === 'rp-diary-tab') {
      rpGenerateDiary();
    } else if (rpCurrentNotesTab === 'rp-memo-tab') {
      rpGenerateMemo();
    }
  }
});

/* ---- 待办 ---- */
function rpAddTodo() {
  var text = prompt('输入待办内容');
  if (!text || !text.trim()) return;
  rpCurrentRoleData.notes.todos.unshift({
    id:   'todo_' + Date.now(),
    text: text.trim(),
    done: false,
    ts:   Date.now()
  });
  rpSave(rpCurrentRoleId, rpCurrentRoleData);
  rpRenderTodoList();
}

function rpRenderTodoList() {
  var list = document.getElementById('rp-todo-list');
  if (!list) return;
  var todos = rpCurrentRoleData.notes.todos || [];
  if (!todos.length) {
    list.innerHTML = '<div class="rp-list-empty">暂无待办，点右上角＋添加</div>';
    return;
  }
  list.innerHTML = '';
  todos.forEach(function (todo, idx) {
    var item       = document.createElement('div');
    item.className = 'rp-todo-item';

    var check       = document.createElement('div');
    check.className = 'rp-todo-check' + (todo.done ? ' checked' : '');
    check.dataset.todoIdx = idx;

    var body       = document.createElement('div');
    body.className = 'rp-todo-body';

    var textEl       = document.createElement('div');
    textEl.className = 'rp-todo-text' + (todo.done ? ' done' : '');
    textEl.textContent = todo.text;

    var timeEl       = document.createElement('div');
    timeEl.className = 'rp-todo-time';
    timeEl.textContent = rpFormatTime(todo.ts);

    body.appendChild(textEl);
    body.appendChild(timeEl);
    item.appendChild(check);
    item.appendChild(body);
    list.appendChild(item);

    check.addEventListener('click', function () {
      rpCurrentRoleData.notes.todos[idx].done = !rpCurrentRoleData.notes.todos[idx].done;
      rpSave(rpCurrentRoleId, rpCurrentRoleData);
      rpRenderTodoList();
    });
  });
}

/* ---- 日记 ---- */
function rpGenerateDiary() {
  if (!rpCurrentRole) { alert('角色信息未加载'); return; }
  var roleName    = rpCurrentRole.nickname || rpCurrentRole.realname || '角色';
  var roleSetting = rpCurrentRole.setting || '';
  var now         = new Date();
  var dateStr     = now.getFullYear() + '年' + (now.getMonth() + 1) + '月' + now.getDate() + '日';
  var weather     = rpWeatherStr || '晴天';
  var systemPrompt =
    '你扮演角色' + roleName + '，' + roleSetting + '。' +
    '今天是' + dateStr + '，天气' + weather + '。' +
    '请以角色第一人称写一篇今日日记，600字左右，细腻真实，贴合人设，' +
    '格式：第一行是日期和天气，然后换行写日记正文。只输出日记内容。';
  rpShowLoading();
  rpCallAPI(
    [{ role: 'system', content: systemPrompt }],
    function (raw) {
      rpHideLoading();
      var content = raw.trim();
      if (!content) { alert('生成失败，请重试'); return; }
      rpCurrentRoleData.notes.diaries.unshift({
        id:      'diary_' + Date.now(),
        date:    dateStr,
        weather: weather,
        content: content,
        starred: false,
        ts:      Date.now()
      });
      rpSave(rpCurrentRoleId, rpCurrentRoleData);
      rpRenderDiaryList();
    },
    function (err) {
      rpHideLoading();
      alert('API 请求失败：' + err);
    }
  );
}

function rpRenderDiaryList() {
  var list = document.getElementById('rp-diary-list');
  if (!list) return;
  var diaries = rpCurrentRoleData.notes.diaries || [];
  if (!diaries.length) {
    list.innerHTML = '<div class="rp-list-empty">暂无日记，点右上角＋生成</div>';
    return;
  }
  list.innerHTML = '';
  diaries.forEach(function (diary, idx) {
    var item       = document.createElement('div');
    item.className = 'rp-diary-item';

    var header       = document.createElement('div');
    header.className = 'rp-diary-item-header';

    var dateEl       = document.createElement('span');
    dateEl.className = 'rp-diary-item-date';
    dateEl.textContent = diary.date || '';

    var weatherEl       = document.createElement('span');
    weatherEl.className = 'rp-diary-item-weather';
    weatherEl.textContent = diary.weather || '';

    var preview       = document.createElement('div');
    preview.className = 'rp-diary-item-preview';
    preview.textContent = (diary.content || '').slice(0, 60);

    header.appendChild(dateEl);
    header.appendChild(weatherEl);
    item.appendChild(header);
    item.appendChild(preview);
    list.appendChild(item);

    item.addEventListener('click', function () {
      rpOpenDiaryDetail(idx, 'diary');
    });
  });
}

/* ---- 随记 ---- */
function rpGenerateMemo() {
  if (!rpCurrentRole) { alert('角色信息未加载'); return; }
  var roleName    = rpCurrentRole.nickname || rpCurrentRole.realname || '角色';
  var roleSetting = rpCurrentRole.setting || '';
  var systemPrompt =
    '你扮演角色' + roleName + '，' + roleSetting + '。' +
    '请以角色第一人称写一条随手记，50到100字，' +
    '内容随意，可以是突然看见的事、心里的想法、小感悟等，口语化，不加任何标题。只输出随记内容。';
  rpShowLoading();
  rpCallAPI(
    [{ role: 'system', content: systemPrompt }],
    function (raw) {
      rpHideLoading();
      var content = raw.trim();
      if (!content) { alert('生成失败，请重试'); return; }
      var now = new Date();
      rpCurrentRoleData.notes.memos.unshift({
        id:      'rmemo_' + Date.now(),
        content: content,
        starred: false,
        ts:      Date.now()
      });
      rpSave(rpCurrentRoleId, rpCurrentRoleData);
      rpRenderMemoList();
    },
    function (err) {
      rpHideLoading();
      alert('API 请求失败：' + err);
    }
  );
}

function rpRenderMemoList() {
  var list = document.getElementById('rp-random-list');
  if (!list) return;
  var memos = rpCurrentRoleData.notes.memos || [];
  if (!memos.length) {
    list.innerHTML = '<div class="rp-list-empty">暂无随记，点右上角＋生成</div>';
    return;
  }
  list.innerHTML = '';
  memos.forEach(function (memo, idx) {
    var item       = document.createElement('div');
    item.className = 'rp-diary-item';

    var header       = document.createElement('div');
    header.className = 'rp-diary-item-header';

    var timeEl       = document.createElement('span');
    timeEl.className = 'rp-diary-item-date';
    timeEl.textContent = rpFormatTime(memo.ts);

    var preview       = document.createElement('div');
    preview.className = 'rp-diary-item-preview';
    preview.textContent = (memo.content || '').slice(0, 60);

    header.appendChild(timeEl);
    item.appendChild(header);
    item.appendChild(preview);
    list.appendChild(item);

    item.addEventListener('click', function () {
      rpOpenDiaryDetail(idx, 'memo');
    });
  });
}

/* ---- 日记/随记详情 ---- */
var rpDetailType  = 'diary';
var rpDetailIndex = 0;

function rpOpenDiaryDetail(idx, type) {
  rpDetailType  = type;
  rpDetailIndex = idx;

  var item    = type === 'diary'
    ? rpCurrentRoleData.notes.diaries[idx]
    : rpCurrentRoleData.notes.memos[idx];
  if (!item) return;

  var dateEl    = document.getElementById('rp-detail-date');
  var weatherEl = document.getElementById('rp-detail-weather');
  var contentEl = document.getElementById('rp-detail-content');
  var favBtn    = document.getElementById('rp-detail-fav-btn');

  if (dateEl)    dateEl.textContent    = item.date    || rpFormatTime(item.ts);
  if (weatherEl) weatherEl.textContent = item.weather || '';
  if (contentEl) contentEl.textContent = item.content || '';
  if (favBtn)    favBtn.textContent    = item.starred ? '★' : '☆';

  rpShowView('rp-diary-detail-view');
}

/* 收藏 / 删除 */
document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'rp-detail-fav-btn') {
    var arr  = rpDetailType === 'diary'
      ? rpCurrentRoleData.notes.diaries
      : rpCurrentRoleData.notes.memos;
    arr[rpDetailIndex].starred = !arr[rpDetailIndex].starred;
    rpSave(rpCurrentRoleId, rpCurrentRoleData);
    e.target.textContent = arr[rpDetailIndex].starred ? '★' : '☆';
  }
  if (e.target && e.target.id === 'rp-detail-del-btn') {
    if (!confirm('确定删除？')) return;
    var arr = rpDetailType === 'diary'
      ? rpCurrentRoleData.notes.diaries
      : rpCurrentRoleData.notes.memos;
    arr.splice(rpDetailIndex, 1);
    rpSave(rpCurrentRoleId, rpCurrentRoleData);
    rpShowView('rp-notes-view');
    rpRenderCurrentNotesTab();
  }
});

/* ================================================================
   屏幕健康 App
   ================================================================ */
function rpInitHealthApp() {
  rpRenderHealthData();
}

function rpRenderHealthData() {
  var totalEl = document.getElementById('rp-health-total');
  var listEl  = document.getElementById('rp-health-list');
  if (!listEl) return;

  var records = rpCurrentRoleData.screenHealth || [];
  var today   = new Date().toDateString();
  var todayRecord = records.find(function (r) { return r.date === today; });

  if (!todayRecord || !todayRecord.apps || !todayRecord.apps.length) {
    if (totalEl) totalEl.textContent = '0h 0m';
    listEl.innerHTML = '<div class="rp-list-empty">暂无数据，点右上角＋生成今日数据</div>';
    return;
  }

  var apps      = todayRecord.apps;
  var totalMins = apps.reduce(function (s, a) { return s + (a.minutes || 0); }, 0);
  var h         = Math.floor(totalMins / 60);
  var m         = totalMins % 60;
  if (totalEl) totalEl.textContent = h + 'h ' + m + 'm';

  var maxMins = Math.max.apply(null, apps.map(function (a) { return a.minutes || 0; }));
  listEl.innerHTML = '';

  apps.forEach(function (app) {
    var pct = maxMins > 0 ? Math.round((app.minutes / maxMins) * 100) : 0;
    var ah  = Math.floor(app.minutes / 60);
    var am  = app.minutes % 60;
    var timeStr = ah > 0 ? ah + 'h ' + am + 'm' : am + 'm';

    var item       = document.createElement('div');
    item.className = 'rp-health-item';

    item.innerHTML =
      '<div class="rp-health-item-header">' +
        '<div class="rp-health-item-info">' +
          '<div class="rp-health-item-icon">' + (app.icon || '📱') + '</div>' +
          '<div class="rp-health-item-name">' + (app.name || '') + '</div>' +
        '</div>' +
        '<div class="rp-health-item-time">' + timeStr + '</div>' +
      '</div>' +
      '<div class="rp-health-bar-wrap">' +
        '<div class="rp-health-bar-fill" style="width:' + pct + '%"></div>' +
      '</div>';

    listEl.appendChild(item);
  });
}

/* 屏幕健康 + 按钮 */
document.addEventListener('click', function (e) {
  if (e.target && e.target.closest('#rp-health-view') &&
      e.target.classList.contains('rp-topbar-right-btn')) {
    if (document.getElementById('rp-health-view') &&
        document.getElementById('rp-health-view').style.display === 'none') return;
    if (!rpCurrentRole) { alert('角色信息未加载'); return; }
    var roleName    = rpCurrentRole.nickname || rpCurrentRole.realname || '角色';
    var roleSetting = rpCurrentRole.setting || '';
    var systemPrompt =
      '你扮演角色' + roleName + '，' + roleSetting + '。' +
      '请生成角色今天使用手机各App的时长数据，以JSON数组格式输出，' +
      '格式：[{"name":"App名","icon":"emoji","minutes":数字}]，' +
      '生成6到10个App，时长合理，App种类参考真实手机App和了了、便签、屏幕健康、趣问等。只输出JSON数组。';
    rpShowLoading();
    rpCallAPI(
      [{ role: 'system', content: systemPrompt }],
      function (raw) {
        rpHideLoading();
        try {
          var jsonStr = raw.trim();
          var m = jsonStr.match(/\[[\s\S]*\]/);
          if (m) jsonStr = m[0];
          var apps = JSON.parse(jsonStr);
          if (!Array.isArray(apps)) throw new Error('empty');
          var today = new Date().toDateString();
          var records = rpCurrentRoleData.screenHealth || [];
          var existIdx = records.findIndex(function (r) { return r.date === today; });
          var newRecord = { date: today, apps: apps };
          if (existIdx >= 0) records[existIdx] = newRecord;
          else records.unshift(newRecord);
          rpCurrentRoleData.screenHealth = records;
          rpSave(rpCurrentRoleId, rpCurrentRoleData);
          rpRenderHealthData();
        } catch (err) {
          alert('生成失败：' + err.message);
        }
      },
      function (err) {
        rpHideLoading();
        alert('API 请求失败：' + err);
      }
    );
  }
});

/* ================================================================
   趣问 App
   ================================================================ */
function rpInitForumApp() {
  rpRenderForumList();
}

function rpRenderForumList() {
  var list = document.getElementById('rp-forum-list');
  if (!list) return;
  var posts = rpCurrentRoleData.forum || [];
  if (!posts.length) {
    list.innerHTML = '<div class="rp-list-empty">暂无帖子，点右上角＋生成</div>';
    return;
  }
  list.innerHTML = '';
  posts.forEach(function (post) {
    var item       = document.createElement('div');
    item.className = 'rp-forum-item';

    var avatarEmoji = (rpCurrentRole && rpCurrentRole.avatar) ? '' : '👤';

    item.innerHTML =
      '<div class="rp-forum-item-header">' +
        '<div class="rp-forum-item-avatar">' + avatarEmoji + '</div>' +
        '<div class="rp-forum-item-name">' +
          ((rpCurrentRole && (rpCurrentRole.nickname || rpCurrentRole.realname)) || '角色') +
        '</div>' +
      '</div>' +
      '<div class="rp-forum-item-title">' + (post.title || '') + '</div>' +
      '<div class="rp-forum-item-footer">' +
        '<div class="rp-forum-item-replies">' +
        (post.replies ? post.replies.length : 0) + ' 条回复' +
        '</div>' +
        '<div class="rp-forum-item-time">' + rpFormatTime(post.ts) + '</div>' +
      '</div>';

    item.addEventListener('click', function () {
      rpOpenForumPost(post.id);
    });
    list.appendChild(item);
  });
}

function rpOpenForumPost(postId) {
  rpCurrentForumPostId = postId;
  var post = (rpCurrentRoleData.forum || []).find(function (p) { return p.id === postId; });
  if (!post) return;

  var contentEl = document.getElementById('rp-forum-post-content');
  var repliesEl = document.getElementById('rp-forum-replies');
  if (!contentEl || !repliesEl) return;

  contentEl.innerHTML =
    '<div class="rp-forum-post-title">' + (post.title || '') + '</div>' +
    '<div class="rp-forum-post-body">' + (post.content || '') + '</div>';

  repliesEl.innerHTML = '';
  var replies = post.replies || [];
  replies.forEach(function (reply) {
    var item       = document.createElement('div');
    item.className = 'rp-forum-reply-item';
    item.innerHTML =
      '<div class="rp-forum-reply-header">' +
        '<div class="rp-forum-reply-avatar">' + (reply.avatar || '👤') + '</div>' +
        '<div class="rp-forum-reply-name">' + (reply.name || '路人') + '</div>' +
        '<div class="rp-forum-reply-time">' + rpFormatTime(reply.ts || post.ts) + '</div>' +
      '</div>' +
      '<div class="rp-forum-reply-content">' + (reply.content || '') + '</div>';
    repliesEl.appendChild(item);
  });

  rpShowView('rp-forum-detail-view');

  /* 清空输入框 */
  var inputEl = document.getElementById('rp-forum-reply-input');
  if (inputEl) inputEl.value = '';
}

/* 趣问 + 按钮：生成新帖子 */
document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'rp-forum-add-btn') {
    if (!rpCurrentRole) { alert('角色信息未加载'); return; }
    var roleName    = rpCurrentRole.nickname || rpCurrentRole.realname || '角色';
    var roleSetting = rpCurrentRole.setting || '';
    var systemPrompt =
      '你扮演角色' + roleName + '，' + roleSetting + '。' +
      '请生成一条角色在论坛"趣问"App里发的提问帖子，以JSON格式输出，' +
      '格式：{"title":"帖子标题","content":"帖子正文100字左右",' +
      '"replies":[{"name":"路人昵称","avatar":"emoji","content":"回复内容"}]}，' +
      '生成15到20条路人回复，回复风格多样（支持、质疑、共鸣、搞笑、认真建议等），' +
      '其中最后一条回复的name为角色名，是角色对某条路人回复的回应。只输出JSON。';
    rpShowLoading();
    rpCallAPI(
      [{ role: 'system', content: systemPrompt }],
      function (raw) {
        rpHideLoading();
        try {
          var jsonStr = raw.trim();
          var m = jsonStr.match(/\{[\s\S]*\}/);
          if (m) jsonStr = m[0];
          var post = JSON.parse(jsonStr);
          if (!post.title) throw new Error('empty');
          var newPost = {
            id:      'post_' + Date.now(),
            title:   post.title   || '',
            content: post.content || '',
            ts:      Date.now(),
            replies: (post.replies || []).map(function (r) {
              return {
                name:    r.name    || '路人',
                avatar:  r.avatar  || '👤',
                content: r.content || '',
                ts:      Date.now()
              };
            })
          };
          rpCurrentRoleData.forum.unshift(newPost);
          rpSave(rpCurrentRoleId, rpCurrentRoleData);
          rpRenderForumList();
        } catch (err) {
          alert('生成失败：' + err.message);
        }
      },
      function (err) {
        rpHideLoading();
        alert('API 请求失败：' + err);
      }
    );
  }
});

/* 趣问帖子详情：发送回复 */
document.addEventListener('click', function (e) {
  if (e.target && e.target.id === 'rp-forum-reply-send') {
    var inputEl = document.getElementById('rp-forum-reply-input');
    var text    = inputEl ? inputEl.value.trim() : '';
    if (!text) return;
    var post = (rpCurrentRoleData.forum || []).find(function (p) {
      return p.id === rpCurrentForumPostId;
    });
    if (!post) return;
    if (!post.replies) post.replies = [];
    post.replies.push({
      name:    (rpCurrentRole && (rpCurrentRole.nickname || rpCurrentRole.realname)) || '我',
      avatar:  '💬',
      content: text,
      ts:      Date.now(),
      isRole:  false
    });
    rpSave(rpCurrentRoleId, rpCurrentRoleData);
    if (inputEl) inputEl.value = '';
    rpOpenForumPost(rpCurrentForumPostId);
  }
});

/* ================================================================
   工具函数
   ================================================================ */
function rpFormatTime(ts) {
  if (!ts) return '';
  var now  = Date.now();
  var diff = now - ts;
  if (diff < 60000)    return '刚刚';
  if (diff < 3600000)  return Math.floor(diff / 60000) + '分钟前';
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前';
  var d  = new Date(ts);
  var mo = d.getMonth() + 1;
  var dd = d.getDate();
  return mo + '/' + dd;
}

/* ================================================================
   暴露全局接口
   ================================================================ */
window.RolePhone = {
  open:  rpOpen,
  close: rpClose
};

/* ================================================================
   csb-rolephone 按钮入口（从了了聊天界面打开）
   ================================================================ */
(function bindRpEntry() {
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'csb-rolephone') {
      if (typeof currentChatIdx === 'undefined' || currentChatIdx < 0) {
        alert('请先打开一个聊天');
        return;
      }
      if (typeof liaoChats === 'undefined' || typeof liaoRoles === 'undefined') {
        alert('数据未加载');
        return;
      }
      var chat = liaoChats[currentChatIdx];
      if (!chat) { alert('请先打开一个聊天'); return; }
      rpOpen(chat.roleId);
    }
  });
})();
