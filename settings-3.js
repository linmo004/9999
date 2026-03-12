/* ============================================================
   settings-3.js — 隐私设置 / 密码 / 开发者工具 / 弹窗遮罩
   ============================================================ */

(function attachSettings3() {

  const DEFAULT_PIN_AVATAR = 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=halo9';
  let pinAvatarTab = 'url';

  /* 恢复锁屏头像预览（从 IndexedDB 读取） */
  (async function () {
    /* 优先从 IndexedDB 读，兼容旧的 localStorage */
    const savedIdb = await imgLoad('pinAvatar', null);
    const savedLs  = sLoad('pinAvatar', null);
    const saved    = savedIdb || savedLs;
    const prev     = document.getElementById('privacy-pin-avatar-preview');
    if (saved && prev) prev.src = saved;
    /* 同步到锁屏头像 */
    const pinAvatarEl = document.getElementById('pin-avatar-img');
    if (pinAvatarEl && saved) pinAvatarEl.src = saved;
  })();

  /* 恢复锁屏壁纸预览 */
  (async function () {
    const savedIdb = await imgLoad('lockWallpaper', null);
    const savedLs  = sLoad('lockWallpaper', null);
    const saved    = savedIdb || savedLs;
    applyLockWallpaper(saved);
    const preview = document.getElementById('lock-wallpaper-preview');
    if (preview && saved) {
      preview.style.backgroundImage = 'url(' + saved + ')';
      preview.style.border = 'none';
    }
  })();

  /* ---- 锁屏壁纸 ---- */
  function applyLockWallpaper(src) {
    const lsEl = document.getElementById('lockscreen');
    if (!lsEl) return;
    lsEl.style.backgroundImage    = src ? 'url(' + src + ')' : '';
    lsEl.style.backgroundSize     = src ? 'cover' : '';
    lsEl.style.backgroundPosition = src ? 'center' : '';
  }

  function setPinAvatarTab(tab) {
    pinAvatarTab = tab;
    document.querySelectorAll('[data-pin-avatar-tab]').forEach(b => {
      b.classList.toggle('active', b.dataset.pinAvatarTab === tab);
    });
    const urlPanel   = document.getElementById('pin-avatar-url-panel');
    const localPanel = document.getElementById('pin-avatar-local-panel');
    if (urlPanel)   urlPanel.style.display   = tab === 'url'   ? '' : 'none';
    if (localPanel) localPanel.style.display = tab === 'local' ? '' : 'none';
  }

  document.querySelectorAll('[data-pin-avatar-tab]').forEach(btn => {
    btn.addEventListener('click', function () { setPinAvatarTab(this.dataset.pinAvatarTab); });
  });

  const pinAvatarUrlInput = document.getElementById('privacy-pin-avatar-url');
  if (pinAvatarUrlInput) {
    pinAvatarUrlInput.addEventListener('input', function () {
      const url  = this.value.trim();
      const prev = document.getElementById('privacy-pin-avatar-preview');
      if (url && prev) prev.src = url;
    });
  }

  const pinAvatarFileInput = document.getElementById('privacy-pin-avatar-file');
  if (pinAvatarFileInput) {
    pinAvatarFileInput.addEventListener('change', async function () {
      const file = this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async e => {
        const compressed = await compressImage(e.target.result, 300, 0.85);
        const prev = document.getElementById('privacy-pin-avatar-preview');
        if (prev) prev.src = compressed;
      };
      reader.readAsDataURL(file);
    });
  }

  const pinAvatarSaveBtn = document.getElementById('privacy-pin-avatar-save-btn');
  if (pinAvatarSaveBtn) {
    pinAvatarSaveBtn.addEventListener('click', async function () {
      const msgEl = document.getElementById('privacy-pin-avatar-msg');
      if (!msgEl) return;
      msgEl.style.color = '#e07a7a';

      async function applyAndSave(src) {
        /* 本地图片存 IndexedDB，URL 存 localStorage */
        if (src && src.startsWith('data:')) {
          await imgSave('pinAvatar', src);
          sSave('pinAvatar', null);
        } else {
          sSave('pinAvatar', src);
          await imgDelete('pinAvatar');
        }
        const pinAvatarEl = document.getElementById('pin-avatar-img');
        if (pinAvatarEl) pinAvatarEl.src = src;
        const prev = document.getElementById('privacy-pin-avatar-preview');
        if (prev) prev.src = src;
        msgEl.style.color = '#5aaa7a';
        msgEl.textContent = '头像已保存';
        setTimeout(() => { msgEl.textContent = ''; }, 2000);
      }

      if (pinAvatarTab === 'url') {
        const urlEl = document.getElementById('privacy-pin-avatar-url');
        const url   = urlEl ? urlEl.value.trim() : '';
        if (!url) { msgEl.textContent = '请输入图片 URL'; return; }
        await applyAndSave(url);
      } else {
        const fileEl = document.getElementById('privacy-pin-avatar-file');
        const file   = fileEl ? fileEl.files[0] : null;
        if (!file) { msgEl.textContent = '请选择一张图片'; return; }
        const reader = new FileReader();
        reader.onload = async e => {
          const compressed = await compressImage(e.target.result, 300, 0.85);
          await applyAndSave(compressed);
        };
        reader.readAsDataURL(file);
      }
    });
  }

  const pinAvatarResetBtn = document.getElementById('privacy-pin-avatar-reset-btn');
  if (pinAvatarResetBtn) {
    pinAvatarResetBtn.addEventListener('click', async function () {
      const msgEl = document.getElementById('privacy-pin-avatar-msg');
      sSave('pinAvatar', null);
      await imgDelete('pinAvatar');
      const pinAvatarEl = document.getElementById('pin-avatar-img');
      if (pinAvatarEl) pinAvatarEl.src = DEFAULT_PIN_AVATAR;
      const prev = document.getElementById('privacy-pin-avatar-preview');
      if (prev) prev.src = DEFAULT_PIN_AVATAR;
      const urlInput = document.getElementById('privacy-pin-avatar-url');
      if (urlInput) urlInput.value = '';
      if (msgEl) {
        msgEl.style.color = '#5aaa7a';
        msgEl.textContent = '已恢复默认头像';
        setTimeout(() => { msgEl.textContent = ''; }, 2000);
      }
    });
  }

  /* ---- 锁屏壁纸按钮 ---- */
  const lockWpLocalBtn = document.getElementById('lock-wallpaper-local-btn');
  if (lockWpLocalBtn) {
    lockWpLocalBtn.addEventListener('click', function () {
      const fi = document.getElementById('lock-wallpaper-file-input');
      if (fi) fi.click();
    });
  }

  const lockWpFileInput = document.getElementById('lock-wallpaper-file-input');
  if (lockWpFileInput) {
    lockWpFileInput.addEventListener('change', async function () {
      const file = this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async e => {
        const compressed = await compressImage(e.target.result, 1200, 0.75);
        await imgSave('lockWallpaper', compressed);
        sSave('lockWallpaper', null);
        applyLockWallpaper(compressed);
        const preview = document.getElementById('lock-wallpaper-preview');
        if (preview) {
          preview.style.backgroundImage = 'url(' + compressed + ')';
          preview.style.border = 'none';
        }
        const msgEl = document.getElementById('lock-wallpaper-msg');
        if (msgEl) {
          msgEl.style.color = '#5aaa7a';
          msgEl.textContent = '壁纸已保存';
          setTimeout(() => { msgEl.textContent = ''; }, 2000);
        }
      };
      reader.readAsDataURL(file);
      this.value = '';
    });
  }

  const lockWpUrlBtn = document.getElementById('lock-wallpaper-url-btn');
  if (lockWpUrlBtn) {
    lockWpUrlBtn.addEventListener('click', function () {
      const urlModal = document.getElementById('lock-wallpaper-url-modal');
      if (urlModal) urlModal.classList.add('show');
    });
  }

  const lockWpUrlConfirm = document.getElementById('lock-wallpaper-url-confirm');
  if (lockWpUrlConfirm) {
    lockWpUrlConfirm.addEventListener('click', async function () {
      const urlEl = document.getElementById('lock-wallpaper-url-input');
      const url   = urlEl ? urlEl.value.trim() : '';
      if (!url) return;
      sSave('lockWallpaper', url);
      await imgDelete('lockWallpaper');
      applyLockWallpaper(url);
      const preview = document.getElementById('lock-wallpaper-preview');
      if (preview) {
        preview.style.backgroundImage = 'url(' + url + ')';
        preview.style.border = 'none';
      }
      const urlModal = document.getElementById('lock-wallpaper-url-modal');
      if (urlModal) urlModal.classList.remove('show');
      const msgEl = document.getElementById('lock-wallpaper-msg');
      if (msgEl) {
        msgEl.style.color = '#5aaa7a';
        msgEl.textContent = '壁纸已保存';
        setTimeout(() => { msgEl.textContent = ''; }, 2000);
      }
    });
  }

  const lockWpUrlCancel = document.getElementById('lock-wallpaper-url-cancel');
  if (lockWpUrlCancel) {
    lockWpUrlCancel.addEventListener('click', function () {
      const urlModal = document.getElementById('lock-wallpaper-url-modal');
      if (urlModal) urlModal.classList.remove('show');
    });
  }

  const lockWpClearBtn = document.getElementById('lock-wallpaper-clear-btn');
  if (lockWpClearBtn) {
    lockWpClearBtn.addEventListener('click', async function () {
      sSave('lockWallpaper', null);
      await imgDelete('lockWallpaper');
      applyLockWallpaper('');
      const preview = document.getElementById('lock-wallpaper-preview');
      if (preview) {
        preview.style.backgroundImage = '';
        preview.style.border = '';
      }
      const msgEl = document.getElementById('lock-wallpaper-msg');
      if (msgEl) {
        msgEl.style.color = '#5aaa7a';
        msgEl.textContent = '壁纸已清除';
        setTimeout(() => { msgEl.textContent = ''; }, 2000);
      }
    });
  }

  /* ---- 隐私设置 — 主屏幕密码 ---- */
  const pinSaveBtn = document.getElementById('privacy-pin-save-btn');
  if (pinSaveBtn) {
    pinSaveBtn.addEventListener('click', function () {
      const msgEl  = document.getElementById('privacy-pin-msg');
      const oldEl  = document.getElementById('privacy-old-pin');
      const newEl  = document.getElementById('privacy-new-pin');
      const confEl = document.getElementById('privacy-confirm-pin');
      if (!msgEl) return;
      const oldVal  = oldEl  ? oldEl.value  : '';
      const newVal  = newEl  ? newEl.value  : '';
      const confVal = confEl ? confEl.value : '';
      msgEl.style.color = '#e07a7a';
      if (!oldVal || !newVal || !confVal) { msgEl.textContent = '请填写全部字段'; return; }
      if (!/^\d{6}$/.test(newVal))        { msgEl.textContent = '新密码必须为6位数字'; return; }
      if (newVal !== confVal)             { msgEl.textContent = '两次输入的新密码不一致'; return; }
      if (!window.LockScreen)             { msgEl.textContent = '锁屏模块未加载'; return; }
      const ok = window.LockScreen.changePin(oldVal, newVal);
      if (!ok) { msgEl.textContent = '当前密码错误'; return; }
      msgEl.style.color = '#5aaa7a';
      msgEl.textContent = '密码已更新';
      if (oldEl)  oldEl.value  = '';
      if (newEl)  newEl.value  = '';
      if (confEl) confEl.value = '';
      setTimeout(() => { msgEl.textContent = ''; }, 2000);
    });
  }

  /* ---- 开发者工具 ---- */
  let devLogEnabled = false;
  let devLogEntries = [];

  function devLogWrite(type, content) {
    if (!devLogEnabled) return;
    const now     = new Date();
    const timeStr = String(now.getHours()).padStart(2,'0') + ':' +
      String(now.getMinutes()).padStart(2,'0') + ':' +
      String(now.getSeconds()).padStart(2,'0') + '.' +
      String(now.getMilliseconds()).padStart(3,'0');
    devLogEntries.push({ type, content, time: timeStr });
    const win = document.getElementById('devtools-log-window');
    if (!win) return;
    const line = document.createElement('div');
    line.style.borderBottom  = '1px solid rgba(153,200,237,0.08)';
    line.style.paddingBottom = '4px';
    line.style.marginBottom  = '4px';
    const timeSpan = document.createElement('span');
    timeSpan.className   = 'devlog-entry-time';
    timeSpan.textContent = '[' + timeStr + '] ';
    const contentSpan = document.createElement('span');
    contentSpan.className   = 'devlog-entry-' + type;
    const displayContent    = typeof content === 'string'
      ? content.slice(0, 1200) + (content.length > 1200 ? '…(已截断)' : '')
      : JSON.stringify(content).slice(0, 1200);
    contentSpan.textContent = displayContent;
    line.appendChild(timeSpan);
    line.appendChild(contentSpan);
    win.appendChild(line);
    win.scrollTop = win.scrollHeight;
  }

  window.halo9Log = devLogWrite;

  (function patchFetch() {
    const originalFetch = window.fetch;
    window.fetch = async function (...args) {
      const url      = typeof args[0] === 'string' ? args[0] : (args[0].url || '');
      const isAiCall = url.includes('/chat/completions') || url.includes('/completions');
      if (isAiCall && devLogEnabled) {
        try {
          const body = args[1] && args[1].body ? JSON.parse(args[1].body) : null;
          devLogWrite('request',
            '→ POST ' + url + '\n' +
            '  model: '    + (body && body.model    ? body.model : '?') + '\n' +
            '  messages: ' + (body && body.messages ? body.messages.length : '?') + ' 条');
        } catch (e) {
          devLogWrite('request', '→ POST ' + url);
        }
      }
      let response;
      try {
        response = await originalFetch.apply(this, args);
      } catch (err) {
        if (isAiCall && devLogEnabled) devLogWrite('error', '✗ 网络错误: ' + err.message);
        throw err;
      }
      if (isAiCall && devLogEnabled) {
        response.clone().json().then(json => {
          const content = json.choices && json.choices[0] && json.choices[0].message
            ? json.choices[0].message.content
            : JSON.stringify(json).slice(0, 300);
          devLogWrite('response', '← ' + response.status + ' 回复: ' +
            (typeof content === 'string' ? content.slice(0, 500) : content));
        }).catch(() => {
          devLogWrite('response', '← ' + response.status + ' (无法解析响应体)');
        });
      }
      return response;
    };
  })();

  const devLogToggleBtn = document.getElementById('devtools-log-toggle-btn');
  if (devLogToggleBtn) {
    devLogToggleBtn.addEventListener('click', function () {
      devLogEnabled    = !devLogEnabled;
      this.textContent = devLogEnabled ? '关闭日志记录' : '开启日志记录';
      const statusEl   = document.getElementById('devtools-log-status');
      if (statusEl) {
        statusEl.textContent = '日志记录：' + (devLogEnabled ? '开启（API请求将被记录）' : '关闭');
        statusEl.style.color = devLogEnabled ? '#4caf84' : 'var(--text-light)';
      }
      if (devLogEnabled) devLogWrite('info', '✓ 日志记录已开启，将捕获所有 AI API 请求');
    });
  }

  const devLogClearBtn = document.getElementById('devtools-log-clear-btn');
  if (devLogClearBtn) {
    devLogClearBtn.addEventListener('click', function () {
      devLogEntries = [];
      const win = document.getElementById('devtools-log-window');
      if (win) win.innerHTML = '';
    });
  }

  const devLogExportBtn = document.getElementById('devtools-log-export-btn');
  if (devLogExportBtn) {
    devLogExportBtn.addEventListener('click', function () {
      if (!devLogEntries.length) { alert('暂无日志内容'); return; }
      const lines = devLogEntries.map(e => '[' + e.time + '][' + e.type + '] ' + e.content);
      const blob  = new Blob([lines.join('\n')], { type: 'text/plain' });
      const url   = URL.createObjectURL(blob);
      const a     = document.createElement('a');
      a.href = url; a.download = 'halo9_log_' + Date.now() + '.txt'; a.click();
      URL.revokeObjectURL(url);
    });
  }

  function devtoolsViewKey(keyName) {
    const metaEl    = document.getElementById('devtools-result-meta');
    const contentEl = document.getElementById('devtools-result-content');
    if (!metaEl || !contentEl) return;
    if (keyName === '__all__') {
      const allKeys = [];
      for (let i = 0; i < localStorage.length; i++) allKeys.push(localStorage.key(i));
      metaEl.textContent    = '共 ' + allKeys.length + ' 个键';
      metaEl.style.color    = 'var(--text-mid)';
      contentEl.textContent = allKeys.sort().join('\n');
      return;
    }
    if (!keyName) { contentEl.textContent = '请先选择或输入键名'; return; }
    const raw = localStorage.getItem(keyName);
    if (raw === null) {
      metaEl.style.color    = '#e05c5c';
      metaEl.textContent    = '键名「' + keyName + '」不存在';
      contentEl.textContent = '（该键在 localStorage 中不存在）';
      return;
    }
    metaEl.style.color = '#4caf84';
    try {
      const parsed   = JSON.parse(raw);
      const isArray  = Array.isArray(parsed);
      const typeDesc = isArray
        ? '数组，共 ' + parsed.length + ' 条'
        : (typeof parsed === 'object' ? '对象' : typeof parsed);
      metaEl.textContent = '键：' + keyName + ' | 类型：' + typeDesc + ' | 大小：' + raw.length + ' 字节';
      if (isArray && parsed.length > 0) {
        const summary = parsed.map((item, idx) => {
          if (typeof item === 'object' && item !== null) {
            const name = item.nickname || item.realname || item.name || item.id || item.title || item.content || '';
            const keys = Object.keys(item).slice(0, 5).join(', ');
            return '[' + idx + '] ' + (name ? '「' + String(name).slice(0, 30) + '」 ' : '') + '{' + keys + '}';
          }
          return '[' + idx + '] ' + String(item).slice(0, 50);
        }).join('\n');
        contentEl.textContent = '── 摘要 ──\n' + summary +
          '\n\n── 完整数据（前3条）──\n' + JSON.stringify(parsed.slice(0, 3), null, 2);
      } else {
        contentEl.textContent = JSON.stringify(parsed, null, 2).slice(0, 3000);
      }
    } catch (e) {
      metaEl.style.color    = '#e05c5c';
      metaEl.textContent    = '键：' + keyName + ' | JSON解析失败 | 大小：' + raw.length + ' 字节';
      contentEl.textContent = raw.slice(0, 500);
    }
  }

  const devtoolsViewBtn = document.getElementById('devtools-view-btn');
  if (devtoolsViewBtn) {
    devtoolsViewBtn.addEventListener('click', function () {
      const sel = document.getElementById('devtools-key-select');
      if (sel) devtoolsViewKey(sel.value);
    });
  }

  function refreshAllKeysList() {
    const container = document.getElementById('devtools-all-keys');
    if (!container) return;
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
    keys.sort();
    if (!keys.length) { container.textContent = '（localStorage 为空）'; return; }
    container.innerHTML = '';
    keys.forEach(k => {
      const size = (localStorage.getItem(k) || '').length;
      const span = document.createElement('span');
      span.style.cssText = 'display:block;padding:2px 0;border-bottom:1px solid rgba(153,200,237,0.1);';
      const bold = document.createElement('b');
      bold.textContent = k;
      const sizeSpan = document.createElement('span');
      sizeSpan.style.cssText = 'color:#9aafc4;margin-left:8px;';
      sizeSpan.textContent = size + ' 字节';
      span.appendChild(bold);
      span.appendChild(sizeSpan);
      container.appendChild(span);
    });
  }

  const devtoolsListAllBtn = document.getElementById('devtools-list-all-btn');
  if (devtoolsListAllBtn) devtoolsListAllBtn.addEventListener('click', refreshAllKeysList);

  const devtoolsRefreshKeysBtn = document.getElementById('devtools-refresh-keys-btn');
  if (devtoolsRefreshKeysBtn) devtoolsRefreshKeysBtn.addEventListener('click', refreshAllKeysList);

  const devtoolsFixRolesBtn = document.getElementById('devtools-fix-roles-btn');
  if (devtoolsFixRolesBtn) {
    devtoolsFixRolesBtn.addEventListener('click', function () {
      const msgEl         = document.getElementById('devtools-fix-msg');
      const candidateKeys = ['liao_roles', 'halo9_roles', 'roles'];
      let found = null, foundKey = '';
      for (let i = 0; i < candidateKeys.length; i++) {
        try {
          const raw = localStorage.getItem(candidateKeys[i]);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length > 0) { found = parsed; foundKey = candidateKeys[i]; break; }
        } catch (e) {}
      }
      if (!found) {
        if (msgEl) { msgEl.style.color = '#e05c5c'; msgEl.textContent = '未找到任何角色数据，请先在了了中创建角色。'; }
        return;
      }
      try {
        const jsonStr = JSON.stringify(found);
        localStorage.setItem('liao_roles',  jsonStr);
        localStorage.setItem('halo9_roles', jsonStr);
        if (msgEl) {
          msgEl.style.color = '#4caf84';
          msgEl.textContent = '修复成功！从「' + foundKey + '」读取了 ' + found.length + ' 个角色，已同步写入 liao_roles 和 halo9_roles。';
        }
      } catch (e) {
        if (msgEl) { msgEl.style.color = '#e05c5c'; msgEl.textContent = '写入失败：' + e.message; }
      }
      if (msgEl) setTimeout(() => { msgEl.textContent = ''; }, 5000);
    });
  }

  const devtoolsCustomViewBtn = document.getElementById('devtools-custom-view-btn');
  if (devtoolsCustomViewBtn) {
    devtoolsCustomViewBtn.addEventListener('click', function () {
      const keyEl = document.getElementById('devtools-custom-key');
      const key   = keyEl ? keyEl.value.trim() : '';
      if (!key) { alert('请输入键名'); return; }
      devtoolsViewKey(key);
    });
  }

  const devtoolsCustomDeleteBtn = document.getElementById('devtools-custom-delete-btn');
  if (devtoolsCustomDeleteBtn) {
    devtoolsCustomDeleteBtn.addEventListener('click', function () {
      const keyEl = document.getElementById('devtools-custom-key');
      const key   = keyEl ? keyEl.value.trim() : '';
      if (!key) { alert('请输入键名'); return; }
      if (!confirm('确定要删除键「' + key + '」吗？此操作不可恢复。')) return;
      localStorage.removeItem(key);
      alert('已删除键：' + key);
      refreshAllKeysList();
    });
  }

  const devtoolsHardRefreshBtn = document.getElementById('devtools-hard-refresh-btn');
  if (devtoolsHardRefreshBtn) {
    devtoolsHardRefreshBtn.addEventListener('click', function () {
      const msgEl = document.getElementById('devtools-refresh-msg');
      if (msgEl) { msgEl.style.color = '#4caf84'; msgEl.textContent = '正在清除缓存并强制刷新…'; }
      if (typeof caches !== 'undefined') {
        caches.keys().then(function (keyList) {
          return Promise.all(keyList.map(function (key) { return caches.delete(key); }));
        }).then(function () {
          location.reload(true);
        }).catch(function () {
          location.reload(true);
        });
      } else {
        location.reload(true);
      }
    });
  }

  const devtoolsSwClearBtn = document.getElementById('devtools-sw-clear-btn');
  if (devtoolsSwClearBtn) {
    devtoolsSwClearBtn.addEventListener('click', function () {
      const msgEl = document.getElementById('devtools-refresh-msg');
      if (!('serviceWorker' in navigator)) {
        if (msgEl) { msgEl.style.color = '#e05c5c'; msgEl.textContent = '当前浏览器不支持 ServiceWorker'; }
        return;
      }
      navigator.serviceWorker.getRegistrations().then(function (registrations) {
        if (!registrations.length) {
          if (msgEl) { msgEl.style.color = '#f0c060'; msgEl.textContent = '没有发现已注册的 ServiceWorker'; }
          return;
        }
        return Promise.all(registrations.map(function (reg) { return reg.unregister(); }))
          .then(function () {
            if (typeof caches !== 'undefined') {
              return caches.keys().then(function (keys) {
                return Promise.all(keys.map(function (k) { return caches.delete(k); }));
              });
            }
          }).then(function () {
            if (msgEl) {
              msgEl.style.color = '#4caf84';
              msgEl.textContent = '已清除 ' + registrations.length + ' 个 ServiceWorker 及全部缓存，即将刷新…';
            }
            setTimeout(function () { location.reload(true); }, 1200);
          });
        }).catch(function (e) {
        if (msgEl) { msgEl.style.color = '#e05c5c'; msgEl.textContent = '清除失败：' + e.message; }
      });
    });
  }

  /* ---- 弹窗遮罩点击关闭 ---- */
  ['wallpaper-url-modal', 'wallpaper2-url-modal', 'wallpaper3-url-modal',
   'icon-replace-modal', 'lock-wallpaper-url-modal'].forEach(id => {
    const mask = document.getElementById(id);
    if (mask) {
      mask.addEventListener('click', function (e) {
        if (e.target === this) this.classList.remove('show');
      });
    }
  });

  const storageEntryBtn = document.getElementById('settings-storage-entry');
  if (storageEntryBtn) {
    storageEntryBtn.addEventListener('click', function () {
      if (window.StorageManager) window.StorageManager.open();
    });
  }

  window.refreshAllKeysList = refreshAllKeysList;
  window.setPinAvatarTab    = setPinAvatarTab;
  window.DEFAULT_PIN_AVATAR = DEFAULT_PIN_AVATAR;

})();
