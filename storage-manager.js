/* ============================================================
   storage-manager.js — 存储管理页面逻辑
   ============================================================ */

(function () {
  'use strict';

  /* ── 颜色表（自动分组用） ── */
  const GROUP_COLORS = [
    '#99C8ED','#f0cc78','#7ecb7e','#e07a7a','#c8a0e8',
    '#f0a070','#70c0d0','#a0b8d8','#d0a8c0','#90d0b0',
    '#e8c070','#b0c8e8'
  ];

  /* ── 分组规则（以后加新App只需加一行）── */
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

  /* ── 工具函数 ── */
  function smFormatSize(bytes) {
    if (bytes < 1024)       return bytes + ' B';
    if (bytes < 1024*1024)  return (bytes/1024).toFixed(1) + ' KB';
    return (bytes/(1024*1024)).toFixed(2) + ' MB';
  }

  function smGetAllData() {
    const groups = {};
    GROUP_RULES.forEach(r => { groups[r.name] = { color: r.color, size: 0, keys: [] }; });
    groups['未知'] = { color: '#e0e0e0', size: 0, keys: [] };

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const val  = localStorage.getItem(key) || '';
      const size = (key.length + val.length) * 2; // UTF-16

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

  /* ── 甜甜圈图 ── */
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

    // 内圆（挖空甜甜圈）
    ctx.beginPath();
    ctx.arc(cx, cy, inner, 0, Math.PI * 2);
    ctx.fillStyle = getComputedStyle(document.documentElement)
      .getPropertyValue('--bg') || '#F5F5F0';
    ctx.fill();
  }

  /* ── 渲染列表 ── */
  function smRenderList(groups, totalSize) {
    const container = document.getElementById('storage-list');
    if (!container) return;
    container.innerHTML = '';

    const sorted = Object.entries(groups)
      .filter(([,g]) => g.size > 0)
      .sort((a, b) => b[1].size - a[1].size);

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
  }

  /* ── 图片检测 ── */
  function smFindAllImages() {
    const images = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key) continue;
      const val = localStorage.getItem(key) || '';
      // 检测直接是 base64 图片的键
      if (val.startsWith('"data:image/')) {
        try {
          const src = JSON.parse(val);
          images.push({ key, src, type: 'single' });
        } catch(e) {}
      }
      // 检测 JSON 数组或对象里包含 base64 的
      else if (val.includes('data:image/')) {
        images.push({ key, val, type: 'embedded' });
      }
    }
    return images;
  }

  /* ── 压缩单张图片 ── */
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
      img.onerror = () => resolve(src); // 失败就原样返回
      img.src = src;
    });
  }

  /* ── 压缩质量配置 ── */
  const QUALITY_PRESETS = {
    high:   { maxWidth: 1200, quality: 0.80 },
    medium: { maxWidth: 900,  quality: 0.65 },
    low:    { maxWidth: 600,  quality: 0.45 },
  };

  let smSelectedQuality = 'high';

  /* ── 渲染图片统计 ── */
  function smRenderImageStats() {
    const el = document.getElementById('storage-image-stats');
    if (!el) return;
    const images = smFindAllImages();
    let totalImgSize = 0;
    images.forEach(img => {
      const val = localStorage.getItem(img.key) || '';
      totalImgSize += val.length * 2;
    });
    el.innerHTML =
      '检测到 <b>' + images.length + '</b> 处图片数据，' +
      '共占用约 <b>' + smFormatSize(totalImgSize) + '</b>';
  }

  /* ── 一键压缩 ── */
  async function smCompressAll() {
    const btn    = document.getElementById('storage-compress-btn');
    const result = document.getElementById('storage-compress-result');
    const preset = QUALITY_PRESETS[smSelectedQuality];
    if (!btn || !result) return;

    btn.disabled    = true;
    btn.textContent = '压缩中…';
    result.textContent = '';

    const images     = smFindAllImages();
    let savedBytes   = 0;
    let processedCount = 0;

    for (const imgInfo of images) {
      try {
        if (imgInfo.type === 'single') {
          const oldVal    = localStorage.getItem(imgInfo.key) || '';
          const oldSrc    = JSON.parse(oldVal);
          const newSrc    = await smCompressImage(oldSrc, preset.maxWidth, preset.quality);
          const newVal    = JSON.stringify(newSrc);
          savedBytes     += (oldVal.length - newVal.length) * 2;
          localStorage.setItem(imgInfo.key, newVal);
          processedCount++;

        } else if (imgInfo.type === 'embedded') {
          // 处理嵌套在 JSON 里的图片
          const oldVal = imgInfo.val;
          let parsed;
          try { parsed = JSON.parse(oldVal); } catch(e) { continue; }

          const newParsed = await smReplaceImagesInObject(parsed, preset);
          const newVal    = JSON.stringify(newParsed);
          savedBytes     += (oldVal.length - newVal.length) * 2;
          localStorage.setItem(imgInfo.key, newVal);
          processedCount++;
        }
      } catch(e) {
        console.error('压缩失败:', imgInfo.key, e);
      }
    }

    btn.disabled    = false;
    btn.textContent = '一键压缩所有图片';

    if (savedBytes > 0) {
      result.style.color = '#4caf84';
      result.textContent = '✓ 压缩完成，释放了约 ' + smFormatSize(Math.max(0, savedBytes));
    } else {
      result.style.color = '#9aafc4';
      result.textContent = '图片已是最优状态，无需压缩';
    }

    // 刷新显示
    smRender();
  }

  /* 递归替换对象中的 base64 图片 */
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

  /* ── Token 预估器 ── */
  function smEstimateTokens(str) {
    // 粗略估算：中文约1.5字符/token，英文约4字符/token
    // 混合文本用平均值约2.5字符/token
    return Math.ceil((str || '').length / 2.5);
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
        '<img class="storage-token-role-avatar" src="' + (role.avatar || 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=default') + '" alt="">' +
        '<div class="storage-token-role-name">' + (role.nickname || role.realname || '未知') + '</div>' +
        '<div class="storage-token-role-arrow">›</div>';
      item.addEventListener('click', () => smOpenTokenModal(role));
      container.appendChild(item);
    });
  }

  function smOpenTokenModal(role) {
    const modal    = document.getElementById('storage-token-modal');
    const title    = document.getElementById('storage-token-modal-title');
    const body     = document.getElementById('storage-token-modal-body');
    if (!modal || !title || !body) return;

    title.textContent = (role.nickname || role.realname) + ' · Token 分析';

    const chat = (typeof liaoChats !== 'undefined')
      ? liaoChats.find(c => c.roleId === role.id)
      : null;

    // 各部分字符数
    const parts = [];

    // 1. 角色设定
    const settingStr = role.setting || '';
    parts.push({ name: '角色设定', chars: settingStr.length, color: '#99C8ED' });

    // 2. 用户设定
    const userSetting = (chat && chat.chatUserSetting) || '';
    parts.push({ name: '用户设定', chars: userSetting.length, color: '#f0cc78' });

    // 3. 长期记忆
    const longMem = (chat && chat.memory && chat.memory.longTerm) || [];
    const longMemStr = longMem.map(m => m.content || '').join('\n');
    parts.push({ name: '长期记忆', chars: longMemStr.length, color: '#7ecb7e' });

    // 4. 重要记忆
    const impMem = (chat && chat.memory && chat.memory.important) || [];
    const impMemStr = impMem.map(m => m.content || '').join('\n');
    parts.push({ name: '重要记忆', chars: impMemStr.length, color: '#c8a0e8' });

    // 5. 世界书
    let wbStr = '';
    if (typeof getWorldBookInjection === 'function' && chat) {
      wbStr = getWorldBookInjection(chat.messages || [], role.id) || '';
    }
    parts.push({ name: '世界书注入', chars: wbStr.length, color: '#f0a070' });

    // 6. 表情包名称列表
    const emojiList = (typeof liaoEmojis !== 'undefined') ? liaoEmojis : [];
    const emojiStr  = emojiList.map(e => e.name || '').join('、');
    parts.push({ name: '表情包名称', chars: emojiStr.length, color: '#e07a7a' });

    // 7. 最近聊天记录（按设置条数）
    const maxApiMsgs = (chat && chat.chatSettings && chat.chatSettings.maxApiMsgs) || 0;
    const msgs = (chat && chat.messages || []).filter(m => !m.hidden && (m.role === 'user' || m.role === 'assistant'));
    const recentMsgs = maxApiMsgs > 0 ? msgs.slice(-maxApiMsgs) : msgs;
    const msgsStr = recentMsgs.map(m => (m.content || '')).join('\n');
    parts.push({ name: '聊天记录 (' + recentMsgs.length + '条)', chars: msgsStr.length, color: '#70c0d0' });

    const totalChars  = parts.reduce((s, p) => s + p.chars, 0);

const totalTokens = Math.ceil(totalChars / 2.5);
 // 粗算

    body.innerHTML = '';

    // 总览卡片
    const overview = document.createElement('div');
    overview.className = 'storage-token-section';
    overview.innerHTML =
      '<div class="storage-token-section-title">总计</div>' +
      '<div class="storage-token-section-value">' + totalChars.toLocaleString() + ' 字符</div>' +
      '<div class="storage-token-section-sub">约 ' + totalTokens.toLocaleString() + ' tokens（估算）</div>';
    body.appendChild(overview);

    // 各部分详情
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

    // 建议
    const advice = document.createElement('div');
    advice.className = 'storage-token-advice';
    advice.innerHTML = '<div class="storage-token-advice-title">优化建议</div><div class="storage-token-advice-text">' +
      smGenerateAdvice(parts, totalChars) + '</div>';
    body.appendChild(advice);

    modal.style.display = 'flex';
  }

  function smGenerateAdvice(parts, totalChars) {
  const lines = []; // 加上这一行
    const settingPart = parts.find(p => p.name === '角色设定');
    const memPart      = parts.find(p => p.name === '长期记忆');
    const wbPart       = parts.find(p => p.name === '世界书注入');
    const emojiPart    = parts.find(p => p.name === '表情包名称');
    const msgPart      = parts.find(p => p.name.startsWith('聊天记录'));


    if (totalChars < 2000) {
      lines.push('✓ 当前发送字符数较少，对 AI 响应速度影响不大。');
    } else if (totalChars < 6000) {
      lines.push('⚠ 字符数适中，建议控制在 6000 以内以获得最佳响应速度。');
    } else {
      lines.push('⚠ 字符数较多，可能影响 AI 响应速度和质量，建议优化。');
    }

    if (settingPart && settingPart.chars > 1500) {
      lines.push('• 角色设定过长（' + settingPart.chars + ' 字符），建议精简到 800 字以内，保留最核心的性格和说话方式。');
    }
    if (memPart && memPart.chars > 1000) {
      lines.push('• 长期记忆条目较多（' + memPart.chars + ' 字符），可以删除过时或重复的记忆条目。');
    }
    if (wbPart && wbPart.chars > 2000) {
      lines.push('• 世界书注入内容较多（' + wbPart.chars + ' 字符），建议检查触发词设置，避免不必要的条目被注入。');
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

  /* ── 主渲染函数 ── */
  function smRender() {
    const groups    = smGetAllData();
    const total     = smTotalSize();
    const totalEl   = document.getElementById('storage-total-text');
    const warnEl    = document.getElementById('storage-warning');
    const centerEl  = document.getElementById('storage-center-value');
    const canvas    = document.getElementById('storage-donut-canvas');

    // 总量显示
    const LS_MAX = 5 * 1024 * 1024; // 5MB
    const pct    = (total / LS_MAX * 100).toFixed(1);
    if (totalEl)  totalEl.textContent  = '已使用 ' + smFormatSize(total) + ' / 约 5 MB（' + pct + '%）';
    if (centerEl) centerEl.textContent = pct + '%';

    // 警告
    if (warnEl) {
      if (total > LS_MAX * 0.9)      warnEl.textContent = '⚠ 存储空间即将耗尽，建议立即压缩图片或清理数据！';
      else if (total > LS_MAX * 0.7) warnEl.textContent = '存储空间使用超过 70%，建议压缩图片。';
      else                            warnEl.textContent = '';
    }

    // 甜甜圈
    const segments = Object.values(groups).filter(g => g.size > 0);
    if (canvas) smDrawDonut(canvas, segments);

    // 列表
    smRenderList(groups, total);

    // 图片统计
    smRenderImageStats();

    // Token 角色列表
    smRenderTokenRoleList();
  }

  /* ── 页面入口 ── */
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

  /* ── 事件绑定 ── */
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
  if (tokenModal) tokenModal.addEventListener('click', function(e) {
    if (e.target === this) this.style.display = 'none';
  });

  // 压缩质量按钮
  document.querySelectorAll('.storage-quality-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      document.querySelectorAll('.storage-quality-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      smSelectedQuality = this.dataset.quality;
    });
  });

  // 暴露给设置页面调用
  window.StorageManager = { open: smOpen, close: smClose };

})();
