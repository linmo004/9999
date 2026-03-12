/* ============================================================
   liao-myhome.js — 我的主页 INS 风逻辑
   ============================================================ */

(function () {

  /* ============================================================
     存储 key 定义
     ============================================================ */
  const MH_STORE_KEY = 'liao_myhome_data';

  /* 默认数据结构 */
  function getDefaultData() {
    return {
      avatar:   '',
      name:     lLoad('userName', '用户'),
      setting:  '',
      works: [
        { title: '我的人设库', tag: '#人设 #角色',  user: '@用户', dur: '∞', cover: '' },
        { title: '收藏夹',     tag: '#收藏 #片段',  user: '@用户', dur: '∞', cover: '' },
        { title: '记忆宫殿',   tag: '#记忆 #世界观', user: '@用户', dur: '∞', cover: '' },
        { title: '美化',       tag: '#美化 #聊天',   user: '@用户', dur: '∞', cover: '' },
      ]
    };
  }

  /* ============================================================
     读写工具
     ============================================================ */
  function mhSave(data) {
    try {
      localStorage.setItem(MH_STORE_KEY, JSON.stringify(data));
    } catch (e) {}
  }

  function mhLoad() {
    try {
      const raw = localStorage.getItem(MH_STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        /* 兼容：确保 works 数组长度正确 */
        const def = getDefaultData();
        if (!parsed.works || parsed.works.length < 4) parsed.works = def.works;
        return parsed;
      }
    } catch (e) {}
    return getDefaultData();
  }

  /* ============================================================
     渲染：将数据同步到 DOM
     ============================================================ */
  function renderMyhome(data) {
    /* 头像 */
    const avatarImg = document.getElementById('mh-avatar-img');
    if (avatarImg && data.avatar) avatarImg.src = data.avatar;

    /* 名字 */
    const nameEl = document.getElementById('mh-name');
    if (nameEl) nameEl.textContent = data.name || '用户名';

    /* 人设描述 */
    const settingEl = document.getElementById('mh-setting-text');
    if (settingEl) settingEl.textContent = data.setting || '';

    /* 四个作品 */
    data.works.forEach((work, idx) => {
      const titleEl = document.getElementById('mhwt-'  + idx);
      const tagEl   = document.getElementById('mhwtg-' + idx);
      const userEl  = document.getElementById('mhwu-'  + idx);
      const durEl   = document.getElementById('mhwd-'  + idx);
      const imgEl   = document.getElementById('mhwci-' + idx);
      const phEl    = document.getElementById('mhwcp-' + idx);

      if (titleEl) titleEl.textContent = work.title || '';
      if (tagEl)   tagEl.textContent   = work.tag   || '';
      if (userEl)  userEl.textContent  = work.user  || '';
      if (durEl)   durEl.textContent   = work.dur   || '';

      if (imgEl) {
        if (work.cover) {
          imgEl.src = work.cover;
          imgEl.classList.add('visible');
          if (phEl) phEl.style.display = 'none';
        } else {
          imgEl.classList.remove('visible');
          if (phEl) phEl.style.display = '';
        }
      }
    });
  }

  /* ============================================================
     收集当前 DOM 里的数据
     ============================================================ */
  function collectData(currentData) {
    const nameEl    = document.getElementById('mh-name');
    const settingEl = document.getElementById('mh-setting-text');
    const avatarImg = document.getElementById('mh-avatar-img');

    if (nameEl)    currentData.name    = nameEl.textContent.trim();
    if (settingEl) currentData.setting = settingEl.textContent.trim();
    if (avatarImg && avatarImg.src && !avatarImg.src.includes('dicebear')) {
      currentData.avatar = avatarImg.src;
    }

    currentData.works.forEach((work, idx) => {
      const titleEl = document.getElementById('mhwt-'  + idx);
      const tagEl   = document.getElementById('mhwtg-' + idx);
      const userEl  = document.getElementById('mhwu-'  + idx);
      const durEl   = document.getElementById('mhwd-'  + idx);

      if (titleEl) work.title = titleEl.textContent.trim();
      if (tagEl)   work.tag   = tagEl.textContent.trim();
      if (userEl)  work.user  = userEl.textContent.trim();
      if (durEl)   work.dur   = durEl.textContent.trim();
    });

    return currentData;
  }

  /* ============================================================
     初始化
     ============================================================ */
  let mhData = mhLoad();

  /* 面板首次激活时渲染 */
  function initMyhome() {
    mhData = mhLoad();
    renderMyhome(mhData);
    bindEvents();
  }

  /* ============================================================
     事件绑定
     ============================================================ */
  function bindEvents() {

    /* ── 头像点击上传 ── */
    const avatarWrap = document.getElementById('mh-avatar-wrap');
    const avatarFile = document.getElementById('mh-avatar-file');

    if (avatarWrap && avatarFile && !avatarWrap._mhBound) {
      avatarWrap._mhBound = true;
      avatarWrap.addEventListener('click', () => avatarFile.click());
      avatarFile.addEventListener('change', async function () {
        const file = this.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async e => {
          const compressed = typeof compressImage === 'function'
            ? await compressImage(e.target.result, 300, 0.85)
            : e.target.result;
          const img = document.getElementById('mh-avatar-img');
          if (img) img.src = compressed;
          mhData.avatar = compressed;
          mhSave(mhData);
        };
        reader.readAsDataURL(file);
        this.value = '';
      });
    }

    /* ── 保存按钮 ── */
    const saveBtn = document.getElementById('mh-save-btn');
    if (saveBtn && !saveBtn._mhBound) {
      saveBtn._mhBound = true;
      saveBtn.addEventListener('click', () => {
  /* 先让所有编辑框失焦，确保 blur 触发 */
  document.querySelectorAll('[contenteditable="true"]').forEach(el => el.blur());
  mhData = collectData(mhData);
  mhSave(mhData);
  saveBtn.textContent = '✔';
  saveBtn.style.background = '#4caf84';
  setTimeout(() => {
    saveBtn.textContent = '✓';
    saveBtn.style.background = '';
  }, 1200);
});

    }

    /* ── contenteditable 失焦自动保存 ── */
    const autoSaveIds = [
      'mh-name', 'mh-setting-text',
      'mhwt-0','mhwtg-0','mhwu-0','mhwd-0',
      'mhwt-1','mhwtg-1','mhwu-1','mhwd-1',
      'mhwt-2','mhwtg-2','mhwu-2','mhwd-2',
      'mhwt-3','mhwtg-3','mhwu-3','mhwd-3',
    ];

    autoSaveIds.forEach(id => {
      const el = document.getElementById(id);
      if (el && !el._mhBlurBound) {
        el._mhBlurBound = true;
        el.addEventListener('blur', () => {
          mhData = collectData(mhData);
          mhSave(mhData);
        });
        /* 回车失焦 */
        el.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
        });
        /* 阻止点击封面时触发导航 */
        el.addEventListener('click', e => e.stopPropagation());
      }
    });

    /* ── 四个封面图点击上传 ── */
    for (let idx = 0; idx < 4; idx++) {
      bindCoverUpload(idx);
    }

    /* ── 四个作品条目点击导航 ── */
    bindWorkNavigation();

    /* ── 切换面具按钮 ── */
    const maskBtn = document.getElementById('mh-mask-switch-btn');
    if (maskBtn && !maskBtn._mhBound) {
      maskBtn._mhBound = true;
      maskBtn.addEventListener('click', openMaskModal);
    }

    /* ── 面具弹窗取消 ── */
    const maskCancel = document.getElementById('mh-mask-cancel');
    if (maskCancel && !maskCancel._mhBound) {
      maskCancel._mhBound = true;
      maskCancel.addEventListener('click', closeMaskModal);
    }

    /* ── 面具弹窗遮罩点击关闭 ── */
    const maskModal = document.getElementById('mh-mask-modal');
    if (maskModal && !maskModal._mhBound) {
      maskModal._mhBound = true;
      maskModal.addEventListener('click', function (e) {
        if (e.target === this) closeMaskModal();
      });
    }
  }

  /* ── 封面图上传绑定 ── */
  function bindCoverUpload(idx) {
    const coverEl = document.getElementById('mhwc-'  + idx);
    const fileEl  = document.getElementById('mhwcf-' + idx);
    if (!coverEl || !fileEl || coverEl._mhCoverBound) return;
    coverEl._mhCoverBound = true;

    coverEl.addEventListener('click', e => {
      e.stopPropagation(); /* 阻止冒泡到作品条目的导航点击 */
      fileEl.click();
    });

    fileEl.addEventListener('change', async function () {
      const file = this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async e => {
        const compressed = typeof compressImage === 'function'
          ? await compressImage(e.target.result, 400, 0.82)
          : e.target.result;
        const imgEl = document.getElementById('mhwci-' + idx);
        const phEl  = document.getElementById('mhwcp-' + idx);
        if (imgEl) {
          imgEl.src = compressed;
          imgEl.classList.add('visible');
        }
        if (phEl) phEl.style.display = 'none';
        mhData.works[idx].cover = compressed;
        mhSave(mhData);
      };
      reader.readAsDataURL(file);
      this.value = '';
    });
  }

  /* ── 作品条目导航绑定 ── */
  function bindWorkNavigation() {
    const map = [
      { id: 'mh-work-persona',   action: () => { if (typeof openPersonaLib === 'function') openPersonaLib(); } },
      { id: 'mh-work-favorites', action: () => { if (typeof openFavorites  === 'function') openFavorites();  } },
      { id: 'mh-work-memory',    action: () => { alert('记忆宫殿：功能建设中，敬请期待'); } },
      { id: 'mh-work-beauty',    action: () => { alert('美化：功能建设中，敬请期待');     } },
    ];

    map.forEach(({ id, action }) => {
      const el = document.getElementById(id);
      if (!el || el._mhNavBound) return;
      el._mhNavBound = true;
      el.addEventListener('click', function (e) {
        /* 如果点击的是可编辑元素或封面，不触发导航 */
        if (e.target.contentEditable === 'true') return;
        if (e.target.closest('.mh-work-cover')) return;
        action();
      });
    });
  }

  /* ============================================================
     面具切换弹窗
     ============================================================ */
  function openMaskModal() {
    const modal    = document.getElementById('mh-mask-modal');
    const listEl   = document.getElementById('mh-mask-list');
    if (!modal || !listEl) return;

    const personas = lLoad('personas', []);
    listEl.innerHTML = '';

    if (!personas.length) {
      listEl.innerHTML = '<div style="font-size:13px;color:var(--text-light);text-align:center;padding:16px 0;">人设库为空，请先在人设库中新建人设。</div>';
    } else {
      personas.forEach(p => {
        const item = document.createElement('div');
        item.className = 'mh-mask-item';

        const isActive = (mhData.name === p.name && mhData.setting === (p.setting || ''));
        if (isActive) item.classList.add('active-mask');

        const avatar = document.createElement('img');
        avatar.className = 'mh-mask-avatar';
        avatar.src = p.avatar || 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=persona';
        avatar.alt = '';

        const info = document.createElement('div');
        info.className = 'mh-mask-info';

        const name = document.createElement('div');
        name.className   = 'mh-mask-name';
        name.textContent = p.name || '未命名';

        const sub = document.createElement('div');
        sub.className   = 'mh-mask-sub';
        sub.textContent = (p.setting || '').slice(0, 30) || '暂无描述';

        const check = document.createElement('div');
        check.className   = 'mh-mask-check';
        check.textContent = '✓';

        info.appendChild(name);
        info.appendChild(sub);
        item.appendChild(avatar);
        item.appendChild(info);
        item.appendChild(check);

        item.addEventListener('click', () => applyMask(p));
        listEl.appendChild(item);
      });
    }

    modal.style.display = 'flex';
  }

  function closeMaskModal() {
    const modal = document.getElementById('mh-mask-modal');
    if (modal) modal.style.display = 'none';
  }

  function applyMask(persona) {
    /* 同步头像 */
    if (persona.avatar) {
      const img = document.getElementById('mh-avatar-img');
      if (img) img.src = persona.avatar;
      mhData.avatar = persona.avatar;
    }
    /* 同步名字 */
    const nameEl = document.getElementById('mh-name');
    if (nameEl) nameEl.textContent = persona.name || '';
    mhData.name = persona.name || '';

    /* 同步人设描述 */
    const settingEl = document.getElementById('mh-setting-text');
    if (settingEl) settingEl.textContent = persona.setting || '';
    mhData.setting = persona.setting || '';

    mhSave(mhData);
    closeMaskModal();
  }

  /* ============================================================
     标签切换时触发初始化（只初始化一次）
     ============================================================ */
  let _inited = false;

  /* 暴露给 liao-core.js 的 switchLiaoTab 调用 */
  window.initMyhomePanel = function () {
    if (!_inited) {
      initMyhome();
      _inited = true;
    } else {
      /* 再次切换时刷新数据（人设库可能有更新） */
      mhData = mhLoad();
      renderMyhome(mhData);
    }
  };

  /* 兼容旧版：如果没有调用 initMyhomePanel，直接在 DOMContentLoaded 后初始化 */
  document.addEventListener('DOMContentLoaded', () => {
    /* 延迟等待 liao-core.js 加载完 */
    setTimeout(() => {
      if (!_inited) {
        initMyhome();
        _inited = true;
      }
    }, 300);
  });

  /* ============================================================
     菜单项事件绑定（兼容旧的 my-menu-item 写法，现在已不存在，保留兜底）
     ============================================================ */
  document.querySelectorAll('.my-menu-item').forEach(item => {
    const id = item.id;
    if (id === 'menu-persona-lib' || id === 'menu-favorites') return;
    item.addEventListener('click', function () {
      const title = this.querySelector('.my-menu-title');
      if (title) alert('「' + title.textContent + '」功能建设中，敬请期待');
    });
  });

})();
