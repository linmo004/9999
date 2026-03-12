/* ============================================================
   batoru.js — 大逃杀 App 逻辑层（v3 修复版）
   ============================================================ */

(function () {
  'use strict';

  /* ============================================================
     工具函数
     ============================================================ */
  function btrLoad(key) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
    catch (e) { return null; }
  }
  function btrSave(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }
  function btrGetApiConfig() { return btrLoad('halo9_apiActiveConfig'); }
  function btrGetApiModel()  { return btrLoad('halo9_apiCurrentModel') || ''; }

  function btrGetRoles() {
    for (const k of ['liao_roles','halo9_roles','roles']) {
      const v = btrLoad(k);
      if (Array.isArray(v) && v.length) return v;
    }
    return [];
  }

  function btrGetRoleName(role) {
    return role.realname || role.nickname || role.name || '未知';
  }
  function btrGetRoleAvatar(role) {
    return role.avatar ||
      'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=' +
      encodeURIComponent(btrGetRoleName(role));
  }
  function btrGetRoleSetting(role) {
    return (role.setting || role.persona || role.description || '').slice(0, 200);
  }
  function btrGetUserAvatar() {
    return btrLoad('halo9_userAvatar') || btrLoad('liao_userAvatar') ||
      'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=btr_user';
  }

  async function btrCallAPI(messages) {
    const cfg   = btrGetApiConfig();
    const model = btrGetApiModel();
    if (!cfg || !cfg.url || !model) throw new Error('未配置API，请在设置中配置');
    const endpoint = cfg.url.replace(/\/$/, '') + '/chat/completions';
    const headers  = { 'Content-Type': 'application/json' };
    if (cfg.key) headers['Authorization'] = 'Bearer ' + cfg.key;
    const res = await fetch(endpoint, {
      method: 'POST', headers,
      body: JSON.stringify({ model, messages, stream: false })
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const json = await res.json();
    return (json.choices?.[0]?.message?.content || '').trim();
  }

  /* ============================================================
     游戏状态
     ============================================================ */
  const SAVES_KEY = 'halo9_batoru_saves';
  const MAX_SAVES = 5;
  let gs = null;

  function btrNewGameState() {
    return {
      mode:             'player',
      userSetup:        { name: '幸存者', setting: '', mode: 'player' },
      participants:     [],
      outline:          [],
      scene:            '',
      totalDays:        4,
      currentDayIndex:  0,
      aliveList:        [],
      userStats:        { hp: 100, hunger: 100, stamina: 100, location: '未知', statusTags: ['正常'] },
      inventory:        [],
      narrativeHistory: [],
      broadcastQueue:   [],
      danmakuHistory:   [],
      pendingChat:      '',
      isUserDead:       false,
      gameOver:         false,
      winner:           '',
    };
  }

  const PERIOD_LABELS = ['早', '午', '晚'];
  function btrDayLabel(idx) {
    const day    = Math.floor(idx / 3) + 1;
    const period = PERIOD_LABELS[idx % 3];
    return '第' + day + '天 ' + period;
  }

  /* 时间段对应的环境描述，注入给AI */
  function btrPeriodContext(idx) {
    const period = idx % 3;
    if (period === 0) return '现在是清晨。天刚亮，光线昏暗，气温低，能见度有限。';
    if (period === 1) return '现在是正午。太阳高悬，光线充足，但消耗体力更快，饥饿感加剧。';
    return '现在是夜晚。周围黑暗，危险系数上升，可选择睡觉休息或继续冒险。';
  }

  /* ============================================================
     Canvas 乱码字符雨
     ============================================================ */
  let glitchAnimId = null;

  function btrStartGlitch() {
    const canvas = document.getElementById('batoru-glitch-canvas');
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx   = canvas.getContext('2d');
    const cols  = Math.floor(canvas.width / 14);
    const drops = Array(cols).fill(1);
    const chars =
  '▒▓░█▄▀▌▐■□▪▫' +
  'ЖФЦЧШЩЪЫЬЭЮЯабвгдеёжзийкл' +
  'アイウエオカキクケコサシスセソタチツテト' +
  '囧囗囡囚囤囦囧囨囩囪囫囬园囮囯' +
  '░▒▓╔╗╚╝╠╣╦╩╬═║' +
  '①②③④⑤⑥⑦⑧⑨⑩⑪⑫' +
  '꧁꧂ꆧꁒꁷꂔꃊ' +
  '𝕯𝖆𝖗𝖐𝖓𝖊𝖘𝖘' +
  'ψΩΞΔΦΣΛΘΓΨ' +
  'Escapeandkillバトルロイヤル배틀로얄ậnchiếnhoànggiaแบทเทิลรอยัลबैटलरॉयलКоролевскаябитваبیٹلرائلمعركةرويالব্যাটেলরয়্যালBitwakrólewska◑﹏◐←→↑↓↖↗↙↘↔↕＋－∷√≌≒≦≧≥≤∽∵∴╱╲∑∏∝∞∮∫∪∩⊆⊂⊇⊃∈∧∨∟|⊥∠∥⌒⊙⊕△Φ※Å￡₂¤ℓ≠≈÷×＝≡^≯≮￥$ⅠⅡⅢⅣⅥⅤⅦⅪⅧⅨⅫⅩ○●△▲◇◆□■☆★◎♪♂♀§€£©®™℡囍㊣㈱キΖΙΑΓΒΔΗΕΘΣΜΞΤΩΨΧΟα▒▓░█▄▀▌▐■□▪▫' +
  '⚠⛧†‡§¶©®™';
    const colors = ['#8b0000','#cc0000','#3a0000','#5a0000','#6a0000'];

    function draw() {
      ctx.fillStyle = 'rgba(10,0,0,0.06)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = '13px monospace';
      for (let i = 0; i < drops.length; i++) {
        const ch    = chars[Math.floor(Math.random() * chars.length)];
        const color = colors[Math.floor(Math.random() * colors.length)];
        ctx.fillStyle = color;
        ctx.fillText(ch, i * 14, drops[i] * 14);
        if (drops[i] * 14 > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
      glitchAnimId = requestAnimationFrame(draw);
    }
    draw();
  }

  function btrStopGlitch() {
    if (glitchAnimId) { cancelAnimationFrame(glitchAnimId); glitchAnimId = null; }
    const canvas = document.getElementById('batoru-glitch-canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  /* ============================================================
     雪花屏
     ============================================================ */
  let staticTimer = null;

  function btrScheduleStatic() {
    if (staticTimer) clearTimeout(staticTimer);
    const delay = (10 + Math.random() * 15) * 1000;
    staticTimer = setTimeout(() => {
      const el = document.getElementById('batoru-static');
      if (!el) return;
      el.style.display   = 'block';
      el.style.opacity   = String(0.3 + Math.random() * 0.5);
      const dur    = 200 + Math.random() * 400;
      const shakeX = (Math.random() * 4 - 2).toFixed(1) + 'px';
      const shakeY = (Math.random() * 4 - 2).toFixed(1) + 'px';
      el.style.transform = 'translate(' + shakeX + ',' + shakeY + ')';
      setTimeout(() => {
        el.style.opacity   = '0';
        el.style.transform = 'translate(0,0)';
        setTimeout(() => { el.style.display = 'none'; }, 100);
        btrScheduleStatic();
      }, dur);
    }, delay);
  }

  function btrStopStatic() {
    if (staticTimer) { clearTimeout(staticTimer); staticTimer = null; }
    const el = document.getElementById('batoru-static');
    if (el) { el.style.display = 'none'; el.style.opacity = '0'; }
  }

  /* ============================================================
     屏幕切换
     ============================================================ */
  const BTR_SCREENS = [
    'batoru-lobby','batoru-user-setup','batoru-select',
    'batoru-loading','batoru-main','batoru-dead','batoru-ending'
  ];

  function btrShowScreen(id) {
    BTR_SCREENS.forEach(sid => {
      const el = document.getElementById(sid);
      if (!el) return;
      el.style.display = (sid === id) ? 'flex' : 'none';
    });
  }

  /* ============================================================
     全局接口
     ============================================================ */
  window.BatoruApp = {
        open() {
      const app = document.getElementById('batoru-app');
      if (app) app.style.display = 'flex';
      btrStopGlitch();
      btrShowScreen('batoru-lobby');
      btrStartGlitch();
      btrScheduleStatic();
      setTimeout(() => { btrUpdateContinueBtn(); }, 50); // ← 改这里
    },
    close() {
      const app = document.getElementById('batoru-app');
      if (app) app.style.display = 'none';
      btrStopGlitch();
      btrStopStatic();
      gs = null;
    }
  };

  document.addEventListener('click', function (e) {
    const item = e.target.closest('.app-item[data-app="batoru"]');
    if (item && window.BatoruApp) window.BatoruApp.open();
  });

  /* ============================================================
     大厅
     ============================================================ */
    function btrUpdateContinueBtn() {
    const btn = document.getElementById('btr-continue-btn');
    if (!btn) return;
    let count = 0;
    try {
      const raw = localStorage.getItem(SAVES_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) count = arr.length;
      }
    } catch (e) { count = 0; }

    if (count > 0) {
      btn.disabled         = false;
      btn.style.opacity    = '1';
      btn.style.pointerEvents = 'auto';
      btn.style.animation  = '';
    } else {
      btn.disabled         = true;
      btn.style.opacity    = '0.35';
      btn.style.pointerEvents = 'none';
      btn.style.animation  = 'none';
    }
  }



  document.getElementById('btr-start-btn').addEventListener('click', () => {
    btrShowScreen('batoru-user-setup');
    const ni = document.getElementById('btr-user-name-input');
    const si = document.getElementById('btr-user-setting-input');
    if (ni) ni.value = '';
    if (si) si.value = '';
    const pr = document.querySelector('input[name="btr-mode"][value="player"]');
    if (pr) pr.checked = true;
  });

  document.getElementById('btr-continue-btn').addEventListener('click', () => {
  let saves = [];
  try {
    const raw = localStorage.getItem(SAVES_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) saves = arr;
    }
  } catch (e) { saves = []; }
  if (!saves.length) { alert('没有找到存档'); return; }
  btrRenderSavesList(saves);
  document.getElementById('btr-saves-modal').style.display = 'flex';
});


  document.getElementById('btr-quit-lobby-btn').addEventListener('click', () => {
    btrShowExitWarning(() => window.BatoruApp.close());
  });

  document.getElementById('btr-saves-close').addEventListener('click', () => {
    document.getElementById('btr-saves-modal').style.display = 'none';
  });

  document.getElementById('btr-saves-modal').addEventListener('click', function (e) {
    if (e.target === this) this.style.display = 'none';
  });

  function btrRenderSavesList(saves) {
    const container = document.getElementById('btr-saves-list');
    if (!container) return;
    container.innerHTML = '';
    saves.slice().reverse().forEach((save, revIdx) => {
      const realIdx = saves.length - 1 - revIdx;
      const div = document.createElement('div');
      div.className = 'btr-save-item';
      div.innerHTML =
        '<div class="btr-save-time">' + save.saveTime + '</div>' +
        '<div class="btr-save-info">' + save.dayLabel +
        ' &nbsp;·&nbsp; 存活 ' + save.aliveCount + ' 人</div>';
      div.addEventListener('click', () => {
        document.getElementById('btr-saves-modal').style.display = 'none';
        btrLoadSave(saves[realIdx]);
      });
      container.appendChild(div);
    });
  }

  function btrLoadSave(save) {
    gs = JSON.parse(JSON.stringify(save.gameState));
    btrEnterMainGame(true);
  }

  /* ============================================================
     用户设定界面
     ============================================================ */
  document.getElementById('btr-setup-back').addEventListener('click',  () => btrShowScreen('batoru-lobby'));
  document.getElementById('btr-setup-back2').addEventListener('click', () => btrShowScreen('batoru-lobby'));

  document.getElementById('btr-setup-next').addEventListener('click', () => {
    const ni   = document.getElementById('btr-user-name-input');
    const si   = document.getElementById('btr-user-setting-input');
    const mr   = document.querySelector('input[name="btr-mode"]:checked');
    const name    = (ni ? ni.value.trim() : '') || btrLoad('liao_userName') || '幸存者';
    const setting = si ? si.value.trim() : '';
    const mode    = mr ? mr.value : 'player';
    gs           = btrNewGameState();
    gs.mode      = mode;
    gs.userSetup = { name, setting, mode };
    btrRenderRoleSelect();
    btrShowScreen('batoru-select');
  });

  /* ============================================================
     角色选择界面
     ============================================================ */
  let selectedRoleIds = new Set();

  document.getElementById('btr-select-back').addEventListener('click',  () => btrShowScreen('batoru-user-setup'));
  document.getElementById('btr-select-back2').addEventListener('click', () => btrShowScreen('batoru-user-setup'));

  function btrRenderRoleSelect() {
    selectedRoleIds = new Set();
    const grid  = document.getElementById('btr-role-grid');
    const hint  = document.getElementById('btr-select-hint');
    const roles = btrGetRoles();
    if (!grid) return;
    grid.innerHTML = '';

    const isPlayer = gs.userSetup.mode === 'player';
    if (hint) hint.textContent = isPlayer
      ? '点击角色选择对手（可多选，你已固定参战）'
      : '旁观模式：至少选择2个角色';

    if (isPlayer) {
      const userCard = document.createElement('div');
      userCard.className = 'btr-role-card is-user selected';
      userCard.innerHTML =
        '<img class="btr-role-avatar" src="' + btrGetUserAvatar() + '" alt="">' +
        '<div class="btr-role-name">' + gs.userSetup.name + '</div>' +
        '<div class="btr-role-tag">（你）</div>';
      grid.appendChild(userCard);
    }

    if (!roles.length) {
      const tip = document.createElement('div');
      tip.style.cssText = 'grid-column:1/-1;text-align:center;color:#9a8880;font-size:12px;padding:20px 0;letter-spacing:.06em;';
      tip.textContent = '角色库为空，请先在了了中添加角色';
      grid.appendChild(tip);
      return;
    }

    roles.forEach(role => {
      const id   = String(role.id || role.realname || role.nickname || role.name || Math.random());
      const card = document.createElement('div');
      card.className      = 'btr-role-card';
      card.dataset.roleId = id;
      card.innerHTML =
        '<img class="btr-role-avatar" src="' + btrGetRoleAvatar(role) + '" alt="">' +
        '<div class="btr-role-name">' + btrGetRoleName(role) + '</div>';
      card.addEventListener('click', () => {
        if (selectedRoleIds.has(id)) {
          selectedRoleIds.delete(id);
          card.classList.remove('selected');
        } else {
          selectedRoleIds.add(id);
          card.classList.add('selected');
        }
      });
      grid.appendChild(card);
    });
  }

  document.getElementById('btr-random-select').addEventListener('click', () => {
    const roles = btrGetRoles();
    if (!roles.length) { alert('角色库为空'); return; }
    const count    = 2 + Math.floor(Math.random() * 4);
    const shuffled = roles.slice().sort(() => Math.random() - 0.5);
    const picked   = shuffled.slice(0, Math.min(count, shuffled.length));
    selectedRoleIds = new Set();
    document.querySelectorAll('#btr-role-grid .btr-role-card:not(.is-user)').forEach(c => {
      c.classList.remove('selected');
    });
    picked.forEach(role => {
      const id = String(role.id || role.realname || role.nickname || role.name || '');
      selectedRoleIds.add(id);
      const card = document.querySelector('#btr-role-grid .btr-role-card[data-role-id="' + id + '"]');
      if (card) card.classList.add('selected');
    });
  });

  document.getElementById('btr-select-start').addEventListener('click', async () => {
    const roles    = btrGetRoles();
    const isPlayer = gs.userSetup.mode === 'player';
    const minSelect = isPlayer ? 1 : 2;

    if (selectedRoleIds.size < minSelect) {
      alert('至少选择 ' + minSelect + ' 个角色');
      return;
    }

    gs.participants = [];
    if (isPlayer) {
      gs.participants.push({
        id: 'user', name: gs.userSetup.name,
        avatar: btrGetUserAvatar(), setting: gs.userSetup.setting, isUser: true
      });
    }
    roles.forEach(role => {
      const id = String(role.id || role.realname || role.nickname || role.name || '');
      if (selectedRoleIds.has(id)) {
        gs.participants.push({
          id, name: btrGetRoleName(role),
          avatar: btrGetRoleAvatar(role), setting: btrGetRoleSetting(role), isUser: false
        });
      }
    });

    gs.aliveList = gs.participants.map(p => p.id);
    const total  = gs.participants.length;
    gs.totalDays = total <= 3 ? 4 : total <= 5 ? 6 : 8;

    btrShowScreen('batoru-loading');
    await btrGenerateOutline();
  });

  /* ============================================================
     大纲生成
     ============================================================ */
  async function btrGenerateOutline() {
    const progressBar = document.getElementById('btr-progress-bar');
    const subText     = document.getElementById('btr-loading-sub');

    let fakeProgress = 0;
    const fakeTick = setInterval(() => {
      fakeProgress = Math.min(fakeProgress + 1.2, 90);
      if (progressBar) progressBar.style.width = fakeProgress + '%';
    }, 300);

    const isPlayer = gs.userSetup.mode === 'player';
    let participantsDesc = '';
    gs.participants.forEach(p => {
      participantsDesc += (p.isUser
        ? p.name + '（用户，' + (p.setting || '普通人') + '）'
        : p.name + '（' + (p.setting || '普通人') + '）') + '\n';
    });

    const systemPrompt =
      '你是一个文字大逃杀游戏的剧本编剧，根据以下信息生成本局游戏的完整大纲。\n\n' +
      '【参战者信息】\n' + participantsDesc + '\n' +
      '【场景】从以下中随机选一个：废旧居民楼、废弃医院、废旧游乐场、废弃工厂、荒废学校。\n\n' +
      '【大纲要求】\n' +
      '1. 天数：2-3人4天，4-5人6天，6人以上8天，每天分早午晚三段。\n' +
      '2. 严格按格式输出，每行一个事件，不输出任何其他内容：\n' +
      '   第X天早：事件\n   第X天午：事件\n   第X天晚：事件\n' +
      '3. 事件极度简短直接。例：张三用砖头砸死李四。王五和赵六在二楼结盟。用户三楼发现急救包。\n' +
      '4. 禁止阴谋论、科幻、神化、比喻。纯粹写实白描。\n' +
      '5. 符合每个角色的性格和能力。\n' +
      '6. 所有人互为陌生人' + (isPlayer ? '（含用户）' : '') + '。\n' +
      '7. 必须有：结盟、背刺、反转' + (isPlayer ? '、用户与某角色的正面遭遇' : '') + '。\n' +
      '8. 死亡有逻辑：体力耗尽、饥饿、受伤、人数劣势等。\n' +
      '9. 最终只剩一人。\n' +
      '10. 弹幕要求：每次生成5-8条，角度多样，有调侃、有惋惜、有惊呼、有剧透感、有戏谑、有粉丝、有磕cp、上帝视角、但不要太剧透。\n' +
      '11. 最后单独一行：【场景：XXX】';

    try {
      const raw = await btrCallAPI([
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: '请生成大纲。' }
      ]);

      clearInterval(fakeTick);
      if (progressBar) progressBar.style.width = '100%';

      const sceneMatch = raw.match(/【场景[：:]\s*(.+?)】/);
      gs.scene   = sceneMatch ? sceneMatch[1].trim() : '废弃建筑';
      gs.outline = raw.split('\n').map(l => l.trim()).filter(l => /^第\d+天[早午晚]/.test(l));

      if (subText) subText.textContent = '大纲生成完毕，进入游戏……';
      setTimeout(() => { btrEnterMainGame(false); }, 800);

    } catch (err) {
      clearInterval(fakeTick);
      if (progressBar) progressBar.style.width = '0%';
      if (subText) subText.textContent = '生成失败：' + err.message;
      alert('大纲生成失败：' + err.message);
      btrShowScreen('batoru-select');
    }
  }

  /* ============================================================
     进入游戏主界面
     ============================================================ */
  function btrEnterMainGame(fromSave) {
    btrShowScreen('batoru-main');
    btrUpdateDayLabel();
    btrUpdateBroadcast();
    btrUpdateAttrPanel();
    btrRenderBag();

    const choicesArea = document.getElementById('btr-choices-area');
    const nextWrap    = document.getElementById('btr-next-btn-wrap');
    const chatWrap    = document.getElementById('btr-chat-input-wrap');
    const isSpectator = gs.mode === 'spectator' || gs.isUserDead;

    if (choicesArea) choicesArea.style.display = 'none'; /* 默认收起，等AI返回后展开 */
    if (nextWrap)    nextWrap.style.display    = isSpectator ? 'block' : 'none';
    if (chatWrap)    chatWrap.style.display    = isSpectator ? 'none'  : 'block';

    const narrativeArea = document.getElementById('btr-narrative-area');
    if (narrativeArea) narrativeArea.innerHTML = '';

    if (fromSave) {
  if (gs.narrativeHistory.length) {
    btrAppendNarrative(
      '═══ 读取存档：' + btrDayLabel(gs.currentDayIndex) + ' ═══\n\n' +
      gs.narrativeHistory[gs.narrativeHistory.length - 1],
      false
    );
  }
  btrRefreshBroadcast();
  if (!isSpectator) {
    btrRenderDefaultChoices();
    if (choicesArea) choicesArea.style.display = 'block';
    btrSetChoicesEnabled(true);   // ← 加这一行
  } else {
    if (nextWrap) nextWrap.style.display = 'block';
    const nb = document.getElementById('btr-next-segment');
    if (nb) nb.disabled = false;
  }
  } else {
    btrRunOpeningAndFirstSegment();
  }

} // 关闭 btrEnterMainGame 函数

  /* ============================================================
     默认选项（存档恢复时或AI选项解析失败时使用）
     ============================================================ */
  function btrRenderDefaultChoices() {
    const periodIdx = gs.currentDayIndex % 3;
    let defaults;
    if (periodIdx === 2) {
      /* 夜晚有睡觉选项 */
      defaults = [
        { label: 'A', text: '找隐蔽处睡觉，恢复体力（风险：可能被偷袭）' },
        { label: 'B', text: '在附近区域继续探索，寻找物资' },
        { label: 'C', text: '警戒守夜，观察周围动静' }
      ];
    } else if (periodIdx === 0) {
      defaults = [
        { label: 'A', text: '趁早搜索附近区域，寻找食物和武器' },
        { label: 'B', text: '找高处观察全局，确认其他人位置' },
        { label: 'C', text: '悄悄跟踪观察到的其他人' }
      ];
    } else {
      defaults = [
        { label: 'A', text: '主动出击，搜索物资补给' },
        { label: 'B', text: '在当前位置埋伏等待' },
        { label: 'C', text: '尝试接近附近的其他幸存者' }
      ];
    }
    btrRenderChoices(defaults);
  }

  /* ============================================================
     开场白
     ============================================================ */
  async function btrRunOpeningAndFirstSegment() {
    const narrativeArea = document.getElementById('btr-narrative-area');
    if (narrativeArea) narrativeArea.innerHTML = '';

    const participantNames = gs.participants.map(p => p.name).join('、');
    const opening =
      '═══ 游戏开始 ═══\n\n' +
      '地点：' + gs.scene + '\n' +
      '参战者：' + participantNames + '\n' +
      '规则：最后一名存活者方可离开。\n\n' +
      '【系统】只能有一人活着走出去。';

    btrAppendNarrative(opening, true);

    const choicesArea = document.getElementById('btr-choices-area');
    if (choicesArea) choicesArea.style.display = 'none';

    setTimeout(async () => {
      await btrRunSegment(null);
    }, 1500);
  }

  /* ============================================================
     核心：运行一个时间段
     修复：注入时间上下文、强制快节奏、禁止比喻神化
     ============================================================ */
  async function btrRunSegment(userAction) {
    if (!gs || gs.gameOver) return;

    btrSetChoicesEnabled(false);
    const nextBtn = document.getElementById('btr-next-segment');
    if (nextBtn) nextBtn.disabled = true;

    /* 收起选项区，等AI返回后展开 */
    const choicesArea = document.getElementById('btr-choices-area');
    if (choicesArea) choicesArea.style.display = 'none';

    const isPlayer    = gs.mode === 'player' && !gs.isUserDead;
    const dayLabel    = btrDayLabel(gs.currentDayIndex);
    const periodCtx   = btrPeriodContext(gs.currentDayIndex);
    const isNight     = gs.currentDayIndex % 3 === 2;
    const histSummary = gs.narrativeHistory.slice(-3).join('\n---\n');

    let participantsDesc = '';
gs.participants.forEach(p => {
  participantsDesc += (p.isUser ? p.name + '（用户）' : p.name) +
    '：' + (p.setting || '普通人') + '\n';
});


    const aliveNames = gs.aliveList.map(id => {
      const p = gs.participants.find(x => x.id === id);
      return p ? p.name : id;
    }).join('、');

    const deadNames = gs.participants
      .filter(p => !gs.aliveList.includes(p.id))
      .map(p => p.name).join('、') || '无';

    const statsDesc = isPlayer
      ? '用户血量:' + gs.userStats.hp +
        ' 饥饿:' + gs.userStats.hunger +
        ' 体力:' + gs.userStats.stamina +
        ' 位置:' + gs.userStats.location +
        ' 状态:' + gs.userStats.statusTags.join('/')
      : '';

    const outlineEntry = gs.outline[gs.currentDayIndex] || '';

        const systemPrompt =
      '【参战者设定】\n' + participantsDesc + '\n' +
      '【本局大纲（必须严格遵守）】\n' + gs.outline.join('\n') + '\n\n' +
      '【当前时间段】\n' +
      dayLabel + '。' + periodCtx + '\n' +
      '本时间段大纲事件：' + outlineEntry + '\n\n' +
      '【当前状态】\n' +
      '场景：' + gs.scene + '\n' +
      '存活：' + aliveNames + '\n' +
      '已淘汰：' + deadNames + '\n' +
      statsDesc + '\n\n' +
      '【近期叙事摘要】\n' + (histSummary || '游戏刚开始') + '\n\n' +
      '【写作要求——必须严格遵守】\n' +
      '1. 第一句话必须点明当前时间：如"第X天，' + PERIOD_LABELS[gs.currentDayIndex % 3] + '。"\n' +
      '2. 必须严格按大纲事件推进，本时间段大纲写了谁死谁就必须死，大纲写了什么事件就必须发生，不得以任何理由跳过或修改。\n' +
      '3. 节奏极快。每个时间段必须有实质性事件发生，不能只描述氛围或心理活动。一个时间段内必须推进至少一件大纲事件。\n' +
      '4. 各角色在不同地点行动，不需要凑在一起。明确写出每个存活角色在哪、在做什么。\n' +
      '5. 禁止比喻、禁止神化、禁止诗意散文。用干净利落的叙事语言，像恐怖惊悚小说。\n' +
      '6. 有对话时直接写，格式：[角色名]："内容"。对话要符合角色性格，紧张时短促，平静时克制。\n' +
      '7. 分段写作：每个段落聚焦一个地点或角色，换地点或角色时另起一段。段落之间节奏要有轻重，行动段落要快，发现线索段落可以稍慢但不拖沓。\n' +
      '8. 字数：200-350字，不超过350字，宁可短也不拖沓。\n' +
      (isNight ? '9. 这是夜晚时间段，选项中必须包含"睡觉休息"选项。\n' : '') +
      (isPlayer
        ? '10. 用第二人称描述用户视角，用户是有限视角，只能看到自己周围发生的事。\n' +
          '    用户无法直接看到其他地点发生的死亡事件，但可以通过以下方式间接感知：\n' +
          '    · 广播播报（全局可知）\n' +
          '    · 听到远处的尖叫声、打斗声、物体倒地声\n' +
          '    · 事后探索时发现血迹、破碎的痕迹、遗落的物品\n' +
          '    · 发现尸体或带血的凶器\n' +
          '    · 某角色突然消失不见，广播随后通报\n' +
          '    这些线索要自然融入叙事，不要直接告知用户其他地点的完整经过。\n'
        : '') +
      '\n【死亡强制规则——绝对不可违反】\n' +
      '本时间段必须发生的事件：' + outlineEntry + '\n' +
      '若此事件涉及死亡，该角色必须在叙事中死亡，且【游戏状态】存活列表必须移除该人。\n' +
      '死亡必须写得真实合理，符合以下任意一种逻辑：\n' +
      '· 被其他角色用具体武器或方式击杀（写清楚用什么、怎么打、死亡过程）\n' +
      '· 受伤后失血过多、伤口感染、无力再战，独自死在角落\n' +
      '· 饥饿或脱水导致体力耗尽，倒地不起\n' +
      '· 被多人围攻、寡不敌众、无路可逃\n' +
      '· 试图偷袭他人反被反杀，凶手冷静离开\n' +
      '· 背刺盟友被盟友察觉并反击\n' +
      '· 意外受伤（坠落、踩到陷阱、被困住），无人救援\n' +
      '死亡描写要求：\n' +
      '· 有具体动作和过程，不能一笔带过\n' +
      '· 有该角色最后一刻的反应（挣扎、求饶、沉默、倒下）\n' +
      '· 如果是用户有限视角，可以不直接描写死亡过程，改为线索式呈现\n' +
      '禁止让所有人都活到游戏结束。这是大逃杀，最终只能有一人存活。\n' +
      '若当前是最后一个时间段，存活列表必须只剩一人，其余全部死亡。\n' +
      '\n【属性变化规则】\n' +
      '每个时间段结束后，用户属性必须根据实际发生的事件合理变化：\n' +
      '· 睡觉休息：体力+20至+35，饥饿-5\n' +
      '· 剧烈行动（奔跑、战斗、逃跑）：体力-15至-25，饥饿-15\n' +
      '· 普通探索、移动：体力-8至-12，饥饿-10\n' +
      '· 静止潜伏、守夜：体力-5，饥饿-8\n' +
      '· 使用食物/水：饥饿+30至+40\n' +
      '· 受到攻击或受伤：血量-20至-40\n' +
      '· 使用急救物品：血量+20至+35\n' +
      '· 饥饿值≤20时：每段自动扣血-5，状态变为"饥饿"\n' +
      '· 体力≤20时：状态变为"疲惫"，行动效率下降\n' +
      '· 血量≤30时：状态变为"受伤"，每段自动扣血-3\n' +
      '· 血量≤0：用户死亡\n' +
      '位置字段必须更新为用户当前所在的具体地点（如"三楼走廊"、"地下室入口"、"废弃手术室"等）。\n' +
      '状态标签根据上述条件叠加，可以同时有多个状态。\n' +
      '\n【输出格式——严格按此格式，不得省略任何块】\n\n' +
      '【叙事】\n' +
      '（200-350字，恐怖惊悚小说风格，合理分段，快节奏）\n\n' +
      (isPlayer
        ? '【选项】\n' +
          'A. （根据当前处境生成的具体可行行动）\n' +
          'B. （另一个方向或策略不同的行动）\n' +
          'C. （' + (isNight ? '睡觉休息相关选项' : '第三个差异化选项') + '）\n\n' +
          '【属性变化】\n' +
          '血量:+0 饥饿:-10 体力:-8 位置:当前具体地点\n\n'
        : '') +
      '【广播】\n' +
      '（本时间段有死亡则写死亡通报如"[名字]已离开游戏"，无死亡则写场景内发生的重要事件，一句话）\n\n' +
      '【弹幕】\n' +
      '弹幕1|弹幕2|弹幕3|弹幕4|弹幕5|弹幕6|弹幕7\n\n' +
      '【物品】\n' +
      '（用户本时间段捡到物品则写：名称:emoji:数量。未捡到则写：无）\n\n' +
      '【游戏状态】\n' +
      '存活:（存活者名字逗号分隔，死亡者必须从列表移除）\n' +
      '结束:否/是';


    const userContent = isPlayer
      ? '当前：' + dayLabel + '\n行动：' + (userAction || '观察周围') +
        (gs.pendingChat ? '\n对话：' + gs.pendingChat : '')
      : '当前：' + dayLabel + '\n生成本时间段叙事。';

    gs.pendingChat = '';

    try {
      const raw = await btrCallAPI([
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userContent }
      ]);
      btrParseAndApplySegment(raw);
        } catch (err) {
      btrAppendNarrative('\n【通信中断】' + err.message + '\n继续游戏请点击下方选项，或点击"重试"重新请求。\n', true);

      /* 在叙事区追加一个重试按钮 */
      const area = document.getElementById('btr-narrative-area');
      if (area) {
        const retryBtn = document.createElement('button');
        retryBtn.className = 'btr-choice-btn';
        retryBtn.style.cssText = 'margin:8px 0;border-color:#cc0000;color:#cc0000;';
        retryBtn.textContent = '↺ 重试（重新请求AI）';
        retryBtn.addEventListener('click', () => {
          if (area.contains(retryBtn)) area.removeChild(retryBtn);
          btrRunSegment(userAction);
        });
        area.appendChild(retryBtn);
        area.scrollTop = area.scrollHeight;
      }

      /* 同时恢复选项/下一段按钮，让用户可以跳过继续 */
      if (isPlayer) {
        btrRenderDefaultChoices();
        const ca = document.getElementById('btr-choices-area');
        if (ca) ca.style.display = 'block';
        btrSetChoicesEnabled(true);
      } else {
        if (nextBtn) nextBtn.disabled = false;
      }
    }

  }

  /* ============================================================
     解析 AI 返回
     ============================================================ */
  function btrParseAndApplySegment(raw) {
    function extract(tag) {
      const re = new RegExp('【' + tag + '】[^\\S\\n]*\\n?([\\s\\S]*?)(?=\\n【|$)');
      const m  = raw.match(re);
      return m ? m[1].trim() : '';
    }

    const narrative  = extract('叙事');
    const optionsRaw = extract('选项');
    const attrRaw    = extract('属性变化');
    const broadcast  = extract('广播');
    const danmakuRaw = extract('弹幕');
    const itemRaw    = extract('物品');
    const statusRaw  = extract('游戏状态');

    /* ── 叙事渲染 ── */
    if (narrative) {
      btrAppendNarrative('\n' + narrative, true);
      gs.narrativeHistory.push(narrative);
      if (gs.narrativeHistory.length > 6) gs.narrativeHistory.shift();
    }

    /* ── 广播 ── */
    if (broadcast && broadcast !== '暂无新消息') {
      gs.broadcastQueue.push(broadcast);
      btrRefreshBroadcast();
    }

    /* ── 弹幕 ── */
    if (danmakuRaw) {
      danmakuRaw.split('|').map(s => s.trim()).filter(Boolean).forEach(t => {
        gs.danmakuHistory.push(t);
        if (btrDanmakuEnabled) btrLaunchDanmaku(t, 'btr-danmaku-layer');
      });
    }

    /* ── 属性变化 ── */
    if (attrRaw && gs.mode === 'player' && !gs.isUserDead) {
      const hpM = attrRaw.match(/血量[：:]\s*([+-]?\d+)/);
      const huM = attrRaw.match(/饥饿[：:]\s*([+-]?\d+)/);
      const stM = attrRaw.match(/体力[：:]\s*([+-]?\d+)/);
      if (hpM) gs.userStats.hp      = Math.min(100, Math.max(0, gs.userStats.hp      + parseInt(hpM[1])));
      if (huM) gs.userStats.hunger  = Math.min(100, Math.max(0, gs.userStats.hunger  + parseInt(huM[1])));
      if (stM) gs.userStats.stamina = Math.min(100, Math.max(0, gs.userStats.stamina + parseInt(stM[1])));
      if (gs.userStats.hunger <= 0) gs.userStats.hp = Math.max(0, gs.userStats.hp - 5);
    }
    /* 固定自然衰减（叠加在AI属性变化之上） */
    if (gs.mode === 'player' && !gs.isUserDead) {
      gs.userStats.hunger  = Math.max(0, gs.userStats.hunger  - 8);
      gs.userStats.stamina = Math.max(0, gs.userStats.stamina - 6);
      btrUpdateAttrPanel();
    }

    /* ── 物品 ── */
    if (itemRaw && itemRaw !== '无' && gs.mode === 'player' && !gs.isUserDead) {
      const parts = itemRaw.split(':');
      if (parts.length >= 2 && gs.inventory.length < 12) {
        gs.inventory.push({
          name:  parts[0].trim(),
          emoji: parts[1].trim(),
          qty:   parseInt(parts[2]) || 1
        });
        btrRenderBag();
      }
    }

    /* ── 存活者列表 ── */
    if (statusRaw) {
      const aliveMatch = statusRaw.match(/存活[：:]\s*(.+)/);
      if (aliveMatch) {
        const aliveNames = aliveMatch[1].split(/[,，]/).map(s => s.trim()).filter(Boolean);
        gs.aliveList = gs.participants.filter(p =>
          aliveNames.some(n => {
            const pn = p.name.trim(), nn = n.trim();
            return pn === nn || pn.includes(nn) || nn.includes(pn);
          })
        ).map(p => p.id);
      }
      const endMatch = statusRaw.match(/结束[：:]\s*(是|否)/);
      if (endMatch && endMatch[1] === '是') gs.gameOver = true;
    }

    /* ── 检测用户死亡 ── */
    if (gs.mode === 'player' && !gs.isUserDead) {
      if (!gs.aliveList.includes('user') || gs.userStats.hp <= 0) {
        gs.isUserDead = true;
        setTimeout(() => btrShowScreen('batoru-dead'), 1200);
        return;
      }
    }

    /* ── 游戏结束 ── */
    if (gs.gameOver || gs.currentDayIndex >= gs.totalDays * 3 - 1) {
      gs.gameOver = true;
      const wp = gs.aliveList.length > 0
        ? (gs.participants.find(p => p.id === gs.aliveList[0]) || { name: '不明' })
        : { name: '无人' };
      gs.winner = wp.name;
      setTimeout(() => btrTriggerEnding(), 1500);
      return;
    }

    /* ── 推进时间 ── */
    gs.currentDayIndex++;
    btrUpdateDayLabel();

    /* ── 渲染选项或下一段 ── */
    const isPlayer    = gs.mode === 'player' && !gs.isUserDead;
    const choicesArea = document.getElementById('btr-choices-area');
    const nextWrap    = document.getElementById('btr-next-btn-wrap');

    if (isPlayer) {
      const labels   = ['A', 'B', 'C'];
      const optLines = optionsRaw.split('\n').map(l => l.trim()).filter(l => /^[ABC][.。]/.test(l));
      let choices    = optLines.map((l, i) => ({
        label: labels[i] || String.fromCharCode(65 + i),
        text:  l.replace(/^[ABC][.。]\s*/, '')
      }));

      /* 如果AI未返回选项或夜晚缺少睡觉选项，补充 */
      if (!choices.length) {
        btrRenderDefaultChoices();
      } else {
        const isNight = gs.currentDayIndex % 3 === 0 && gs.currentDayIndex > 0
          ? false
          : (gs.currentDayIndex - 1) % 3 === 2;
        const hasSleep = choices.some(c => c.text.includes('睡') || c.text.includes('休息'));
        if (isNight && !hasSleep) {
          choices[2] = { label: 'C', text: '找隐蔽处睡觉，恢复体力（风险：可能被偷袭）' };
        }
        btrRenderChoices(choices);
      }

      if (choicesArea) choicesArea.style.display = 'block';
      btrSetChoicesEnabled(true);
    } else {
      if (nextWrap) nextWrap.style.display = 'block';
      const nb = document.getElementById('btr-next-segment');
      if (nb) nb.disabled = false;
    }
  }

  /* ============================================================
     叙事文字渲染
     ============================================================ */
  function btrAppendNarrative(text, scroll) {
    const area = document.getElementById('btr-narrative-area');
    if (!area || !text) return;

    text.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (!trimmed) return;

      const dlg = trimmed.match(/^\[(.+?)\][：:][""](.+?)[""]?$/) ||
                  trimmed.match(/^\[(.+?)\]："(.+)"$/);
      if (dlg) {
        const div = document.createElement('div');
        div.className = 'btr-dialogue-line';
        const nm = document.createElement('span');
        nm.className   = 'btr-dialogue-name';
        nm.textContent = '[' + dlg[1] + ']：';
        const ct = document.createElement('span');
        ct.className   = 'btr-dialogue-text';
        ct.textContent = '"' + dlg[2] + '"';
        div.appendChild(nm);
        div.appendChild(ct);
        area.appendChild(div);
      } else {
        const p = document.createElement('p');
        p.className   = 'btr-narrative-para';
        p.textContent = trimmed;
        area.appendChild(p);
      }
    });

    if (scroll) requestAnimationFrame(() => { area.scrollTop = area.scrollHeight; });
  }

  /* ============================================================
     选项渲染（修复：可折叠，选项收起默认）
     ============================================================ */
  function btrRenderChoices(choices) {
    const list       = document.getElementById('btr-choices-list');
    const area       = document.getElementById('btr-choices-area');
    const customWrap = document.getElementById('btr-custom-input-wrap');
    if (!list) return;

    list.innerHTML = '';
    if (customWrap) customWrap.style.display = 'none';

    choices.forEach(choice => {
      const btn = document.createElement('button');
      btn.className = 'btr-choice-btn';
      btn.innerHTML =
        '<span class="btr-choice-label">' + choice.label + '.</span>' + choice.text;
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        btrSetChoicesEnabled(false);
        if (area) area.style.display = 'none';
        btrRunSegment(choice.text);
      });
      list.appendChild(btn);
    });

    /* 选项D：自行输入 */
    const customBtn = document.createElement('button');
    customBtn.className = 'btr-choice-btn';
    customBtn.innerHTML = '<span class="btr-choice-label">D.</span>✎ 自行输入行动';
    customBtn.addEventListener('click', () => {
      if (!customWrap) return;
      customWrap.style.display = customWrap.style.display === 'none' ? 'flex' : 'none';
    });
    list.appendChild(customBtn);
  }

  function btrSetChoicesEnabled(enabled) {
    document.querySelectorAll('.btr-choice-btn').forEach(btn => {
      btn.disabled      = !enabled;
      btn.style.opacity = enabled ? '1' : '0.55';
    });
  }

  document.getElementById('btr-custom-action-confirm').addEventListener('click', () => {
    const input = document.getElementById('btr-custom-action-input');
    const val   = input ? input.value.trim() : '';
    if (!val) return;
    if (input) input.value = '';
    const cw = document.getElementById('btr-custom-input-wrap');
    if (cw) cw.style.display = 'none';
    const area = document.getElementById('btr-choices-area');
    if (area) area.style.display = 'none';
    btrSetChoicesEnabled(false);
    btrRunSegment(val);
  });

  document.getElementById('btr-custom-action-input').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btr-custom-action-confirm').click();
  });

  document.getElementById('btr-next-segment').addEventListener('click', () => {
    if (!gs || gs.gameOver) return;
    const nb = document.getElementById('btr-next-segment');
    if (nb) nb.disabled = true;
    btrRunSegment(null);
  });

  document.getElementById('btr-chat-input').addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const input = document.getElementById('btr-chat-input');
    const val   = input ? input.value.trim() : '';
    if (!val) return;
    if (gs) gs.pendingChat = val;
    if (input) input.value = '';
    btrAppendNarrative('[你]："' + val + '"', true);
  });

  /* ============================================================
     广播栏
     ============================================================ */
  function btrRefreshBroadcast() {
    const inner = document.getElementById('btr-broadcast-inner');
    if (!inner || !gs) return;
    const base   = '大逃杀进行中 · ' + (gs.scene || '') + ' · ';
    const recent = gs.broadcastQueue.slice(-8).join(' · ');
    inner.textContent = base + (recent || '祝各位好运……只有一人能活着走出去……');
    inner.style.animation = 'none';
    void inner.offsetHeight;
    inner.style.animation = '';
  }

  function btrUpdateBroadcast() { btrRefreshBroadcast(); }

  /* ============================================================
     天数标签
     ============================================================ */
  function btrUpdateDayLabel() {
    const el = document.getElementById('btr-day-label');
    if (el && gs) el.textContent = btrDayLabel(gs.currentDayIndex);
  }

  /* ============================================================
     属性面板
     ============================================================ */
  function btrUpdateAttrPanel() {
    if (!gs) return;
    const s = gs.userStats;
    const setBar = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.style.width = Math.min(100, Math.max(0, val)) + '%';
    };
    const setVal = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = Math.round(Math.max(0, val));
    };
    setBar('btr-bar-hp',      s.hp);
    setBar('btr-bar-hunger',  s.hunger);
    setBar('btr-bar-stamina', s.stamina);
    setVal('btr-attr-hp-val',      s.hp);
    setVal('btr-attr-hunger-val',  s.hunger);
    setVal('btr-attr-stamina-val', s.stamina);
    const locEl = document.getElementById('btr-attr-location');
    if (locEl) locEl.textContent = s.location || '未知';
    const stEl = document.getElementById('btr-attr-status');
    if (stEl) stEl.textContent = (s.statusTags || ['正常']).join('/');
  }

  /* ============================================================
     背包
     ============================================================ */
  let btrSelectedItemIdx = -1;

  function btrRenderBag() {
    const grid  = document.getElementById('btr-bag-grid');
    const count = document.getElementById('btr-bag-count');
    const hint  = document.getElementById('btr-bag-full-hint');
    if (!grid || !gs) return;
    grid.innerHTML = '';
    const inv = gs.inventory || [];
    if (count) count.textContent = inv.length + '/12';
    if (hint)  hint.style.display = inv.length >= 12 ? 'block' : 'none';

    for (let i = 0; i < 12; i++) {
      const cell = document.createElement('div');
      if (i < inv.length) {
        cell.className = 'btr-bag-cell has-item';
        cell.innerHTML =
          '<div class="btr-bag-emoji">' + (inv[i].emoji || '📦') + '</div>' +
          '<div class="btr-bag-item-name">' + inv[i].name + '</div>';
        const idx = i;
        cell.addEventListener('click', () => btrOpenItemAction(idx));
      } else {
        cell.className = 'btr-bag-cell empty';
      }
      grid.appendChild(cell);
    }
    const menu = document.getElementById('btr-item-action-menu');
    if (menu) menu.style.display = 'none';
    btrSelectedItemIdx = -1;
  }

  function btrOpenItemAction(idx) {
    btrSelectedItemIdx = idx;
    const item = gs.inventory[idx];
    if (!item) return;
    const menu     = document.getElementById('btr-item-action-menu');
    const nameEl   = document.getElementById('btr-item-action-name');
    const giveWrap = document.getElementById('btr-give-target-wrap');
    if (nameEl)   nameEl.textContent     = (item.emoji || '📦') + ' ' + item.name;
    if (giveWrap) giveWrap.style.display = 'none';
    if (menu)     menu.style.display     = 'flex';
  }

  document.getElementById('btr-item-use').addEventListener('click', () => {
    if (btrSelectedItemIdx < 0 || !gs) return;
    const item = gs.inventory[btrSelectedItemIdx];
    if (!item) return;
    const n = item.name;
    if (n.includes('急救') || n.includes('药') || n.includes('绷带')) {
      gs.userStats.hp = Math.min(100, gs.userStats.hp + 30);
    } else if (n.includes('食') || n.includes('水') || n.includes('罐头') || n.includes('饼')) {
      gs.userStats.hunger = Math.min(100, gs.userStats.hunger + 40);
    } else if (n.includes('能量') || n.includes('体力')) {
      gs.userStats.stamina = Math.min(100, gs.userStats.stamina + 35);
    }
    btrUpdateAttrPanel();
    gs.inventory.splice(btrSelectedItemIdx, 1);
    btrRenderBag();
  });

  document.getElementById('btr-item-discard').addEventListener('click', () => {
    if (btrSelectedItemIdx < 0 || !gs) return;
    gs.inventory.splice(btrSelectedItemIdx, 1);
    btrRenderBag();
  });

  document.getElementById('btr-item-give').addEventListener('click', () => {
    const giveWrap   = document.getElementById('btr-give-target-wrap');
    const targetList = document.getElementById('btr-give-target-list');
    if (!giveWrap || !targetList || !gs) return;
    targetList.innerHTML = '';
    const others = gs.participants.filter(p => !p.isUser && gs.aliveList.includes(p.id));
    giveWrap.style.display = 'block';
    if (!others.length) {
      targetList.innerHTML = '<div style="font-size:11px;color:#9a8880;padding:4px 0;">附近无可赠送对象</div>';
      return;
    }
    others.forEach(p => {
      const btn = document.createElement('button');
      btn.className   = 'btr-btn btr-btn-ghost';
      btn.textContent = p.name;
      btn.style.cssText = 'margin-top:6px;width:100%;font-size:12px;padding:7px;';
      btn.addEventListener('click', () => {
        if (btrSelectedItemIdx < 0 || !gs) return;
        const item = gs.inventory[btrSelectedItemIdx];
        const nm   = item ? item.name : '物品';
        gs.inventory.splice(btrSelectedItemIdx, 1);
        btrRenderBag();
        btrAppendNarrative('你将【' + nm + '】赠送给了' + p.name + '。', true);
        document.getElementById('btr-bag-modal').style.display = 'none';
      });
      targetList.appendChild(btn);
    });
  });

  document.getElementById('btr-item-action-cancel').addEventListener('click', () => {
    const menu = document.getElementById('btr-item-action-menu');
    if (menu) menu.style.display = 'none';
    btrSelectedItemIdx = -1;
  });

  document.getElementById('btr-bag-btn').addEventListener('click', () => {
    if (!gs) return;
    btrRenderBag();
    document.getElementById('btr-bag-modal').style.display = 'flex';
  });

  document.getElementById('btr-bag-close').addEventListener('click', () => {
    document.getElementById('btr-bag-modal').style.display = 'none';
  });

  document.getElementById('btr-bag-modal').addEventListener('click', function (e) {
    if (e.target === this) this.style.display = 'none';
  });

  /* ============================================================
     属性弹窗
     ============================================================ */
  document.getElementById('btr-attr-btn').addEventListener('click', () => {
    if (!gs) return;
    btrUpdateAttrPanel();
    document.getElementById('btr-attr-modal').style.display = 'flex';
  });
  document.getElementById('btr-attr-close').addEventListener('click', () => {
    document.getElementById('btr-attr-modal').style.display = 'none';
  });
  document.getElementById('btr-attr-modal').addEventListener('click', function (e) {
    if (e.target === this) this.style.display = 'none';
  });

  /* ============================================================
     弹幕
     ============================================================ */
  let btrDanmakuEnabled = false;

  document.getElementById('btr-danmaku-btn').addEventListener('click', () => {
    btrDanmakuEnabled = !btrDanmakuEnabled;
    const btn = document.getElementById('btr-danmaku-btn');
    if (btn) btn.classList.toggle('active', btrDanmakuEnabled);
    if (btrDanmakuEnabled && gs && gs.danmakuHistory.length) {
      gs.danmakuHistory.slice(-14).forEach((t, i) => {
        setTimeout(() => btrLaunchDanmaku(t, 'btr-danmaku-layer'), i * 700);
      });
    }
  });

  function btrLaunchDanmaku(text, layerId) {
    const layer = document.getElementById(layerId);
    if (!layer) return;
    const el       = document.createElement('div');
    el.className   = 'btr-danmaku-item';
    el.textContent = text;
    const topPct   = 10 + Math.random() * 75;
    const duration = 6 + Math.random() * 5;
    el.style.top               = topPct + '%';
    el.style.animationDuration = duration + 's';
    layer.appendChild(el);
    setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, (duration + 1) * 1000);
  }

  /* ============================================================
     菜单
     ============================================================ */
  document.getElementById('btr-menu-trigger').addEventListener('click', function () {
    const menu = document.getElementById('btr-side-menu');
    if (!menu) return;
    const isOpen = menu.style.display !== 'none';
    menu.style.display = isOpen ? 'none' : 'block';
    this.classList.toggle('open', !isOpen);
  });

  document.addEventListener('click', function (e) {
    if (e.target.closest('#btr-menu-trigger') || e.target.closest('#btr-side-menu')) return;
    const menu    = document.getElementById('btr-side-menu');
    const trigger = document.getElementById('btr-menu-trigger');
    if (menu)    menu.style.display = 'none';
    if (trigger) trigger.classList.remove('open');
  });

  document.getElementById('btr-save-game').addEventListener('click', () => {
    btrDoSave();
    const menu    = document.getElementById('btr-side-menu');
    const trigger = document.getElementById('btr-menu-trigger');
    if (menu)    menu.style.display = 'none';
    if (trigger) trigger.classList.remove('open');
  });

  document.getElementById('btr-exit-game').addEventListener('click', () => {
    const menu    = document.getElementById('btr-side-menu');
    const trigger = document.getElementById('btr-menu-trigger');
    if (menu)    menu.style.display = 'none';
    if (trigger) trigger.classList.remove('open');
    btrShowExitWarning(() => {
      btrShowScreen('batoru-lobby');
      btrUpdateContinueBtn();
    });
  });

  /* ============================================================
     存档（修复：确保序列化完整，写入前验证）
     ============================================================ */
      function btrDoSave() {
    if (!gs) { alert('当前无游戏进度'); return; }

    const now = new Date();
    const pad = n => String(n).padStart(2, '0');
    const time =
      now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) +
      ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes()) + ':' + pad(now.getSeconds());

    const gsMin = {
      mode:            gs.mode,
      userSetup:       gs.userSetup,
      /* 角色不存设定，只存身份识别信息，ai会根据角色名自动代入 */
      participants:    gs.participants.map(p => ({
        id:     p.id,
        name:   p.name,
        avatar: p.avatar,
        isUser: p.isUser
      })),
      outline:          gs.outline,
      scene:            gs.scene,
      totalDays:        gs.totalDays,
      currentDayIndex:  gs.currentDayIndex,
      aliveList:        gs.aliveList,
      userStats:        gs.userStats,
      inventory:        gs.inventory,
      narrativeHistory: gs.narrativeHistory.slice(-1),
      broadcastQueue:   gs.broadcastQueue.slice(-3),
      danmakuHistory:   [],
      pendingChat:      '',
      isUserDead:       gs.isUserDead,
      gameOver:         gs.gameOver,
      winner:           gs.winner,
    };

    let serialized;
    try {
      serialized = JSON.stringify(gsMin);
    } catch (e) {
      alert('存档序列化失败：' + e.message);
      return;
    }

    const record = {
      id:         'save_' + Date.now(),
      saveTime:   time,
      dayLabel:   btrDayLabel(gs.currentDayIndex),
      aliveCount: gs.aliveList.length,
      gameState:  JSON.parse(serialized)
    };

    let saves = [];
    try {
      const raw = localStorage.getItem(SAVES_KEY);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) saves = arr;
      }
    } catch (e) { saves = []; }

    saves.push(record);
    if (saves.length > MAX_SAVES) saves = saves.slice(-MAX_SAVES);

    /* 写入失败则逐步缩减存档数量直到成功 */
    let written = false;
    for (let keep = saves.length; keep >= 1 && !written; keep--) {
      try {
        localStorage.setItem(SAVES_KEY, JSON.stringify(saves.slice(-keep)));
        written = true;
      } catch (e) { /* 继续缩减 */ }
    }

    if (!written) {
      alert('设备存储空间严重不足，无法存档');
      return;
    }

    btrUpdateContinueBtn();
    btrAppendNarrative('【存档成功】' + time, false);
  }


  /* ============================================================
     退出警告弹窗（修复：叠加式，疯批恐怖文案）
     ============================================================ */
    const EXIT_WARN_TEXTS = [
    {
      title: '⚠ 你要离开了吗',
      text:  '退出将丢失未存档的进度。\n你确定要离开这里吗？'
    },
    {
      title: '不……不要走',
      text:  '已经有人在等你了。\n你真的要走吗？'
    },
    {
      title: '它注意到你了',
      text:  '有什么东西盯着你。\n它不希望你离开。'
    },
    {
      title: '门——锁上了',
      text:  '你以为你能出去吗？\n没有人能离开这里。'
    },
    {
      title: '▒▓░ 错误 ░▓▒',
      text:  '退出进程已损坏。\n你无法离开。\n你永远无法离开。'
    },
    {
      title: '哈哈哈哈哈哈哈',
      text:  '继续点确定吧。\n弹窗会一直出现的。\n你是出不去的。'
    },
    {
      title: '已记录你的位置',
      text:  '我们知道你在哪里。\n…别以为你能逃走。'
    },
    {
      title: '╔═══ 最终警告 ═══╗',
      text:  '你已触发第∞层确认协议。\n永远留在这里吧…我会一直盯着你的👁️。'
    }
  ];

  function btrShowExitWarning(onExit, depth) {
    depth = (depth || 0);
    const layer = document.getElementById('btr-exit-warnings');
    if (!layer) return;
    layer.style.display = 'block';

    const info = EXIT_WARN_TEXTS[Math.min(depth, EXIT_WARN_TEXTS.length - 1)];

    const mask = document.createElement('div');
    mask.className = 'btr-warn-mask';
    mask.style.cssText =
      'position:absolute;inset:0;z-index:' + (100 + depth) + ';' +
      'display:flex;align-items:center;justify-content:center;' +
      'background:rgba(0,0,0,0.35);';

    const box = document.createElement('div');
    box.className = 'btr-warn-box';
    box.style.cssText =
      'position:relative;' +
      'border-color:' + (depth >= 3 ? '#ff0000' : '#cc8800') + ';' +
      'box-shadow:0 0 ' + (20 + depth * 6) + 'px rgba(255,' +
      Math.max(0, 100 - depth * 15) + ',0,0.75);';

    box.innerHTML =
      '<div class="btr-warn-title">' + info.title + '</div>' +
      '<div class="btr-warn-text" style="white-space:pre-line;">' + info.text + '</div>' +
      '<div class="btr-warn-btns">' +
        '<button class="btr-warn-confirm">确定退出</button>' +
        '<button class="btr-warn-cancel">取消</button>' +
      '</div>';

    mask.appendChild(box);
    layer.appendChild(mask);

    mask.addEventListener('click', function (e) {
      if (e.target !== mask) return;
      while (layer.firstChild) layer.removeChild(layer.firstChild);
      layer.style.display = 'none';
    });

    box.querySelector('.btr-warn-confirm').addEventListener('click', () => {
      btrShowExitWarning(onExit, depth + 1);
    });

    box.querySelector('.btr-warn-cancel').addEventListener('click', () => {
      while (layer.firstChild) layer.removeChild(layer.firstChild);
      layer.style.display = 'none';
      onExit();
    });
  }


  /* ============================================================
     用户被淘汰
     ============================================================ */
  document.getElementById('btr-dead-watch').addEventListener('click', () => {
    if (!gs) return;
    gs.mode       = 'spectator';
    gs.isUserDead = true;
    btrShowScreen('batoru-main');
    const choicesArea = document.getElementById('btr-choices-area');
    const nextWrap    = document.getElementById('btr-next-btn-wrap');
    const chatWrap    = document.getElementById('btr-chat-input-wrap');
    if (choicesArea) choicesArea.style.display = 'none';
    if (nextWrap)    nextWrap.style.display    = 'block';
    if (chatWrap)    chatWrap.style.display    = 'none';
    const nb = document.getElementById('btr-next-segment');
    if (nb) nb.disabled = false;
    btrAppendNarrative('\n你已死亡。意识飘离身体，继续旁观……\n', true);
  });

  document.getElementById('btr-dead-exit').addEventListener('click', () => {
    btrShowScreen('batoru-lobby');
    btrUpdateContinueBtn();
  });

  /* ============================================================
     结局界面
     ============================================================ */
  async function btrTriggerEnding() {
    btrShowScreen('batoru-ending');

    const winner     = gs.winner || '不明';
    const totalDays  = Math.ceil((gs.currentDayIndex + 1) / 3);
    const eliminated = gs.participants.length - gs.aliveList.length;

    const winnerEl = document.getElementById('btr-ending-winner');
    if (winnerEl) winnerEl.textContent = '存活者：' + winner;
    const statsEl = document.getElementById('btr-ending-stats');
    if (statsEl) statsEl.textContent =
      '游戏历时 ' + totalDays + ' 天  ·  共淘汰 ' + eliminated + ' 人';

    /* 渲染大纲回顾 */
    const outlineListEl = document.getElementById('btr-ending-outline-list');
    if (outlineListEl && gs.outline && gs.outline.length) {
      outlineListEl.innerHTML = '';
      gs.outline.forEach(line => {
        /* 解析格式：第X天早：事件 */
        const colonIdx = line.indexOf('：');
        const label = colonIdx > -1 ? line.slice(0, colonIdx) : line;
        const text  = colonIdx > -1 ? line.slice(colonIdx + 1).trim() : '';
        const item  = document.createElement('div');
        item.className = 'btr-ending-outline-item';
        item.innerHTML =
          '<span class="btr-ending-outline-label">' + label + '</span>' +
          '<span class="btr-ending-outline-text">' + text + '</span>';
        outlineListEl.appendChild(item);
      });
    }

    const lastWordsEl = document.getElementById('btr-ending-last-words');
    if (lastWordsEl) {
      lastWordsEl.innerHTML =
        '<div style="color:#9a8880;font-size:11px;padding:10px 0;letter-spacing:.06em;">正在生成最终遗言……</div>';
    }

    try {
      const participantsDesc = gs.participants.map(p =>
        p.name + '（' + (p.setting || '普通人') + '，' +
        (gs.aliveList.includes(p.id) ? '存活' : '已淘汰') + '）'
      ).join('\n');

      const systemPrompt =
        '根据以下大逃杀游戏的角色信息和剧情大纲，为每位参战者生成一句简短有力的最后遗言或胜利感言（不超过30字）。\n' +
        '格式：角色真实姓名："遗言内容"\n' +
        '每人一行，只输出遗言，不输出其他文字。\n' +
        '最后另起一行输出10-15条上帝视角弹幕点评，格式：【弹幕】弹幕1|弹幕2|弹幕3\n\n' +
        '【参战者信息】\n' + participantsDesc + '\n\n' +
        '【剧情大纲】\n' + gs.outline.join('\n');

      const raw = await btrCallAPI([
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: '请生成遗言和弹幕。' }
      ]);

      if (lastWordsEl) {
        lastWordsEl.innerHTML = '';
        raw.split('\n').map(l => l.trim()).filter(Boolean).forEach(line => {
          /* 弹幕行 */
          if (line.startsWith('【弹幕】')) {
            line.replace('【弹幕】', '').split('|').forEach((t, i) => {
              const text = t.trim();
              if (!text) return;
              setTimeout(() => btrLaunchDanmaku(text, 'btr-ending-danmaku-layer'), i * 600);
            });
            return;
          }
          /* 遗言行 */
          const match = line.match(/^(.+?)[：""](.+?)[""]?$/) ||
                        line.match(/^(.+?):"(.+)"$/);
          if (!match) return;
          const roleName = match[1].replace(/[：""\s]+$/, '').trim();
          const word     = match[2].replace(/[""]$/, '').trim();
          const item = document.createElement('div');
          item.className = 'btr-last-word-item';
          item.innerHTML =
            '<span class="btr-last-word-name">' + roleName + '</span>' +
            '<span class="btr-last-word-text">"' + word + '"</span>';
          lastWordsEl.appendChild(item);
        });
        if (!lastWordsEl.children.length) {
          lastWordsEl.innerHTML =
            '<div style="color:#9a8880;font-size:11px;padding:10px 0;">未能解析遗言。</div>';
        }
      }
    } catch (err) {
      if (lastWordsEl) {
        lastWordsEl.innerHTML =
          '<div style="color:#9a8880;font-size:11px;padding:10px 0;">遗言生成失败：' + err.message + '</div>';
      }
    }
  }

  document.getElementById('btr-ending-restart').addEventListener('click', () => {
    gs = null;
    /* 清空所有状态 */
    const narrativeArea = document.getElementById('btr-narrative-area');
    if (narrativeArea) narrativeArea.innerHTML = '';
    const endLayer = document.getElementById('btr-ending-danmaku-layer');
    if (endLayer) endLayer.innerHTML = '';
    const mainLayer = document.getElementById('btr-danmaku-layer');
    if (mainLayer) mainLayer.innerHTML = '';
    btrDanmakuEnabled = false;
    const danmakuBtn  = document.getElementById('btr-danmaku-btn');
    if (danmakuBtn) danmakuBtn.classList.remove('active');
    const choicesList = document.getElementById('btr-choices-list');
    if (choicesList) choicesList.innerHTML = '';

    const ni = document.getElementById('btr-user-name-input');
    const si = document.getElementById('btr-user-setting-input');
    if (ni) ni.value = '';
    if (si) si.value = '';
    const pr = document.querySelector('input[name="btr-mode"][value="player"]');
    if (pr) pr.checked = true;

    btrShowScreen('batoru-user-setup');
  });

  document.getElementById('btr-ending-exit').addEventListener('click', () => {
    const endLayer = document.getElementById('btr-ending-danmaku-layer');
    if (endLayer) endLayer.innerHTML = '';
    btrShowScreen('batoru-lobby');
    btrUpdateContinueBtn();
  });

})();
