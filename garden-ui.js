/* ============================================================
   garden-ui.js — 家园App 界面层
   所有界面渲染函数：地图、住所、房间、广场、地点、弹窗
   依赖：garden-core.js 必须先加载
   ============================================================ */

/* ── 界面切换 ── */
var GDN_VIEWS = [
  'garden-map-view', 'garden-apt-view', 'garden-room-view',
  'garden-plaza-view', 'garden-location-view',
];

function gdnShowView(id) {
  GDN_VIEWS.forEach(function (v) {
    var el = document.getElementById(v);
    if (el) el.style.display = (v === id) ? 'flex' : 'none';
  });
}

/* ── 开场动画 ── */
function gdnPlayIntro(callback) {
  var intro   = document.getElementById('garden-intro');
  var img     = document.getElementById('garden-intro-img');
  var overlay = document.getElementById('garden-intro-overlay');
  if (!intro) { callback(); return; }
  intro.style.display      = 'flex';
  img.src                  = GDN_INTRO_IMG_URL;
  img.style.opacity        = '0';
  overlay.style.background = 'rgba(0,0,0,0)';
  setTimeout(function () { img.style.opacity = '1'; }, 100);
  setTimeout(function () { overlay.style.background = 'rgba(0,0,0,0.7)'; }, 1800);
  setTimeout(function () {
    intro.style.display      = 'none';
    img.style.opacity        = '0';
    overlay.style.background = 'rgba(0,0,0,0)';
    callback();
  }, 2800);
}

/* ── 地图界面 ── */
function gdnRenderMap(data) {
  gdnShowView('garden-map-view');
  var spotsEl = document.getElementById('garden-map-spots');
  if (!spotsEl) return;
  spotsEl.innerHTML = '';

  GDN_MAP_SPOTS.forEach(function (spot) {
    var div = document.createElement('div');
    div.className  = 'gdn-spot';
    div.style.left = spot.left;
    div.style.top  = spot.top;

    var here = [];
    if (data.userPosition === spot.id) {
      here.push({ avatar: gdnGetUserAvatar(), name: '我' });
    }
    (data.invitedRoles || []).forEach(function (rid) {
      if (data.positions[rid] === spot.id) {
        var role = gdnGetRoleById(rid);
        here.push({ avatar: gdnGetRoleAvatar(role), name: gdnGetRoleName(role) });
      }
    });

    var avatarsHtml = '';
    here.slice(0, 3).forEach(function (p) {
      avatarsHtml += '<img src="' + p.avatar + '" alt="' + p.name + '">';
    });
    if (here.length > 3) {
      avatarsHtml += '<div class="gdn-spot-count">+' + (here.length - 3) + '</div>';
    }

    div.innerHTML =
      '<div class="gdn-spot-circle">' +
        '<span class="gdn-spot-emoji">' + spot.emoji + '</span>' +
      '</div>' +
      '<div class="gdn-spot-label">' + spot.label + '</div>' +
      '<div class="gdn-spot-avatars">' + avatarsHtml + '</div>';

    div.addEventListener('click', function () { gdnHandleSpotClick(spot.id, data); });
    spotsEl.appendChild(div);
  });
}

function gdnHandleSpotClick(spotId, data) {
  if (spotId === 'home')       gdnRenderAptView(data);
  else if (spotId === 'plaza') gdnRenderPlazaView(data);
  else                         gdnRenderLocationView(spotId, data);
}

/* ── 住所（公寓楼）界面 ── */
/* 每层4间房，修复每层只显示2人的bug */
function gdnRenderAptView(data) {
  gdnShowView('garden-apt-view');
  var building = document.getElementById('garden-apt-building');
  if (!building) return;
  building.innerHTML = '';

  var invited         = data.invitedRoles || [];
  var allRoles        = gdnGetAllRoles();
  var invitedRoleObjs = invited.map(function (id) {
    var idStr = String(id);
    return allRoles.find(function (r) {
      return String(r.id || r.realname || r.nickname || r.name || '') === idStr;
    }) || { id: id, realname: id, nickname: id };
  });

  /* rooms[0] 是用户，后续是各角色 */
  var rooms = [{ type: 'user', name: '我', avatar: gdnGetUserAvatar(), roomKey: '__user__' }];
  invitedRoleObjs.forEach(function (role) {
    rooms.push({
      type:    'role',
      name:    gdnGetRoleName(role),
      avatar:  gdnGetRoleAvatar(role),
      roleId:  gdnGetRoleId(role),
      roomKey: gdnGetRoleId(role),
    });
  });

  /* 每层4间，+1楼是一楼设置室 */
  var ROOMS_PER_FLOOR = 4;
  var totalFloors = Math.ceil(rooms.length / ROOMS_PER_FLOOR) + 1;

  for (var floor = totalFloors; floor >= 1; floor--) {
    var floorEl = document.createElement('div');
    floorEl.className = 'gdn-apt-floor';

    var labelEl = document.createElement('div');
    labelEl.className   = 'gdn-floor-label';
    labelEl.textContent = floor + 'F';
    floorEl.appendChild(labelEl);

    var roomsEl = document.createElement('div');
    roomsEl.className = 'gdn-floor-rooms';

    if (floor === 1) {
      /* 一楼：设置室 */
      var settingsRoom = document.createElement('div');
      settingsRoom.className = 'gdn-settings-room';
      settingsRoom.innerHTML =
        '<div class="gdn-settings-room-frame">⚙️</div>' +
        '<div class="gdn-settings-room-name">设置室</div>';
      settingsRoom.addEventListener('click', function () { gdnOpenInviteModal(data); });
      roomsEl.appendChild(settingsRoom);
    } else {
      /* 普通楼层，每层4间 */
      var startIdx = (floor - 2) * ROOMS_PER_FLOOR;
      for (var i = startIdx; i < startIdx + ROOMS_PER_FLOOR && i < rooms.length; i++) {
        var room   = rooms[i];
        var doorEl = document.createElement('div');
        doorEl.className = 'gdn-room-door';
        doorEl.innerHTML =
          '<div class="gdn-room-door-frame">' +
            '<img class="gdn-room-door-avatar" src="' + room.avatar + '" alt="">' +
            '<div class="gdn-room-door-knob"></div>' +
          '</div>' +
          '<div class="gdn-room-door-name">' + room.name + '</div>';
        (function (r) {
          doorEl.addEventListener('click', function () { gdnRenderRoomView(r, data); });
        })(room);
        roomsEl.appendChild(doorEl);
      }
    }

    floorEl.appendChild(roomsEl);
    building.appendChild(floorEl);
  }
}

/* ── 房间内部界面 ── */
/*
 * 修复bug：
 * 1. 进入谁的房间，只显示该房主的头像（如果在房间里）或不在房间的提示。
 * 2. 其他角色/用户如果也在home（来串门），也显示在该房间里。
 * 3. 但"不在家"的只显示房主自己不在的提示，不显示所有不在的人。
 */
function gdnRenderRoomView(roomOwner, data) {
  gdnShowView('garden-room-view');

  var titleEl = document.getElementById('gdn-room-title');
  if (titleEl) titleEl.textContent = roomOwner.name + ' 的房间';

  var bgImg = document.getElementById('garden-room-bg-img');
  if (bgImg) bgImg.src = GDN_ROOM_BG_URL;

  var avatarsEl = document.getElementById('garden-room-avatars');
  if (!avatarsEl) return;
  avatarsEl.innerHTML = '';

  /* ── 判断房主是否在家 ── */
  var ownerIsUser = (roomOwner.type === 'user' || roomOwner.roomKey === '__user__');
  var ownerAtHome = false;
  var ownerStatus = '';
  var ownerAbsentLocation = '';

  if (ownerIsUser) {
    ownerAtHome = (data.userPosition === 'home');
    ownerStatus = data.userStatus || '在房间里休息';
    ownerAbsentLocation = data.userPosition;
  } else {
    var ownerId = roomOwner.roleId;
    ownerAtHome = (data.positions[ownerId] === 'home');
    ownerStatus = data.charStatuses[ownerId] || '在房间里';
    ownerAbsentLocation = data.positions[ownerId];
  }

  /* ── 收集在家的人（用于串门显示）── */
  /* 所有在home的人都会出现在房间里，因为房间是公寓楼的公共空间 */
  var presentChars = [];

  /* 用户 */
  if (data.userPosition === 'home') {
    presentChars.push({
      isUser: true,
      name:   '我',
      avatar: gdnGetUserAvatar(),
      status: data.userStatus || '在家',
    });
  }

  /* 已入住角色 */
  (data.invitedRoles || []).forEach(function (rid) {
    if (data.positions[rid] === 'home') {
      var role = gdnGetRoleById(rid);
      presentChars.push({
        isUser: false,
        roleId: rid,
        name:   gdnGetRoleName(role),
        avatar: gdnGetRoleAvatar(role),
        status: data.charStatuses[rid] || '在家',
        role:   role,
      });
    }
  });

  /* ── 如果房主不在家，显示提示；如果在家，正常渲染 ── */
  if (!ownerAtHome) {
    /* 房主不在房间，显示去哪里了 */
    var absentWrap = document.createElement('div');
    absentWrap.className = 'gdn-room-absent';

    var locLabel = '';
    if (ownerIsUser) {
      locLabel = (GDN_MAP_SPOTS.find(function (s) { return s.id === ownerAbsentLocation; }) || {}).label || ownerAbsentLocation;
    } else {
      locLabel = (GDN_MAP_SPOTS.find(function (s) { return s.id === ownerAbsentLocation; }) || {}).label || ownerAbsentLocation;
    }

    var chip = document.createElement('div');
    chip.className = 'gdn-room-absent-chip';
    chip.innerHTML =
      '<img src="' + roomOwner.avatar + '" alt="">' +
      '<span>' + roomOwner.name + ' 现在在' + locLabel + '，不在房间</span>';
    absentWrap.appendChild(chip);
    avatarsEl.appendChild(absentWrap);

    /* 即使房主不在，其他在家的人也可能在串门，显示他们 */
    /* 排除房主自己（避免重复） */
    var visitors = presentChars.filter(function (c) {
      if (ownerIsUser) return !c.isUser; /* 用户是房主时，显示其他角色串门 */
      return c.isUser || (c.roleId !== roomOwner.roleId); /* 角色是房主时，显示用户和其他角色串门 */
    });

    visitors.forEach(function (char, idx) {
      var point = GDN_ROOM_AVATAR_POINTS[idx % GDN_ROOM_AVATAR_POINTS.length];
      var pin   = document.createElement('div');
      pin.className  = 'gdn-room-avatar-pin';
      pin.style.left = point.left;
      pin.style.top  = point.top;
      pin.innerHTML  =
        '<img src="' + char.avatar + '" alt="">' +
        '<div class="gdn-room-avatar-pin-name">' + char.name + '（串门）</div>';
      (function (c) {
        pin.addEventListener('click', function () {
          gdnShowBubblePopup(c, data, pin.getBoundingClientRect());
        });
      })(char);
      avatarsEl.appendChild(pin);
    });

  } else {
    /* 房主在家，渲染所有在家的人（房主排在第一位） */
    /* 先把房主提到最前面 */
    var ownerChar = null;
    var otherChars = [];

    presentChars.forEach(function (c) {
      var isOwner = ownerIsUser ? c.isUser : (c.roleId === roomOwner.roleId);
      if (isOwner) ownerChar = c;
      else otherChars.push(c);
    });

    /* 如果房主在presentChars里没找到（理论上不应发生），兜底构建 */
    if (!ownerChar) {
      ownerChar = {
        isUser: ownerIsUser,
        roleId: ownerIsUser ? undefined : roomOwner.roleId,
        name:   roomOwner.name,
        avatar: roomOwner.avatar,
        status: ownerStatus,
        role:   ownerIsUser ? null : gdnGetRoleById(roomOwner.roleId),
      };
    }

    /* 房主第一，其他串门的排后面 */
    var displayChars = [ownerChar].concat(otherChars);

    displayChars.forEach(function (char, idx) {
      var point = GDN_ROOM_AVATAR_POINTS[idx % GDN_ROOM_AVATAR_POINTS.length];
      var pin   = document.createElement('div');
      pin.className  = 'gdn-room-avatar-pin';
      pin.style.left = point.left;
      pin.style.top  = point.top;

      var label = char.name;
      if (idx > 0) label += '（串门）';

      pin.innerHTML =
        '<img src="' + char.avatar + '" alt="">' +
        '<div class="gdn-room-avatar-pin-name">' + label + '</div>';
      (function (c) {
        pin.addEventListener('click', function () {
          gdnShowBubblePopup(c, data, pin.getBoundingClientRect());
        });
      })(char);
      avatarsEl.appendChild(pin);
    });
  }
}

/* ── 头像气泡弹窗 ── */
var gdnBubbleTarget = null;

function gdnShowBubblePopup(charObj, data, anchorRect) {
  gdnBubbleTarget = charObj;
  var popup = document.getElementById('gdn-bubble-popup');
  if (!popup) return;

  document.getElementById('gdn-bubble-avatar').src         = charObj.avatar;
  document.getElementById('gdn-bubble-name').textContent   = charObj.name;
  document.getElementById('gdn-bubble-status').textContent =
    charObj.isUser ? (data.userStatus || '') : (charObj.status || '');

  var locId    = charObj.isUser ? data.userPosition : (data.positions[charObj.roleId] || 'home');
  var locLabel = (GDN_MAP_SPOTS.find(function (s) { return s.id === locId; }) || {}).label || locId;
  document.getElementById('gdn-bubble-location').textContent = '📍 ' + locLabel;

  var chatBtn = document.getElementById('gdn-bubble-chat');
  var rpsBtn  = document.getElementById('gdn-bubble-rps');
  if (chatBtn) chatBtn.style.display = charObj.isUser ? 'none' : '';
  if (rpsBtn)  rpsBtn.style.display  = charObj.isUser ? 'none' : '';

  popup.style.display = 'block';

  var appEl = document.getElementById('garden-app');
  if (appEl) {
    var ar   = appEl.getBoundingClientRect();
    var left = anchorRect.right - ar.left + 8;
    var top  = anchorRect.top   - ar.top  - 20;
    if (left + 240 > ar.width)  left = anchorRect.left - ar.left - 248;
    if (top  + 170 > ar.height) top  = ar.height - 175;
    if (top  < 10) top  = 10;
    if (left < 8)  left = 8;
    popup.style.left = left + 'px';
    popup.style.top  = top  + 'px';
  }
}

function gdnCloseBubblePopup() {
  var popup = document.getElementById('gdn-bubble-popup');
  if (popup) popup.style.display = 'none';
  gdnBubbleTarget = null;
}

/* ── 临时对话浮窗 ── */
var gdnChatFloatRole     = null;
var gdnChatFloatMessages = [];
var gdnChatFloatScene    = '';

function gdnOpenChatFloat(charObj, data) {
  gdnChatFloatRole     = charObj;
  gdnChatFloatMessages = [];

  var locId    = (data.positions && data.positions[charObj.roleId]) || 'home';
  var locLabel = (GDN_MAP_SPOTS.find(function (s) { return s.id === locId; }) || {}).label || locId;
  gdnChatFloatScene = '家园·' + locLabel;

  var floatEl = document.getElementById('gdn-chat-float');
  if (!floatEl) return;

  document.getElementById('gdn-chat-float-avatar').src         = charObj.avatar;
  document.getElementById('gdn-chat-float-name').textContent   = charObj.name;
  document.getElementById('gdn-chat-float-scene').textContent  = '📍 ' + gdnChatFloatScene;
  document.getElementById('gdn-chat-float-messages').innerHTML = '';
  document.getElementById('gdn-chat-float-input').value        = '';

  floatEl.style.display = 'flex';
  gdnCloseBubblePopup();

  setTimeout(function () {
    var inp = document.getElementById('gdn-chat-float-input');
    if (inp) inp.focus();
  }, 100);
}

function gdnCloseChatFloat() {
  var floatEl = document.getElementById('gdn-chat-float');
  if (floatEl) floatEl.style.display = 'none';
  gdnChatFloatRole     = null;
  gdnChatFloatMessages = [];
}

function gdnAppendFloatMsg(role, content, tag) {
  var msgsEl = document.getElementById('gdn-chat-float-messages');
  if (!msgsEl) return;
  var isUser = role === 'user';
  var div    = document.createElement('div');
  div.className = 'gdn-float-msg' + (isUser ? ' user' : '');
  div.innerHTML =
    '<img src="' + (isUser ? gdnGetUserAvatar() : (gdnChatFloatRole ? gdnChatFloatRole.avatar : '')) + '" alt="">' +
    '<div class="gdn-float-bubble-wrap">' +
      '<div class="gdn-float-tag">' + (tag || '【家园临时对话】') + '</div>' +
      '<div class="gdn-float-bubble">' + content + '</div>' +
    '</div>';
  msgsEl.appendChild(div);
  msgsEl.scrollTop = msgsEl.scrollHeight;
}

function gdnAppendFloatLoading() {
  var msgsEl = document.getElementById('gdn-chat-float-messages');
  if (!msgsEl) return;
  var div = document.createElement('div');
  div.className = 'gdn-float-msg';
  div.id        = 'gdn-float-loading';
  div.innerHTML =
    '<img src="' + (gdnChatFloatRole ? gdnChatFloatRole.avatar : '') + '" alt="">' +
    '<div class="gdn-float-loading"><span></span><span></span><span></span></div>';
  msgsEl.appendChild(div);
  msgsEl.scrollTop = msgsEl.scrollHeight;
}

function gdnRemoveFloatLoading() {
  var el = document.getElementById('gdn-float-loading');
  if (el) el.remove();
}

function gdnSendFloatMessage(text, data) {
  if (!text || !gdnChatFloatRole) return;
  var timeStr = gdnNowTimeStr();
  var tag     = '【家园临时对话】' + timeStr + ' · ' + gdnChatFloatScene;

  gdnChatFloatMessages.push({ role: 'user', content: text, tag: tag, ts: Date.now() });
  gdnAppendFloatMsg('user', text, tag);
  gdnAppendFloatLoading();

  var sysPrompt     = gdnBuildSystemPrompt(gdnChatFloatRole, gdnChatFloatScene);
  var liaoHistory   = gdnGetRoleChatHistory(gdnChatFloatRole.roleId, 20);
  var gardenHistory = gdnChatFloatMessages
    .slice(0, -1)
    .filter(function (m) { return m.role === 'user' || m.role === 'assistant'; })
    .map(function (m) { return { role: m.role, content: m.content }; });

  var messages = [{ role: 'system', content: sysPrompt }];
  liaoHistory.forEach(function (m) { messages.push(m); });
  gardenHistory.forEach(function (m) { messages.push(m); });
  messages.push({ role: 'user', content: text });

  gdnCallAPI(messages, function (reply) {
    gdnRemoveFloatLoading();
    var replyText = reply || '（微微一笑，没有说话）';
    gdnChatFloatMessages.push({ role: 'assistant', content: replyText, tag: tag, ts: Date.now() });
    gdnAppendFloatMsg('assistant', replyText, tag);
  }, function (err) {
    gdnRemoveFloatLoading();
    gdnAppendFloatMsg('assistant', '（暂时无法回应：' + err + '）', tag);
  });
}

function gdnSyncChatFloatToLiao() {
  if (!gdnChatFloatRole || !gdnChatFloatMessages.length) {
    alert('暂无临时对话内容可同步'); return;
  }
  var roleId = gdnChatFloatRole.roleId;
  if (!roleId) return;

  var liaoChats = [];
  try {
    var raw = localStorage.getItem('liao_chats');
    if (raw) liaoChats = JSON.parse(raw);
  } catch (e) {}

  var chatIdx = liaoChats.findIndex(function (c) { return c.roleId === roleId; });
  if (chatIdx < 0) {
    alert('未找到对应角色的了了聊天记录，请先在了了中与该角色建立对话。'); return;
  }

  var foldContent = gdnChatFloatMessages.map(function (m) {
    return '[' + (m.role === 'user' ? '我' : gdnChatFloatRole.name) + '] ' + m.content;
  }).join('\n');

  var foldMsg = {
    role: 'assistant', type: 'garden_chat_fold',
    content: '【家园临时对话折叠】' + gdnChatFloatScene + ' · ' + gdnNowTimeStr() + '\n' + foldContent,
    ts: Date.now(), id: 'garden_fold_' + Date.now(),
    gardenFoldData: {
      scene:    gdnChatFloatScene,
      messages: gdnChatFloatMessages.slice(),
      roleName: gdnChatFloatRole.name,
      timeStr:  gdnNowTimeStr(),
    },
  };

  if (!liaoChats[chatIdx].messages) liaoChats[chatIdx].messages = [];
  liaoChats[chatIdx].messages.push(foldMsg);
  liaoChats[chatIdx].messages.push({
    role: 'user', type: 'system_hint', hidden: true,
    content: '【系统提示】用户刚刚在家园App中与你进行了一段临时对话，场景是' +
      gdnChatFloatScene + '，时间是' + gdnNowTimeStr() + '，内容摘要：' + foldContent.slice(0, 200),
    ts: Date.now() + 1, id: 'garden_hint_' + Date.now(),
  });

  try { localStorage.setItem('liao_chats', JSON.stringify(liaoChats)); } catch (e) {}

  if (typeof window.LiaoChat !== 'undefined' &&
      typeof window.LiaoChat.refreshIfActive === 'function') {
    window.LiaoChat.refreshIfActive(roleId);
  }

  gdnChatFloatMessages = [];
  alert('已同步到了了聊天记录（折叠显示）');
}

/* ── 石头剪刀布 ── */
var gdnRpsTargetChar = null;

function gdnOpenRPS(charObj) {
  gdnRpsTargetChar = charObj;
  var modal = document.getElementById('gdn-rps-modal');
  if (!modal) return;
  var nameEl = document.getElementById('gdn-rps-role-name');
  if (nameEl) nameEl.textContent = charObj.name;
  var resultEl = document.getElementById('gdn-rps-result');
  if (resultEl) resultEl.style.display = 'none';
  modal.style.display = 'flex';
  gdnCloseBubblePopup();
}

function gdnPlayRPS(userChoice) {
  var choices    = ['rock', 'scissors', 'paper'];
  var labels     = { rock: '石头✊', scissors: '剪刀✌️', paper: '布🖐️' };
  var roleChoice = gdnPickRandom(choices);
  var result = '';
  if (userChoice === roleChoice) {
    result = '平局！';
  } else if (
    (userChoice === 'rock'     && roleChoice === 'scissors') ||
    (userChoice === 'scissors' && roleChoice === 'paper')    ||
    (userChoice === 'paper'    && roleChoice === 'rock')
  ) {
    result = '你赢了！🎉';
  } else {
    result = '你输了…😔';
  }

  var roleName   = gdnRpsTargetChar ? gdnRpsTargetChar.name : '角色';
  var resultText = '你出了 ' + labels[userChoice] + '，' + roleName +
    ' 出了 ' + labels[roleChoice] + '。' + result;

  var resultEl = document.getElementById('gdn-rps-result');
  if (resultEl) { resultEl.textContent = resultText; resultEl.style.display = 'block'; }

  var timeStr = gdnNowTimeStr();
  var tag     = '【家园·石头剪刀布】' + timeStr;

  if (gdnChatFloatRole && gdnRpsTargetChar &&
      gdnChatFloatRole.roleId === gdnRpsTargetChar.roleId) {
    gdnChatFloatMessages.push({ role: 'user', content: resultText, tag: tag, ts: Date.now() });
    gdnAppendFloatMsg('user', resultText, tag);
  } else if (gdnRpsTargetChar) {
    gdnOpenChatFloat(gdnRpsTargetChar, gdnCurrentData);
    setTimeout(function () {
      gdnChatFloatMessages.push({ role: 'user', content: resultText, tag: tag, ts: Date.now() });
      gdnAppendFloatMsg('user', resultText, tag);
    }, 150);
  }
}

/* ── 广场界面 ── */
function gdnRenderPlazaView(data) {
  gdnShowView('garden-plaza-view');
  gdnEnsureDailyActivities(data);

  var charsEl = document.getElementById('garden-plaza-chars');
  if (charsEl) { charsEl.innerHTML = ''; gdnRenderLocationChars('plaza', data, charsEl); }

  var listEl = document.getElementById('garden-activity-list');
  if (listEl) {
    listEl.innerHTML = '';
    data.dailyActivities.forEach(function (activity, idx) {
      var item = document.createElement('div');
      item.className = 'gdn-activity-item' + (activity.done ? ' done' : '');
      var joinBtn = '<button class="gdn-activity-join-btn"' +
        (activity.done ? ' disabled' : '') + '>' +
        (activity.done ? '已完成' : '参与') + '</button>';
      item.innerHTML =
        '<div class="gdn-activity-icon">' + activity.icon + '</div>' +
        '<div class="gdn-activity-info">' +
          '<div class="gdn-activity-name">' + activity.name + '</div>' +
          '<div class="gdn-activity-desc">' + activity.desc + '</div>' +
        '</div>' + joinBtn;
      if (!activity.done) {
        item.querySelector('.gdn-activity-join-btn').addEventListener('click', function () {
          gdnTriggerActivity(activity, idx, data);
        });
      }
      listEl.appendChild(item);
    });
  }

  gdnRenderVoteResult(data);
}

function gdnTriggerActivity(activity, idx, data) {
  data.dailyActivities[idx].done = true;
  gdnSaveData(data);
  gdnRenderPlazaView(data);

  var cfg = gdnGetApiConfig();
  if (!cfg || !cfg.url) { gdnShowNarrate(activity.icon, activity.name, activity.narrative); return; }

  gdnCallAPI([{
    role: 'system',
    content: '你是一个温暖的叙事者，请用100字以内的中文描述以下家园活动的情景，语言生动有画面感：「' +
      activity.name + '」—— ' + activity.desc,
  }], function (reply) {
    gdnShowNarrate(activity.icon, activity.name, reply || activity.narrative);
  }, function () {
    gdnShowNarrate(activity.icon, activity.name, activity.narrative);
  });
}

function gdnShowNarrate(icon, title, text) {
  var modal = document.getElementById('gdn-narrate-modal');
  if (!modal) return;
  var iconEl  = document.getElementById('gdn-narrate-icon');
  var titleEl = document.getElementById('gdn-narrate-title');
  var textEl  = document.getElementById('gdn-narrate-text');
  if (iconEl)  iconEl.textContent  = icon;
  if (titleEl) titleEl.textContent = title;
  if (textEl)  textEl.textContent  = text;
  modal.style.display = 'flex';
}

/* ── 投票功能 ── */
function gdnOpenVoteSetup() {
  var modal = document.getElementById('gdn-vote-setup-modal');
  if (modal) modal.style.display = 'flex';
}

function gdnStartVote(topic, optionsRaw, data) {
  var options = optionsRaw.split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  if (!topic || options.length < 2) { alert('请填写题目和至少两个选项'); return; }
  var invited = data.invitedRoles || [];
  if (!invited.length) { alert('还没有邀请任何角色入住，无法发起投票'); return; }

  data.voteData = { topic: topic, options: options, votes: {} };
  gdnSaveData(data);

  var voteSection = document.getElementById('garden-vote-section');
  if (voteSection) voteSection.style.display = 'flex';

  var modal = document.getElementById('gdn-vote-setup-modal');
  if (modal) modal.style.display = 'none';

  var pending = invited.length;
  invited.forEach(function (roleId, i) {
    var role     = gdnGetRoleById(roleId);
    var roleName = gdnGetRoleName(role);
    var roleBase = role ? (role.setting || role.persona || ('你是' + roleName)) : ('你是' + roleName);
    var optStr   = options.map(function (o, idx) { return (idx+1) + '. ' + o; }).join('\n');

    setTimeout(function () {
      gdnCallAPI([{
        role: 'system',
        content: roleBase + '\n\n现在在家园的广场上有一个投票活动，题目是：「' + topic +
          '」\n选项：\n' + optStr +
          '\n\n请从以上选项中选择一个，只输出选项的序号数字（如：1），不要输出任何其他内容。',
      }], function (reply) {
        var num    = parseInt((reply || '').trim());
        var optIdx = isNaN(num) ? 0 : Math.min(Math.max(0, num-1), options.length-1);
        data.voteData.votes[roleId] = optIdx;
        gdnSaveData(data);
        if (--pending <= 0) gdnRenderVoteResult(data);
      }, function () {
        data.voteData.votes[roleId] = Math.floor(Math.random() * options.length);
        gdnSaveData(data);
        if (--pending <= 0) gdnRenderVoteResult(data);
      });
    }, i * 400);
  });
}

function gdnRenderVoteResult(data) {
  var voteSection = document.getElementById('garden-vote-section');
  var resultEl    = document.getElementById('garden-vote-result');
  if (!voteSection || !resultEl) return;
  if (!data.voteData || !data.voteData.topic) { voteSection.style.display = 'none'; return; }

  voteSection.style.display = 'flex';
  resultEl.innerHTML = '';

  var topic   = data.voteData.topic;
  var options = data.voteData.options;
  var votes   = data.voteData.votes;
  var counts  = options.map(function () { return 0; });
  Object.values(votes).forEach(function (idx) {
    if (idx >= 0 && idx < counts.length) counts[idx]++;
  });
  var total = Object.keys(votes).length || 1;

  var box = document.createElement('div');
  box.className = 'gdn-vote-result-box';

  var topicEl = document.createElement('div');
  topicEl.className   = 'gdn-vote-topic';
  topicEl.textContent = topic;
  box.appendChild(topicEl);

  options.forEach(function (opt, idx) {
    var pct = Math.round((counts[idx] / total) * 100);
    var row = document.createElement('div');
    row.className = 'gdn-vote-option-row';
    row.innerHTML =
      '<div class="gdn-vote-option-label">' + opt + '</div>' +
      '<div class="gdn-vote-bar-wrap">' +
        '<div class="gdn-vote-bar-fill" style="width:' + pct + '%"></div>' +
      '</div>' +
      '<div class="gdn-vote-count">' + counts[idx] + '</div>';
    box.appendChild(row);
  });

  resultEl.appendChild(box);
}

/* ── 通用地点界面 ── */
function gdnRenderLocationView(spotId, data) {
  gdnShowView('garden-location-view');

  var spot = GDN_MAP_SPOTS.find(function (s) { return s.id === spotId; });
  if (!spot) return;

  var titleEl = document.getElementById('gdn-location-title');
  if (titleEl) titleEl.textContent = spot.label;

  var descEl = document.getElementById('gdn-location-desc');
  if (descEl) descEl.textContent = GDN_LOCATION_DESC[spotId] || '';

  var charsEl = document.getElementById('garden-location-chars');
  if (charsEl) { charsEl.innerHTML = ''; gdnRenderLocationChars(spotId, data, charsEl); }

  var greetBtn = document.getElementById('gdn-location-greet');
  if (greetBtn) greetBtn.onclick = function () { gdnTriggerGreet(spotId, data); };

  var backBtn = document.getElementById('gdn-location-back');
  if (backBtn) backBtn.onclick = function () { gdnRenderMap(data); };
}

function gdnRenderLocationChars(spotId, data, container) {
  if (data.userPosition === spotId) {
    container.appendChild(gdnMakeCharChip({
      isUser: true, name: '我',
      avatar: gdnGetUserAvatar(),
      status: data.userStatus,
    }, data));
  }

  (data.invitedRoles || []).forEach(function (rid) {
    if (data.positions[rid] === spotId) {
      var role = gdnGetRoleById(rid);
      container.appendChild(gdnMakeCharChip({
        isUser: false, roleId: rid,
        name:   gdnGetRoleName(role),
        avatar: gdnGetRoleAvatar(role),
        status: data.charStatuses[rid] || '',
        role:   role,
      }, data));
    }
  });

  if (!container.children.length) {
    container.innerHTML =
      '<div style="font-size:12px;color:rgba(150,220,150,0.5);padding:8px 0;">这里暂时没有人</div>';
  }
}

function gdnMakeCharChip(charObj, data) {
  var chip = document.createElement('div');
  chip.className = 'gdn-loc-char-chip';
  chip.innerHTML =
    '<img src="' + charObj.avatar + '" alt="">' +
    '<div class="gdn-loc-char-chip-info">' +
      '<div class="gdn-loc-char-name">'   + charObj.name           + '</div>' +
      '<div class="gdn-loc-char-status">' + (charObj.status || '') + '</div>' +
    '</div>';
  if (!charObj.isUser) {
    chip.addEventListener('click', function () {
      gdnShowBubblePopup(charObj, data, chip.getBoundingClientRect());
    });
  }
  return chip;
}

function gdnTriggerGreet(spotId, data) {
  var spot      = GDN_MAP_SPOTS.find(function (s) { return s.id === spotId; });
  var spotLabel = spot ? spot.label : spotId;
  var hereRoles = (data.invitedRoles || []).filter(function (rid) {
    return data.positions[rid] === spotId;
  });

  if (!hereRoles.length) {
    gdnShowNarrate('👋', '打了个招呼',
      '你向' + spotLabel + '四处张望，微笑着和周围的一切打了个招呼，清风拂过，心情格外舒畅。');
    return;
  }

  var roleNames = hereRoles.map(function (rid) {
    return gdnGetRoleName(gdnGetRoleById(rid));
  }).join('、');

  gdnCallAPI([{
    role: 'system',
    content: '请用80字以内生动描述：用户在' + spotLabel + '向' + roleNames +
      '打招呼，大家的反应和当时的温馨场景。语言自然活泼。',
  }], function (reply) {
    gdnShowNarrate('👋', '打了个招呼',
      reply || ('你在' + spotLabel + '遇到了' + roleNames + '，大家相视而笑，气氛格外融洽。'));
  }, function () {
    gdnShowNarrate('👋', '打了个招呼',
      '你在' + spotLabel + '遇到了' + roleNames + '，大家相视而笑，气氛格外融洽。');
  });
}

/* ── 邀请角色入住弹窗 ── */
var gdnInviteSelected = [];

function gdnOpenInviteModal(data) {
  gdnInviteSelected = (data.invitedRoles || []).map(String);
  var listEl = document.getElementById('gdn-invite-list');
  if (!listEl) return;
  listEl.innerHTML = '';

  var allRoles = gdnGetAllRoles();
  if (!allRoles.length) {
    listEl.innerHTML =
      '<div style="font-size:13px;color:rgba(150,220,150,0.5);padding:12px 0;text-align:center;">' +
      '角色库为空，请先在了了中创建角色。<br><br>' +
      '<button onclick="if(window.GardenApp&&window.GardenApp._showDebug)window.GardenApp._showDebug()" ' +
      'style="background:rgba(100,200,100,0.2);border:1px solid rgba(100,200,100,0.4);' +
      'color:#7ecb7e;border-radius:8px;padding:6px 14px;cursor:pointer;font-size:12px;">' +
      '🔍 调试：查看存储</button></div>';
  } else {
    allRoles.forEach(function (role) {
      var id = gdnGetRoleId(role);
      if (!id) return;
      var idStr    = String(id);
      var selected = gdnInviteSelected.indexOf(idStr) >= 0;
      var item     = document.createElement('div');
      item.className = 'gdn-invite-item' + (selected ? ' selected' : '');
      item.innerHTML =
        '<img src="' + gdnGetRoleAvatar(role) + '" alt="">' +
        '<div class="gdn-invite-item-name">' + gdnGetRoleName(role) + '</div>' +
        '<div class="gdn-invite-check">' + (selected ? '✓' : '') + '</div>';
      item.addEventListener('click', function () {
        var cur = gdnInviteSelected.map(String);
        var pos = cur.indexOf(idStr);
        if (pos >= 0) {
          gdnInviteSelected.splice(pos, 1);
          item.classList.remove('selected');
          item.querySelector('.gdn-invite-check').textContent = '';
        } else {
          gdnInviteSelected.push(idStr);
          item.classList.add('selected');
          item.querySelector('.gdn-invite-check').textContent = '✓';
        }
      });
      listEl.appendChild(item);
    });
  }

  var modal = document.getElementById('gdn-invite-modal');
  if (modal) modal.style.display = 'flex';
}

function gdnConfirmInvite(data) {
  data.invitedRoles = gdnInviteSelected.map(String).slice();

  var locationIds = GDN_MAP_SPOTS.map(function (s) { return s.id; });
  data.invitedRoles.forEach(function (rid) {
    if (!data.positions[rid]) {
      var locId = gdnPickRandom(locationIds);
      data.positions[rid]    = locId;
      data.charStatuses[rid] = gdnPickRandom(GDN_LOCATION_STATES[locId] || ['在家园里']);
    }
  });

  var posKeys = Object.keys(data.positions);
  for (var i = 0; i < posKeys.length; i++) {
    var rid = posKeys[i];
    var stillIn = false;
    for (var j = 0; j < data.invitedRoles.length; j++) {
      if (String(data.invitedRoles[j]) === String(rid)) { stillIn = true; break; }
    }
    if (!stillIn) {
      delete data.positions[rid];
      delete data.charStatuses[rid];
    }
  }

  gdnSaveData(data);

  var modal = document.getElementById('gdn-invite-modal');
  if (modal) modal.style.display = 'none';

  gdnRenderAptView(data);
}

/* ── 拖拽临时对话浮窗 ── */
function gdnInitChatFloatDrag() {
  var floatEl  = document.getElementById('gdn-chat-float');
  var headerEl = document.getElementById('gdn-chat-float-header');
  if (!floatEl || !headerEl) return;

  var isDragging = false;
  var startX = 0, startY = 0, origLeft = 0, origTop = 0;

  function onDragStart(e) {
    isDragging = true;
    var clientX = e.touches ? e.touches[0].clientX : e.clientX;
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;
    startX   = clientX; startY   = clientY;
    origLeft = floatEl.offsetLeft; origTop = floatEl.offsetTop;
    floatEl.style.transform = 'none';
    floatEl.style.left = origLeft + 'px';
    floatEl.style.top  = origTop  + 'px';
    e.preventDefault();
  }

  function onDragMove(e) {
    if (!isDragging) return;
    var clientX = e.touches ? e.touches[0].clientX : e.clientX;
    var clientY = e.touches ? e.touches[0].clientY : e.clientY;
    var appEl   = document.getElementById('garden-app');
    var appRect = appEl
      ? appEl.getBoundingClientRect()
      : { width: window.innerWidth, height: window.innerHeight };
    var newLeft = Math.max(0, Math.min(origLeft + (clientX - startX), appRect.width  - floatEl.offsetWidth));
    var newTop  = Math.max(0, Math.min(origTop  + (clientY - startY), appRect.height - floatEl.offsetHeight));
    floatEl.style.left = newLeft + 'px';
    floatEl.style.top  = newTop  + 'px';
  }

  function onDragEnd() { isDragging = false; }

  headerEl.addEventListener('mousedown',  onDragStart);
  headerEl.addEventListener('touchstart', onDragStart, { passive: false });
  document.addEventListener('mousemove',  onDragMove);
  document.addEventListener('touchmove',  onDragMove,  { passive: false });
  document.addEventListener('mouseup',    onDragEnd);
  document.addEventListener('touchend',   onDragEnd);
}
