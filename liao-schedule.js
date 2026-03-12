/* ============================================================
   liao-schedule.js — 角色日程逻辑
   ============================================================ */

(function () {
  'use strict';

  /* ============================================================
     常量与配置
     ============================================================ */

  const DAY_NAMES = ['周一','周二','周三','周四','周五','周六','周日'];

  /* 状态定义 */
  const STATUS_LIST = [
    { id: 'sleep',   emoji: '😴', label: '睡觉',   color: '#b0c8e8', replyDefault: 'none' },
    { id: 'work',    emoji: '💼', label: '工作/上学', color: '#f0a070', replyDefault: 'low'  },
    { id: 'busy',    emoji: '⚡', label: '忙碌',   color: '#e07a7a', replyDefault: 'low'  },
    { id: 'leisure', emoji: '😊', label: '休闲',   color: '#7ecb7e', replyDefault: 'high' },
    { id: 'outing',  emoji: '🚶', label: '外出',   color: '#f0cc78', replyDefault: 'mid'  },
    { id: 'eat',     emoji: '🍜', label: '吃饭',   color: '#c8a0e8', replyDefault: 'mid'  },
    { id: 'exercise',emoji: '🏃', label: '运动',   color: '#90d0b0', replyDefault: 'low'  },
    { id: 'bath',    emoji: '🛁', label: '洗漱/洗澡',color: '#a0b8d8',replyDefault: 'low'  },
  ];

  /* 回复概率标签 */
  const REPLY_LABELS = {
    high: { text: '必回',   class: 'high' },
    mid:  { text: '可能回', class: 'mid'  },
    low:  { text: '少回',   class: 'low'  },
    none: { text: '不回',   class: 'none' },
  };

  /* ============================================================
     数据读写
     ============================================================ */

  function schGetKey(roleId) {
    return 'liao_schedule_' + roleId;
  }

  function schLoad(roleId) {
    try {
      const raw = localStorage.getItem(schGetKey(roleId));
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    /* 7天空日程 */
    return Array.from({ length: 7 }, () => []);
  }

  function schSave(roleId, schedule) {
    try {
      localStorage.setItem(schGetKey(roleId), JSON.stringify(schedule));
    } catch (e) {}
  }

  /* ============================================================
     当前状态：获取角色此刻在做什么
     ============================================================ */

  /**
   * 获取角色当前时间段的状态
   * @param {string} roleId
   * @returns {{ slot: object|null, status: object|null }}
   */
  function schGetCurrentStatus(roleId) {
    const schedule = schLoad(roleId);
    const now      = new Date();
    /* JS: 0=周日, 1=周一 ... 改成 0=周一 ... 6=周日 */
    const dayIdx   = (now.getDay() + 6) % 7;
    const daySlots = schedule[dayIdx] || [];
    const nowMins  = now.getHours() * 60 + now.getMinutes();

    for (const slot of daySlots) {
      const [sh, sm] = slot.startTime.split(':').map(Number);
      const [eh, em] = slot.endTime.split(':').map(Number);
      const startMins = sh * 60 + sm;
      let   endMins   = eh * 60 + em;
      if (endMins <= startMins) endMins += 24 * 60; /* 跨午夜 */

      const checkMins = endMins > 24 * 60 && nowMins < startMins
        ? nowMins + 24 * 60
        : nowMins;

      if (checkMins >= startMins && checkMins < endMins) {
        const statusObj = STATUS_LIST.find(s => s.id === slot.statusId) || null;
        return { slot, status: statusObj };
      }
    }
    return { slot: null, status: null };
  }

  /**
   * 判断角色能否回复（在 triggerAiReply 之前调用）
   * 返回 { canReply: bool, reason: string, probability: string }
   */
  function schCheckCanReply(roleId) {
    const { slot, status } = schGetCurrentStatus(roleId);

    if (!slot) {
      /* 没有日程安排，默认可以回复 */
      return { canReply: true, reason: '', probability: 'high' };
    }

    const replyLevel = slot.replyLevel || (status ? status.replyDefault : 'high');

    switch (replyLevel) {
      case 'none':
        return {
          canReply: false,
          reason:   (status ? status.emoji + ' ' : '') + (slot.activity || (status ? status.label : '休息中')) + '，暂时无法回复',
          probability: 'none'
        };
      case 'low': {
        /* 20% 概率回复 */
        const roll = Math.random();
        return {
          canReply: roll < 0.20,
          reason:   roll >= 0.20
            ? (status ? status.emoji + ' ' : '') + (slot.activity || status?.label) + '，比较忙，没有看到消息'
            : '',
          probability: 'low'
        };
      }
      case 'mid': {
        /* 60% 概率回复 */
        const roll = Math.random();
        return {
          canReply: roll < 0.60,
          reason:   roll >= 0.60
            ? (status ? status.emoji + ' ' : '') + (slot.activity || status?.label) + '，正好在忙，稍后再回'
            : '',
          probability: 'mid'
        };
      }
      case 'high':
      default:
        return { canReply: true, reason: '', probability: 'high' };
    }
  }

  /* 暴露给外部 */
  window.schCheckCanReply    = schCheckCanReply;
  window.schGetCurrentStatus = schGetCurrentStatus;
  window.schLoad             = schLoad;
  window.schSave             = schSave;

  /* ============================================================
     UI 渲染
     ============================================================ */

  let _currentRoleId = null;
  let _currentDay    = 0; /* 0=周一 */
  let _schedule      = null;
  let _editingSlotIdx = -1;

  /* 切到日程 tab 时初始化 */
  function schInitUI(roleId) {
    _currentRoleId = roleId;
    _schedule      = schLoad(roleId);

    /* 默认选今天 */
    const todayIdx = (new Date().getDay() + 6) % 7;
    _currentDay    = todayIdx;

    renderDayTabs();
    renderSlotList();
    bindSchEvents();
  }

  window.schInitUI = schInitUI;

  /* ── 渲染星期选项卡 ── */
  function renderDayTabs() {
    const todayIdx = (new Date().getDay() + 6) % 7;
    const container = document.getElementById('sch-day-tabs');
    if (!container) return;

    container.querySelectorAll('.sch-day-btn').forEach((btn, i) => {
      btn.classList.toggle('active', i === _currentDay);
      btn.classList.toggle('today', i === todayIdx);
    });
  }

  /* ── 渲染时间段列表 ── */
  function renderSlotList() {
    const container = document.getElementById('sch-list');
    if (!container) return;
    container.innerHTML = '';

    const slots = (_schedule[_currentDay] || []).slice().sort((a, b) => {
      const ta = a.startTime.replace(':', '');
      const tb = b.startTime.replace(':', '');
      return parseInt(ta) - parseInt(tb);
    });

    if (!slots.length) {
      container.innerHTML = `
        <div class="sch-empty">
          <div class="sch-empty-icon">📅</div>
          今天还没有日程安排<br>
          点击「＋ 添加」手动添加，或点击「✦ AI生成」自动生成
        </div>`;
      return;
    }

    slots.forEach((slot, idx) => {
      const statusObj = STATUS_LIST.find(s => s.id === slot.statusId);
      const replyLevel = slot.replyLevel || (statusObj ? statusObj.replyDefault : 'high');
      const replyInfo  = REPLY_LABELS[replyLevel] || REPLY_LABELS.high;

      /* 计算时长 */
      const [sh, sm] = slot.startTime.split(':').map(Number);
      const [eh, em] = slot.endTime.split(':').map(Number);
      let   diffMins = (eh * 60 + em) - (sh * 60 + sm);
      if (diffMins < 0) diffMins += 24 * 60;
      const durText = diffMins >= 60
        ? Math.floor(diffMins / 60) + 'h' + (diffMins % 60 ? (diffMins % 60) + 'm' : '')
        : diffMins + 'min';

      const div = document.createElement('div');
      div.className = 'sch-slot';
      div.style.setProperty('--sch-color', statusObj ? statusObj.color : 'rgba(153,200,237,0.4)');
      div.dataset.idx = idx;

      div.innerHTML = `
        <div class="sch-slot-time">
          <div class="sch-slot-time-range">${slot.startTime}</div>
          <div class="sch-slot-duration">${durText}</div>
        </div>
        <div class="sch-slot-icon">${statusObj ? statusObj.emoji : '📌'}</div>
        <div class="sch-slot-content">
          <div class="sch-slot-activity">${slot.activity || (statusObj ? statusObj.label : '未命名')}</div>
          ${slot.desc ? `<div class="sch-slot-desc">${slot.desc}</div>` : ''}
        </div>
        <span class="sch-slot-reply ${replyInfo.class}">${replyInfo.text}</span>
        <button class="sch-slot-del" data-delidx="${idx}" title="删除">×</button>
      `;

      /* 点击卡片（非删除按钮）打开编辑 */
      div.addEventListener('click', function (e) {
        if (e.target.classList.contains('sch-slot-del')) return;
        openEditModal(idx);
      });

      container.appendChild(div);
    });

    /* 删除按钮事件 */
    container.querySelectorAll('.sch-slot-del').forEach(btn => {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        const rawIdx = parseInt(this.dataset.delidx);
        const sorted = (_schedule[_currentDay] || []).slice().sort((a, b) => {
          return parseInt(a.startTime.replace(':', '')) - parseInt(b.startTime.replace(':', ''));
        });
        const slotToRemove = sorted[rawIdx];
        _schedule[_currentDay] = (_schedule[_currentDay] || []).filter(s => s !== slotToRemove);
        schSave(_currentRoleId, _schedule);
        renderSlotList();
      });
    });
  }

  /* ============================================================
     编辑弹窗
     ============================================================ */

  function openEditModal(slotIdx) {
    _editingSlotIdx = slotIdx;

    let modal = document.getElementById('sch-edit-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id        = 'sch-edit-modal';
      modal.className = 'sch-edit-modal';
      modal.innerHTML = buildEditModalHTML();
      document.body.appendChild(modal);
      bindEditModalEvents(modal);
    }

    const sorted = (_schedule[_currentDay] || []).slice().sort((a, b) =>
      parseInt(a.startTime.replace(':', '')) - parseInt(b.startTime.replace(':', ''))
    );

    let slot = slotIdx >= 0 && sorted[slotIdx]
      ? JSON.parse(JSON.stringify(sorted[slotIdx]))
      : { startTime: '08:00', endTime: '09:00', statusId: 'leisure', activity: '', desc: '', replyLevel: 'high' };

    const titleEl = modal.querySelector('.sch-edit-title');
    if (titleEl) titleEl.textContent = slotIdx >= 0 ? '编辑时间段' : '添加时间段';

    modal.querySelector('#sch-edit-start').value    = slot.startTime;
    modal.querySelector('#sch-edit-end').value      = slot.endTime;
    modal.querySelector('#sch-edit-activity').value = slot.activity || '';
    modal.querySelector('#sch-edit-desc').value     = slot.desc     || '';

    /* 选中状态 */
    modal.querySelectorAll('.sch-status-option').forEach(opt => {
      opt.classList.toggle('selected', opt.dataset.sid === slot.statusId);
    });

    /* 选中回复概率 */
    const replyLevel = slot.replyLevel || 'high';
    modal.querySelectorAll('.sch-reply-option').forEach(opt => {
      const lvl = opt.dataset.reply;
      opt.className = 'sch-reply-option' + (lvl === replyLevel ? ' selected-' + lvl : '');
    });

    /* 存到弹窗的dataset，方便保存时读取 */
    modal.dataset.statusId   = slot.statusId;
    modal.dataset.replyLevel = replyLevel;

    modal.classList.add('show');
  }

  function buildEditModalHTML() {
    const statusOptionsHTML = STATUS_LIST.map(s =>
      `<div class="sch-status-option" data-sid="${s.id}">
        <div class="sch-status-emoji">${s.emoji}</div>
        <div class="sch-status-label">${s.label}</div>
      </div>`
    ).join('');

    const replyOptionsHTML = [
      { lvl: 'high', label: '必回'   },
      { lvl: 'mid',  label: '可能回' },
      { lvl: 'low',  label: '少回'   },
      { lvl: 'none', label: '不回'   },
    ].map(r =>
      `<button class="sch-reply-option" data-reply="${r.lvl}">${r.label}</button>`
    ).join('');

    return `
      <div class="sch-edit-box">
        <div class="sch-edit-title">添加时间段</div>

        <div style="display:flex;gap:10px;margin-bottom:12px;">
          <div style="flex:1;">
            <div class="liao-modal-label">开始时间</div>
            <input class="liao-modal-input" id="sch-edit-start" type="time" value="08:00">
          </div>
          <div style="flex:1;">
            <div class="liao-modal-label">结束时间</div>
            <input class="liao-modal-input" id="sch-edit-end" type="time" value="09:00">
          </div>
        </div>

        <div class="liao-modal-label">状态</div>
        <div class="sch-status-grid">${statusOptionsHTML}</div>

        <div class="liao-modal-label">活动名称（可选）</div>
        <input class="liao-modal-input" id="sch-edit-activity" placeholder="如：在家复习、咖啡厅打工…">

        <div class="liao-modal-label" style="margin-top:10px;">备注（可选）</div>
        <input class="liao-modal-input" id="sch-edit-desc" placeholder="补充说明…">

        <div class="liao-modal-label" style="margin-top:10px;">回复消息概率</div>
        <div class="sch-reply-options">${replyOptionsHTML}</div>

        <div class="liao-modal-btns" style="margin-top:16px;">
          <button class="liao-btn-primary" id="sch-edit-save">保存</button>
          <button class="liao-btn-ghost"   id="sch-edit-cancel">取消</button>
        </div>
      </div>`;
  }

  function bindEditModalEvents(modal) {
    /* 遮罩关闭 */
    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.classList.remove('show');
    });

    /* 状态选择 */
    modal.addEventListener('click', function (e) {
      const opt = e.target.closest('.sch-status-option');
      if (!opt) return;
      modal.querySelectorAll('.sch-status-option').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
      modal.dataset.statusId = opt.dataset.sid;
      /* 自动更新默认回复概率 */
      const statusObj = STATUS_LIST.find(s => s.id === opt.dataset.sid);
      if (statusObj) {
        const defaultReply = statusObj.replyDefault;
        modal.querySelectorAll('.sch-reply-option').forEach(o => {
          const lvl = o.dataset.reply;
          o.className = 'sch-reply-option' + (lvl === defaultReply ? ' selected-' + lvl : '');
        });
        modal.dataset.replyLevel = defaultReply;
      }
    });

    /* 回复概率选择 */
    modal.addEventListener('click', function (e) {
      const opt = e.target.closest('.sch-reply-option');
      if (!opt) return;
      const lvl = opt.dataset.reply;
      modal.querySelectorAll('.sch-reply-option').forEach(o => {
        o.className = 'sch-reply-option';
      });
      opt.className = 'sch-reply-option selected-' + lvl;
      modal.dataset.replyLevel = lvl;
    });

    /* 保存 */
    document.getElementById('sch-edit-save').addEventListener('click', () => {
      const start    = modal.querySelector('#sch-edit-start').value;
      const end      = modal.querySelector('#sch-edit-end').value;
      const activity = (modal.querySelector('#sch-edit-activity').value || '').trim();
      const desc     = (modal.querySelector('#sch-edit-desc').value     || '').trim();
      const statusId   = modal.dataset.statusId   || 'leisure';
      const replyLevel = modal.dataset.replyLevel || 'high';

      if (!start || !end) { alert('请填写开始和结束时间'); return; }

      const newSlot = { startTime: start, endTime: end, statusId, activity, desc, replyLevel };

      if (!_schedule[_currentDay]) _schedule[_currentDay] = [];

      if (_editingSlotIdx >= 0) {
        /* 编辑：找到原始 slot 并替换 */
        const sorted = _schedule[_currentDay].slice().sort((a, b) =>
          parseInt(a.startTime.replace(':', '')) - parseInt(b.startTime.replace(':', ''))
        );
        const originalSlot = sorted[_editingSlotIdx];
        const realIdx = _schedule[_currentDay].indexOf(originalSlot);
        if (realIdx >= 0) _schedule[_currentDay][realIdx] = newSlot;
        else _schedule[_currentDay].push(newSlot);
      } else {
        _schedule[_currentDay].push(newSlot);
      }

      schSave(_currentRoleId, _schedule);
      modal.classList.remove('show');
      renderSlotList();
    });

    /* 取消 */
    document.getElementById('sch-edit-cancel').addEventListener('click', () => {
      modal.classList.remove('show');
    });
  }

  /* ============================================================
     AI 生成日程
     ============================================================ */

  async function schAiGenerate() {
    if (!_currentRoleId) return;

    const chat = (typeof liaoChats !== 'undefined')
      ? liaoChats.find(c => c.roleId === _currentRoleId)
      : null;
    const role = (typeof liaoRoles !== 'undefined')
      ? liaoRoles.find(r => r.id === _currentRoleId)
      : null;

    if (!role) { alert('找不到角色信息'); return; }

    const cfg   = (typeof loadApiConfig === 'function') ? loadApiConfig() : null;
    const model = (typeof loadApiModel  === 'function') ? loadApiModel()  : '';
    if (!cfg || !cfg.url) { alert('请先配置 API'); return; }

    /* 显示生成中 */
    const listEl = document.getElementById('sch-list');
    if (listEl) {
      listEl.innerHTML = `<div class="sch-generating">
        ✦ AI 正在生成日程
        <span class="sch-generating-dot">.</span>
        <span class="sch-generating-dot" style="animation-delay:.2s">.</span>
        <span class="sch-generating-dot" style="animation-delay:.4s">.</span>
      </div>`;
    }

    const dayName   = DAY_NAMES[_currentDay];
    const roleName  = role.nickname || role.realname || '角色';
    const setting   = role.setting || '';

    const prompt = `你是角色「${roleName}」。角色设定：${setting || '普通人'}。
请为这个角色生成${dayName}的详细日程安排。
要求：
1. 覆盖全天24小时，时间段不重叠
2. 日程要符合角色性格和生活习惯
3. 包含睡眠、三餐、工作/学习、休闲等基本活动
4. 每个时间段必须包含：开始时间、结束时间、状态类型、活动名称

状态类型只能从以下选择：sleep/work/busy/leisure/outing/eat/exercise/bath

回复格式（JSON数组，不要有其他内容）：
[
  {"startTime":"22:00","endTime":"07:00","statusId":"sleep","activity":"睡觉","desc":"","replyLevel":"none"},
  {"startTime":"07:00","endTime":"07:30","statusId":"bath","activity":"起床洗漱","desc":"","replyLevel":"low"},
  ...
]

replyLevel 只能是：high/mid/low/none`;

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

      /* 提取 JSON */
      const match = content.match(/\[[\s\S]*\]/);
      if (!match) throw new Error('AI 返回格式不正确');

      const slots = JSON.parse(match[0]);
      if (!Array.isArray(slots) || !slots.length) throw new Error('日程数据为空');

      /* 验证字段 */
      const valid = slots.filter(s => s.startTime && s.endTime && s.statusId);
      _schedule[_currentDay] = valid;
      schSave(_currentRoleId, _schedule);
      renderSlotList();

    } catch (err) {
      if (listEl) listEl.innerHTML = '';
      renderSlotList();
      alert('AI 生成失败：' + err.message);
    }
  }

  /* ============================================================
     事件绑定（只绑定一次）
     ============================================================ */

  let _evBound = false;

  function bindSchEvents() {
    if (_evBound) return;
    _evBound = true;

    /* 星期选项卡 */
    const dayTabs = document.getElementById('sch-day-tabs');
    if (dayTabs) {
      dayTabs.addEventListener('click', function (e) {
        const btn = e.target.closest('.sch-day-btn');
        if (!btn) return;
        _currentDay = parseInt(btn.dataset.day);
        renderSlotList();
      });
    }

    /* AI 生成 */
    const aiBtn = document.getElementById('sch-ai-gen-btn');
    if (aiBtn) {
      aiBtn.addEventListener('click', schAiGenerate);
    }

    /* 添加按钮 */
    const addBtn = document.getElementById('sch-add-slot-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => {
        _editingSlotIdx = -1;
        openEditModal(-1);
      });
    }

    /* 复制到所有天 */
    const copyBtn = document.getElementById('sch-copy-all-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        if (!confirm('确定将' + DAY_NAMES[_currentDay] + '的日程复制到所有天吗？这会覆盖其他天的日程。')) return;
        const daySlots = JSON.parse(JSON.stringify(_schedule[_currentDay] || []));
        for (let i = 0; i < 7; i++) {
          _schedule[i] = JSON.parse(JSON.stringify(daySlots));
        }
        schSave(_currentRoleId, _schedule);
        alert('已复制到所有天！');
      });
    }
  }

})();
