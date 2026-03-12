/* ============================================================
   settings-2.js — initSettings 主体
   导航 / API设置 / 美化主题 / 数据管理
   ============================================================ */

window.initSettings = function () {

  /* 壁纸现在从 IndexedDB 异步加载 */
  let wallpaperSrc  = '';
  let wallpaper2Src = '';
  let wallpaper3Src = '';

  /* ---- 层级导航 ---- */
  function showLayer(id) {
    document.querySelectorAll('.settings-layer').forEach(el => { el.style.display = 'none'; });
    const el = document.getElementById(id);
    if (el) el.style.display = 'flex';
  }
  function hideAllSettings() {
    document.querySelectorAll('.settings-layer').forEach(el => { el.style.display = 'none'; });
  }

  const dockSettings = document.getElementById('dock-settings');
  if (dockSettings) dockSettings.addEventListener('click', () => showLayer('settings-root'));
  document.querySelectorAll('[data-app="settings"]').forEach(el => {
    el.addEventListener('click', () => showLayer('settings-root'));
  });

  const rootClose = document.getElementById('settings-root-close');
  if (rootClose) rootClose.addEventListener('click', hideAllSettings);

  document.querySelectorAll('.settings-back-btn[data-back]').forEach(btn => {
    btn.addEventListener('click', function () { showLayer(this.dataset.back); });
  });

  const gotoApi = document.getElementById('goto-api');
  if (gotoApi) gotoApi.addEventListener('click', () => {
    renderApiArchiveList();
    showLayer('settings-api');
  });

  const gotoTheme = document.getElementById('goto-theme');
  if (gotoTheme) gotoTheme.addEventListener('click', () => {
    renderIconReplaceList();
    renderColorFields();
    renderAppNameFields();
    renderAffinityColorFields();
    initWallpaper2Preview();
    initWallpaper3Preview();
    initDockStyleFields();
    showLayer('settings-theme');
  });

  const gotoData = document.getElementById('goto-data');
  if (gotoData) gotoData.addEventListener('click', () => showLayer('settings-data'));

  const gotoPrivacyBtn = document.getElementById('goto-privacy');
  if (gotoPrivacyBtn) gotoPrivacyBtn.addEventListener('click', () => {
    const saved = sLoad('pinAvatar', null);
    const prev  = document.getElementById('privacy-pin-avatar-preview');
    if (prev) prev.src = saved || DEFAULT_PIN_AVATAR;
    setPinAvatarTab('url');
    const urlInput = document.getElementById('privacy-pin-avatar-url');
    if (urlInput) urlInput.value = '';
    showLayer('settings-privacy');
  });

  const gotoDevtools = document.getElementById('goto-devtools');
  if (gotoDevtools) gotoDevtools.addEventListener('click', () => {
    refreshAllKeysList();
    showLayer('settings-devtools');
  });

  /* ---- ① API 设置 ---- */
  let apiArchives = sLoad('apiArchives', []);

  function renderApiArchiveList() {
    const container = document.getElementById('api-archive-list');
    if (!container) return;
    if (!apiArchives.length) {
      container.innerHTML = '<div class="settings-desc" style="padding:4px 0;">暂无存档，保存后显示在这里</div>';
      return;
    }
    container.innerHTML = '';
    apiArchives.forEach((arc, idx) => {
      const row  = document.createElement('div');
      row.className = 'api-archive-item';
      const info = document.createElement('div');
      info.className   = 'api-archive-info';
      info.dataset.idx = idx;
      const nameDiv = document.createElement('div');
      nameDiv.className   = 'api-archive-name';
      nameDiv.textContent = arc.name || '未命名';
      const urlDiv = document.createElement('div');
      urlDiv.className   = 'api-archive-url';
      urlDiv.textContent = arc.url || '';
      info.appendChild(nameDiv);
      info.appendChild(urlDiv);
      const delBtn = document.createElement('button');
      delBtn.className   = 'api-archive-del';
      delBtn.dataset.del = idx;
      delBtn.textContent = '删除';
      row.appendChild(info);
      row.appendChild(delBtn);
      container.appendChild(row);
    });
    container.querySelectorAll('.api-archive-info').forEach(info => {
      info.addEventListener('click', function () {
        const arc = apiArchives[parseInt(this.dataset.idx)];
        const nE = document.getElementById('api-config-name');
        const uE = document.getElementById('api-url');
        const kE = document.getElementById('api-key');
        if (nE) nE.value = arc.name || '';
        if (uE) uE.value = arc.url  || '';
        if (kE) kE.value = arc.key  || '';
        setApiModelVisible(false);
        setApiStatus('');
      });
    });
    container.querySelectorAll('.api-archive-del').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        apiArchives.splice(parseInt(this.dataset.del), 1);
        sSave('apiArchives', apiArchives);
        renderApiArchiveList();
      });
    });
  }

  function setApiStatus(msg, type) {
    const el = document.getElementById('api-fetch-status');
    if (!el) return;
    el.textContent = msg || '';
    el.className   = 'api-status-text' + (type ? ' ' + type : '');
  }

  function setApiModelVisible(show) {
    const label  = document.getElementById('api-model-label');
    const select = document.getElementById('api-model-select');
    const btn    = document.getElementById('api-model-confirm-btn');
    if (label)  label.style.display  = show ? '' : 'none';
    if (select) select.style.display = show ? '' : 'none';
    if (btn)    btn.style.display    = show ? '' : 'none';
  }

  const apiFetchBtn = document.getElementById('api-fetch-models-btn');
  if (apiFetchBtn) {
    apiFetchBtn.addEventListener('click', async function () {
      const urlEl = document.getElementById('api-url');
      const keyEl = document.getElementById('api-key');
      const url = urlEl ? urlEl.value.trim() : '';
      const key = keyEl ? keyEl.value.trim() : '';
      if (!url) { setApiStatus('请先填写 API 地址', 'error'); return; }
      setApiStatus('正在请求模型列表…');
      this.disabled = true;
      try {
        const endpoint = url.replace(/\/$/, '') + '/models';
        const headers  = { 'Content-Type': 'application/json' };
        if (key) headers['Authorization'] = 'Bearer ' + key;
        const res = await fetch(endpoint, { headers });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const json = await res.json();
        let models = [];
        if (Array.isArray(json.data))        models = json.data.map(m => m.id || m.name).filter(Boolean);
        else if (Array.isArray(json.models)) models = json.models.map(m => m.name || m.id).filter(Boolean);
        else if (Array.isArray(json))        models = json.map(m => m.id || m.name).filter(Boolean);
        if (!models.length) throw new Error('未获取到模型列表');
        const sel = document.getElementById('api-model-select');
        if (sel) {
          sel.innerHTML = '';
          models.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m; opt.textContent = m;
            sel.appendChild(opt);
          });
        }
        setApiModelVisible(true);
        setApiStatus('获取到 ' + models.length + ' 个模型', 'success');
      } catch (err) {
        setApiStatus('请求失败：' + err.message, 'error');
        setApiModelVisible(false);
      } finally {
        this.disabled = false;
      }
    });
  }

  const apiModelConfirmBtn = document.getElementById('api-model-confirm-btn');
  if (apiModelConfirmBtn) {
    apiModelConfirmBtn.addEventListener('click', function () {
      const sel = document.getElementById('api-model-select');
      if (!sel) return;
      sSave('apiCurrentModel', sel.value);
      setApiStatus('已选择模型：' + sel.value, 'success');
    });
  }

  const apiSaveBtn = document.getElementById('api-save-btn');
  if (apiSaveBtn) {
    apiSaveBtn.addEventListener('click', function () {
      const nE   = document.getElementById('api-config-name');
      const uE   = document.getElementById('api-url');
      const kE   = document.getElementById('api-key');
      const name = (nE ? nE.value.trim() : '') || ('配置' + (apiArchives.length + 1));
      const url  = uE ? uE.value.trim() : '';
      const key  = kE ? kE.value.trim() : '';
      if (!url) { setApiStatus('API 地址不能为空', 'error'); return; }
      const existing = apiArchives.findIndex(a => a.name === name);
      if (existing >= 0) apiArchives[existing] = { name, url, key };
      else apiArchives.push({ name, url, key });
      sSave('apiArchives', apiArchives);
      sSave('apiActiveConfig', { name, url, key });
      renderApiArchiveList();
      setApiStatus('配置已保存', 'success');
    });
  }

  (function () {
    const active = sLoad('apiActiveConfig', null);
    if (!active) return;
    const nE = document.getElementById('api-config-name');
    const uE = document.getElementById('api-url');
    const kE = document.getElementById('api-key');
    if (nE) nE.value = active.name || '';
    if (uE) uE.value = active.url  || '';
    if (kE) kE.value = active.key  || '';
  })();

  /* ---- ② 美化 / 主题 ---- */

  (function () {
    const DARK_KEY = 'halo9_darkMode';
    function applyDarkMode(on) { document.body.classList.toggle('dark-mode', on); }
    const on     = localStorage.getItem(DARK_KEY) === 'true';
    const toggle = document.getElementById('dark-mode-toggle');
    if (toggle) toggle.checked = on;
    applyDarkMode(on);
    if (toggle) {
      toggle.addEventListener('change', function () {
        localStorage.setItem(DARK_KEY, this.checked ? 'true' : 'false');
        applyDarkMode(this.checked);
      });
    }
  })();

  function setPage2Wallpaper(src) {
    const p2 = document.getElementById('page2');
    if (!p2) return;
    p2.style.backgroundImage    = src ? 'url(' + src + ')' : '';
    p2.style.backgroundSize     = src ? 'cover' : '';
    p2.style.backgroundPosition = src ? 'center' : '';
  }

  function setPage3Wallpaper(src) {
    const p3 = document.getElementById('page3');
    if (!p3) return;
    p3.style.backgroundImage    = src ? 'url(' + src + ')' : '';
    p3.style.backgroundSize     = src ? 'cover' : '';
    p3.style.backgroundPosition = src ? 'center' : '';
  }

  function applyWallpaper2Fallback() {
    if (!wallpaper2Src) setPage2Wallpaper(wallpaperSrc);
  }

  function applyWallpaper3Fallback() {
    if (!wallpaper3Src) setPage3Wallpaper(wallpaperSrc);
  }

  function applyWallpaper(src) {
    wallpaperSrc = src;
    /* 壁纸存储：URL 用 localStorage，本地图片用 IndexedDB */
    if (src && src.startsWith('data:')) {
      imgSave('wallpaper', src);
      sSave('wallpaper', '');
    } else {
      sSave('wallpaper', src);
      imgDelete('wallpaper');
    }
    document.body.style.backgroundImage    = src ? 'url(' + src + ')' : '';
    document.body.style.backgroundSize     = src ? 'cover' : '';
    document.body.style.backgroundPosition = src ? 'center' : '';
    const preview = document.getElementById('wallpaper-preview');
    if (preview) {
      preview.style.backgroundImage = src ? 'url(' + src + ')' : '';
      preview.style.border          = src ? 'none' : '';
    }
    applyWallpaper2Fallback();
    applyWallpaper3Fallback();
  }

  function applyWallpaper2(src) {
    wallpaper2Src = src;
    if (src && src.startsWith('data:')) {
      imgSave('wallpaper2', src);
      sSave('wallpaper2', '');
    } else {
      sSave('wallpaper2', src);
      imgDelete('wallpaper2');
    }
    setPage2Wallpaper(src || wallpaperSrc);
    const preview = document.getElementById('wallpaper2-preview');
    if (preview) {
      const ds = src || wallpaperSrc;
      preview.style.backgroundImage = ds ? 'url(' + ds + ')' : '';
      preview.style.border          = ds ? 'none' : '';
    }
  }

  function applyWallpaper3(src) {
    wallpaper3Src = src;
    if (src && src.startsWith('data:')) {
      imgSave('wallpaper3', src);
      sSave('wallpaper3', '');
    } else {
      sSave('wallpaper3', src);
      imgDelete('wallpaper3');
    }
    setPage3Wallpaper(src || wallpaperSrc);
    const preview = document.getElementById('wallpaper3-preview');
    if (preview) {
      const ds = src || wallpaperSrc;
      preview.style.backgroundImage = ds ? 'url(' + ds + ')' : '';
      preview.style.border          = ds ? 'none' : '';
    }
  }

  function initWallpaper2Preview() {
    const preview = document.getElementById('wallpaper2-preview');
    if (!preview) return;
    const ds = wallpaper2Src || wallpaperSrc;
    preview.style.backgroundImage = ds ? 'url(' + ds + ')' : '';
    preview.style.border          = ds ? 'none' : '';
  }

  function initWallpaper3Preview() {
    const preview = document.getElementById('wallpaper3-preview');
    if (!preview) return;
    const ds = wallpaper3Src || wallpaperSrc;
    preview.style.backgroundImage = ds ? 'url(' + ds + ')' : '';
    preview.style.border          = ds ? 'none' : '';
  }

  /* 启动时异步加载壁纸 */
  (async function loadWallpapers() {
    /* 优先读 IndexedDB，没有再读 localStorage */
    const w1db = await imgLoad('wallpaper',  null);
    const w1ls = sLoad('wallpaper',  '');
    wallpaperSrc = w1db || w1ls || '';

    const w2db = await imgLoad('wallpaper2', null);
    const w2ls = sLoad('wallpaper2', '');
    wallpaper2Src = w2db || w2ls || '';

    const w3db = await imgLoad('wallpaper3', null);
    const w3ls = sLoad('wallpaper3', '');
    wallpaper3Src = w3db || w3ls || '';

    /* 应用到页面（不触发再次写入，直接操作 DOM） */
    if (wallpaperSrc) {
      document.body.style.backgroundImage    = 'url(' + wallpaperSrc + ')';
      document.body.style.backgroundSize     = 'cover';
      document.body.style.backgroundPosition = 'center';
    }
    if (wallpaper2Src || wallpaperSrc) setPage2Wallpaper(wallpaper2Src || wallpaperSrc);
    if (wallpaper3Src || wallpaperSrc) setPage3Wallpaper(wallpaper3Src || wallpaperSrc);
  })();

  /* 主页壁纸按钮 */
  const wpUrlBtn = document.getElementById('wallpaper-url-btn');
  if (wpUrlBtn) wpUrlBtn.addEventListener('click', function () {
    const inp = document.getElementById('wallpaper-url-input');
    if (inp) inp.value = wallpaperSrc && !wallpaperSrc.startsWith('data:') ? wallpaperSrc : '';
    const modal = document.getElementById('wallpaper-url-modal');
    if (modal) modal.classList.add('show');
  });
  const wpUrlConfirm = document.getElementById('wallpaper-url-confirm');
  if (wpUrlConfirm) wpUrlConfirm.addEventListener('click', function () {
    const inp = document.getElementById('wallpaper-url-input');
    if (inp) applyWallpaper(inp.value.trim());
    const modal = document.getElementById('wallpaper-url-modal');
    if (modal) modal.classList.remove('show');
  });
  const wpUrlCancel = document.getElementById('wallpaper-url-cancel');
  if (wpUrlCancel) wpUrlCancel.addEventListener('click', function () {
    const modal = document.getElementById('wallpaper-url-modal');
    if (modal) modal.classList.remove('show');
  });
  const wpLocalBtn = document.getElementById('wallpaper-local-btn');
  if (wpLocalBtn) wpLocalBtn.addEventListener('click', function () {
    const fi = document.getElementById('wallpaper-file-input');
    if (fi) fi.click();
  });
  const wpFileInput = document.getElementById('wallpaper-file-input');
  if (wpFileInput) wpFileInput.addEventListener('change', async function () {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
      /* 壁纸压缩后存 IndexedDB */
      const compressed = await compressImage(e.target.result, 1200, 0.75);
      applyWallpaper(compressed);
    };
    reader.readAsDataURL(file);
    this.value = '';
  });
  const wpClearBtn = document.getElementById('wallpaper-clear-btn');
  if (wpClearBtn) wpClearBtn.addEventListener('click', () => applyWallpaper(''));

  /* 第二页壁纸按钮 */
  const wp2UrlBtn = document.getElementById('wallpaper2-url-btn');
  if (wp2UrlBtn) wp2UrlBtn.addEventListener('click', function () {
    const inp = document.getElementById('wallpaper2-url-input');
    if (inp) inp.value = wallpaper2Src && !wallpaper2Src.startsWith('data:') ? wallpaper2Src : '';
    const modal = document.getElementById('wallpaper2-url-modal');
    if (modal) modal.classList.add('show');
  });
  const wp2UrlConfirm = document.getElementById('wallpaper2-url-confirm');
  if (wp2UrlConfirm) wp2UrlConfirm.addEventListener('click', function () {
    const inp = document.getElementById('wallpaper2-url-input');
    if (inp) applyWallpaper2(inp.value.trim());
    const modal = document.getElementById('wallpaper2-url-modal');
    if (modal) modal.classList.remove('show');
  });
  const wp2UrlCancel = document.getElementById('wallpaper2-url-cancel');
  if (wp2UrlCancel) wp2UrlCancel.addEventListener('click', function () {
    const modal = document.getElementById('wallpaper2-url-modal');
    if (modal) modal.classList.remove('show');
  });
  const wp2LocalBtn = document.getElementById('wallpaper2-local-btn');
  if (wp2LocalBtn) wp2LocalBtn.addEventListener('click', function () {
    const fi = document.getElementById('wallpaper2-file-input');
    if (fi) fi.click();
  });
  const wp2FileInput = document.getElementById('wallpaper2-file-input');
  if (wp2FileInput) wp2FileInput.addEventListener('change', async function () {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
      const compressed = await compressImage(e.target.result, 1200, 0.75);
      applyWallpaper2(compressed);
    };
    reader.readAsDataURL(file);
    this.value = '';
  });
  const wp2ClearBtn = document.getElementById('wallpaper2-clear-btn');
  if (wp2ClearBtn) wp2ClearBtn.addEventListener('click', () => applyWallpaper2(''));

  /* 第三页壁纸按钮 */
  const wp3UrlBtn = document.getElementById('wallpaper3-url-btn');
  if (wp3UrlBtn) wp3UrlBtn.addEventListener('click', function () {
    const inp = document.getElementById('wallpaper3-url-input');
    if (inp) inp.value = wallpaper3Src && !wallpaper3Src.startsWith('data:') ? wallpaper3Src : '';
    const modal = document.getElementById('wallpaper3-url-modal');
    if (modal) modal.classList.add('show');
  });
  const wp3UrlConfirm = document.getElementById('wallpaper3-url-confirm');
  if (wp3UrlConfirm) wp3UrlConfirm.addEventListener('click', function () {
    const inp = document.getElementById('wallpaper3-url-input');
    if (inp) applyWallpaper3(inp.value.trim());
    const modal = document.getElementById('wallpaper3-url-modal');
    if (modal) modal.classList.remove('show');
  });
  const wp3UrlCancel = document.getElementById('wallpaper3-url-cancel');
  if (wp3UrlCancel) wp3UrlCancel.addEventListener('click', function () {
    const modal = document.getElementById('wallpaper3-url-modal');
    if (modal) modal.classList.remove('show');
  });
  const wp3LocalBtn = document.getElementById('wallpaper3-local-btn');
  if (wp3LocalBtn) wp3LocalBtn.addEventListener('click', function () {
    const fi = document.getElementById('wallpaper3-file-input');
    if (fi) fi.click();
  });
  const wp3FileInput = document.getElementById('wallpaper3-file-input');
  if (wp3FileInput) wp3FileInput.addEventListener('change', async function () {
    const file = this.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async e => {
      const compressed = await compressImage(e.target.result, 1200, 0.75);
      applyWallpaper3(compressed);
    };
    reader.readAsDataURL(file);
    this.value = '';
  });
  const wp3ClearBtn = document.getElementById('wallpaper3-clear-btn');
  if (wp3ClearBtn) wp3ClearBtn.addEventListener('click', () => applyWallpaper3(''));

  /* App 名称修改 */
  const appNameRegistry = [
    { key: 'app-name-dock-chat',     selector: '#dock-chat .app-name',             default: '了了'   },
    { key: 'app-name-dock-home',     selector: '#dock-home .app-name',             default: '家园'   },
    { key: 'app-name-dock-settings', selector: '#dock-settings .app-name',         default: '设置'   },
    { key: 'app-name-chat',          selector: '[data-app="chat"] .app-name',      default: '了了'   },
    { key: 'app-name-settings',      selector: '[data-app="settings"] .app-name',  default: '设置'   },
    { key: 'app-name-music',         selector: '[data-app="0"] .app-name',         default: '音乐'   },
    { key: 'app-name-worldbook',     selector: '[data-app="worldbook"] .app-name', default: '世界书' },
    { key: 'app-name-calendar',      selector: '[data-app="2"] .app-name',         default: '日历'   },
    { key: 'app-name-gallery',       selector: '[data-app="3"] .app-name',         default: '相册'   },
    { key: 'app-name-p2-app-0',      selector: '[data-app="p2-app-0"] .app-name',  default: '备忘录' },
    { key: 'app-name-p2-app-1',      selector: '[data-app="p2-app-1"] .app-name',  default: '闹钟'   },
    { key: 'app-name-p2-app-2',      selector: '[data-app="p2-app-2"] .app-name',  default: '地图'   },
    { key: 'app-name-p2-app-3',      selector: '[data-app="p2-app-3"] .app-name',  default: '收藏'   },
    { key: 'app-name-p3-weather',    selector: '[data-app="p3-weather"] .app-name',    default: '天气'   },
    { key: 'app-name-p3-calculator', selector: '[data-app="p3-calculator"] .app-name', default: '计算器' },
    { key: 'app-name-p3-gallery',    selector: '[data-app="p3-gallery"] .app-name',    default: '相册'   },
    { key: 'app-name-p3-calendar',   selector: '[data-app="p3-calendar"] .app-name',   default: '日历'   },
    { key: 'app-name-p3-alarm',      selector: '[data-app="p3-alarm"] .app-name',      default: '闹钟'   },
    { key: 'app-name-p3-map',        selector: '[data-app="p3-map"] .app-name',        default: '地图'   },
    { key: 'app-name-p3-shop',       selector: '[data-app="p3-shop"] .app-name',       default: '购物'   },
    { key: 'app-name-p3-health',     selector: '[data-app="p3-health"] .app-name',     default: '健康'   },
    { key: 'app-name-p3-note',       selector: '[data-app="p3-note"] .app-name',       default: '笔记'   },
    { key: 'app-name-p3-music',      selector: '[data-app="p3-music"] .app-name',      default: '音乐'   },
    { key: 'app-name-p3-video',      selector: '[data-app="p3-video"] .app-name',      default: '视频'   },
    { key: 'app-name-p3-game',       selector: '[data-app="p3-game"] .app-name',       default: '游戏'   },
  ];
  let customAppNames = sLoad('customAppNames', {});

  function applyAllAppNames() {
    appNameRegistry.forEach(reg => {
      const val = customAppNames[reg.key];
      if (val !== undefined) {
        document.querySelectorAll(reg.selector).forEach(el => { el.textContent = val; });
      }
    });
  }
  applyAllAppNames();

  function renderAppNameFields() {
    const container = document.getElementById('app-name-fields');
    if (!container) return;
    container.innerHTML = '';
    appNameRegistry.forEach(reg => {
      const currentVal = customAppNames[reg.key] !== undefined ? customAppNames[reg.key] : reg.default;
      const iconEl = document.querySelector(reg.selector.replace('.app-name', '.app-icon'));
      const row = document.createElement('div');
      row.className = 'app-name-row';
      const img = document.createElement('img');
      img.className = 'app-name-row-icon';
      img.alt = '';
      if (iconEl) img.src = iconEl.src;
      const label = document.createElement('span');
      label.className   = 'app-name-row-label';
      label.textContent = reg.default;
      const input = document.createElement('input');
      input.className   = 'app-name-row-input';
      input.dataset.key = reg.key;
      input.value       = currentVal;
      input.placeholder = reg.default;
      row.appendChild(img);
      row.appendChild(label);
      row.appendChild(input);
      container.appendChild(row);
    });
  }

  const appNameSaveBtn = document.getElementById('app-name-save-btn');
  if (appNameSaveBtn) {
    appNameSaveBtn.addEventListener('click', function () {
      const container = document.getElementById('app-name-fields');
      if (!container) return;
      container.querySelectorAll('.app-name-row-input').forEach(input => {
        const val = input.value.trim();
        if (val) customAppNames[input.dataset.key] = val;
        else delete customAppNames[input.dataset.key];
      });
      sSave('customAppNames', customAppNames);
      applyAllAppNames();
      alert('App名称已保存');
    });
  }

  const appNameResetBtn = document.getElementById('app-name-reset-btn');
  if (appNameResetBtn) {
    appNameResetBtn.addEventListener('click', function () {
      customAppNames = {};
      sSave('customAppNames', {});
      appNameRegistry.forEach(reg => {
        document.querySelectorAll(reg.selector).forEach(el => { el.textContent = reg.default; });
      });
      renderAppNameFields();
      alert('已恢复默认名称');
    });
  }

  /* App 图标替换 */
  const iconRegistry = [
    { key: 'dock-chat',     label: 'Dock · 了了',       selector: '#dock-chat .app-icon'             },
    { key: 'dock-home',     label: 'Dock · 家园',       selector: '#dock-home .app-icon'             },
    { key: 'dock-settings', label: 'Dock · 设置',       selector: '#dock-settings .app-icon'         },
    { key: 'app2-chat',     label: '了了 App',           selector: '[data-app="chat"] .app-icon'      },
    { key: 'app2-settings', label: '设置 App',           selector: '[data-app="settings"] .app-icon'  },
    { key: 'app4-0',        label: '音乐',               selector: '[data-app="0"] .app-icon'         },
    { key: 'app4-wb',       label: '世界书',             selector: '[data-app="worldbook"] .app-icon' },
    { key: 'app4-2',        label: '日历',               selector: '[data-app="2"] .app-icon'         },
    { key: 'app4-3',        label: '相册',               selector: '[data-app="3"] .app-icon'         },
    { key: 'p2-app-0',      label: '第二页 · 备忘录',    selector: '[data-app="p2-app-0"] .app-icon'  },
    { key: 'p2-app-1',      label: '第二页 · 闹钟',      selector: '[data-app="p2-app-1"] .app-icon'  },
    { key: 'p2-app-2',      label: '第二页 · 地图',      selector: '[data-app="p2-app-2"] .app-icon'  },
    { key: 'p2-app-3',      label: '第二页 · 收藏',      selector: '[data-app="p2-app-3"] .app-icon'  },
    { key: 'p3-weather',    label: '第三页 · 天气',      selector: '[data-app="p3-weather"] .app-icon'    },
    { key: 'p3-calculator', label: '第三页 · 计算器',    selector: '[data-app="p3-calculator"] .app-icon' },
    { key: 'p3-gallery',    label: '第三页 · 相册',      selector: '[data-app="p3-gallery"] .app-icon'    },
    { key: 'p3-calendar',   label: '第三页 · 日历',      selector: '[data-app="p3-calendar"] .app-icon'   },
    { key: 'p3-alarm',      label: '第三页 · 闹钟',      selector: '[data-app="p3-alarm"] .app-icon'      },
    { key: 'p3-map',        label: '第三页 · 地图',      selector: '[data-app="p3-map"] .app-icon'        },
    { key: 'p3-shop',       label: '第三页 · 购物',      selector: '[data-app="p3-shop"] .app-icon'       },
    { key: 'p3-health',     label: '第三页 · 健康',      selector: '[data-app="p3-health"] .app-icon'     },
    { key: 'p3-note',       label: '第三页 · 笔记',      selector: '[data-app="p3-note"] .app-icon'       },
    { key: 'p3-music',      label: '第三页 · 音乐',      selector: '[data-app="p3-music"] .app-icon'      },
    { key: 'p3-video',      label: '第三页 · 视频',      selector: '[data-app="p3-video"] .app-icon'      },
    { key: 'p3-game',       label: '第三页 · 游戏',      selector: '[data-app="p3-game"] .app-icon'       },
  ];
  let customIcons = sLoad('customIcons', {});
  let iconEditKey = '';
  let iconTab     = 'url';

  function restoreAllIcons() {
    iconRegistry.forEach(reg => {
      if (customIcons[reg.key]) {
        document.querySelectorAll(reg.selector).forEach(el => { el.src = customIcons[reg.key]; });
      }
    });
  }
  restoreAllIcons();

  function renderIconReplaceList() {
    const container = document.getElementById('icon-replace-list');
    if (!container) return;
    container.innerHTML = '';
    iconRegistry.forEach(reg => {
      const iconEl     = document.querySelector(reg.selector);
      const currentSrc = customIcons[reg.key] || (iconEl ? iconEl.src : '');
      const row = document.createElement('div');
      row.className = 'icon-replace-row';
      const img = document.createElement('img');
      img.className = 'icon-replace-preview';
      img.alt = '';
      img.src = currentSrc;
      const nameDiv = document.createElement('div');
      nameDiv.className   = 'icon-replace-name';
      nameDiv.textContent = reg.label;
      const hintDiv = document.createElement('div');
      hintDiv.className   = 'icon-replace-hint';
      hintDiv.textContent = '点击替换 ›';
      row.appendChild(img);
      row.appendChild(nameDiv);
      row.appendChild(hintDiv);
      row.addEventListener('click', () => openIconReplaceModal(reg.key, reg.label));
      container.appendChild(row);
    });
  }

  function openIconReplaceModal(key, label) {
    iconEditKey = key;
    iconTab     = 'url';
    const titleEl = document.getElementById('icon-replace-modal-title');
    if (titleEl) titleEl.textContent = '替換：' + label;
    const urlInput  = document.getElementById('icon-url-input');
    const fileInput = document.getElementById('icon-file-input');
    if (urlInput)  urlInput.value  = '';
    if (fileInput) fileInput.value = '';
    setIconTab('url');
    const modal = document.getElementById('icon-replace-modal');
    if (modal) modal.classList.add('show');
  }

  function setIconTab(tab) {
    iconTab = tab;
    document.querySelectorAll('[data-icon-tab]').forEach(b => {
      b.classList.toggle('active', b.dataset.iconTab === tab);
    });
    const urlPanel   = document.getElementById('icon-url-panel');
    const localPanel = document.getElementById('icon-local-panel');
    if (urlPanel)   urlPanel.style.display   = tab === 'url'   ? '' : 'none';
    if (localPanel) localPanel.style.display = tab === 'local' ? '' : 'none';
  }

  document.querySelectorAll('[data-icon-tab]').forEach(btn => {
    btn.addEventListener('click', function () { setIconTab(this.dataset.iconTab); });
  });

  function applyIconSrc(key, src) {
    customIcons[key] = src;
    sSave('customIcons', customIcons);
    const reg = iconRegistry.find(r => r.key === key);
    if (reg) document.querySelectorAll(reg.selector).forEach(el => { el.src = src; });
    renderIconReplaceList();
  }

  const iconReplaceConfirm = document.getElementById('icon-replace-confirm');
  if (iconReplaceConfirm) {
    iconReplaceConfirm.addEventListener('click', function () {
      if (iconTab === 'url') {
        const urlEl = document.getElementById('icon-url-input');
        const url   = urlEl ? urlEl.value.trim() : '';
        if (!url) return;
        applyIconSrc(iconEditKey, url);
        const modal = document.getElementById('icon-replace-modal');
        if (modal) modal.classList.remove('show');
      } else {
        const fileEl = document.getElementById('icon-file-input');
        const file   = fileEl ? fileEl.files[0] : null;
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async e => {
          const compressed = await compressImage(e.target.result, 300, 0.85);
          applyIconSrc(iconEditKey, compressed);
          const modal = document.getElementById('icon-replace-modal');
          if (modal) modal.classList.remove('show');
        };
        reader.readAsDataURL(file);
      }
    });
  }

  const iconReplaceCancel = document.getElementById('icon-replace-cancel');
  if (iconReplaceCancel) {
    iconReplaceCancel.addEventListener('click', function () {
      const modal = document.getElementById('icon-replace-modal');
      if (modal) modal.classList.remove('show');
    });
  }

  /* 整体配色 */
  const colorDefs = [
    { key: '--primary',    label: '主色调',   default: '#99C8ED' },
    { key: '--light-blue', label: '亮蓝色',   default: '#B3D8F4' },
    { key: '--mid-blue',   label: '中蓝色',   default: '#7a9abf' },
    { key: '--bg',         label: '背景色',   default: '#F5F5F0' },
    { key: '--bg2',        label: '辅助背景', default: '#F8F9FA' },
    { key: '--dark-bg',    label: '深色背景', default: '#1a1f2e' },
    { key: '--text-dark',  label: '主文字色', default: '#2c3448' },
    { key: '--text-mid',   label: '次文字色', default: '#5a6a80' },
    { key: '--text-light', label: '淡文字色', default: '#9aafc4' },
  ];
  let customColors = sLoad('customColors', {});

  function applyColors(colorMap) {
    Object.entries(colorMap).forEach(([k, v]) => {
      document.documentElement.style.setProperty(k, v);
    });
  }
  applyColors(customColors);

  function renderColorFields() {
    const container = document.getElementById('color-fields');
    if (!container) return;
    container.innerHTML = '';
    colorDefs.forEach(def => {
      const currentVal = customColors[def.key] || def.default;
      const row = document.createElement('div');
      row.className = 'color-field-row';
      const labelDiv = document.createElement('div');
      labelDiv.className   = 'color-field-label';
      labelDiv.textContent = def.label;
      const picker = document.createElement('input');
      picker.type         = 'color';
      picker.className    = 'color-field-input';
      picker.dataset.ckey = def.key;
      picker.value = /^#[0-9a-fA-F]{6}$/.test(currentVal) ? currentVal : def.default;
      const hexInput = document.createElement('input');
      hexInput.type         = 'text';
      hexInput.className    = 'color-field-hex';
      hexInput.dataset.hkey = def.key;
      hexInput.value        = currentVal;
      hexInput.maxLength    = 7;
      picker.addEventListener('input', function () { hexInput.value = this.value; });
      hexInput.addEventListener('input', function () {
        if (/^#[0-9a-fA-F]{6}$/.test(this.value.trim())) picker.value = this.value.trim();
      });
      row.appendChild(labelDiv);
      row.appendChild(picker);
      row.appendChild(hexInput);
      container.appendChild(row);
    });
  }

  const colorApplyBtn = document.getElementById('color-apply-btn');
  if (colorApplyBtn) {
    colorApplyBtn.addEventListener('click', function () {
      const container = document.getElementById('color-fields');
      if (!container) return;
      colorDefs.forEach(def => {
        const hexEl = container.querySelector('.color-field-hex[data-hkey="' + def.key + '"]');
        if (hexEl) {
          const val = hexEl.value.trim();
          if (/^#[0-9a-fA-F]{6}$/.test(val)) customColors[def.key] = val;
        }
      });
      sSave('customColors', customColors);
      applyColors(customColors);
    });
  }

  const colorResetBtn = document.getElementById('color-reset-btn');
  if (colorResetBtn) {
    colorResetBtn.addEventListener('click', function () {
      customColors = {};
      sSave('customColors', {});
      colorDefs.forEach(def => {
        document.documentElement.style.setProperty(def.key, def.default);
      });
      renderColorFields();
    });
  }

  /* 相性卡片配色 */
  const affinityColorDefs = [
    { key: 'affinity-card-bg',         label: '卡片背景色',     default: '#ffffff',  cssVar: '--affinity-card-bg'         },
    { key: 'affinity-card-border',      label: '卡片边框色',     default: '#99C8ED',  cssVar: '--affinity-card-border'     },
    { key: 'affinity-header-bg-from',   label: '卡片标题渐变起', default: '#f0f7ff',  cssVar: '--affinity-header-bg-from'  },
    { key: 'affinity-header-bg-to',     label: '卡片标题渐变止', default: '#fafcff',  cssVar: '--affinity-header-bg-to'    },
    { key: 'affinity-fortune-bg-from',  label: '运势区渐变起',   default: '#eaf4ff',  cssVar: '--affinity-fortune-bg-from' },
    { key: 'affinity-rank-score-color', label: '分数文字色',     default: '#2c3448',  cssVar: '--affinity-rank-score-color'},
    { key: 'affinity-tag-high-color',   label: '高分标签文字色', default: '#c8900a',  cssVar: '--affinity-tag-high-color'  },
    { key: 'affinity-tag-mid-color',    label: '中分标签文字色', default: '#3a7ab8',  cssVar: '--affinity-tag-mid-color'   },
    { key: 'affinity-tag-low-color',    label: '低分标签文字色', default: '#7a8a9a',  cssVar: '--affinity-tag-low-color'   },
  ];
  let customAffinityColors = sLoad('customAffinityColors', {});

  function applyAffinityColors(colorMap) {
    Object.entries(colorMap).forEach(([k, v]) => {
      const def = affinityColorDefs.find(d => d.key === k);
      if (def) document.documentElement.style.setProperty(def.cssVar, v);
    });
  }
  applyAffinityColors(customAffinityColors);

  function renderAffinityColorFields() {
    const container = document.getElementById('affinity-color-fields');
    if (!container) return;
    container.innerHTML = '';
    affinityColorDefs.forEach(def => {
      const currentVal = customAffinityColors[def.key] || def.default;
      const row = document.createElement('div');
      row.className = 'color-field-row';
      const labelDiv = document.createElement('div');
      labelDiv.className   = 'color-field-label';
      labelDiv.textContent = def.label;
      const picker = document.createElement('input');
      picker.type         = 'color';
      picker.className    = 'color-field-input';
      picker.dataset.akey = def.key;
      picker.value = /^#[0-9a-fA-F]{6}$/.test(currentVal) ? currentVal : def.default;
      const hexInput = document.createElement('input');
      hexInput.type          = 'text';
      hexInput.className     = 'color-field-hex';
      hexInput.dataset.ahkey = def.key;
      hexInput.value         = currentVal;
      hexInput.maxLength     = 7;
      picker.addEventListener('input', function () { hexInput.value = this.value; });
      hexInput.addEventListener('input', function () {
        if (/^#[0-9a-fA-F]{6}$/.test(this.value.trim())) picker.value = this.value.trim();
      });
      row.appendChild(labelDiv);
      row.appendChild(picker);
      row.appendChild(hexInput);
      container.appendChild(row);
    });
  }

  const affinityColorApplyBtn = document.getElementById('affinity-color-apply-btn');
  if (affinityColorApplyBtn) {
    affinityColorApplyBtn.addEventListener('click', function () {
      const container = document.getElementById('affinity-color-fields');
      if (!container) return;
      affinityColorDefs.forEach(def => {
        const hexEl = container.querySelector('.color-field-hex[data-ahkey="' + def.key + '"]');
        if (hexEl) {
          const val = hexEl.value.trim();
          if (/^#[0-9a-fA-F]{6}$/.test(val)) customAffinityColors[def.key] = val;
        }
      });
      sSave('customAffinityColors', customAffinityColors);
      applyAffinityColors(customAffinityColors);
    });
  }

  const affinityColorResetBtn = document.getElementById('affinity-color-reset-btn');
  if (affinityColorResetBtn) {
    affinityColorResetBtn.addEventListener('click', function () {
      customAffinityColors = {};
      sSave('customAffinityColors', {});
      affinityColorDefs.forEach(def => {
        document.documentElement.style.removeProperty(def.cssVar);
      });
      renderAffinityColorFields();
    });
  }

  /* Dock 栏配色与透明度 */
  function initDockStyleFields() {
    const saved = sLoad('dockStyle', null);
    const pickerEl  = document.getElementById('dock-bg-color-picker');
    const hexEl     = document.getElementById('dock-bg-color-hex');
    const sliderEl  = document.getElementById('dock-opacity-slider');
    const valEl     = document.getElementById('dock-opacity-value');
    if (!pickerEl || !hexEl || !sliderEl || !valEl) return;
    const color   = (saved && saved.color)   ? saved.color   : '#ffffff';
    const opacity = (saved && saved.opacity !== undefined) ? saved.opacity : 0.84;
    pickerEl.value    = color;
    hexEl.value       = color;
    sliderEl.value    = opacity;
    valEl.textContent = parseFloat(opacity).toFixed(2);
    pickerEl.addEventListener('input', function () { hexEl.value = this.value; });
    hexEl.addEventListener('input', function () {
      if (/^#[0-9a-fA-F]{6}$/.test(this.value.trim())) pickerEl.value = this.value.trim();
    });
    sliderEl.addEventListener('input', function () {
      valEl.textContent = parseFloat(this.value).toFixed(2);
    });
  }

  function applyDockStyle(color, opacity) {
    const dock = document.getElementById('dock');
    if (!dock) return;
    const r = parseInt(color.slice(1,3), 16);
    const g = parseInt(color.slice(3,5), 16);
    const b = parseInt(color.slice(5,7), 16);
    dock.style.background = 'rgba(' + r + ',' + g + ',' + b + ',' + opacity + ')';
  }

  (function restoreDockStyle() {
    const saved = sLoad('dockStyle', null);
    if (!saved) return;
    const color   = saved.color   || '#ffffff';
    const opacity = saved.opacity !== undefined ? saved.opacity : 0.84;
    applyDockStyle(color, opacity);
  })();

  const dockStyleApplyBtn = document.getElementById('dock-style-apply-btn');
  if (dockStyleApplyBtn) {
    dockStyleApplyBtn.addEventListener('click', function () {
      const pickerEl = document.getElementById('dock-bg-color-picker');
      const hexEl    = document.getElementById('dock-bg-color-hex');
      const sliderEl = document.getElementById('dock-opacity-slider');
      if (!pickerEl || !hexEl || !sliderEl) return;
      const hexVal = hexEl.value.trim();
      const color  = /^#[0-9a-fA-F]{6}$/.test(hexVal) ? hexVal : pickerEl.value;
      const opacity = parseFloat(sliderEl.value);
      sSave('dockStyle', { color, opacity });
      applyDockStyle(color, opacity);
    });
  }

  const dockStyleResetBtn = document.getElementById('dock-style-reset-btn');
  if (dockStyleResetBtn) {
    dockStyleResetBtn.addEventListener('click', function () {
      sSave('dockStyle', null);
      const dock = document.getElementById('dock');
      if (dock) dock.style.background = '';
      const pickerEl = document.getElementById('dock-bg-color-picker');
      const hexEl    = document.getElementById('dock-bg-color-hex');
      const sliderEl = document.getElementById('dock-opacity-slider');
      const valEl    = document.getElementById('dock-opacity-value');
      if (pickerEl) pickerEl.value     = '#ffffff';
      if (hexEl)    hexEl.value        = '#ffffff';
      if (sliderEl) sliderEl.value     = '0.84';
      if (valEl)    valEl.textContent  = '0.84';
    });
  }

  /* ---- ③ 数据管理 ---- */

  const HOME_DATA_KEYS = [
    'cdItems', 'carouselUrls', 'userSig', 'msgData', 'textBars',
    'apiArchives', 'apiActiveConfig', 'apiCurrentModel',
    'customIcons', 'customColors', 'wallpaper', 'wallpaper2', 'wallpaper3',
    'customAppNames', 'darkMode', 'pinAvatar', 'lockPin',
    'p2UcBg', 'p2UcName', 'p2UcUid', 'p2UcFans', 'p2UcLikes',
    'p2AlbumBg', 'p2CdImg', 'page2Cards',
    'garden', 'customAffinityColors', 'dockStyle',
  ];

  const THEME_DATA_KEYS = [
    'customIcons', 'customColors', 'wallpaper', 'wallpaper2', 'wallpaper3',
    'customAppNames', 'darkMode', 'customAffinityColors', 'dockStyle',
  ];

  const LIAO_RAW_KEYS = [
    'liao_roles', 'liao_chats', 'liao_suiyan', 'liao_userName', 'liao_userAvatar',
    'liao_suiyanBg', 'liao_emojis', 'liao_emojiCats', 'liao_favorites',
    'liao_personas', 'liao_worldbook',
  ];

  function collectHalo9Data(keys) {
    const result = {};
    keys.forEach(k => {
      const v = localStorage.getItem('halo9_' + k);
      if (v !== null) {
        try { result['halo9_' + k] = JSON.parse(v); } catch (e) { result['halo9_' + k] = v; }
      }
    });
    return result;
  }

  function collectRawData(rawKeys) {
    const result = {};
    rawKeys.forEach(k => {
      const v = localStorage.getItem(k);
      if (v !== null) {
        try { result[k] = JSON.parse(v); } catch (e) { result[k] = v; }
      }
    });
    return result;
  }

  function downloadJson(obj, filename) {
    const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  }

  function importAllFromJson(file, callback) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        Object.entries(data).forEach(([k, v]) => {
          try {
            localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
          } catch (ex) {
            console.warn('导入键失败：', k, ex);
          }
        });
        if (callback) callback();
      } catch (err) { alert('导入失败：JSON 格式错误'); }
    };
    reader.readAsText(file);
  }

  /* 全局完整备份（含 IndexedDB 图片） */
  const exportGlobalBtn = document.getElementById('export-global-btn');
  if (exportGlobalBtn) {
    exportGlobalBtn.addEventListener('click', async function () {
      const allData = {};
      /* localStorage 部分 */
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        try { allData[key] = JSON.parse(localStorage.getItem(key)); }
        catch (e) { allData[key] = localStorage.getItem(key); }
      }
      /* IndexedDB 图片部分 */
      const imgItems = await imgLoadAll();
      if (imgItems.length) {
        allData['__idb_images__'] = imgItems;
      }
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = 'halo9_全量备份_' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      URL.revokeObjectURL(url);
      const msg = document.getElementById('global-backup-msg');
      if (msg) {
        msg.textContent = '导出成功，共 ' + localStorage.length + ' 个文字键 + ' + imgItems.length + ' 张图片';
        setTimeout(() => { msg.textContent = ''; }, 4000);
      }
    });
  }

  const importGlobalBtn = document.getElementById('import-global-btn');
  if (importGlobalBtn) importGlobalBtn.addEventListener('click', function () {
    const fi = document.getElementById('import-global-file');
    if (fi) fi.click();
  });

  const importGlobalFile = document.getElementById('import-global-file');
  if (importGlobalFile) {
    importGlobalFile.addEventListener('change', async function () {
      const file = this.files[0];
      if (!file) return;
      if (!confirm('导入全局备份将覆盖当前所有数据，确定继续吗？')) return;
      const reader = new FileReader();
      reader.onload = async e => {
        try {
          const data = JSON.parse(e.target.result);
          /* 还原 IndexedDB 图片 */
          if (Array.isArray(data['__idb_images__'])) {
            await imgSaveAll(data['__idb_images__']);
            delete data['__idb_images__'];
          }
          /* 还原 localStorage */
          Object.entries(data).forEach(([k, v]) => {
            try {
              localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
            } catch (ex) {
              console.warn('导入键失败：', k, ex);
            }
          });
          const msg = document.getElementById('global-backup-msg');
          if (msg) msg.textContent = '导入成功，即将刷新页面…';
          setTimeout(() => location.reload(), 1500);
        } catch (err) { alert('导入失败：JSON 格式错误'); }
      };
      reader.readAsText(file);
      this.value = '';
    });
  }

  const exportAllBtn = document.getElementById('export-all-btn');
  if (exportAllBtn) {
    exportAllBtn.addEventListener('click', () => {
      const data = Object.assign(
        {},
        collectHalo9Data(HOME_DATA_KEYS),
        collectRawData(LIAO_RAW_KEYS)
      );
      downloadJson(data, 'halo9_主页数据_' + new Date().toISOString().slice(0, 10) + '.json');
    });
  }

  const importAllBtn = document.getElementById('import-all-btn');
  if (importAllBtn) importAllBtn.addEventListener('click', function () {
    const fi = document.getElementById('import-all-file');
    if (fi) fi.click();
  });

  const importAllFile = document.getElementById('import-all-file');
  if (importAllFile) {
    importAllFile.addEventListener('change', function () {
      const file = this.files[0];
      if (!file) return;
      importAllFromJson(file, () => {
        alert('数据导入成功，即将刷新页面');
        location.reload();
      });
      this.value = '';
    });
  }

  const exportThemeBtn = document.getElementById('export-theme-btn');
  if (exportThemeBtn) {
    exportThemeBtn.addEventListener('click', async () => {
      const data = collectHalo9Data(THEME_DATA_KEYS);
      /* 同时导出壁纸图片 */
      const wpKeys = ['wallpaper', 'wallpaper2', 'wallpaper3'];
      for (const k of wpKeys) {
        const imgVal = await imgLoad(k, null);
        if (imgVal) data['__idb_img_' + k + '__'] = imgVal;
      }
      downloadJson(data, 'halo9_美化数据_' + new Date().toISOString().slice(0, 10) + '.json');
    });
  }

  const importThemeBtn = document.getElementById('import-theme-btn');
  if (importThemeBtn) importThemeBtn.addEventListener('click', function () {
    const fi = document.getElementById('import-theme-file');
    if (fi) fi.click();
  });

  const importThemeFile = document.getElementById('import-theme-file');
  if (importThemeFile) {
    importThemeFile.addEventListener('change', async function () {
      const file = this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async e => {
        try {
          const data = JSON.parse(e.target.result);
          /* 还原壁纸图片到 IndexedDB */
          const wpKeys = ['wallpaper', 'wallpaper2', 'wallpaper3'];
          for (const k of wpKeys) {
            const imgKey = '__idb_img_' + k + '__';
            if (data[imgKey]) {
              await imgSave(k, data[imgKey]);
              delete data[imgKey];
            }
          }
          /* 还原文字类配置到 localStorage */
          Object.entries(data).forEach(([k, v]) => {
            try {
              localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v));
            } catch (ex) {}
          });
          /* 重新应用所有美化 */
          const w1 = await imgLoad('wallpaper',  null) || sLoad('wallpaper',  '');
          const w2 = await imgLoad('wallpaper2', null) || sLoad('wallpaper2', '');
          const w3 = await imgLoad('wallpaper3', null) || sLoad('wallpaper3', '');
          wallpaperSrc  = w1;
          wallpaper2Src = w2;
          wallpaper3Src = w3;
          if (w1) { document.body.style.backgroundImage = 'url(' + w1 + ')'; document.body.style.backgroundSize = 'cover'; document.body.style.backgroundPosition = 'center'; }
          setPage2Wallpaper(w2 || w1);
          setPage3Wallpaper(w3 || w1);
          customColors   = sLoad('customColors',   {}); applyColors(customColors);
          customIcons    = sLoad('customIcons',    {}); restoreAllIcons();
          customAppNames = sLoad('customAppNames', {}); applyAllAppNames();
          customAffinityColors = sLoad('customAffinityColors', {}); applyAffinityColors(customAffinityColors);
          const dockSaved = sLoad('dockStyle', null);
          if (dockSaved) applyDockStyle(dockSaved.color || '#ffffff', dockSaved.opacity !== undefined ? dockSaved.opacity : 0.84);
          const darkOn = localStorage.getItem('halo9_darkMode') === 'true';
          document.body.classList.toggle('dark-mode', darkOn);
          const toggle = document.getElementById('dark-mode-toggle');
          if (toggle) toggle.checked = darkOn;
          alert('美化数据导入成功');
        } catch (err) { alert('导入失败：JSON 格式错误'); }
      };
      reader.readAsText(file);
      this.value = '';
    });
  }

  const clearAllDataBtn = document.getElementById('clear-all-data-btn');
  if (clearAllDataBtn) {
    clearAllDataBtn.addEventListener('click', function () {
      if (!confirm('确定要清除全部本地数据吗？此操作不可恢复！')) return;
      localStorage.clear();
      /* 同时清空 IndexedDB 图片 */
      _imgDB.images.clear().then(() => {
        alert('已清除全部数据，即将刷新页面');
        location.reload();
      });
    });
  }

  /* 将关键函数挂到 window 供 settings-3.js 使用 */
  window._s2 = {
    applyWallpaper, applyWallpaper2, applyWallpaper3,
    applyColors, applyAllAppNames, restoreAllIcons,
    renderIconReplaceList, renderColorFields, renderAppNameFields,
    renderAffinityColorFields, applyAffinityColors,
    initWallpaper2Preview, initWallpaper3Preview,
    initDockStyleFields, applyDockStyle,
  };

}; /* end window.initSettings */
