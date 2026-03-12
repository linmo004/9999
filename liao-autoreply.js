/* ============================================================
   liao-autoreply.js — 在线状态 + 自动回复逻辑
   ============================================================ */

(function () {
  'use strict';

  /* ============================================================
     数据读写
     ============================================================ */
  function arKey(roleId) { return 'liao_autoreply_' + roleId; }

  function arLoad(roleId) {
    try {
      const raw = localStorage.getItem(arKey(roleId));
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {
      status:        'online',  /* online | offline */
      defaultReplies: [],        /* 默认回复列表 */
      keywordReplies: []         /* 关键词回复列表 */
    };
  }

  function arSave(roleId, data) {
    try { localStorage.setItem(arKey(roleId), JSON.stringify(data)); } catch (e) {}
  }

  /* ============================================================
     在线状态读写（对外暴露）
     ============================================================ */
  function arGetStatus(roleId) {
    return arLoad(roleId).status || 'online';
  }

  function arSetStatus(roleId, status) {
    const data = arLoad(roleId);
    data.status = status;
    arSave(roleId, data);
  }

  window.arGetStatus = arGetStatus;
  window.arSetStatus = arSetStatus;

  /* ============================================================
     自动回复触发（在 sendUserMessage 之后调用）
     ============================================================ */
  function arTryAutoReply(chatIdx, userContent) {
    if (chatIdx < 0) return false;
    const chat = liaoChats[chatIdx];
    const role = liaoRoles.find(r => r.id === chat.roleId);
    if (!role) return false;

    const data = arLoad(chat.roleId);
    if (data.status !== 'offline') return false;

    const uAvt = chat.chatUserAvatar || liaoUserAvatar;

    /* 1. 先检查关键词触发 */
    const content = (userContent || '').toLowerCase();
    let matched = null;
    for (const kw of (data.keywordReplies || [])) {
      const keywords = (kw.keywords || []);
      const hit = keywords.some(k => content.includes(k.toLowerCase()));
      if (hit) { matched = kw; break; }
    }

    let replyText = '';

    if (matched) {
      replyText = matched.reply || '';
    } else {
      /* 2. 随机从默认回复里选一条 */
      const defaults = (data.defaultReplies || []).filter(r => r.trim());
      if (defaults.length) {
        replyText = defaults[Math.floor(Math.random() * defaults.length)];
      }
    }

    if (!replyText) return false;

    /* 发送自动回复气泡 */
const prefix = matched ? '【自动回复】：' : '【默认回复】：';
setTimeout(() => {
  const msgObj = {
    role:    'assistant',
    type:    'text',
    content: prefix + replyText, 
        ts:      Date.now(),
        id:      'msg_' + Date.now() + '_ar',
        isAutoReply: true
      };
      chat.messages.push(msgObj);
      lSave('chats', liaoChats);
      appendMessageBubble(msgObj, role, uAvt, true);
      renderChatList();
    }, 800 + Math.random() * 600);

    return true;
  }

  window.arTryAutoReply = arTryAutoReply;

  /* ============================================================
     识别 AI 回复里的 [STATUS:offline] / [STATUS:online]
     ============================================================ */
  function arParseStatusFromContent(content, roleId) {
    if (!content || !roleId) return;
    const offlineMatch = content.match(/\[STATUS:offline\]/i);
const onlineMatch  = content.match(/\[STATUS:online\]/i);
    if (offlineMatch) arSetStatus(roleId, 'offline');
    if (onlineMatch)  arSetStatus(roleId, 'online');
  }

  window.arParseStatusFromContent = arParseStatusFromContent;

  /* ============================================================
     更新顶栏在线状态显示
     ============================================================ */
  function arUpdateStatusBar(roleId) {
    const dot  = document.getElementById('chat-status-dot');
    const text = document.getElementById('chat-status-text');
    if (!dot || !text) return;

    const status = arGetStatus(roleId);
    dot.className  = 'chat-status-dot ' + status;
    text.className = 'chat-status-text ' + status;
    text.textContent = status === 'online' ? '在线' : '离线';
  }

  window.arUpdateStatusBar = arUpdateStatusBar;

  /* ============================================================
     自动回复 Tab UI 渲染
     ============================================================ */
  let _arCurrentRoleId = null;

  function arInitTab(roleId) {
    _arCurrentRoleId = roleId;
    arRenderTab();
    arBindTabEvents();
  }

  window.arInitTab = arInitTab;

  function arRenderTab() {
    const roleId = _arCurrentRoleId;
    if (!roleId) return;
    const data    = arLoad(roleId);
    const page    = document.getElementById('cs-tab-autoreply-page');
    if (!page) return;

    page.innerHTML = `
      <div class="cs-page-scroll" style="padding:14px 14px 40px;">

        <!-- AI 一键生成 -->
        <div class="ar-section-title">AI 生成</div>
        <div class="ar-card">
          <div style="font-size:12px;color:var(--text-mid);margin-bottom:10px;line-height:1.6;">
            AI 会根据角色人设，自动生成默认回复和一组关键词回复。
          </div>
          <button class="ar-ai-btn" id="ar-ai-gen-btn">✦ AI 一键生成自动回复</button>
          <div id="ar-ai-gen-msg" style="font-size:11px;color:#4caf84;min-height:16px;text-align:center;"></div>
        </div>

        <!-- 默认回复 -->
        <div class="ar-section-title">默认自动回复</div>
        <div class="ar-card">
          <div style="font-size:11px;color:var(--text-light);margin-bottom:10px;line-height:1.6;">
            离线时收到消息，若没有触发关键词，随机发送以下一条回复。
          </div>
          <div class="ar-reply-list" id="ar-default-list"></div>
          <div class="ar-add-row">
            <textarea class="ar-add-input" id="ar-default-input" placeholder="添加一条默认回复…" rows="1"></textarea>
            <button class="ar-add-btn" id="ar-default-add-btn">添加</button>
          </div>
        </div>

        <!-- 关键词回复 -->
        <div class="ar-section-title">关键词自动回复</div>
        <div class="ar-card">
          <div style="font-size:11px;color:var(--text-light);margin-bottom:10px;line-height:1.6;">
            当消息包含关键词时触发对应回复。点击「查看」才能看到内容，保持神秘感！
          </div>
          <div id="ar-kw-list"></div>
          <div id="ar-kw-empty" style="font-size:12px;color:var(--text-light);text-align:center;padding:10px 0;display:none;">
            暂无关键词回复，点击上方 AI 生成
          </div>
        </div>

      </div>`;

    arRenderDefaultList(data);
    arRenderKwList(data);
  }

  function arRenderDefaultList(data) {
    const container = document.getElementById('ar-default-list');
    if (!container) return;
    container.innerHTML = '';
    const replies = data.defaultReplies || [];

    if (!replies.length) {
      container.innerHTML = '<div style="font-size:12px;color:var(--text-light);text-align:center;padding:8px 0;">暂无默认回复</div>';
      return;
    }

    replies.forEach((text, idx) => {
      const item = document.createElement('div');
      item.className = 'ar-reply-item';
      item.innerHTML =
        '<div class="ar-reply-item-text">' + escHtml(text) + '</div>' +
        '<button class="ar-reply-item-del" data-delidx="' + idx + '">×</button>';
      container.appendChild(item);
    });

    container.querySelectorAll('.ar-reply-item-del').forEach(btn => {
      btn.addEventListener('click', function () {
        const d = arLoad(_arCurrentRoleId);
        d.defaultReplies.splice(parseInt(this.dataset.delidx), 1);
        arSave(_arCurrentRoleId, d);
        arRenderDefaultList(d);
      });
    });
  }

  function arRenderKwList(data) {
    const container = document.getElementById('ar-kw-list');
    const emptyEl   = document.getElementById('ar-kw-empty');
    if (!container) return;
    container.innerHTML = '';

    const list = data.keywordReplies || [];
    if (!list.length) {
      if (emptyEl) emptyEl.style.display = 'block';
      return;
    }
    if (emptyEl) emptyEl.style.display = 'none';

    list.forEach((kw, idx) => {
      const item = document.createElement('div');
      item.className = 'ar-kw-item';

      const tagsHtml = (kw.keywords || []).map(k =>
        '<span class="ar-kw-tag">' + escHtml(k) + '</span>'
      ).join('');

      item.innerHTML =
        '<button class="ar-kw-del" data-kwidx="' + idx + '">×</button>' +
        '<div class="ar-kw-keywords">' + tagsHtml + '</div>' +
        '<div class="ar-kw-reply-text" id="ar-kw-text-' + idx + '">••• 点击「查看」解锁内容</div>' +
                '<button class="ar-reveal-btn" data-revealidx="' + idx + '">查看回复内容</button>';

      container.appendChild(item);
    });

    /* 删除按钮 */
    container.querySelectorAll('.ar-kw-del').forEach(btn => {
      btn.addEventListener('click', function () {
        const d = arLoad(_arCurrentRoleId);
        d.keywordReplies.splice(parseInt(this.dataset.kwidx), 1);
        arSave(_arCurrentRoleId, d);
        arRenderKwList(d);
      });
    });

    /* 查看按钮 */
    container.querySelectorAll('.ar-reveal-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const idx  = parseInt(this.dataset.revealidx);
        const d    = arLoad(_arCurrentRoleId);
        const kw   = d.keywordReplies[idx];
        if (!kw) return;
        if (!confirm('确定要查看这条自动回复的内容吗？')) return;
        const textEl = document.getElementById('ar-kw-text-' + idx);
        if (textEl) {
          textEl.textContent = kw.reply || '（无内容）';
          textEl.classList.add('revealed');
        }
        this.style.display = 'none';
      });
    });
  }

  let _arEventsBound = false;

  function arBindTabEvents() {
    if (_arEventsBound) return;
    _arEventsBound = true;

    /* AI 生成 */
    document.addEventListener('click', async function (e) {
      if (e.target && e.target.id === 'ar-ai-gen-btn') {
        const roleId = _arCurrentRoleId;
        if (!roleId) return;
        const role = liaoRoles.find(r => r.id === roleId);
        if (!role) return;

        const cfg   = loadApiConfig();
        const model = loadApiModel();
        if (!cfg || !cfg.url) { alert('请先配置 API'); return; }

        const msgEl = document.getElementById('ar-ai-gen-msg');
        if (msgEl) { msgEl.style.color = '#9aafc4'; msgEl.textContent = 'AI 生成中…'; }
        e.target.disabled = true;

        const roleName    = role.nickname || role.realname || '角色';
        const roleSetting = role.setting || '';

        const prompt = `你扮演角色「${roleName}」。角色设定：${roleSetting || '普通人'}。

请为这个角色生成手机自动回复。当角色设置为"离线"状态时使用这些回复。

要求：
1. 生成3条默认自动回复（角色不在线时的通用回复，要符合角色性格）
2. 生成8组关键词自动回复，每组包含：
   - 2~4个同义关键词（精简，优先2字以内）
   - 1条对应回复
3.回复内容里不要用句号结尾

关键词分组建议：问好、晚安、想你、吃饭、在吗、生气、无聊、等待

严格按此 JSON 格式输出，不要输出其他内容：
{
  "defaultReplies": ["回复1", "回复2", "回复3"],
  "keywordReplies": [
    {"keywords": ["早", "早安", "早上好"], "reply": "回复内容"},
    {"keywords": ["晚安", "睡了", "拜拜"], "reply": "回复内容"}
  ]
}`;

        try {
          const endpoint = cfg.url.replace(/\/$/, '') + '/chat/completions';
          const headers  = { 'Content-Type': 'application/json' };
          if (cfg.key) headers['Authorization'] = 'Bearer ' + cfg.key;

          const res = await fetch(endpoint, {
            method: 'POST', headers,
            body: JSON.stringify({
              model,
              messages: [{ role: 'user', content: prompt }],
              stream: false
            })
          });

          if (!res.ok) throw new Error('HTTP ' + res.status);
          const json    = await res.json();
          const content = (json.choices?.[0]?.message?.content || '').trim();
          const match   = content.match(/\{[\s\S]*\}/);
          if (!match) throw new Error('格式不正确');

          const generated = JSON.parse(match[0]);
          const d = arLoad(roleId);
          if (Array.isArray(generated.defaultReplies)) {
            d.defaultReplies = generated.defaultReplies.filter(Boolean);
          }
          if (Array.isArray(generated.keywordReplies)) {
            d.keywordReplies = generated.keywordReplies.filter(k => k.keywords && k.reply);
          }
          arSave(roleId, d);

          const kwCount = (d.keywordReplies || []).length;
          if (msgEl) {
            msgEl.style.color = '#4caf84';
            msgEl.textContent = '✓ 生成完成！' + (d.defaultReplies.length) + ' 条默认回复 + ' + kwCount + ' 组关键词回复';
          }
          alert('AI 生成完成！生成了 ' + d.defaultReplies.length + ' 条默认回复 和 ' + kwCount + ' 组关键词自动回复。\n\n关键词回复默认隐藏，点击「查看」才能看到内容～');

          arRenderDefaultList(d);
          arRenderKwList(d);

        } catch (err) {
          if (msgEl) { msgEl.style.color = '#e07a7a'; msgEl.textContent = '生成失败：' + err.message; }
        } finally {
          e.target.disabled = false;
        }
      }
    });

    /* 添加默认回复 */
    document.addEventListener('click', function (e) {
      if (e.target && e.target.id === 'ar-default-add-btn') {
        const input = document.getElementById('ar-default-input');
        const text  = (input ? input.value.trim() : '');
        if (!text) return;
        const d = arLoad(_arCurrentRoleId);
        if (!d.defaultReplies) d.defaultReplies = [];
        d.defaultReplies.push(text);
        arSave(_arCurrentRoleId, d);
        if (input) input.value = '';
        arRenderDefaultList(d);
      }
    });
  }

})();

