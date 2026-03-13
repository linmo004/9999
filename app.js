/* ============================================================
   工具：localStorage 存取
   ============================================================ */
function save(key, val) {
  try { localStorage.setItem('halo9_' + key, JSON.stringify(val)); } catch(e) {}
}
function load(key, def) {
  try {
    const v = localStorage.getItem('halo9_' + key);
    return v !== null ? JSON.parse(v) : def;
  } catch(e) { return def; }
}

/* ============================================================
   状态栏时间
   ============================================================ */
function updateStatusTime() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const el = document.getElementById('status-time');
  if (el) el.textContent = h + ':' + m;
}
updateStatusTime();
setInterval(updateStatusTime, 1000);

/* ============================================================
   农历 / 节气 / 节日
   ============================================================ */
const lunarInfo = [
  0x04bd8,0x04ae0,0x0a570,0x054d5,0x0d260,0x0d950,0x16554,0x056a0,0x09ad0,0x055d2,
  0x04ae0,0x0a5b6,0x0a4d0,0x0d250,0x1d255,0x0b540,0x0d6a0,0x0ada2,0x095b0,0x14977,
  0x04970,0x0a4b0,0x0b4b5,0x06a50,0x06d40,0x1ab54,0x02b60,0x09570,0x052f2,0x04970,
  0x06566,0x0d4a0,0x0ea50,0x06e95,0x05ad0,0x02b60,0x186e3,0x092e0,0x1c8d7,0x0c950,
  0x0d4a0,0x1d8a6,0x0b550,0x056a0,0x1a5b4,0x025d0,0x092d0,0x0d2b2,0x0a950,0x0b557,
  0x06ca0,0x0b550,0x15355,0x04da0,0x0a5d0,0x14573,0x052d0,0x0a9a8,0x0e950,0x06aa0,
  0x0aea6,0x0ab50,0x04b60,0x0aae4,0x0a570,0x05260,0x0f263,0x0d950,0x05b57,0x056a0,
  0x096d0,0x04dd5,0x04ad0,0x0a4d0,0x0d4d4,0x0d250,0x0d558,0x0b540,0x0b6a0,0x195a6,
  0x095b0,0x049b0,0x0a974,0x0a4b0,0x0b27a,0x06a50,0x06d40,0x0af46,0x0ab60,0x09570,
  0x04af5,0x04970,0x064b0,0x074a3,0x0ea50,0x06aa0,0x0a6b6,0x056a0,0x02b40,0x10d96,
  0x092e0,0x0c960,0x0d954,0x0d4a0,0x0da50,0x07552,0x056a0,0x0abb7,0x025d0,0x092d0,
  0x0cab5,0x0a950,0x0b4a0,0x0baa4,0x0ad50,0x055d9,0x04ba0,0x0a5b0,0x15176,0x052b0,
  0x0f930,0x06aa6,0x0ad50,0x056a0,0x1aae4,0x0a9d0,0x0c954,0x0b4a8
];

const heavenlyStems   = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const earthlyBranches = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const lunarMonthNames = ['正','二','三','四','五','六','七','八','九','十','冬','腊'];
const lunarDayNames   = [
  '初一','初二','初三','初四','初五','初六','初七','初八','初九','初十',
  '十一','十二','十三','十四','十五','十六','十七','十八','十九','二十',
  '廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'
];
const solarFestivals = {
  '1-1':'元旦','2-14':'情人节','3-8':'妇女节','4-1':'愚人节',
  '5-1':'劳动节','6-1':'儿童节','10-1':'国庆节','12-25':'圣诞节'
};
const lunarFestivals = {
  '1-1':'春节','1-15':'元宵节','5-5':'端午节','7-7':'七夕',
  '7-15':'中元节','8-15':'中秋节','9-9':'重阳节','12-30':'除夕'
};
const solarTerms = [
  '小寒','大寒','立春','雨水','惊蛰','春分','清明','谷雨',
  '立夏','小满','芒种','夏至','小暑','大暑','立秋','处暑',
  '白露','秋分','寒露','霜降','立冬','小雪','大雪','冬至'
];
const solarTermDates = [
  [6,20],[20,5],[4,19],[19,4],[6,21],[21,6],[5,20],[20,5],
  [6,21],[21,6],[6,21],[21,7],[7,23],[23,8],[8,23],[23,8],
  [8,23],[23,8],[8,24],[24,9],[7,23],[22,7],[7,22],[22,6]
];

function leapMonth(y)  { return lunarInfo[y-1900] & 0xf; }
function leapDays(y)   { return leapMonth(y) ? ((lunarInfo[y-1900] & 0x10000) ? 30 : 29) : 0; }
function monthDays(y,m){ return (lunarInfo[y-1900] & (0x10000>>m)) ? 30 : 29; }
function lunarYearDays(y) {
  let sum = 348;
  for (let i = 0x8000; i > 0x8; i >>= 1) sum += (lunarInfo[y-1900] & i) ? 1 : 0;
  return sum + leapDays(y);
}

function getLunarData(y, m, d) {
  const baseDate = new Date(1900, 0, 31);
  const objDate  = new Date(y, m-1, d);
  let offset = Math.round((objDate - baseDate) / 86400000);
  let i, temp = 0, leap = 0;
  for (i = 1900; i < 2101 && offset > 0; i++) {
    temp = lunarYearDays(i); offset -= temp;
  }
  if (offset < 0) { offset += temp; i--; }
  const lunarYear = i;
  leap = leapMonth(i);
  let isLeap = false;
  for (i = 1; i < 13 && offset > 0; i++) {
    if (leap > 0 && i === (leap+1) && !isLeap) {
      --i; isLeap = true; temp = leapDays(lunarYear);
    } else { temp = monthDays(lunarYear, i); }
    if (isLeap && i === (leap+1)) isLeap = false;
    offset -= temp;
  }
  if (offset === 0 && leap > 0 && i === leap+1) {
    if (isLeap) isLeap = false; else { isLeap = true; --i; }
  }
  if (offset < 0) { offset += temp; --i; }
  return {
    lunarMonth: i,
    lunarDay:   offset + 1,
    isLeap,
    yearStr: heavenlyStems[(lunarYear-4)%10] + earthlyBranches[(lunarYear-4)%12] + '年'
  };
}

function getSolarTerm(m, d) {
  const idx = (m-1) * 2;
  if (d === solarTermDates[idx][0])   return solarTerms[idx];
  if (d === solarTermDates[idx][1])   return solarTerms[idx+1];
  return '';
}

function updateDate() {
  const now = new Date();
  const y = now.getFullYear(), m = now.getMonth()+1, d = now.getDate();
  document.getElementById('date-year-month').textContent =
    y + ' / ' + String(m).padStart(2,'0');
  document.getElementById('date-day').textContent =
    String(d).padStart(2,'0');
  const lunar  = getLunarData(y, m, d);
  const lMonth = (lunar.isLeap ? '闰' : '') + lunarMonthNames[lunar.lunarMonth-1] + '月';
  const lDay   = lunarDayNames[lunar.lunarDay-1];
  const sfKey  = m + '-' + d;
  const lfKey  = lunar.lunarMonth + '-' + lunar.lunarDay;
  const term   = getSolarTerm(m, d);
  const fest   = solarFestivals[sfKey] || term || lunarFestivals[lfKey] || '';
  document.getElementById('date-lunar').textContent =
    lunar.yearStr + ' ' + lMonth + lDay + (fest ? ' · ' + fest : '');
}
updateDate();
setInterval(updateDate, 60000);

/* ============================================================
   倒计时 / 纪念日
   ============================================================ */
let cdItems = load('cdItems', [
  { title:'在一起', date:'2023-02-14', type:'anniversary' },
  { title:'距离元旦', date:(new Date().getFullYear()+1)+'-01-01', type:'countdown' }
]);
let cdIdx = 0, cdTimer = null;

function calcDays(item) {
  const today  = new Date(); today.setHours(0,0,0,0);
  const target = new Date(item.date); target.setHours(0,0,0,0);
  const diff   = Math.round((today - target) / 86400000);
  return item.type === 'anniversary' ? Math.max(0, diff) : Math.max(0, -diff);
}

function renderCDDisplay() {
  if (!cdItems.length) {
    document.getElementById('cd-label').textContent  = '点击添加';
    document.getElementById('cd-number').textContent = '—';
    document.getElementById('cd-unit').textContent   = '天';
    return;
  }
  const item = cdItems[cdIdx % cdItems.length];
  document.getElementById('cd-label').textContent  = item.title;
  document.getElementById('cd-number').textContent = calcDays(item);
  document.getElementById('cd-unit').textContent   =
    item.type === 'anniversary' ? '天 已过' : '天 后';
}

function startCDCarousel() {
  if (cdTimer) clearInterval(cdTimer);
  renderCDDisplay();
  if (cdItems.length > 1) {
    cdTimer = setInterval(() => {
      cdIdx = (cdIdx+1) % cdItems.length;
      renderCDDisplay();
    }, 3000);
  }
}
startCDCarousel();

function renderCDList() {
  const container = document.getElementById('cd-list');
  container.innerHTML = '';
  cdItems.forEach((item, idx) => {
    const div = document.createElement('div');
    div.className = 'cd-item';
    div.innerHTML = `
      <div class="cd-item-info">
        <div class="cd-item-title">${item.title}</div>
        <div class="cd-item-sub">
          ${item.date} · ${item.type==='anniversary'?'纪念日':'倒计时'} · ${calcDays(item)}天
        </div>
      </div>
      <button class="cd-del-btn" data-del="${idx}">删除</button>`;
    container.appendChild(div);
  });
  container.querySelectorAll('.cd-del-btn').forEach(btn => {
    btn.addEventListener('click', function() {
      cdItems.splice(parseInt(this.dataset.del), 1);
      cdIdx = 0;
      save('cdItems', cdItems);
      renderCDList();
    });
  });
}

document.getElementById('countdown-right').addEventListener('click', function() {
  renderCDList();
  document.getElementById('cd-modal').classList.add('show');
});

document.getElementById('cd-add-btn').addEventListener('click', function() {
  const title = document.getElementById('cd-new-title').value.trim();
  const date  = document.getElementById('cd-new-date').value;
  const type  = document.getElementById('cd-new-type').value;
  if (!title || !date) { alert('请填写标题和日期'); return; }
  cdItems.push({ title, date, type });
  document.getElementById('cd-new-title').value = '';
  document.getElementById('cd-new-date').value  = '';
  save('cdItems', cdItems);
  renderCDList();
});

document.getElementById('cd-close-btn').addEventListener('click', function() {
  document.getElementById('cd-modal').classList.remove('show');
  startCDCarousel();
});

/* ============================================================
   图片轮播
   ============================================================ */
let carouselUrls = load('carouselUrls', []);
let carouselIdx  = 0, carouselTimer = null;

function renderCarousel() {
  const img = document.getElementById('carousel-img');
  const ph  = document.getElementById('carousel-placeholder');
  if (!carouselUrls.length) {
    img.style.opacity = '0';
    ph.style.display  = 'flex';
    return;
  }
  ph.style.display  = 'none';
  img.style.opacity = '0';
  img.src = carouselUrls[carouselIdx % carouselUrls.length];
  img.onload  = () => { img.style.opacity = '1'; };
  img.onerror = () => { img.style.opacity = '0.3'; };
}

function startCarousel() {
  if (carouselTimer) clearInterval(carouselTimer);
  renderCarousel();
  if (carouselUrls.length > 1) {
    carouselTimer = setInterval(() => {
      carouselIdx = (carouselIdx+1) % carouselUrls.length;
      renderCarousel();
    }, 10000);
  }
}
startCarousel();

document.getElementById('carousel-widget').addEventListener('click', function() {
  document.getElementById('carousel-urls').value = carouselUrls.join('\n');
  document.getElementById('carousel-modal').classList.add('show');
});

document.getElementById('carousel-save-btn').addEventListener('click', function() {
  const raw = document.getElementById('carousel-urls').value;
  carouselUrls = raw.split('\n').map(s => s.trim()).filter(Boolean);
  carouselIdx  = 0;
  save('carouselUrls', carouselUrls);
  startCarousel();
  document.getElementById('carousel-modal').classList.remove('show');
});

document.getElementById('carousel-cancel-btn').addEventListener('click', function() {
  document.getElementById('carousel-modal').classList.remove('show');
});

/* ============================================================
   用户头像
   ============================================================ */
let avatarTab = 'url';

(function restoreAvatar() {
  const av = load('userAvatar', null);
  if (av) document.getElementById('user-avatar').src = av;
})();

document.getElementById('user-avatar').addEventListener('click', function() {
  document.getElementById('avatar-url-input').value  = '';
  document.getElementById('avatar-file-input').value = '';
  setAvatarTab('url');
  document.getElementById('avatar-modal').classList.add('show');
});

document.querySelectorAll('[data-avatar-tab]').forEach(btn => {
  btn.addEventListener('click', function() { setAvatarTab(this.dataset.avatarTab); });
});

function setAvatarTab(tab) {
  avatarTab = tab;
  document.querySelectorAll('[data-avatar-tab]').forEach(b => {
    b.classList.toggle('active', b.dataset.avatarTab === tab);
  });
  document.getElementById('avatar-url-panel').style.display   = tab === 'url'   ? '' : 'none';
  document.getElementById('avatar-local-panel').style.display = tab === 'local' ? '' : 'none';
}

document.getElementById('avatar-confirm-btn').addEventListener('click', function() {
  if (avatarTab === 'url') {
    const url = document.getElementById('avatar-url-input').value.trim();
    if (!url) return;
    document.getElementById('user-avatar').src = url;
    save('userAvatar', url);
    document.getElementById('avatar-modal').classList.remove('show');
    const p2av = document.getElementById('p2-uc-avatar');
    if (p2av) p2av.src = url;
  } else {
    const file = document.getElementById('avatar-file-input').files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      document.getElementById('user-avatar').src = e.target.result;
      save('userAvatar', e.target.result);
      document.getElementById('avatar-modal').classList.remove('show');
      const p2av = document.getElementById('p2-uc-avatar');
      if (p2av) p2av.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }
});

document.getElementById('avatar-cancel-btn').addEventListener('click', function() {
  document.getElementById('avatar-modal').classList.remove('show');
});

/* ============================================================
   签名
   ============================================================ */
(function restoreSig() {
  const sig = load('userSig', null);
  if (sig) document.getElementById('user-sig').textContent = sig;
})();

document.getElementById('user-sig').addEventListener('click', function() {
  document.getElementById('sig-input').value = this.textContent;
  document.getElementById('sig-modal').classList.add('show');
});

document.getElementById('sig-confirm-btn').addEventListener('click', function() {
  const val = document.getElementById('sig-input').value.trim();
  document.getElementById('user-sig').textContent = val;
  save('userSig', val);
  document.getElementById('sig-modal').classList.remove('show');
});

document.getElementById('sig-cancel-btn').addEventListener('click', function() {
  document.getElementById('sig-modal').classList.remove('show');
});

/* ============================================================
   消息观赏
   ============================================================ */
let msgData = load('msgData', [
  {
    avatar:   'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=luna',
    messages: ['你好呀～今天过得怎么样？']
  },
  {
    avatar:   'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=nova',
    messages: ['HALO·九 已上线']
  }
]);
let msgEditIdx = 0, msgTab = 'url';

function renderMsgWidget() {
  msgData.forEach((data, idx) => {
    const avatarEl  = document.getElementById('msg-avatar-'  + idx);
    const bubblesEl = document.getElementById('msg-bubbles-' + idx);
    if (avatarEl)  avatarEl.src = data.avatar;
    if (bubblesEl) bubblesEl.innerHTML =
      data.messages.map(msg => `<div class="msg-bubble">${msg}</div>`).join('');
  });
}
renderMsgWidget();

document.getElementById('msg-widget').addEventListener('click', function(e) {
  const avatar = e.target.closest('.msg-avatar');
  if (!avatar) return;
  const row = avatar.closest('.msg-row');
  if (!row) return;
  const rows = document.querySelectorAll('#msg-widget .msg-row');
  let idx = -1;
  rows.forEach((r, i) => { if (r === row) idx = i; });
  if (idx < 0) return;
  openMsgModal(idx);
});

function openMsgModal(idx) {
  msgEditIdx = idx;
  setMsgTab('url');
  document.getElementById('msg-avatar-url-input').value = '';
  document.getElementById('msg-content-input').value    = msgData[idx].messages.join('\n');
  document.getElementById('msg-modal').classList.add('show');
}

document.querySelectorAll('[data-msg-tab]').forEach(btn => {
  btn.addEventListener('click', function() { setMsgTab(this.dataset.msgTab); });
});

function setMsgTab(tab) {
  msgTab = tab;
  document.querySelectorAll('[data-msg-tab]').forEach(b => {
    b.classList.toggle('active', b.dataset.msgTab === tab);
  });
  document.getElementById('msg-url-panel').style.display   = tab === 'url'   ? '' : 'none';
  document.getElementById('msg-local-panel').style.display = tab === 'local' ? '' : 'none';
}

document.getElementById('msg-confirm-btn').addEventListener('click', function() {
  const messages = document.getElementById('msg-content-input').value
    .split('\n').map(s => s.trim()).filter(Boolean);
  msgData[msgEditIdx].messages = messages;

  if (msgTab === 'url') {
    const url = document.getElementById('msg-avatar-url-input').value.trim();
    if (url) msgData[msgEditIdx].avatar = url;
    save('msgData', msgData);
    renderMsgWidget();
    document.getElementById('msg-modal').classList.remove('show');
  } else {
    const file = document.getElementById('msg-file-input').files[0];
    if (!file) {
      save('msgData', msgData);
      renderMsgWidget();
      document.getElementById('msg-modal').classList.remove('show');
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      msgData[msgEditIdx].avatar = e.target.result;
      save('msgData', msgData);
      renderMsgWidget();
      document.getElementById('msg-modal').classList.remove('show');
    };
    reader.readAsDataURL(file);
  }
});

document.getElementById('msg-cancel-btn').addEventListener('click', function() {
  document.getElementById('msg-modal').classList.remove('show');
});

/* ============================================================
   文字条
   ============================================================ */
let textBars = load('textBars', ['', '']);

function renderTextBars() {
  textBars.forEach((text, idx) => {
    const contentEl = document.getElementById('text-bar-content-' + idx);
    const phEl      = document.getElementById('text-bar-placeholder-' + idx);
    if (!contentEl || !phEl) return;
    contentEl.textContent = text;
    phEl.style.display    = text ? 'none' : '';
  });
}
renderTextBars();

let textBarEditIdx = 0;

document.getElementById('text-bars').addEventListener('click', function(e) {
  const bar = e.target.closest('.text-bar');
  if (!bar) return;
  const contentEl = bar.querySelector('.text-bar-content');
  if (!contentEl) return;
  textBarEditIdx = parseInt(contentEl.dataset.bar);
  document.getElementById('textbar-input').value =
    textBars[textBarEditIdx] || '';
  document.getElementById('textbar-modal').classList.add('show');
});

document.getElementById('textbar-confirm-btn').addEventListener('click', function() {
  const val = document.getElementById('textbar-input').value.trim();
  textBars[textBarEditIdx] = val;
  save('textBars', textBars);
  renderTextBars();
  document.getElementById('textbar-modal').classList.remove('show');
});

document.getElementById('textbar-cancel-btn').addEventListener('click', function() {
  document.getElementById('textbar-modal').classList.remove('show');
});

/* ============================================================
   页面横滑（支持三页）
   ============================================================ */
let currentPage  = 0;
const pagesWrap  = document.getElementById('pages-wrap');
const totalPages = 4;
let touchStartX  = 0, touchStartY = 0, touchMoved = false;

pagesWrap.style.width = (totalPages * 100) + 'vw';

function goToPage(idx) {
  if (idx < 0 || idx >= totalPages) return;
  currentPage = idx;
  pagesWrap.style.transform = `translateX(-${idx * 100}vw)`;
  document.querySelectorAll('.dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === idx);
  });
}

document.addEventListener('touchstart', function(e) {
  touchStartX = e.touches[0].clientX;
  touchStartY = e.touches[0].clientY;
  touchMoved  = false;
}, { passive: true });

document.addEventListener('touchmove', function(e) {
  const dx = e.touches[0].clientX - touchStartX;
  const dy = e.touches[0].clientY - touchStartY;
  if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 8) touchMoved = true;
}, { passive: true });

document.addEventListener('touchend', function(e) {
  if (!touchMoved) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  if (dx < -50 && currentPage < totalPages - 1) goToPage(currentPage + 1);
  else if (dx > 50 && currentPage > 0) goToPage(currentPage - 1);
  touchMoved = false;
}, { passive: true });

let mouseStartX = 0, mouseIsDown = false, mouseMoved = false;

document.addEventListener('mousedown', function(e) {
  if (e.target.closest('.modal-mask')) return;
  if (e.target.closest('.settings-layer')) return;
  if (e.target.closest('#worldbook-app')) return;
  if (e.target.closest('.p2-img-modal-mask')) return;
  mouseStartX = e.clientX;
  mouseIsDown = true;
  mouseMoved  = false;
});

document.addEventListener('mousemove', function(e) {
  if (!mouseIsDown) return;
  if (Math.abs(e.clientX - mouseStartX) > 8) mouseMoved = true;
});

document.addEventListener('mouseup', function(e) {
  if (!mouseIsDown) return;
  mouseIsDown = false;
  if (!mouseMoved) return;
  if (e.target.closest('.modal-mask')) return;
  if (e.target.closest('.settings-layer')) return;
  if (e.target.closest('#worldbook-app')) return;
  if (e.target.closest('.p2-img-modal-mask')) return;
  const dx = e.clientX - mouseStartX;
  if (dx < -60 && currentPage < totalPages - 1) goToPage(currentPage + 1);
  else if (dx > 60 && currentPage > 0) goToPage(currentPage - 1);
  mouseMoved = false;
});

/* ============================================================
   分页指示器点击
   ============================================================ */
document.querySelectorAll('.dot').forEach(dot => {
  dot.addEventListener('click', function() {
    goToPage(parseInt(this.dataset.page));
  });
});

/* ============================================================
   世界书 App 点击
   ============================================================ */
document.addEventListener('click', function(e) {
  const appItem = e.target.closest('.app-item[data-app="worldbook"]');
  if (appItem) {
    if (typeof openWorldBook === 'function') {
      openWorldBook();
    }
  }
});

/* ============================================================
   弹窗遮罩点击关闭
   ============================================================ */
document.querySelectorAll('.modal-mask').forEach(mask => {
  mask.addEventListener('click', function(e) {
    if (e.target === this) this.classList.remove('show');
  });
});

/* ============================================================
   第二页：共用图片更换弹窗
   ============================================================ */
var p2ModalTarget  = null;
var p2ModalPending = '';

function openP2ImgModal(title, target) {
  p2ModalTarget  = target;
  p2ModalPending = '';
  document.getElementById('p2-img-modal-title').textContent = title;
  document.getElementById('p2-img-modal-url').value = '';
  document.getElementById('p2-img-modal-file').value = '';
  document.getElementById('p2-img-modal').style.display = 'flex';
}

function closeP2ImgModal() {
  document.getElementById('p2-img-modal').style.display = 'none';
  p2ModalTarget  = null;
  p2ModalPending = '';
}

function applyP2Image(src) {
  if (!src || !p2ModalTarget) return;

  if (p2ModalTarget === 'ucbg') {
    const bgEl = document.getElementById('p2-uc-bg');
    if (bgEl) bgEl.style.backgroundImage = 'url(' + src + ')';
    save('p2UcBg', src);

  } else if (p2ModalTarget === 'album') {
    const bgEl = document.getElementById('p2-album-bg');
    if (bgEl) bgEl.style.backgroundImage = 'url(' + src + ')';
    save('p2AlbumBg', src);

  } else if (p2ModalTarget === 'cdimg') {
    /* CD 图片叠加在 r3 层上 */
    const cdEl = document.getElementById('p2-cd');
    if (cdEl) {
      cdEl.style.setProperty('--cd-img', 'url(' + src + ')');
      /* 直接把 r3 背景改为用户图片 */
      const r3 = cdEl.querySelector('.p2-cd-r3');
      if (r3) {
        r3.style.backgroundImage = 'url(' + src + ')';
        r3.style.backgroundSize  = 'cover';
        r3.style.backgroundPosition = 'center';
      }
    }
    save('p2CdImg', src);

  } else if (p2ModalTarget.startsWith('card-')) {
    const idx   = parseInt(p2ModalTarget.split('-')[1]);
    const imgEl = document.getElementById('p2-card-img-' + idx);
    if (imgEl) {
      imgEl.src = src;
      imgEl.style.display = 'block';
      const empty = imgEl.nextElementSibling;
      if (empty) empty.style.display = 'none';
    }
    p2CardUrls[idx] = src;
    save('page2Cards', p2CardUrls);
  }
  closeP2ImgModal();
}

document.getElementById('p2-img-modal-confirm').addEventListener('click', function() {
  if (p2ModalPending) { applyP2Image(p2ModalPending); return; }
  const url = document.getElementById('p2-img-modal-url').value.trim();
  if (url) { p2ModalPending = url; applyP2Image(url); return; }
  alert('请输入图片URL或选择本地文件');
});

document.getElementById('p2-img-modal-cancel').addEventListener('click', function() {
  closeP2ImgModal();
});

document.getElementById('p2-img-modal-file').addEventListener('change', function() {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    p2ModalPending = e.target.result;
    applyP2Image(e.target.result);
  };
  reader.readAsDataURL(file);
  this.value = '';
});

document.getElementById('p2-img-modal').addEventListener('click', function(e) {
  if (e.target === this) closeP2ImgModal();
});

/* ============================================================
   第二页：用户主页卡初始化
   点击卡片整体 => 换背景；点击头像 => 换头像
   点击用户名/账户码/粉丝/获赞 => 弹框填写
   ============================================================ */
(function initP2UserCard() {
  /* 恢复背景 */
  const bg = load('p2UcBg', null);
  if (bg) {
    const bgEl = document.getElementById('p2-uc-bg');
    if (bgEl) bgEl.style.backgroundImage = 'url(' + bg + ')';
  }

  /* 同步头像 */
  const av   = load('userAvatar', null);
  const p2av = document.getElementById('p2-uc-avatar');
  if (p2av) {
    if (av) {
      p2av.src = av;
    } else {
      const mainAv = document.getElementById('user-avatar');
      if (mainAv) p2av.src = mainAv.src;
    }
  }

  /* 恢复用户信息文本 */
  function restoreText(id, storageKey, placeholder, isPlaceholder) {
    const el = document.getElementById(id);
    if (!el) return;
    const val = load(storageKey, null);
    if (val) {
      el.textContent = val;
      el.classList.remove('p2-placeholder');
      if (isPlaceholder) {
        /* stat-num 恢复 */
        const numEl = el.querySelector ? el : el;
        numEl.classList.remove('p2-placeholder');
      }
    } else {
      el.classList.add('p2-placeholder');
    }
  }

  /* 恢复用户名 */
  const nameEl = document.getElementById('p2-uc-name');
  if (nameEl) {
    const savedName = load('p2UcName', null);
    if (savedName) {
      nameEl.textContent = savedName;
      nameEl.classList.remove('p2-placeholder');
    }
  }

  /* 恢复账户码 */
  const uidEl = document.getElementById('p2-uc-uid');
  if (uidEl) {
    const savedUid = load('p2UcUid', null);
    if (savedUid) {
      uidEl.textContent = '# ' + savedUid;
      uidEl.classList.remove('p2-placeholder');
    }
  }

  /* 恢复粉丝数 */
  const fansNumEl = document.getElementById('p2-uc-fans-num');
  if (fansNumEl) {
    const savedFans = load('p2UcFans', null);
    if (savedFans !== null) {
      fansNumEl.textContent = savedFans;
      fansNumEl.classList.remove('p2-placeholder');
    } else {
      fansNumEl.classList.add('p2-placeholder');
    }
  }

  /* 恢复获赞数 */
  const likesNumEl = document.getElementById('p2-uc-likes-num');
  if (likesNumEl) {
    const savedLikes = load('p2UcLikes', null);
    if (savedLikes !== null) {
      likesNumEl.textContent = savedLikes;
      likesNumEl.classList.remove('p2-placeholder');
    } else {
      likesNumEl.classList.add('p2-placeholder');
    }
  }

  /* 通用文字编辑弹框（用系统 prompt 轻量实现） */
  function editField(promptText, storageKey, onSave) {
    const cur = load(storageKey, '');
    const val = window.prompt(promptText, cur);
    if (val === null) return; /* 取消 */
    save(storageKey, val.trim());
    onSave(val.trim());
  }

  /* 点击用户名 */
  if (nameEl) {
    nameEl.addEventListener('click', function(e) {
      e.stopPropagation();
      editField('填写用户名', 'p2UcName', function(val) {
        if (val) {
          nameEl.textContent = val;
          nameEl.classList.remove('p2-placeholder');
        } else {
          nameEl.textContent = '点击填写用户名';
          nameEl.classList.add('p2-placeholder');
        }
      });
    });
  }

  /* 点击账户码 */
  if (uidEl) {
    uidEl.addEventListener('click', function(e) {
      e.stopPropagation();
      editField('填写账户码', 'p2UcUid', function(val) {
        if (val) {
          uidEl.textContent = '# ' + val;
          uidEl.classList.remove('p2-placeholder');
        } else {
          uidEl.textContent = '# 点击填写账户码';
          uidEl.classList.add('p2-placeholder');
        }
      });
    });
  }

  /* 点击粉丝数 */
  const fansEl = document.getElementById('p2-uc-fans');
  if (fansEl) {
    fansEl.addEventListener('click', function(e) {
      e.stopPropagation();
      editField('填写粉丝数量', 'p2UcFans', function(val) {
        if (fansNumEl) {
          if (val) {
            fansNumEl.textContent = val;
            fansNumEl.classList.remove('p2-placeholder');
          } else {
            fansNumEl.textContent = '0';
            fansNumEl.classList.add('p2-placeholder');
          }
        }
      });
    });
  }

  /* 点击获赞数 */
  const likesEl = document.getElementById('p2-uc-likes');
  if (likesEl) {
    likesEl.addEventListener('click', function(e) {
      e.stopPropagation();
      editField('填写获赞数量', 'p2UcLikes', function(val) {
        if (likesNumEl) {
          if (val) {
            likesNumEl.textContent = val;
            likesNumEl.classList.remove('p2-placeholder');
          } else {
            likesNumEl.textContent = '0';
            likesNumEl.classList.add('p2-placeholder');
          }
        }
      });
    });
  }

  /* 点击卡片整体换背景（排除头像、信息区点击） */
  const card = document.getElementById('p2-user-card');
  if (card) {
    card.addEventListener('click', function(e) {
      if (e.target.closest('#p2-uc-avatar-wrap')) return;
      if (e.target.closest('.p2-uc-info')) return;
      openP2ImgModal('更换用户卡背景', 'ucbg');
    });
  }

  /* 点击头像换头像（复用主页面弹窗） */
  const avatarWrap = document.getElementById('p2-uc-avatar-wrap');
  if (avatarWrap) {
    avatarWrap.addEventListener('click', function(e) {
      e.stopPropagation();
      document.getElementById('avatar-url-input').value  = '';
      document.getElementById('avatar-file-input').value = '';
      setAvatarTab('url');
      document.getElementById('avatar-modal').classList.add('show');
    });
  }
})();


/* ============================================================
   第二页：小卡图片
   ============================================================ */
var p2CardUrls = load('page2Cards', ['', '', '', '']);

(function initP2Cards() {
  p2CardUrls.forEach(function(url, idx) {
    if (!url) return;
    const imgEl = document.getElementById('p2-card-img-' + idx);
    if (!imgEl) return;
    imgEl.src = url;
    imgEl.style.display = 'block';
    const empty = imgEl.nextElementSibling;
    if (empty) empty.style.display = 'none';
  });

  const widget = document.getElementById('p2-cards-widget');
  if (widget) {
    widget.addEventListener('click', function(e) {
      const card = e.target.closest('.p2-card-item');
      if (!card) return;
      const idx = card.dataset.card;
      openP2ImgModal('更换小卡图片 ' + (parseInt(idx) + 1), 'card-' + idx);
    });
  }
})();

/* ============================================================
   第二页：专辑封面（点击专辑主体换封面）
   ============================================================ */
(function initP2Album() {
  /* 恢复专辑背景 */
  const bg = load('p2AlbumBg', null);
  if (bg) {
    const bgEl = document.getElementById('p2-album-bg');
    if (bgEl) bgEl.style.backgroundImage = 'url(' + bg + ')';
  }

  /* 点击专辑主体换封面 */
  const albumWidget = document.getElementById('p2-album-widget');
  if (albumWidget) {
    albumWidget.addEventListener('click', function(e) {
      e.stopPropagation();
      openP2ImgModal('更换专辑封面', 'album');
    });
  }

  /* 恢复 CD 图片 */
  const cdImg = load('p2CdImg', null);
  if (cdImg) {
    const r3 = document.querySelector('#p2-cd .p2-cd-r3');
    if (r3) {
      r3.style.backgroundImage    = 'url(' + cdImg + ')';
      r3.style.backgroundSize     = 'cover';
      r3.style.backgroundPosition = 'center';
    }
  }

  /* 点击 CD 非金属区换 CD 图（r3、r4 可点击） */
  const cdClickable = document.getElementById('p2-cd-clickable');
  if (cdClickable) {
    cdClickable.addEventListener('click', function(e) {
      e.stopPropagation();
      openP2ImgModal('更换 CD 图片', 'cdimg');
    });
  }

  const r4 = document.querySelector('#p2-cd .p2-cd-r4');
  if (r4) {
    r4.addEventListener('click', function(e) {
      e.stopPropagation();
      openP2ImgModal('更换 CD 图片', 'cdimg');
    });
  }
})();

/* ============================================================
   Dock：家园App 入口
   ============================================================ */
document.addEventListener('click', function (e) {
  const dockHome = e.target.closest('#dock-home');
  if (dockHome) {
    if (typeof window.GardenApp !== 'undefined') {
      window.GardenApp.open();
    }
  }
});

/* ============================================================
   音乐 App 入口
   ============================================================ */
document.addEventListener('click', function(e) {
  const appItem = e.target.closest('.app-item[data-app="0"]');
  if (appItem) {
    if (typeof window.MusicApp !== 'undefined') {
      window.MusicApp.open();
    }
  }
});
