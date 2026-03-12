/* ============================================================
   liao-myhome.js — 我的主页逻辑
   ============================================================ */

(function () {

  const MH_STORE_KEY = 'liao_myhome_data';

  function getDefaultData() {
    return {
      avatar:  '',
      name:    lLoad('userName', '用户'),
      setting: '',
      works: [
        { title: '我的人设库', tag: '#人设 #角色',   user: '@用户', dur: '∞', cover: '' },
        { title: '收藏夹',     tag: '#收藏 #片段',   user: '@用户', dur: '∞', cover: '' },
        { title: '记忆宫殿',   tag: '#记忆 #世界观', user: '@用户', dur: '∞', cover: '' },
        { title: '美化',       tag: '#美化 #聊天',   user: '@用户', dur: '∞', cover: '' },
      ]
    };
  }

  function mhSave(data) {
    try { localStorage.setItem(MH_STORE_KEY, JSON.stringify(data)); } catch (e) {}
  }

  function mhLoad() {
    try {
      const raw = localStorage.getItem(MH_STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (!parsed.works || parsed.works.length < 4) parsed.works = getDefaultData().works;
        return parsed;
      }
    } catch (e) {}
    return getDefaultData();
  }

  /* ── 渲染 ── */
  function renderMyhome(data) {
    const avatarImg = document.getElementById('mh-avatar-img');
    if (avatarImg && data.avatar) avatarImg.src = data.avatar;

    const nameEl = document.getElementById('mh-name');
    if (nameEl) nameEl.textContent = data.name || '用户名';

    const settingEl = document.getElementById('mh-setting-text');
    if (settingEl) settingEl.textContent = data.setting || '';

    /* 面具按钮显示当前名字 */
    updateMaskBtnLabel(data.name);

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

  function updateMaskBtnLabel(name) {
    const btn = document.getElementById('mh-mask-switch-btn');
    if (btn) btn.textContent = '@' + (name || '用户');
  }

  /* ── 收集数据 ── */
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
      const t = document.getElementById('mhwt-'  + idx);
      const g = document.getElementById('mhwtg-' + idx);
      const u = document.getElementById('mhwu-'  + idx);
      const d = document.getElementById('mhwd-'  + idx);
      if (t) work.title = t.textContent.trim();
      if (g) work.tag   = g.textContent.trim();
      if (u) work.user  = u.textContent.trim();
      if (d) work.dur   = d.textContent.trim();
    });

    return currentData;
  }

  let mhData = mhLoad();

  function initMyhome() {
    mhData = mhLoad();
    renderMyhome(mhData);
    bindEvents();
  }

  /* ============================================================
     URL 弹窗（头像和封面共用）
     ============================================================ */
  let _urlModalCallback = null;
  let _urlModalFileInput = null;

  function openUrlModal(title, fileInputId, onConfirm) {
    _urlModalCallback  = onConfirm;
    _urlModalFileInput = fileInputId;

    let modal = document.getElementById('mh-url-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id        = 'mh-url-modal';
      modal.className = 'mh-url-modal';
      modal.innerHTML = `
        <div class="mh-url-modal-box">
          <div class="mh-url-modal-title" id="mh-url-modal-title"></div>
          <input class="mh-url-modal-input" id="mh-url-modal-input" placeholder="输入图片 URL…">
          <div class="mh-url-modal-or">— 或 —</div>
          <div class="mh-url-modal-btns">
            <button class="liao-btn-ghost"   id="mh-url-modal-local"  style="flex:1;">本地上传</button>
            <button class="liao-btn-primary" id="mh-url-modal-confirm" style="flex:1;">确认 URL</button>
            <button class="liao-btn-ghost"   id="mh-url-modal-cancel" style="flex:1;">取消</button>
          </div>
        </div>`;
      document.body.appendChild(modal);

      modal.addEventListener('click', e => { if (e.target === modal) closeUrlModal(); });

      document.getElementById('mh-url-modal-confirm').addEventListener('click', () => {
        const url = (document.getElementById('mh-url-modal-input').value || '').trim();
        if (!url) { alert('请输入图片 URL'); return; }
        if (_urlModalCallback) _urlModalCallback(url);
        closeUrlModal();
      });

      document.getElementById('mh-url-modal-local').addEventListener('click', () => {
        closeUrlModal();
        if (_urlModalFileInput) {
          const fi = document.getElementById(_urlModalFileInput);
          if (fi) fi.click();
        }
      });

      document.getElementById('mh-url-modal-cancel').addEventListener('click', closeUrlModal);
    }

    document.getElementById('mh-url-modal-title').textContent = title;
    document.getElementById('mh-url-modal-input').value = '';
    modal.classList.add('show');
    setTimeout(() => {
      const inp = document.getElementById('mh-url-modal-input');
      if (inp) inp.focus();
    }, 100);
  }

  function closeUrlModal() {
    const modal = document.getElementById('mh-url-modal');
    if (modal) modal.classList.remove('show');
    _urlModalCallback  = null;
    _urlModalFileInput = null;
  }

  /* ============================================================
     事件绑定
     ============================================================ */
  function bindEvents() {

    /* ── 头像：短按选URL或本地，长按也一样 ── */
    const avatarWrap = document.getElementById('mh-avatar-wrap');
    const avatarFile = document.getElementById('mh-avatar-file');

    if (avatarWrap && !avatarWrap._mhBound) {
      avatarWrap._mhBound = true;

      avatarWrap.addEventListener('click', () => {
        openUrlModal('更换头像', 'mh-avatar-file', (url) => {
          const img = document.getElementById('mh-avatar-img');
          if (img) img.src = url;
          mhData.avatar = url;
          mhSave(mhData);
        });
      });

      if (avatarFile) {
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
    }

    /* ── 保存按钮：保存到人设库 ── */
    const saveBtn = document.getElementById('mh-save-btn');
    if (saveBtn && !saveBtn._mhBound) {
      saveBtn._mhBound = true;
      saveBtn.addEventListener('click', () => {
        document.querySelectorAll('[contenteditable="true"]').forEach(el => el.blur());
        mhData = collectData(mhData);
        mhSave(mhData);

        /* 同时保存到人设库 */
        const name    = mhData.name    || '';
        const setting = mhData.setting || '';
        const avatar  = mhData.avatar  || '';
        if (!name) { alert('请先填写用户名再保存'); return; }

        let personas = lLoad('personas', []);
        const existIdx = personas.findIndex(p => p.name === name);
        const personaObj = {
          id:      existIdx >= 0 ? personas[existIdx].id : ('persona_' + Date.now()),
          name,
          setting,
          avatar:  avatar || 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=default'
        };

        if (existIdx >= 0) {
          personas[existIdx] = personaObj;
        } else {
          personas.push(personaObj);
        }
        lSave('personas', personas);

        /* 更新面具按钮显示 */
        updateMaskBtnLabel(name);

        /* 视觉反馈 */
        saveBtn.textContent = '已保存 ✓';
        saveBtn.style.background = '#4caf84';
        setTimeout(() => {
          saveBtn.textContent = '保存';
          saveBtn.style.background = '';
        }, 1500);
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
          /* 名字变化时同步面具按钮 */
          if (id === 'mh-name') updateMaskBtnLabel(mhData.name);
        });
        el.addEventListener('keydown', e => {
          if (e.key === 'Enter') { e.preventDefault(); el.blur(); }
        });
        el.addEventListener('click', e => e.stopPropagation());
      }
    });

    /* ── 四个封面图：点击弹出URL/本地选择 ── */
    for (let idx = 0; idx < 4; idx++) {
      bindCoverUpload(idx);
    }

    /* ── 作品条目导航 ── */
    bindWorkNavigation();

    /* ── 面具切换按钮 ── */
    const maskBtn = document.getElementById('mh-mask-switch-btn');
    if (maskBtn && !maskBtn._mhBound) {
      maskBtn._mhBound = true;
      maskBtn.addEventListener('click', e => {
        e.stopPropagation();
        openMaskModal();
      });
    }

    /* ── 面具弹窗取消 ── */
    const maskCancel = document.getElementById('mh-mask-cancel');
    if (maskCancel && !maskCancel._mhBound) {
      maskCancel._mhBound = true;
      maskCancel.addEventListener('click', closeMaskModal);
    }

    /* ── 面具弹窗遮罩 ── */
    const maskModal = document.getElementById('mh-mask-modal');
    if (maskModal && !maskModal._mhBound) {
      maskModal._mhBound = true;
      maskModal.addEventListener('click', function (e) {
        if (e.target === this) closeMaskModal();
      });
    }
  }

  /* ── 封面图上传（URL + 本地） ── */
  function bindCoverUpload(idx) {
    const coverEl = document.getElementById('mhwc-'  + idx);
    const fileEl  = document.getElementById('mhwcf-' + idx);
    if (!coverEl || !fileEl || coverEl._mhCoverBound) return;
    coverEl._mhCoverBound = true;

    coverEl.addEventListener('click', e => {
      e.stopPropagation();
      openUrlModal('更换封面图片', 'mhwcf-' + idx, (url) => {
        const imgEl = document.getElementById('mhwci-' + idx);
        const phEl  = document.getElementById('mhwcp-' + idx);
        if (imgEl) { imgEl.src = url; imgEl.classList.add('visible'); }
        if (phEl) phEl.style.display = 'none';
        mhData.works[idx].cover = url;
        mhSave(mhData);
      });
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
        if (imgEl) { imgEl.src = compressed; imgEl.classList.add('visible'); }
        if (phEl) phEl.style.display = 'none';
        mhData.works[idx].cover = compressed;
        mhSave(mhData);
      };
      reader.readAsDataURL(file);
      this.value = '';
    });
  }

  /* ── 作品条目导航 ── */
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
    const modal  = document.getElementById('mh-mask-modal');
    const listEl = document.getElementById('mh-mask-list');
    if (!modal || !listEl) return;

    const personas = lLoad('personas', []);
    listEl.innerHTML = '';

    if (!personas.length) {
      listEl.innerHTML = '<div style="font-size:13px;color:var(--text-light);text-align:center;padding:16px 0;">人设库为空，请先新建人设。</div>';
    } else {
      personas.forEach(p => {
        const item = document.createElement('div');
        item.className = 'mh-mask-item';

        const isActive = (mhData.name === p.name);
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
    if (persona.avatar) {
      const img = document.getElementById('mh-avatar-img');
      if (img) img.src = persona.avatar;
      mhData.avatar = persona.avatar;
    }
    const nameEl = document.getElementById('mh-name');
    if (nameEl) nameEl.textContent = persona.name || '';
    mhData.name = persona.name || '';

    const settingEl = document.getElementById('mh-setting-text');
    if (settingEl) settingEl.textContent = persona.setting || '';
    mhData.setting = persona.setting || '';

    updateMaskBtnLabel(mhData.name);
    mhSave(mhData);
    closeMaskModal();
  }

  /* ============================================================
     初始化入口
     ============================================================ */
  let _inited = false;

  window.initMyhomePanel = function () {
    if (!_inited) {
      initMyhome();
      _inited = true;
    } else {
      mhData = mhLoad();
      renderMyhome(mhData);
    }
  };

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      if (!_inited) { initMyhome(); _inited = true; }
    }, 300);
  });

})();
