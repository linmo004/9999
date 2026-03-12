/* ============================================================
   page3.js — 相性卡片逻辑
   ============================================================ */
(function () {

  /* ── localStorage 读取 ── */
  function lsGet(key, def) {
    try {
      const v = localStorage.getItem(key);
      if (v === null || v === undefined) return def;
      return JSON.parse(v);
    } catch (e) { return def; }
  }

  /* ── 今日日期 ── */
  function getTodayStr() {
    const now = new Date();
    return now.getFullYear() + '-'
      + String(now.getMonth() + 1).padStart(2, '0') + '-'
      + String(now.getDate()).padStart(2, '0');
  }

  /* ── 种子随机 ── */
  function seededRandom(seed) {
    let s = seed;
    return function () {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      return (s >>> 0) / 0xffffffff;
    };
  }
  function strToSeed(str) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = ((h << 5) - h) + str.charCodeAt(i);
      h |= 0;
    }
    return Math.abs(h);
  }

  /* ── 词库 ── */
  const AFFINITY_TAGS = {
    high:    ['命中注定','灵魂伴侣','天作之合','心有灵犀'],
    midHigh: ['相辅相成','默契十足','相得益彰','志趣相投'],
    mid:     ['平淡如水','相安无事','细水长流','普通朋友'],
    midLow:  ['偶有摩擦','性格互补','磨合期中','时有争执'],
    low:     ['相克','道不同','各走一方','水火不容']
  };
  const AFFINITY_DESCS = [
    '你们之间有着说不清道不明的默契。',
    '在某个瞬间，会觉得对方真的很懂自己。',
    '一起走过的时光，是最温柔的印记。',
    '彼此的存在，像是命运特意安排的相遇。',
    '即使不说话，待在一起也觉得安心。',
    '有时会争吵，但心底始终留着对方的位置。',
    '两个人的世界观有些不同，但也因此有趣。',
    '相处平淡，却有种难以言说的稳定感。',
    '磁场略有不同，需要更多的耐心与理解。',
    '性格差异明显，但差异也是一种缘分。',
    '就像两条平行线，有距离却也各自精彩。',
    '缘分尚浅，一切都还有可能。',
    '彼此映照出对方身上最真实的模样。',
    '在对方身边，能感受到一种特别的温度。',
  ];
  const FORTUNE_YI_POOL = [
    '宜表白','宜出行','宜购物','宜学习','宜创作',
    '宜见友','宜运动','宜休息','宜尝鲜','宜告白',
    '宜整理','宜冥想','宜写信','宜散步','宜做饭',
  ];
  const FORTUNE_JI_POOL = [
    '忌争吵','忌冒险','忌熬夜','忌冲动消费','忌拖延',
    '忌抱怨','忌独处','忌过劳','忌焦虑','忌比较',
    '忌贪嘴','忌怠惰','忌多心','忌犹豫','忌失眠',
  ];

  /* ── 读取角色 ── */
  function getRoles() {
    const keys = ['liao_roles','halo9_roles','roles'];
    for (const key of keys) {
      const val = lsGet(key, null);
      if (Array.isArray(val) && val.length > 0) return val;
    }
    return [];
  }
  function extractRoleName(role, idx) {
    return role.name || role.roleName || role.title
      || role.characterName || role.charName || role.nickname
      || ('角色' + (idx + 1));
  }
  function extractRoleAvatar(role, idx) {
    return role.avatar || role.avatarUrl || role.avatarSrc
      || role.img || role.image || role.cover
      || ('https://api.dicebear.com/7.x/bottts-neutral/svg?seed=role' + idx);
  }

  /* ── 读取用户信息 ── */
  function getUserInfo() {
    const avatarKeys = ['halo9_userAvatar','liao_userAvatar'];
    let avatar = 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=halo9user';
    for (const key of avatarKeys) {
      const v = lsGet(key, null);
      if (v && typeof v === 'string' && v.trim()) { avatar = v.trim(); break; }
    }
    let name = '用户';
    const personaKeys = ['liao_persona','halo9_persona','liao_userName','halo9_userName'];
    for (const key of personaKeys) {
      const v = lsGet(key, null);
      if (!v) continue;
      if (typeof v === 'object' && v !== null) {
        const n = v.name || v.userName || v.nickname || v.playerName;
        if (n && typeof n === 'string' && n.trim()) { name = n.trim(); break; }
      }
      if (typeof v === 'string' && v.trim()) { name = v.trim(); break; }
    }
    return { avatar, name };
  }

  /* ── 生成相性数据 ── */
  function generateAffinityData(persons, dateStr) {
    const pairs = [];
    for (let i = 0; i < persons.length; i++) {
      for (let j = i + 1; j < persons.length; j++) {
        const rng   = seededRandom(strToSeed(dateStr + '|' + persons[i].id + '|' + persons[j].id));
        const score = Math.floor(rng() * 101);
        let tagArr;
        if (score >= 90)      tagArr = AFFINITY_TAGS.high;
        else if (score >= 70) tagArr = AFFINITY_TAGS.midHigh;
        else if (score >= 50) tagArr = AFFINITY_TAGS.mid;
        else if (score >= 30) tagArr = AFFINITY_TAGS.midLow;
        else                  tagArr = AFFINITY_TAGS.low;
        pairs.push({
          idA: persons[i].id,      idB: persons[j].id,
          nameA: persons[i].name,  nameB: persons[j].name,
          avatarA: persons[i].avatar, avatarB: persons[j].avatar,
          score,
          tag:  tagArr[Math.floor(rng() * tagArr.length)],
          desc: AFFINITY_DESCS[Math.floor(rng() * AFFINITY_DESCS.length)]
        });
      }
    }
    pairs.sort((a, b) => b.score - a.score);
    return pairs;
  }

  /* ── 生成运势 ── */
  function generateFortune(personId, dateStr) {
    const rng     = seededRandom(strToSeed(dateStr + '|fortune|' + personId));
    const yiCount = 2 + Math.floor(rng() * 2);
    const jiCount = 2 + Math.floor(rng() * 2);
    const yi = [...FORTUNE_YI_POOL];
    const ji = [...FORTUNE_JI_POOL];
    function shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
    }
    shuffle(yi); shuffle(ji);
    return { yi: yi.slice(0, yiCount), ji: ji.slice(0, jiCount) };
  }

  /* ── 获取或生成当天数据 ── */
  function getAffinityData() {
    const today     = getTodayStr();
    const savedDate = localStorage.getItem('halo9_affinity_date');
    const savedData = lsGet('halo9_affinity_data', null);
    const roles     = getRoles();
    const userInfo  = getUserInfo();

    const persons = [{ id:'user', name:userInfo.name, avatar:userInfo.avatar, isUser:true }];
    roles.forEach((role, idx) => {
      persons.push({
        id:     'role_' + (role.id || role.roleId || role.uid || idx),
        name:   extractRoleName(role, idx),
        avatar: extractRoleAvatar(role, idx),
        isUser: false
      });
    });

    if (
      savedDate === today && savedData &&
      savedData.pairs && savedData.pairs.length > 0 &&
      savedData.personCount === persons.length
    ) return savedData;

    const pairs    = generateAffinityData(persons, today);
    const fortunes = {};
    persons.forEach(p => { fortunes[p.id] = generateFortune(p.id, today); });
    const data = { date:today, persons, pairs, fortunes, personCount:persons.length };
    try {
      localStorage.setItem('halo9_affinity_date', today);
      localStorage.setItem('halo9_affinity_data', JSON.stringify(data));
    } catch(e) {}
    return data;
  }

  /* ── 渲染工具 ── */
  function tagColorClass(score) {
    if (score >= 70) return 'tag-high';
    if (score >= 40) return 'tag-mid';
    return 'tag-low';
  }

  function buildRankItemHTML(rank, pair) {
    const numClass = rank <= 3 ? ' rank-' + rank : '';
    const colorCls = tagColorClass(pair.score);
    const seed     = pair.idA + pair.idB;
    return `<div class="affinity-rank-item">
  <div class="affinity-rank-num${numClass}">${rank}</div>
  <div class="affinity-rank-persons">
    <div class="affinity-rank-avatar-wrap">
      <img class="affinity-rank-avatar" src="${pair.avatarA}" alt=""
           onerror="this.src='https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${seed}A'">
      <img class="affinity-rank-avatar" src="${pair.avatarB}" alt=""
           onerror="this.src='https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${seed}B'">
    </div>
    <span class="affinity-rank-names">${pair.nameA}<span class="affinity-rank-heart"> ♥ </span>${pair.nameB}</span>
  </div>
  <div class="affinity-rank-right">
    <span class="affinity-rank-score">${pair.score}</span>
    <span class="affinity-rank-tag ${colorCls}">${pair.tag}</span>
  </div>
</div>`;
  }

  function buildFortuneHTML(fortune) {
    return fortune.yi.map(i => `<span class="fortune-yi">${i}</span>`).join('')
         + fortune.ji.map(i => `<span class="fortune-ji">${i}</span>`).join('');
  }

  /* ── 卡片切换状态 ── */
  let allCards    = [];
  let activeIndex = 0;

  function updateCards() {
    const total = allCards.length;
    allCards.forEach((el, i) => {
      el.classList.toggle('card-active', i === activeIndex);
    });
    const indicator = document.getElementById('affinity-card-indicator');
    if (indicator) indicator.textContent = (activeIndex + 1) + ' / ' + total;
  }

  function goNext() {
    if (allCards.length === 0) return;
    activeIndex = (activeIndex + 1) % allCards.length;
    updateCards();
  }

  /* ── 阻止卡片内滚动冒泡到页面横滑 ── */
  function bindScrollStop() {
    document.querySelectorAll(
      '#affinity-card-stack .affinity-total-list, #affinity-card-stack .affinity-person-bottom'
    ).forEach(el => {
      el.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
      el.addEventListener('touchmove',  e => e.stopPropagation(), { passive: true });
      el.addEventListener('touchend',   e => e.stopPropagation(), { passive: true });
    });
  }

  /* ── 主渲染 ── */
  function renderAffinityCards() {
    const data                         = getAffinityData();
    const { persons, pairs, fortunes } = data;

    const dateEl = document.getElementById('affinity-total-date');
    if (dateEl) dateEl.textContent = data.date;

    /* 无角色占位 */
    if (persons.length <= 1) {
      const tl = document.getElementById('affinity-total-list');
      if (tl) tl.innerHTML = '<div class="affinity-empty-hint">暂无角色<br>请先在了了中创建角色</div>';
      const ua = document.getElementById('affinity-user-avatar');
      if (ua) ua.src = persons[0].avatar;
      const un = document.getElementById('affinity-user-name');
      if (un) un.textContent = persons[0].name;
      const uf = document.getElementById('affinity-user-fortune');
      if (uf && fortunes['user']) uf.innerHTML = buildFortuneHTML(fortunes['user']);
      collectAndInit();
      return;
    }

    /* 总排行榜 */
    const totalList = document.getElementById('affinity-total-list');
    if (totalList) {
      totalList.innerHTML = pairs.map((p, i) => buildRankItemHTML(i + 1, p)).join('');
    }

    /* 用户卡片 */
    const userPerson = persons.find(p => p.isUser);
    if (userPerson) {
      const ua = document.getElementById('affinity-user-avatar');
      if (ua) ua.src = userPerson.avatar;
      const un = document.getElementById('affinity-user-name');
      if (un) un.textContent = userPerson.name;
      const uf = document.getElementById('affinity-user-fortune');
      if (uf && fortunes[userPerson.id]) uf.innerHTML = buildFortuneHTML(fortunes[userPerson.id]);

      const userRankList = document.getElementById('affinity-user-rank-list');
      if (userRankList) {
        const uPairs = pairs
          .filter(p => p.idA === userPerson.id || p.idB === userPerson.id)
          .sort((a, b) => b.score - a.score);
        userRankList.innerHTML = uPairs.map((p, i) => buildRankItemHTML(i + 1, p)).join('');
      }
    }

    /* 角色卡片动态生成 */
    const wrap = document.getElementById('affinity-role-cards-wrap');
    if (wrap) {
      const rolePersons = persons.filter(p => !p.isUser);
      let counter = 2;
      wrap.innerHTML = rolePersons.map(person => {
        const order = counter++;
        return `<div class="affinity-card affinity-card-person"
                     id="affinity-card-role-${person.id}"
                     data-card-order="${order}">
  <div class="affinity-person-top">
    <div class="affinity-person-fortune-header">
      <img class="affinity-person-avatar" src="${person.avatar}" alt=""
           onerror="this.src='https://api.dicebear.com/7.x/bottts-neutral/svg?seed=${person.id}'">
      <span class="affinity-person-name">${person.name}</span>
      <span class="affinity-fortune-badge">今日运势</span>
    </div>
    <div class="affinity-fortune-content" id="affinity-fortune-${person.id}"></div>
  </div>
  <div class="affinity-person-bottom">
    <div class="affinity-rank-list" id="affinity-rank-${person.id}"></div>
  </div>
</div>`;
      }).join('');

      rolePersons.forEach(person => {
        const fe = document.getElementById('affinity-fortune-' + person.id);
        if (fe && fortunes[person.id]) fe.innerHTML = buildFortuneHTML(fortunes[person.id]);

        const re = document.getElementById('affinity-rank-' + person.id);
        if (re) {
          const rPairs = pairs
            .filter(p => p.idA === person.id || p.idB === person.id)
            .sort((a, b) => b.score - a.score);
          re.innerHTML = rPairs.map((p, i) => buildRankItemHTML(i + 1, p)).join('');
        }
      });
    }

    collectAndInit();
  }

  /* ── 收集卡片并初始化 ── */
  function collectAndInit() {
    const stack = document.getElementById('affinity-card-stack');
    if (!stack) return;

    const all = Array.from(stack.querySelectorAll('.affinity-card'));
    all.sort((a, b) => {
      const oa = parseInt(a.dataset.cardOrder || 0);
      const ob = parseInt(b.dataset.cardOrder || 0);
      return oa - ob;
    });

    allCards    = all;
    activeIndex = 0;
    updateCards();

    /* 绑定左下角隐藏点击区 */
    const tapZone = document.getElementById('affinity-card-tap-zone');
    if (tapZone) {
      const newTap = tapZone.cloneNode(true);
      tapZone.parentNode.replaceChild(newTap, tapZone);
      newTap.addEventListener('click', function (e) {
        e.stopPropagation();
        goNext();
      });
      newTap.addEventListener('touchend', function (e) {
        e.stopPropagation();
        e.preventDefault();
        goNext();
      }, { passive: false });
    }

    bindScrollStop();
  }

  /* ── 初始化入口 ── */
  function initPage3() {
    const inner = document.getElementById('page3-inner');
    if (!inner) { setTimeout(initPage3, 100); return; }
    renderAffinityCards();
  }

  window.initPage3 = initPage3;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPage3);
  } else {
    initPage3();
  }

})();
