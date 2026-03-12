/* ============================================================
   storage-manager.js — 存储管理页面逻辑
   ============================================================ */

(function () {
  'use strict';

  const GROUP_RULES = [
    { name: '聊天记录',   color: '#99C8ED', match: k => k === 'liao_chats' },
    { name: '角色设置',   color: '#f0cc78', match: k => k === 'liao_roles' },
    { name: '表情包',     color: '#7ecb7e', match: k => k.startsWith('liao_emoji') },
    { name: '世界书',     color: '#c8a0e8', match: k => k === 'liao_worldbook' },
    { name: '随言',       color: '#f0a070', match: k => k === 'liao_suiyan' },
    { name: '人设库',     color: '#70c0d0', match: k => k === 'liao_personas' },
    { name: '收藏夹',     color: '#d0a8c0', match: k => k === 'liao_favorites' },
    { name: '大逃杀',     color: '#e07a7a', match: k => k.startsWith('halo9_batoru') },
    { name: '家园',       color: '#90d0b0', match: k => k === 'halo9_garden' },
    { name: '角色手机',   color: '#b0c8e8', match: k => k.startsWith('rp_data_') },
    { name: '主页美化',   color: '#e8c070', match: k => [
        'halo9_carouselUrls','halo9_userAvatar','halo9_userSig',
        'halo9_msgData','halo9_textBars','halo9_cdItems',
        'halo9_p2UcBg','halo9_p2UcName','halo9_p2UcUid',
        'halo9_p2UcFans','halo9_p2UcLikes','halo9_page2Cards',
        'halo9_p2AlbumBg','halo9_p2CdImg'
      ].includes(k)
    },
    { name: '其他了了',   color: '#a0b8d8', match: k => k.startsWith('liao_') },
    { name: '其他设置',   color: '#c8c8c8', match: k => k.startsWith('halo9_') },
  ];

  /* IndexedDB 图片分组单独列出 */
  const IDB_COLOR = '#f0a0d0';

  function smFormatSize(bytes) {
    if (bytes < 1024)         return bytes + ' B';
    if (bytes < 1024 * 1024)  return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  }

  function smGetLocalStorageMax() {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes('safari') && !ua.includes('chrome')) return 5 * 1024 * 1024;
    return 10 * 1024 * 1024;
  }

  function smGetAllData() {
    const groups = {};
    GROUP_RULES.forEach(r => { groups[r.name] = { color: r.color, size: 0, keys: [] }; });
    groups['未知'] = { color: '#e0e0e0', size: 0, keys: [] };

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const val  = localStorage.getItem(key) || '';
      const size = (key.length + val.length) * 2;
      let matched = false;
      for (const rule of GROUP_RULES) {
        if (rule.match(key)) {
          groups[rule.name].size += size;
          groups[rule.name].keys.push({ key, size });
          matched = true;
          break;
        }
      }
      if (!matched) {
        groups['未知'].size += size;
        groups['未知'].keys.push({ key, size });
      }
    }
    return groups;
  }

  function smTotalSize() {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      const val = localStorage.getItem(key) || '';
      total += (key.length + val.length) * 2;
    }
    return total;
  }

  /* 获取 IndexedDB 图片总大小 */
  async function smGetIdbSize() {
    try {
      if (typeof imgLoadAll !== 'function') return 0;
      const items = await imgLoadAll();
      let total = 0;
      items.forEach(item => {
        total += (item.key || '').length * 2;
        total += (item.val || '').length * 2;
      });
      return total;
    } catch (e) {
      return 0;
    }
  }

  function smDrawDonut(canvas, segments) {
    const ctx    = canvas.getContext('2d');
    const cx     = canvas.width  / 2;
    const cy     = canvas.height / 2;
    const radius = 80;
    const inner  = 52;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let startAngle = -Math.PI / 2;
    const total = segments.reduce((s, g) => s + g.size, 0) || 1;

    segments.forEach(seg => {
      if (seg.size === 0) return;
      const slice = (seg.size / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius, startAngle, startAngle + slice);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.fill();
      startAngle += slice;
    });

    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--bg') || '#F5F5F0';
    ctx.fill();
  }

  function smRenderList(groups, totalSize, idbSize) {
    const container = document.getElementById('storage-list');
    if (!container) return;
    container.innerHTML = '';

    const sorted = Object.entries(groups)
      .filter(([, g]) => g.size > 0)
      .sort((a, b) => b[1].size - a[1].size);

    /* 先渲染 localStorage 各分组 */
    sorted.forEach(([name, g]) => {
      const pct = totalSize > 0 ? ((g.size / totalSize) * 100).toFixed(1) : '0.0';
      const row = document.createElement('div');
      row.className = 'storage-list-item';
      row.innerHTML =
        '<div class="storage-color-dot" style="background:' + g.color + '"></div>' +
        '<div class="storage-item-name">' + name + '</div>' +
        '<div class="storage-item-size">' + smFormatSize(g.size) + '</div>' +
        '<div class="storage-item-pct">' + pct + '%</div>';
      container.appendChild(row);
    });

    /* 最后追加 IndexedDB 图片分组 */
    if (idbSize > 0) {
      const row = document.createElement('div');
      row.className = 'storage-list-item';
      row.innerHTML =
        '<div class="storage-color-dot" style="background:' + IDB_COLOR + '"></div>' +
        '<div class="storage-item-name">图片（IndexedDB）</div>' +
        '<div class="storage-item-size">' + smFormatSize(idbSize) + '</div>' +
        '<div class="storage-item-pct" style="color:#f0a0d0;">独立存储</div>';
      container.appendChild(row);
    }
  }

  function smFindAllImages() {
    const images = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const val = localStorage.getItem(key) || '';
      if (val.startsWith('"data:image/')) {
        try {
          const src = JSON.parse(val);
          images.push({ key, src, type: 'single' });
        } catch (e) {}
      } else if (val.includes('data:image/')) {
        images.push({ key, val, type: 'embedded' });
      }
    }
    return images;
  }

  function smCompressImage(src, maxWidth, quality) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
        const canvas = document.createElement('canvas');
        canvas.width  = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });
  }

  const QUALITY_PRESETS = {
    high:   { maxWidth: 1200, quality: 0.80 },
    medium: { maxWidth: 900,  quality: 0.65 },
    low:    { maxWidth: 600,  quality: 0.45 },
  };

  let smSelectedQuality = 'high';

  async function smRenderImageStats() {
    const el = document.getElementById('storage-image-stats');
    if (!el) return;

    /* localStorage 里的图片 */
    const lsImages = smFindAllImages();
    let lsImgSize = 0;
    lsImages.forEach(img => {
      const val = localStorage.getItem(img.key) || '';
      lsImgSize += val.length * 2;
    });

    /* IndexedDB 里的图片 */
    let idbCount = 0;
    let idbSize  = 0;
    try {
      if (typeof imgLoadAll === 'function') {
        const items = await imgLoadAll();
        idbCount = items.length;
        items.forEach(item => {
          idbSize += ((item.key || '').length + (item.val || '').length) * 2;
        });
      }
    } catch (e) {}

    el.innerHTML =
      'localStorage 图片：<b>' + lsImages.length + '</b> 处，约 <b>' + smFormatSize(lsImgSize) + '</b>' +
      '&nbsp;&nbsp;|&nbsp;&nbsp;' +
      'IndexedDB 图片：<b>' + idbCount + '</b> 张，约 <b>' + smFormatSize(idbSize) + '</b>';
  }

  async function smCompressAll() {
    const btn    = document.getElementById('storage-compress-btn');
    const result = document.getElementById('storage-compress-result');
    const preset = QUALITY_PRESETS[smSelectedQuality];
    if (!btn || !result) return;

    btn.disabled       = true;
    btn.textContent    = '压缩中…';
    result.textContent = '';

    let savedBytes = 0;

    /* 压缩 localStorage 里的图片 */
    const lsImages = smFindAllImages();
    for (const imgInfo of lsImages) {
      try {
        if (imgInfo.type === 'single') {
          const oldVal = localStorage.getItem(imgInfo.key) || '';
          const oldSrc = JSON.parse(oldVal);
          const newSrc = await smCompressImage(oldSrc, preset.maxWidth, preset.quality);
          const newVal = JSON.stringify(newSrc);
          savedBytes  += (oldVal.length - newVal.length) * 2;
          localStorage.setItem(imgInfo.key, newVal);
        } else if (imgInfo.type === 'embedded') {
          const oldVal = imgInfo.val;
          let parsed;
          try { parsed = JSON.parse(oldVal); } catch (e) { continue; }
          const newParsed = await smReplaceImagesInObject(parsed, preset);
          const newVal    = JSON.stringify(newParsed);
          savedBytes     += (oldVal.length - newVal.length) * 2;
          localStorage.setItem(imgInfo.key, newVal);
        }
      } catch (e) {
        console.error('压缩失败（localStorage）:', imgInfo.key, e);
      }
    }

    /* 压缩 IndexedDB 里的图片 */
    try {
      if (typeof imgLoadAll === 'function' && typeof imgSave === 'function') {
        const idbItems = await imgLoadAll();
        for (const item of idbItems) {
          try {
            const oldVal = item.val || '';
            if (!oldVal.startsWith('data:image/')) continue;
            const newVal = await smCompressImage(oldVal, preset.maxWidth, preset.quality);
            savedBytes  += (oldVal.length - newVal.length) * 2;
            await imgSave(item.key, newVal);
          } catch (e) {
            console.error('压缩失败（IndexedDB）:', item.key, e);
          }
        }
      }
    } catch (e) {}

    btn.disabled    = false;
    btn.textContent = '一键压缩所有图片';

    if (savedBytes > 0) {
      result.style.color = '#4caf84';
      result.textContent = '✓ 压缩完成，释放了约 ' + smFormatSize(Math.max(0, savedBytes));
    } else {
      result.style.color = '#9aafc4';
      result.textContent = '图片已是最优状态，无需压缩';
    }

    smRender();
  }

  async function smReplaceImagesInObject(obj, preset) {
    if (typeof obj === 'string' && obj.startsWith('data:image/')) {
      return await smCompressImage(obj, preset.maxWidth, preset.quality);
    }
    if (Array.isArray(obj)) {
      const result = [];
      for (const item of obj) {
        result.push(await smReplaceImagesInObject(item, preset));
      }
      return result;
    }
    if (obj && typeof obj === 'object') {
      const result = {};
      for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
          result[key] = await smReplaceImagesInObject(obj[key], preset);
        }
      }
      return result;
    }
    return obj;
  }

  function smRenderTokenRoleList() {
    const container = document.getElementById('storage-token-role-list');
    if (!container) return;
    container.innerHTML = '';

    const roles = (typeof liaoRoles !== 'undefined') ? liaoRoles : [];
    if (!roles.length) {
      container.innerHTML = '<div style="font-size:13px;color:var(--text-light);text-align:center;padding:12px 0;">暂无角色</div>';
      return;
    }

    roles.forEach(role => {
      const item = document.createElement('div');
      item.className = 'storage-token-role-item';
      item.innerHTML =
        '<img class="storage-token-role-avatar" src="' +
        (role.avatar || 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=default') +
        '" alt="">' +
        '<div class="storage-token-role-name">' + (role.nickname || role.realname || '未知') + '</div>' +
        '<div class="storage-token-role-arrow">›</div>';
      item.addEventListener('click', () => smOpenTokenModal(role));
      container.appendChild(item);
    });
  }

  function smOpenTokenModal(role) {
    const modal = document.getElementById('storage-token-modal');
    const title = document.getElementById('storage-token-modal-title');
    const body  = document.getElementById('storage-token-modal-body');
    if (!modal || !title || !body) return;

    title.textContent = (role.nickname || role.realname) + ' · Token 分析';

    const chat = (typeof liaoChats !== 'undefined')
      ? liaoChats.find(c => c.roleId === role.id)
      : null;

    const parts = [];
    parts.push({ name: '角色设定',   chars: (role.setting || '').length, color: '#99C8ED' });
    parts.push({ name: '用户设定',   chars: ((chat && chat.chatUserSetting) || '').length, color: '#f0cc78' });
    parts.push({ name: '长期记忆',   chars: ((chat && chat.memory && chat.memory.longTerm)  || []).map(m => m.content || '').join('\n').length, color: '#7ecb7e' });
    parts.push({ name: '重要记忆',   chars: ((chat && chat.memory && chat.memory.important) || []).map(m => m.content || '').join('\n').length, color: '#c8a0e8' });

    let wbStr = '';
    if (typeof getWorldBookInjection === 'function' && chat) {
      wbStr = getWorldBookInjection(chat.messages || [], role.id) || '';
    }
    parts.push({ name: '世界书注入', chars: wbStr.length, color: '#f0a070' });

    const emojiList = (typeof liaoEmojis !== 'undefined') ? liaoEmojis : [];
    parts.push({ name: '表情包名称', chars: emojiList.map(e => e.name || '').join('、').length, color: '#e07a7a' });

    const maxApiMsgs = (chat && chat.chatSettings && chat.chatSettings.maxApiMsgs) || 0;
    const msgs       = (chat && chat.messages || []).filter(m => !m.hidden && (m.role === 'user' || m.role === 'assistant'));
    const recentMsgs = maxApiMsgs > 0 ? msgs.slice(-maxApiMsgs) : msgs;
    parts.push({ name: '聊天记录 (' + recentMsgs.length + '条)', chars: recentMsgs.map(m => m.content || '').join('\n').length, color: '#70c0d0' });

    const totalChars  = parts.reduce((s, p) => s + p.chars, 0);
    const totalTokens = Math.ceil(totalChars / 2.5);

    body.innerHTML = '';

    const overview = document.createElement('div');
    overview.className = 'storage-token-section';
    overview.innerHTML =
      '<div class="storage-token-section-title">总计</div>' +
      '<div class="storage-token-section-value">' + totalChars.toLocaleString() + ' 字符</div>' +
      '<div class="storage-token-section-sub">约 ' + totalTokens.toLocaleString() + ' tokens（估算）</div>';
    body.appendChild(overview);

    parts.forEach(p => {
      if (p.chars === 0) return;
      const pct  = totalChars > 0 ? (p.chars / totalChars * 100).toFixed(1) : 0;
      const item = document.createElement('div');
      item.className = 'storage-token-section';
      item.innerHTML =
        '<div style="display:flex;justify-content:space-between;align-items:center;">' +
          '<div class="storage-token-section-title" style="margin-bottom:0;">' + p.name + '</div>' +
          '<div style="font-size:12px;color:var(--text-mid);">' + p.chars.toLocaleString() + ' 字符 · ' + pct + '%</div>' +
        '</div>' +
        '<div class="storage-token-bar"><div class="storage-token-bar-fill" style="width:' + pct + '%;background:' + p.color + ';"></div></div>';
      body.appendChild(item);
    });

    const advice = document.createElement('div');
    advice.className = 'storage-token-advice';
    advice.innerHTML = '<div class="storage-token-advice-title">优化建议</div><div class="storage-token-advice-text">' +
      smGenerateAdvice(parts, totalChars) + '</div>';
    body.appendChild(advice);

    modal.style.display = 'flex';
  }

  function smGenerateAdvice(parts, totalChars) {
    const lines       = [];
    const settingPart = parts.find(p => p.name === '角色设定');
    const memPart     = parts.find(p => p.name === '长期记忆');
    const wbPart      = parts.find(p => p.name === '世界书注入');
    const emojiPart   = parts.find(p => p.name === '表情包名称');
    const msgPart     = parts.find(p => p.name.startsWith('聊天记录'));

    if (totalChars < 2000) {
      lines.push('✓ 当前发送字符数较少，对 AI 响应速度影响不大。');
    } else if (totalChars < 6000) {
      lines.push('⚠ 字符数适中，建议控制在 6000 以内以获得最佳响应速度。');
    } else {
      lines.push('⚠ 字符数较多，可能影响 AI 响应速度和质量，建议优化。');
    }
    if (settingPart && settingPart.chars > 1500) {
      lines.push('• 角色设定过长（' + settingPart.chars + ' 字符），建议精简到 800 字以内。');
    }
    if (memPart && memPart.chars > 1000) {
      lines.push('• 长期记忆条目较多（' + memPart.chars + ' 字符），可以删除过时或重复的记忆条目。');
    }
    if (wbPart && wbPart.chars > 2000) {
      lines.push('• 世界书注入内容较多（' + wbPart.chars + ' 字符），建议检查触发词设置。');
    }
    if (emojiPart && emojiPart.chars > 500) {
      lines.push('• 表情包名称列表较长（' + emojiPart.chars + ' 字符），可以删减不常用的表情包。');
    }
    if (msgPart && msgPart.chars > 4000) {
      lines.push('• 聊天记录发送量较大，可以在聊天设置中降低「AI 可读取的消息数量」。');
    }
    if (lines.length === 1) {
      lines.push('• 各部分配置均衡，继续保持！');
    }
    return lines.join('<br>');
  }

  async function smRender() {
    const groups   = smGetAllData();
    const total    = smTotalSize();
    const LS_MAX   = smGetLocalStorageMax();
    const idbSize  = await smGetIdbSize();

    const totalEl  = document.getElementById('storage-total-text');
    const warnEl   = document.getElementById('storage-warning');
    const centerEl = document.getElementById('storage-center-value');
    const canvas   = document.getElementById('storage-donut-canvas');

    const grandTotal = total + idbSize;
    const pct = (total / LS_MAX * 100).toFixed(1);

    if (totalEl) totalEl.textContent =
      'localStorage：' + smFormatSize(total) + ' / 约 ' + smFormatSize(LS_MAX) + '（' + pct + '%）' +
      '　IndexedDB 图片：' + smFormatSize(idbSize);
    if (centerEl) centerEl.textContent = pct + '%';

    if (warnEl) {
      if (total > LS_MAX * 0.9)      warnEl.textContent = '⚠ localStorage 即将耗尽，建议立即压缩图片！';
      else if (total > LS_MAX * 0.7) warnEl.textContent = 'localStorage 使用超过 70%，建议压缩图片。';
      else                            warnEl.textContent = '';
    }

    /* 甜甜圈图：localStorage 各分组 + IndexedDB 图片 */
    const segments = Object.values(groups).filter(g => g.size > 0);
    if (idbSize > 0) segments.push({ color: IDB_COLOR, size: idbSize });
    if (canvas) smDrawDonut(canvas, segments);

    smRenderList(groups, total, idbSize);
    await smRenderImageStats();
    smRenderTokenRoleList();
  }

  function smOpen() {
    const view = document.getElementById('storage-manager-view');
    if (view) {
      view.style.display = 'flex';
      smRender();
    }
  }

  function smClose() {
    const view = document.getElementById('storage-manager-view');
    if (view) view.style.display = 'none';
  }

  const backBtn    = document.getElementById('storage-back-btn');
  const refreshBtn = document.getElementById('storage-refresh-btn');
  const compBtn    = document.getElementById('storage-compress-btn');
  const tokenClose = document.getElementById('storage-token-modal-close');
  const tokenModal = document.getElementById('storage-token-modal');

  if (backBtn)    backBtn.addEventListener('click', smClose);
  if (refreshBtn) refreshBtn.addEventListener('click', smRender);
  if (compBtn)    compBtn.addEventListener('click', smCompressAll);
  if (tokenClose) tokenClose.addEventListener('click', () => {
    if (tokenModal) tokenModal.style.display = 'none';
  });
  if (tokenModal) tokenModal.addEventListener('click', function (e) {
    if (e.target === this) this.style.display = 'none';
  });

  document.querySelectorAll('.storage-quality-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.storage-quality-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      smSelectedQuality = this.dataset.quality;
    });
  });

  window.StorageManager = { open: smOpen, close: smClose };

})();
