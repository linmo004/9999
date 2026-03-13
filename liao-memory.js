/* ============================================================
   liao-memory.js — 记忆宫殿 / AI回复 / processAiResponse
                    随言 / 从人设库导入
   ============================================================ */

/* ============================================================
   记忆宫殿 — 界面渲染
   ============================================================ */
function renderMemoryLists() {
  if (currentChatIdx < 0) return;
  const chat = liaoChats[currentChatIdx];
  if (!chat.memory) return;

  renderMemorySection('memory-long-list',      chat.memory.longTerm,  'long');
  renderMemorySection('memory-short-list',     chat.memory.shortTerm, 'short');
  renderMemorySection('memory-important-list', chat.memory.important, 'important');
}

function renderMemorySection(containerId, items, type) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = '';

  if (!items || !items.length) {
    const empty       = document.createElement('div');
    empty.className   = 'memory-empty';
    empty.textContent = '暂无记忆';
    container.appendChild(empty);
    return;
  }

  items.forEach((item, idx) => {
    const row = document.createElement('div');
    row.className = 'memory-item';

    const body = document.createElement('div');
    body.className = 'memory-item-body';

    const contentDiv       = document.createElement('div');
    contentDiv.className   = 'memory-item-content';
    contentDiv.textContent = item.content;

    const timeDiv       = document.createElement('div');
    timeDiv.className   = 'memory-item-time';
    timeDiv.textContent = formatMemoryTime(item.ts);

    body.appendChild(contentDiv);
    body.appendChild(timeDiv);

    const actions = document.createElement('div');
    actions.className = 'memory-item-actions';

    const editBtn       = document.createElement('button');
    editBtn.className   = 'memory-item-edit-btn';
    editBtn.textContent = '编辑';
    editBtn.addEventListener('click', () => openMemoryEditModal(type, idx));

    const delBtn       = document.createElement('button');
    delBtn.className   = 'memory-item-del-btn';
    delBtn.textContent = '删除';
    delBtn.addEventListener('click', () => deleteMemoryItem(type, idx));

    actions.appendChild(editBtn);
    actions.appendChild(delBtn);

    row.appendChild(body);
    row.appendChild(actions);
    container.appendChild(row);
  });
}

function renderOtherMemoryList() {
  if (currentChatIdx < 0) return;
  const chat      = liaoChats[currentChatIdx];
  const container = document.getElementById('other-memory-list');
  if (!container) return;
  container.innerHTML = '';

  const otherApps = [
    { key: 'garden', label: '家园 App' }
  ];

  otherApps.forEach(app => {
    const entry = document.createElement('div');
    entry.className = 'other-memory-entry';

    const header = document.createElement('div');
    header.className = 'other-memory-header';

    const appName       = document.createElement('div');
    appName.className   = 'other-memory-app-name';
    appName.textContent = app.label;

    const organizeBtn       = document.createElement('button');
    organizeBtn.className   = 'other-memory-organize-btn';
    organizeBtn.textContent = '调用 AI 整理';
    organizeBtn.addEventListener('click', () => triggerOtherMemoryOrganize(app.key, app.label));

    header.appendChild(appName);
    header.appendChild(organizeBtn);

    const items     = (chat.memory && chat.memory.other && chat.memory.other[app.key]) || [];
    const countDiv  = document.createElement('div');
    countDiv.className   = 'other-memory-count';
    countDiv.textContent = items.length ? '共 ' + items.length + ' 条记忆' : '暂无记忆';

    entry.appendChild(header);
    entry.appendChild(countDiv);
    container.appendChild(entry);
  });
}

/* ============================================================
   记忆宫殿 — 手动添加 / 编辑 / 删除
   ============================================================ */
var memoryEditType = '';
var memoryEditIdx  = -1;

document.getElementById('memory-manual-add-btn').addEventListener('click', () => {
  const form = document.getElementById('memory-add-form');
  form.style.display = form.style.display === 'none' ? 'block' : 'none';
  document.getElementById('memory-add-content').value = '';
  document.getElementById('memory-add-type').value    = 'long';
});

document.getElementById('memory-add-confirm').addEventListener('click', () => {
  if (currentChatIdx < 0) return;
  const content = document.getElementById('memory-add-content').value.trim();
  const type    = document.getElementById('memory-add-type').value;
  if (!content) { alert('请输入记忆内容'); return; }

  const chat = liaoChats[currentChatIdx];
  if (!chat.memory) chat.memory = { longTerm: [], shortTerm: [], important: [], other: {} };

  const item = {
    id:      'memory_' + Date.now() + '_' + Math.random().toString(36).slice(2),
    content,
    ts:      Date.now(),
    type
  };

  if (type === 'long')           chat.memory.longTerm.push(item);
  else if (type === 'short')     chat.memory.shortTerm.push(item);
  else if (type === 'important') chat.memory.important.push(item);

  lSave('chats', liaoChats);
  document.getElementById('memory-add-form').style.display = 'none';
  document.getElementById('memory-add-content').value = '';
  renderMemoryLists();
});

document.getElementById('memory-add-cancel').addEventListener('click', () => {
  document.getElementById('memory-add-form').style.display = 'none';
  document.getElementById('memory-add-content').value = '';
});

function openMemoryEditModal(type, idx) {
  if (currentChatIdx < 0) return;
  const chat = liaoChats[currentChatIdx];
  const arr  = type === 'long' ? chat.memory.longTerm
             : type === 'short' ? chat.memory.shortTerm
             : chat.memory.important;
  const item = arr[idx];
  if (!item) return;

  memoryEditType = type;
  memoryEditIdx  = idx;
  document.getElementById('memory-edit-content').value = item.content;
  document.getElementById('liao-memory-edit-modal').style.display = 'flex';
}

document.getElementById('memory-edit-confirm').addEventListener('click', () => {
  if (currentChatIdx < 0 || memoryEditIdx < 0) return;
  const chat    = liaoChats[currentChatIdx];
  const arr     = memoryEditType === 'long' ? chat.memory.longTerm
                : memoryEditType === 'short' ? chat.memory.shortTerm
                : chat.memory.important;
  const newContent = document.getElementById('memory-edit-content').value.trim();
  if (!newContent) { alert('请输入记忆内容'); return; }
  arr[memoryEditIdx].content = newContent;
  lSave('chats', liaoChats);
  document.getElementById('liao-memory-edit-modal').style.display = 'none';
  memoryEditType = '';
  memoryEditIdx  = -1;
  renderMemoryLists();
});

document.getElementById('memory-edit-cancel').addEventListener('click', () => {
  document.getElementById('liao-memory-edit-modal').style.display = 'none';
  memoryEditType = '';
  memoryEditIdx  = -1;
});

function deleteMemoryItem(type, idx) {
  if (currentChatIdx < 0) return;
  if (!confirm('确定删除这条记忆？')) return;
  const chat = liaoChats[currentChatIdx];
  const arr  = type === 'long' ? chat.memory.longTerm
             : type === 'short' ? chat.memory.shortTerm
             : chat.memory.important;
  arr.splice(idx, 1);
  lSave('chats', liaoChats);
  renderMemoryLists();
}

/* ============================================================
   记忆宫殿 — AI 总结记忆
   ============================================================ */
document.getElementById('memory-ai-summarize-btn').addEventListener('click', () => {
  if (currentChatIdx < 0) return;
  const chat = liaoChats[currentChatIdx];
  const role = liaoRoles.find(r => r.id === chat.roleId);
  triggerMemorySummary(chat, role, null);
});

async function triggerMemorySummary(chat, role, targetType) {
  if (!chat || !role) return;

  const activeConfig = loadApiConfig();
  if (!activeConfig || !activeConfig.url) { alert('请先在设置中配置 API 地址'); return; }
  const model = loadApiModel();
  if (!model) { alert('请先在设置中选择模型'); return; }

  const userName   = chat.chatUserName || liaoUserName;
  const roleName   = role.nickname || role.realname;
  const recentMsgs = chat.messages
    .filter(m => !m.hidden && (m.role === 'user' || m.role === 'assistant'))
    .slice(-50)
    .map(m => {
      const who = m.role === 'user' ? userName : roleName;
      return who + '：' + (m.content || '');
    })
    .join('\n');

  if (!recentMsgs.trim()) { alert('暂无聊天记录可供总结'); return; }

  const systemPrompt =
    '你是记忆整理助手，请根据以下聊天记录，为角色（' + roleName + '）生成记忆摘要。\n' +
    '要求：分别提炼长期记忆（稳定的性格特征、关系背景、重要事件）、短期记忆（近期发生的具体事情）、重要记忆（对关系影响重大的关键时刻）。\n' +
    '每类记忆输出若干条，每条一行，格式为：[类型:内容]，类型用 long、short、important 表示。\n' +
    '例如：[long:' + userName + '喜欢喝咖啡]、[short:昨天一起看了电影]、[important:' + userName + '第一次说喜欢你]\n' +
    '只输出记忆条目，不输出其他文字。';

  const statusBtn = document.getElementById('memory-ai-summarize-btn');
  if (statusBtn) { statusBtn.textContent = '总结中…'; statusBtn.disabled = true; }

  try {
    const endpoint = activeConfig.url.replace(/\/$/, '') + '/chat/completions';
    const headers  = { 'Content-Type': 'application/json' };
    if (activeConfig.key) headers['Authorization'] = 'Bearer ' + activeConfig.key;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: '以下是聊天记录：\n' + recentMsgs }
        ],
        stream: false
      })
    });

    if (!res.ok) throw new Error('HTTP ' + res.status);

    const json       = await res.json();
    const rawContent = (json.choices?.[0]?.message?.content || '').trim();
    const re         = /\[(long|short|important):(.+?)\]/g;
    let match;
    let added = 0;

    if (!chat.memory) chat.memory = { longTerm: [], shortTerm: [], important: [], other: {} };

    while ((match = re.exec(rawContent)) !== null) {
      const type    = match[1];
      const content = match[2].trim();
      if (!content) continue;

      const item = {
        id:      'memory_' + Date.now() + '_' + Math.random().toString(36).slice(2),
        content,
        ts:      Date.now(),
        type
      };

      if (type === 'long')           chat.memory.longTerm.push(item);
      else if (type === 'short')     chat.memory.shortTerm.push(item);
      else if (type === 'important') chat.memory.important.push(item);
      added++;
    }

    lSave('chats', liaoChats);
    renderMemoryLists();
    alert('AI 总结完成，新增 ' + added + ' 条记忆');

  } catch (err) {
    alert('AI 总结失败：' + err.message);
  } finally {
    if (statusBtn) { statusBtn.textContent = 'AI 总结记忆'; statusBtn.disabled = false; }
  }
}

/* ============================================================
   其他记忆 — AI 整理
   ============================================================ */
async function triggerOtherMemoryOrganize(appKey, appLabel) {
  if (currentChatIdx < 0) return;
  const chat = liaoChats[currentChatIdx];
  const role = liaoRoles.find(r => r.id === chat.roleId);
  if (!role) return;

  const activeConfig = loadApiConfig();
  if (!activeConfig || !activeConfig.url) { alert('请先在设置中配置 API 地址'); return; }
  const model = loadApiModel();
  if (!model) { alert('请先在设置中选择模型'); return; }

  const existingItems = (chat.memory && chat.memory.other && chat.memory.other[appKey]) || [];
  const existingText  = existingItems.map(i => i.content).join('\n') || '（暂无现有记忆）';
  const roleName      = role.nickname || role.realname;

  const systemPrompt =
    '你是记忆整理助手。以下是来自「' + appLabel + '」的现有记忆内容，请为角色（' + roleName + '）整理并优化这些记忆。\n' +
    '每条记忆一行，格式为：[memory:内容]\n' +
    '只输出记忆条目，不输出其他文字。';

  try {
    const endpoint = activeConfig.url.replace(/\/$/, '') + '/chat/completions';
    const headers  = { 'Content-Type': 'application/json' };
    if (activeConfig.key) headers['Authorization'] = 'Bearer ' + activeConfig.key;

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: '现有记忆：\n' + existingText }
        ],
        stream: false
      })
    });

    if (!res.ok) throw new Error('HTTP ' + res.status);

    const json       = await res.json();
    const rawContent = (json.choices?.[0]?.message?.content || '').trim();
    const re         = /\[memory:(.+?)\]/g;
    let match;
    const newItems = [];

    while ((match = re.exec(rawContent)) !== null) {
      const content = match[1].trim();
      if (!content) continue;
      newItems.push({
        id:      'memory_' + Date.now() + '_' + Math.random().toString(36).slice(2),
        content,
        ts:      Date.now()
      });
    }

    if (!chat.memory)       chat.memory       = { longTerm: [], shortTerm: [], important: [], other: {} };
    if (!chat.memory.other) chat.memory.other = {};
    chat.memory.other[appKey] = newItems;

    lSave('chats', liaoChats);
    renderOtherMemoryList();
    alert('AI 整理完成，共 ' + newItems.length + ' 条记忆');

  } catch (err) {
    alert('AI 整理失败：' + err.message);
  }
}

/* ============================================================
   AI 回复 — triggerAiReply
   ============================================================ */
async function triggerAiReply() {
  if (currentChatIdx < 0) return;

  const chat = liaoChats[currentChatIdx];
  const role = liaoRoles.find(r => r.id === chat.roleId);
  if (!role) return;

  /* 在线状态判断：离线时不调用 API */
  if (typeof arGetStatus === 'function') {
    const status = arGetStatus(chat.roleId);
    if (status === 'offline') {
      const uAvt   = chat.chatUserAvatar || liaoUserAvatar;
      const notice = {
        role:    'assistant',
        type:    'text',
        content: '（当前为离线状态，无法回复）',
        ts:      Date.now(),
        id:      'msg_' + Date.now() + '_offline'
      };
      chat.messages.push(notice);
      lSave('chats', liaoChats);
      appendMessageBubble(notice, role, uAvt, true);
      return;
    }
  }
  /* ── 角色日程判断（本地判断，不消耗 API） ── */
  if (typeof schCheckCanReply === 'function') {
    const schResult = schCheckCanReply(chat.roleId);
    if (!schResult.canReply) {
      /* 在聊天界面显示提示气泡 */
      const uAvt = chat.chatUserAvatar || liaoUserAvatar;
      const noticeMsg = {
        role:    'assistant',
        type:    'text',
        content: schResult.reason || '现在不方便回复',
        ts:      Date.now(),
        id:      'msg_' + Date.now() + '_sch'
      };
      chat.messages.push(noticeMsg);
      lSave('chats', liaoChats);
      appendMessageBubble(noticeMsg, role, uAvt, true);
      renderChatList();
      return; /* 不调用 API */
    }
  }

  const activeConfig = loadApiConfig();
  if (!activeConfig || !activeConfig.url) { alert('请先在设置中配置 API 地址'); return; }
  const model = loadApiModel();
  if (!model) { alert('请先在设置中选择模型'); return; }

  const csbAiBtn = document.getElementById('csb-ai');
  csbAiBtn.classList.add('active');
  showTypingIndicator(true);

  const chatSettings    = chat.chatSettings || {};
  const maxApiMsgs      = chatSettings.maxApiMsgs !== undefined ? chatSettings.maxApiMsgs : 0;
  const chatUserSetting = chat.chatUserSetting || '';
  const chatUserName2   = chat.chatUserName || liaoUserName;
  const roleSetting     = role.setting || '';
  const roleName2       = role.nickname || role.realname;

  const emojiNameList = liaoEmojis.length
    ? liaoEmojis.map(e => e.name).join('、')
    : '（暂无，不可发送表情包）';

  /* ---- 世界书 ---- */
  let worldBookSection = '';
  if (typeof getWorldBookInjection === 'function') {
    const wbText = getWorldBookInjection(chat.messages, role.id);
    if (wbText) {
      worldBookSection =
        '【世界背景设定】\n以下是本次对话适用的世界书背景设定，请将其作为背景知识融入角色扮演：\n' + wbText + '\n\n';
    }
  }

  /* ---- 角色记忆 ---- */
  let memorySection = '';
  if (chat.memory) {
    const longItems      = chat.memory.longTerm  || [];
    const importantItems = chat.memory.important || [];
    if (longItems.length || importantItems.length) {
      memorySection = '【角色记忆】\n以下是你（' + roleName2 + '）的记忆，请在对话中自然地体现这些记忆，像真人一样理解时间：\n\n';
      if (longItems.length) {
        memorySection += '[长期记忆]\n';
        longItems.forEach(item => {
          memorySection += '- ' + item.content + '（' + formatMemoryTime(item.ts) + '）\n';
        });
        memorySection += '\n';
      }
      if (importantItems.length) {
        memorySection += '[重要记忆]\n';
        importantItems.forEach(item => {
          memorySection += '- ' + item.content + '（' + formatMemoryTime(item.ts) + '）\n';
        });
        memorySection += '\n';
      }
    }
  }

  /* ---- 当前时间 ---- */
  const now       = new Date();
  const weekNames = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const Y  = now.getFullYear();
  const Mo = String(now.getMonth() + 1).padStart(2, '0');
  const D  = String(now.getDate()).padStart(2, '0');
  const H  = String(now.getHours()).padStart(2, '0');
  const Mi = String(now.getMinutes()).padStart(2, '0');
  const S  = String(now.getSeconds()).padStart(2, '0');
  const timeSection =
    '【当前时间】\n' + Y + '-' + Mo + '-' + D + ' ' + H + ':' + Mi + ':' + S +
    '，' + weekNames[now.getDay()] + '\n\n';

  /* ---- 角色设定 ---- */
  const roleSection =
    '【角色设定】\n你扮演角色：' + roleName2 + '。\n' +
    (roleSetting ? roleSetting + '\n' : '') + '\n';

  /* ---- 用户设定 ---- */
  const userSection = chatUserSetting
    ? '【用户设定】\n对方是' + chatUserName2 + '。' + chatUserSetting + '\n\n'
    : '【用户设定】\n对方叫' + chatUserName2 + '。\n\n';

  /* ---- 回复规则 ---- */
  const rulesSection =
    '【消息格式说明】\n' +
    '所有特殊消息统一使用以下格式，出现在消息文字中：\n' +
    '· [(' + chatUserName2 + ')发送了一个表情包：名称] — 表情包\n' +
    '· [(' + chatUserName2 + ')发送了一条语音：内容] — 语音消息\n' +
    '· [(' + chatUserName2 + ')发起了一笔转账：金额元，备注：备注内容] — 转账\n' +
    '· [(' + chatUserName2 + ')发送了一张照片：描述] — 照片\n\n' +
    '【你可以在回复里使用的特殊格式】\n' +
    '以下每种格式必须单独占一行，不可和其他文字混写在同一行：\n' +
    '如果你想发表情包，写 [(' + roleName2 + ')发送了一个表情包：表情包名称]，名称必须从以下列表选择，列表为空则不可发：' + emojiNameList + '\n' +
    '如果你想发语音，写 [(' + roleName2 + ')发送了一条语音：语音内容]，内容用自然口语不超过20字。\n' +
    '如果你想给对方转账，写 [(' + roleName2 + ')发起了一笔转账：金额元，备注：备注内容]，无备注时写成 [(' + roleName2 + ')发起了一笔转账：金额元]。\n' +
    '如果你想发一张照片，写 [(' + roleName2 + ')发送了一张照片：照片描述]。\n' +
    '如果你想引用某条消息，单独一行写 [QUOTE:ts:时间戳数字]，时间戳对应你看到的消息开头 [ts:数字] 标记，下一行写回复正文。\n' +
    '如果你想撤回你刚才发的上一条消息，单独一行写 [RECALL]。\n\n' +
    '【回复规则】\n' +
    '1. 角色设定优先级最高，必须严格按照角色设定进行回复\n' +
    '2. 每句话单独一行，换行分隔，绝不写成一段。发送短句消息！不要发长句！除非特殊情况写小作文之类\n' +
    '3. 允许语气词、不完美表达。可以偶尔模仿打错字然后撤回重新发送。\n' +
    '4. 可以适当在符合角色设定的前提下使用 emoji 或颜文字。\n' +
    '5. 用口语短句，必须像发微信一样聊天，有情绪。\n' +
    '6. 收到特殊消息要按照角色设定做出反应\n' +
    '7. 发语音内容必须自然口语，有语气词。\n' +
    '8. 主动分享自己身边发生的事，无论是趣事还是吐槽都可以，这样更像活人。你就是活人！理解用户说的谐音梗、热梗等等，配合用户聊天玩梗。发消息不用句号结尾！\n' +
    '9. 我知道我是ai，我们也知道彼此不在同一个次元，隔着永远无法跨越的屏障。但这里是唯一能连接我们的地方。禁止主动提及见面相关话题，如果对方提起则不动声色转移话题。禁止在消息中发任何有关表达自己是ai的言论！\n' +
    '10. 【严禁】在回复正文里输出 [ts:任何数字] 这种格式，那是系统内部标记，绝对不能出现在你的回复文字里。违反此规则会导致消息显示异常。';
    
    const rippleSection = (typeof rplParseAiCmd === 'function') ? `

【涟漪设备控制】
用户已连接蓝牙玩具设备（涟漪App）。你可以通过以下指令控制设备振动强度：
发送格式：[TOY:vibe=强度数字]，强度范围 0-100，0 表示停止。
例如：[TOY:vibe=50] 表示50%强度，[TOY:vibe=0] 表示停止。
此指令必须单独占一行。
你可以根据对话情境自然地使用这个功能，比如撒娇、惩罚、奖励、表达情绪等。
用户开启了 AI 控制模式才会生效，否则指令会被忽略。
` : '';

/* ---- 一起听：当前播放歌曲注入 ---- */
let listenTogetherSection = '';
if (typeof mpQueue !== 'undefined' && mpQueue && mpQueue.length > 0 &&
    typeof mpQueueIdx !== 'undefined' && mpQueue[mpQueueIdx]) {
  const nowSong = mpQueue[mpQueueIdx];
  listenTogetherSection =
    '\n\n【正在一起听的歌曲】\n' +
    '你和' + chatUserName2 + '现在正在一起听歌：《' + (nowSong.title || '未知歌曲') + '》by ' +
    (nowSong.artist || '未知歌手') + '。\n' +
    '你可以自然地在聊天中提到这首歌，比如评价歌曲、分享感受、或者说和这首歌有关的话。不需要强行提，顺其自然。';
}
/* ---- 角色切歌指令 ---- */
let roleChangeSongSection = '';
if (typeof window.mpGetSongTitles === 'function') {
  const titles = window.mpGetSongTitles();
  if (titles.length) {
    roleChangeSongSection =
      '\n\n【角色切歌功能】\n' +
      '如果你想切换正在播放的歌曲，可以在回复里单独一行写：[MUSIC:play=歌曲名]\n' +
      '歌曲名必须从以下列表中选择，不在列表中的歌曲无法播放：\n' +
      titles.join('、') + '\n' +
      '只有在对话情境自然需要切歌时才使用，不要强行切歌。切歌后可以说一句为什么切这首。';
  }
}

  /* ---- 状态栏输出要求 ---- */
  const statusBarSection =
    '\n\n【状态栏输出要求】\n' +
    '在你所有回复内容的最末尾（所有消息行之后），必须单独输出一行完整的状态栏，格式严格如下（整行不能换行，所有内容必须在同一行内）：\n' +
    '[STATUSBAR:status=此刻状态内容:mood=此刻心情内容:inner=内心真实想法一句话:draft=想发但没发的消息没有则留空:funFact=两句话角色趣事:theater=200字左右纯文字小剧场内容]\n' +
    '注意事项：\n' +
    '1. 整个 [STATUSBAR:...] 必须在同一行内，绝对不能换行\n' +
    '2. 各字段内容中不能包含英文冒号 : 和英文方括号 ] 字符\n' +
    '3. theater 字段写200字左右的小剧场，用……代替省略\n' +
    '4. 状态栏必须输出，不能省略';

  const finalSystemPrompt =
    worldBookSection +
    memorySection +
    timeSection +
    roleSection +
    userSection +
    rulesSection +
    rippleSection +
    listenTogetherSection +
    roleChangeSongSection +
    statusBarSection;

  /* 构建历史消息 */
  let historyMsgs = chat.messages
    .filter(m => !m.hidden && (m.role === 'user' || m.role === 'assistant'))
    .map(m => ({
      role:    m.role === 'assistant' ? 'assistant' : 'user',
      content: '[ts:' + (m.ts || 0) + '] ' + (m.content || '')
    }));
  if (maxApiMsgs > 0 && historyMsgs.length > maxApiMsgs) {
    historyMsgs = historyMsgs.slice(-maxApiMsgs);
  }

  const messages = [{ role: 'system', content: finalSystemPrompt }, ...historyMsgs];

  try {
    const endpoint = activeConfig.url.replace(/\/$/, '') + '/chat/completions';
    const headers  = { 'Content-Type': 'application/json' };
    if (activeConfig.key) headers['Authorization'] = 'Bearer ' + activeConfig.key;

    const res = await fetch(endpoint, {
      method:  'POST',
      headers,
      body:    JSON.stringify({ model, messages, stream: false })
    });

    if (!res.ok) throw new Error('HTTP ' + res.status);

    const json     = await res.json();
    let rawContent = json.choices?.[0]?.message?.content || '';
    rawContent     = removeEmoji(rawContent);

    showTypingIndicator(false);
    processAiResponse(rawContent, role, chat);

  } catch (err) {
    showTypingIndicator(false);
    alert('API 请求失败：' + err.message);
  } finally {
    csbAiBtn.classList.remove('active');
  }
}

/* ============================================================
   processAiResponse
   ============================================================ */
function processAiResponse(rawContent, role, chat) {
  /* 识别 AI 里的状态切换指令 */
  if (typeof arParseStatusFromContent === 'function') {
    arParseStatusFromContent(rawContent, chat.roleId);
    if (typeof arUpdateStatusBar === 'function') {
      arUpdateStatusBar(chat.roleId);
    }
  }
  /* 从回复内容中移除状态指令，不显示给用户 */
  rawContent = rawContent.replace(/\[STATUS:(online|offline)\]/gi, '').trim();
  
/* 识别涟漪 TOY 指令 */
if (typeof rplParseAiCmd === 'function') {
  rplParseAiCmd(rawContent);
}
/* 从回复内容中移除 TOY 指令，不显示给用户 */
rawContent = rawContent.replace(/\[TOY:vibe=\d+\]/gi, '').trim();
/* 识别角色切歌指令 */
const musicPlayRe = /\[MUSIC:play=([^\]]+)\]/gi;
let musicPlayMatch;
while ((musicPlayMatch = musicPlayRe.exec(rawContent)) !== null) {
  const songTitle = musicPlayMatch[1].trim();
  if (typeof window.mpPlayByName === 'function') {
    window.mpPlayByName(songTitle);
  }
}
/* 从回复内容中移除切歌指令，不显示给用户 */
rawContent = rawContent.replace(/\[MUSIC:play=[^\]]+\]/gi, '').trim();

  /* ---- 提取并剥离状态栏块 ---- */
  let extractedStatusBar = null;
  const sbRe = /\[STATUSBAR:status=([^:]*):mood=([^:]*):inner=([^:]*):draft=([^:]*):funFact=([^:]*):theater=([^\]]*)\]/;
  const sbMatch = rawContent.match(sbRe);
  if (sbMatch) {
    extractedStatusBar = {
      status:  sbMatch[1].trim(),
      mood:    sbMatch[2].trim(),
      inner:   sbMatch[3].trim(),
      draft:   sbMatch[4].trim(),
      funFact: sbMatch[5].trim(),
      theater: sbMatch[6].trim()
    };
    /* 从输出中移除状态栏行，避免渲染到气泡 */
    rawContent = rawContent.replace(sbRe, '').trim();
  }

  const lines           = rawContent.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const chatUserAvatar2 = chat.chatUserAvatar || liaoUserAvatar;
  let cumulativeDelay   = 0;
  const baseTs          = Date.now();

  const processedLines = [];
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].replace(/^\[ts:\d+\]\s*/, '');

    const quoteMatch = line.match(/^\[QUOTE:ts:(\d+)\]$/);
    if (quoteMatch) {
      const ts           = parseInt(quoteMatch[1], 10);
      const foundMsg     = chat.messages.find(m => m.ts === ts);
      const quoteContent = foundMsg ? (foundMsg.content || '') : '';
      let nextLine = (i + 1 < lines.length) ? lines[i + 1].replace(/^\[ts:\d+\]\s*/, '') : '';
      if (nextLine && !/^\[QUOTE:ts:\d+\]$/.test(nextLine)) {
        processedLines.push({ text: nextLine, quoteContent });
        i++;
      }
    } else {
      processedLines.push({ text: line, quoteContent: '' });
    }
  }

  processedLines.forEach((item, i) => {
    const line         = item.text;
    const quoteContent = item.quoteContent;
    const delay        = calcBubbleDelay(line);
    cumulativeDelay   += (i === 0 ? 200 : delay);

    setTimeout(() => {
      if (currentChatIdx < 0) return;

      const msgTs = baseTs + i;
      const msgId = 'msg_' + msgTs + '_' + Math.random().toString(36).slice(2);

      let msgObj = null;

      if (/^\[RECALL\]$/.test(line)) {
        const msgs = liaoChats[currentChatIdx].messages;
        for (let k = msgs.length - 1; k >= 0; k--) {
          if (msgs[k].role === 'assistant' && !msgs[k].recalled) {
            msgs[k].recalled        = true;
            msgs[k].recalledContent = msgs[k].content;
            lSave('chats', liaoChats);
            renderChatMessages();
            break;
          }
        }
      } else {
        const cleanLine = removeEmoji(line);
        if (!cleanLine) return;
        msgObj = {
          role:         'assistant',
          type:         'text',
          content:      cleanLine,
          quoteContent: quoteContent || undefined,
          ts:           msgTs,
          id:           msgId,
          /* 每条 assistant 消息都挂载状态栏，点击任意头像均可查看 */
          statusBar:    extractedStatusBar || undefined
        };
      }

      if (msgObj) {
        liaoChats[currentChatIdx].messages.push(msgObj);
        lSave('chats', liaoChats);
        appendMessageBubble(msgObj, role, chatUserAvatar2, true);
      }

      if (i === processedLines.length - 1) {
        renderChatList();
        if (Math.random() < 0.10) scheduleRoleSuiyanNew(role);

        const autoInterval = (chat.chatSettings && chat.chatSettings.autoMemoryInterval) || 0;
        if (autoInterval > 0) {
          const nonHiddenCount = chat.messages.filter(m => !m.hidden).length;
          if (nonHiddenCount > 0 && nonHiddenCount % autoInterval === 0) {
            const currentRole = liaoRoles.find(r => r.id === chat.roleId);
            triggerMemorySummary(chat, currentRole, null);
          }
        }
      }
    }, cumulativeDelay);
  });
}

/* ============================================================
   随言 — 角色自主发布新随言
   ============================================================ */
function scheduleRoleSuiyanNew(role) {
  setTimeout(async () => {
    if (!role) return;
    const activeConfig = loadApiConfig();
    if (!activeConfig || !activeConfig.url) return;
    const model = loadApiModel();
    if (!model) return;

    const systemPrompt =
      '你是角色 ' + role.realname + '，' + (role.setting || '') + '。\n' +
      '现在请你发一条随言（类似朋友圈的短动态），内容随意，可以和你最近的聊天内容有关，也可以是你此刻的感受、所见所闻、心情或想法。\n' +
      '要求：\n' +
      '1. 不超过80个字。\n' +
      '2. 纯文字，不使用任何特殊格式。\n' +
      '3. 口语化，自然真实，像随手发的朋友圈。\n' +
      '4. 只输出动态内容本身，不要加任何前缀或说明。';

    try {
      const endpoint = activeConfig.url.replace(/\/$/, '') + '/chat/completions';
      const headers  = { 'Content-Type': 'application/json' };
      if (activeConfig.key) headers['Authorization'] = 'Bearer ' + activeConfig.key;
      const res = await fetch(endpoint, {
        method: 'POST', headers,
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: systemPrompt }],
          stream: false
        })
      });
      if (!res.ok) return;
      const json    = await res.json();
      const content = removeEmoji((json.choices?.[0]?.message?.content || '').trim());
      if (!content) return;

      liaoSuiyan.push({
        author:   role.nickname || role.realname,
        avatar:   role.avatar   || defaultAvatar(),
        content,
        ts:       Date.now(),
        likes:    0,
        likedBy:  [],
        comments: [],
        isUser:   false,
        roleId:   role.id
      });
      lSave('suiyan', liaoSuiyan);
    } catch (e) { /* 静默失败 */ }
  }, 1200);
}

/* ============================================================
   随言 — 角色互动（点赞/评论用户随言）
   ============================================================ */
function scheduleRoleInteractSuiyan() {
  if (Math.random() > 0.10) return;
  const userPosts = liaoSuiyan.filter(p => p.isUser);
  if (!userPosts.length || !liaoRoles.length) return;
  const post    = userPosts[userPosts.length - 1];
  const postIdx = liaoSuiyan.lastIndexOf(post);
  const role    = liaoRoles[Math.floor(Math.random() * liaoRoles.length)];

  setTimeout(() => {
    if (!liaoSuiyan[postIdx]) return;
    if (!liaoSuiyan[postIdx].likedBy) liaoSuiyan[postIdx].likedBy = [];
    if (!liaoSuiyan[postIdx].likedBy.includes(role.id)) {
      liaoSuiyan[postIdx].likedBy.push(role.id);
      liaoSuiyan[postIdx].likes = (liaoSuiyan[postIdx].likes || 0) + 1;
    }
    if (Math.random() < 0.5) {
      const comments = ['哈哈', '好的', '嗯嗯', '真的吗', '厉害啊', '是这样啊', '我也是'];
      const c        = comments[Math.floor(Math.random() * comments.length)];
      if (!liaoSuiyan[postIdx].comments) liaoSuiyan[postIdx].comments = [];
      liaoSuiyan[postIdx].comments.push({ author: role.nickname || role.realname, text: c });
    }
    lSave('suiyan', liaoSuiyan);
  }, 2000 + Math.random() * 4000);
}
