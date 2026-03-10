/* ============================================================
   garden-core.js — 家园App 数据层
   常量配置 / 数据读写 / 角色读取 / API调用 / Prompt构建
   ============================================================ */

/* ── 顶部可配置常量 ── */
var GDN_INTRO_IMG_URL = 'https://img.icons8.com/fluency/200/cottage.png';
var GDN_ROOM_BG_URL   = 'https://img.icons8.com/fluency/200/interior.png';

var GDN_ROOM_AVATAR_POINTS = [
  { left: '18%', top: '35%' },
  { left: '38%', top: '30%' },
  { left: '55%', top: '28%' },
  { left: '72%', top: '38%' },
  { left: '42%', top: '42%' },
];

var GDN_MAP_SPOTS = [
  { id: 'home',  label: '住所',   emoji: '🏠', left: '22%', top: '38%' },
  { id: 'plaza', label: '广场',   emoji: '⛲', left: '52%', top: '25%' },
  { id: 'park',  label: '游乐场', emoji: '🎡', left: '78%', top: '42%' },
  { id: 'mall',  label: '商场',   emoji: '🏬', left: '62%', top: '65%' },
  { id: 'cafe',  label: '咖啡厅', emoji: '☕', left: '30%', top: '68%' },
  { id: 'farm',  label: '菜园',   emoji: '🌿', left: '16%', top: '62%' },
];

var GDN_LOCATION_STATES = {
  home:  ['在房间里休息', '在客厅看书', '在厨房做饭', '在卧室睡觉', '在书房写作'],
  plaza: ['在广场散步', '在广场晒太阳', '在广场聊天', '在广场看活动', '在广场发呆'],
  park:  ['在游乐场玩耍', '在游乐场坐旋转木马', '在游乐场排队', '在游乐场吃棉花糖'],
  mall:  ['在商场逛街', '在商场购物', '在商场吃饭', '在商场看电影', '在商场休息'],
  cafe:  ['在咖啡厅喝咖啡', '在咖啡厅看书', '在咖啡厅工作', '在咖啡厅发呆', '在咖啡厅聊天'],
  farm:  ['在菜园浇水', '在菜园除草', '在菜园摘菜', '在菜园种花', '在菜园赏蝴蝶'],
};

var GDN_LOCATION_DESC = {
  plaza: '阳光明媚的广场，微风轻拂，大家在这里自由活动。',
  park:  '欢乐的游乐场，旋转木马缓缓转动，笑声此起彼伏。',
  mall:  '宽敞明亮的商场，各种店铺琳琅满目，人来人往。',
  cafe:  '温馨的咖啡厅，木质桌椅，柔和的灯光，咖啡香气弥漫。',
  farm:  '生机勃勃的菜园，绿油油的蔬菜整齐排列，蜜蜂飞舞。',
};

var GDN_ACTIVITY_POOL = [
  { icon: '🎂', name: '生日派对',   desc: '今天是特别的日子，一起来庆祝吧！',
    narrative: '蜡烛的光映出温暖的笑脸，大家的祝福声此起彼伏。' },
  { icon: '🍕', name: '广场野餐',   desc: '铺开野餐毯，一起在广场享用美食！',
    narrative: '草地上铺开了格子毯，阳光正好，微风不燥，这是最美好的下午。' },
  { icon: '🎮', name: '游戏对决',   desc: '来一场公平的游戏对决，谁是最强者？',
    narrative: '游戏开始了！欢呼声和惋惜声交织在一起，胜负已分，却笑声不断。' },
  { icon: '🌟', name: '许愿时刻',   desc: '夜幕降临，流星划过，许下心愿吧。',
    narrative: '一颗流星悄然滑落，大家闭上眼睛，把最深的愿望悄悄放在心里。' },
  { icon: '🌱', name: '菜园劳动',   desc: '一起去菜园劳动，感受泥土的气息。',
    narrative: '锄头翻动泥土的声音，汗水换来的是对收获的期待。' },
  { icon: '📸', name: '集体合影',   desc: '难得聚齐，来一张大合照吧！',
    narrative: '大家挤在一起，镜头定格了这个珍贵的瞬间。' },
  { icon: '🎵', name: '音乐下午茶', desc: '咖啡厅里有人开始弹吉他了……',
    narrative: '旋律在咖啡厅里流淌，大家静静地沉浸在音乐里。' },
  { icon: '🧹', name: '大扫除',     desc: '一起把家园打扫得焕然一新！',
    narrative: '家园变得窗明几净，心情也跟着明亮起来。' },
  { icon: '🌙', name: '深夜聊天',   desc: '夜深了，大家聚在广场上聊到凌晨。',
    narrative: '这种只属于深夜的坦诚，让彼此的距离更近了一些。' },
  { icon: '🎁', name: '神秘礼物',   desc: '广场中央出现了一个大包裹……',
    narrative: '里面是一份让所有人都感到惊喜的礼物，欢呼声响彻广场。' },
];

/* ── 数据管理 ── */
var GDN_STORAGE_KEY = 'halo9_garden';

function gdnLoadData() {
  try {
    var raw = localStorage.getItem(GDN_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}

function gdnSaveData(data) {
  try { localStorage.setItem(GDN_STORAGE_KEY, JSON.stringify(data)); } catch (e) {}
}

function gdnInitData() {
  var existing = gdnLoadData();
  if (existing) return existing;
  var data = {
    invitedRoles: [], positions: {}, userPosition: 'home',
    charStatuses: {}, userStatus: '在房间里休息',
    dailyActivities: [], dailyDate: '', voteData: null,
  };
  gdnSaveData(data);
  return data;
}

/* ── 工具函数 ── */
function gdnTodayStr() {
  var d = new Date();
  return d.getFullYear() + '-' + (d.getMonth()+1) + '-' + d.getDate();
}

function gdnPickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function gdnNowTimeStr() {
  var d = new Date();
  return (d.getMonth()+1) + '月' + d.getDate() + '日 ' +
    String(d.getHours()).padStart(2,'0') + ':' +
    String(d.getMinutes()).padStart(2,'0') + ':' +
    String(d.getSeconds()).padStart(2,'0');
}

/* ── 角色库读取（多键名兼容）── */
function gdnGetAllRoles() {
  var candidateKeys = ['liao_roles', 'halo9_roles', 'roles'];
  for (var i = 0; i < candidateKeys.length; i++) {
    try {
      var raw = localStorage.getItem(candidateKeys[i]);
      if (!raw) continue;
      var parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch (e) {}
  }
  return [];
}

function gdnGetRoleId(role) {
  if (!role) return '';
  return String(role.id || role.realname || role.nickname || role.name || '');
}

function gdnGetRoleName(role) {
  if (!role) return '角色';
  return role.nickname || role.realname || role.name || '角色';
}

function gdnGetRoleAvatar(role) {
  if (!role) return 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=char';
  return role.avatar ||
    'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=' +
    encodeURIComponent(gdnGetRoleName(role));
}

function gdnGetRoleSetting(role) {
  if (!role) return '';
  return role.setting || role.persona || role.description || '';
}

function gdnGetRoleById(id) {
  if (!id) return null;
  var idStr = String(id);
  return gdnGetAllRoles().find(function (r) {
    return String(r.id || r.realname || r.nickname || r.name || '') === idStr;
  }) || null;
}

function gdnGetUserAvatar() {
  try {
    var v1 = localStorage.getItem('halo9_userAvatar');
    if (v1) return JSON.parse(v1);
    var v2 = localStorage.getItem('liao_userAvatar');
    if (v2) return JSON.parse(v2);
    return 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=halo9';
  } catch (e) {
    return 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=halo9';
  }
}

function gdnGetUserName() {
  try {
    var v = localStorage.getItem('liao_userName');
    return v ? JSON.parse(v) : '用户';
  } catch (e) { return '用户'; }
}

function gdnGetRoleChatHistory(roleId, maxCount) {
  try {
    var raw = localStorage.getItem('liao_chats');
    if (!raw) return [];
    var chats = JSON.parse(raw);
    var chat  = chats.find(function (c) { return c.roleId === roleId; });
    if (!chat || !chat.messages) return [];
    var visible = chat.messages.filter(function (m) {
      return !m.hidden &&
        (m.role === 'user' || m.role === 'assistant') &&
        m.type !== 'garden_chat_fold';
    });
    return visible.slice(-(maxCount || 20)).map(function (m) {
      return { role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content || '' };
    });
  } catch (e) { return []; }
}

function gdnGetRoleChatSettings(roleId) {
  try {
    var raw = localStorage.getItem('liao_chats');
    if (!raw) return {};
    var chats = JSON.parse(raw);
    return chats.find(function (c) { return c.roleId === roleId; }) || {};
  } catch (e) { return {}; }
}

/* ── API调用 ── */
function gdnGetApiConfig() {
  try {
    var v = localStorage.getItem('halo9_apiActiveConfig');
    return v ? JSON.parse(v) : null;
  } catch (e) { return null; }
}

function gdnGetApiModel() {
  try {
    var v = localStorage.getItem('halo9_apiCurrentModel');
    return v ? JSON.parse(v) : '';
  } catch (e) { return ''; }
}

function gdnCallAPI(messages, onSuccess, onError) {
  var cfg   = gdnGetApiConfig();
  var model = gdnGetApiModel();
  if (!cfg || !cfg.url) { onError('未配置API'); return; }
  var endpoint = cfg.url.replace(/\/$/, '') + '/chat/completions';
  var headers  = { 'Content-Type': 'application/json' };
  if (cfg.key) headers['Authorization'] = 'Bearer ' + cfg.key;
  fetch(endpoint, {
    method: 'POST',
    headers: headers,
    body: JSON.stringify({
      model: model || 'gpt-3.5-turbo',
      messages: messages,
      stream: false,
    }),
  })
  .then(function (r) { return r.json(); })
  .then(function (json) {
    var reply = json.choices &&
      json.choices[0] &&
      json.choices[0].message &&
      json.choices[0].message.content;
    onSuccess(reply || '');
  })
  .catch(function (e) { onError(e.message || '请求失败'); });
}

/* ── 构建家园临时对话 system prompt ── */
function gdnBuildSystemPrompt(charObj, scene) {
  var roleId       = charObj.roleId;
  var role         = charObj.role || gdnGetRoleById(roleId);
  var roleName     = gdnGetRoleName(role);
  var roleSetting  = gdnGetRoleSetting(role);
  var chatSettings = gdnGetRoleChatSettings(roleId);
  var userSetting  = chatSettings.chatUserSetting  || '';
  var chatUserName = chatSettings.chatUserName || gdnGetUserName();

  var worldBook = '';
  try {
    if (typeof window.getWorldBookInjection === 'function') {
      var liaoHist = gdnGetRoleChatHistory(roleId, 30);
      worldBook = window.getWorldBookInjection(liaoHist, roleId) || '';
    }
  } catch (e) {}

  var prompt = '你扮演角色：' + roleName + '。\n';
  if (roleSetting) prompt += '【角色设定】\n' + roleSetting + '\n\n';
  if (userSetting) {
    prompt += '【用户设定】\n对方是' + chatUserName + '，' + userSetting + '\n\n';
  } else {
    prompt += '【用户设定】\n对方叫' + chatUserName + '。\n\n';
  }
  if (worldBook) prompt += '【世界背景设定】\n' + worldBook + '\n\n';
  prompt +=
    '【家园App说明】\n' +
    '现在你们正在家园App（轻量生活模拟游戏）里进行临时对话。\n' +
    '当前时间：' + gdnNowTimeStr() + '。\n' +
    '当前场景：' + scene + '。\n' +
    '这是家园App游戏内的临时对话，语气应轻松随意、自然生活化。\n\n' +
    '【回复规则】\n' +
    '1. 用口语短句，像发微信一样聊天。\n' +
    '2. 保持角色设定的性格和语气。\n' +
    '3. 不使用任何emoji或颜文字，纯文字。\n' +
    '4. 每次回复控制在1到3句话，简洁自然。\n';
  return prompt;
}

/* ── 每日活动初始化 ── */
function gdnEnsureDailyActivities(data) {
  var today = gdnTodayStr();
  if (data.dailyDate === today && data.dailyActivities.length > 0) return;
  var count  = 3 + Math.floor(Math.random() * 2);
  var pool   = GDN_ACTIVITY_POOL.slice();
  var chosen = [];
  for (var i = 0; i < count && pool.length > 0; i++) {
    var idx = Math.floor(Math.random() * pool.length);
    chosen.push(Object.assign({}, pool[idx], { done: false }));
    pool.splice(idx, 1);
  }
  data.dailyActivities = chosen;
  data.dailyDate = today;
  gdnSaveData(data);
}

/* ── 随机分配角色位置和状态 ── */
function gdnRandomizePositions(data) {
  var locationIds = GDN_MAP_SPOTS.map(function (s) { return s.id; });
  (data.invitedRoles || []).forEach(function (roleId) {
    data.positions[roleId]    = gdnPickRandom(locationIds);
    data.charStatuses[roleId] = gdnPickRandom(GDN_LOCATION_STATES[data.positions[roleId]] || ['在家园里']);
  });
  data.userPosition = 'home';
  data.userStatus   = gdnPickRandom(GDN_LOCATION_STATES['home']);
  gdnSaveData(data);
}

/* ── 屏幕调试面板 ── */
function gdnShowDebugPanel() {
  var existing = document.getElementById('gdn-debug-panel');
  if (existing) { existing.remove(); return; }
  var keys = ['liao_roles', 'halo9_roles', 'liao_chats', 'halo9_garden', 'halo9_apiActiveConfig'];
  var html = '<div id="gdn-debug-panel" style="position:fixed;inset:0;z-index:9999;' +
    'background:rgba(0,0,0,0.93);color:#7ecb7e;font-size:11px;' +
    'font-family:monospace;overflow:auto;padding:16px;">' +
    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
    '<b style="font-size:14px;">存储调试</b>' +
    '<button onclick="document.getElementById(\'gdn-debug-panel\').remove()" ' +
    'style="background:rgba(255,255,255,0.15);border:none;color:#fff;' +
    'border-radius:6px;padding:4px 10px;cursor:pointer;">关闭</button></div>';
  keys.forEach(function (k) {
    var raw = localStorage.getItem(k);
    html += '<div style="margin-bottom:14px;">' +
      '<div style="color:#fff;font-weight:700;margin-bottom:4px;">' + k + '：</div>';
    if (!raw) {
      html += '<div style="color:#e06a4a;">（不存在）</div>';
    } else {
      try {
        var parsed  = JSON.parse(raw);
        var preview = JSON.stringify(parsed, null, 2).slice(0, 800);
        html += '<pre style="white-space:pre-wrap;word-break:break-all;color:#c8f0c8;' +
          'background:rgba(255,255,255,0.07);border-radius:8px;padding:8px;">' +
          preview + (preview.length >= 800 ? '\n...（已截断）' : '') + '</pre>';
      } catch (ex) {
        html += '<div style="color:#e06a4a;">解析失败</div>' +
          '<pre style="color:#aaa;white-space:pre-wrap;word-break:break-all;">' +
          raw.slice(0, 300) + '</pre>';
      }
    }
    html += '</div>';
  });
  var allKeys = [];
  for (var i = 0; i < localStorage.length; i++) allKeys.push(localStorage.key(i));
  html += '<div style="margin-bottom:14px;">' +
    '<div style="color:#fff;font-weight:700;margin-bottom:4px;">全部键名：</div>' +
    '<div style="color:#a8d8a8;line-height:1.8;">' + allKeys.sort().join('<br>') + '</div></div>';
  html += '</div>';
  document.body.insertAdjacentHTML('beforeend', html);
}
