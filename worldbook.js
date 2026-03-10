/* ============================================================
   worldbook.js — 世界书 App 逻辑
   数据存储键：liao_worldbook（含 categories 和 entries）
   ============================================================ */

var wbData = wbLoad();

function wbLoad() {
  try {
    const raw = localStorage.getItem('liao_worldbook');
    if (raw) return JSON.parse(raw);
  } catch(e) {}
  return { categories: ['默认'], entries: [] };
}

function wbSave() {
  try {
    localStorage.setItem('liao_worldbook', JSON.stringify(wbData));
  } catch(e) {}
}

/* ============================================================
   打开 / 关闭世界书
   ============================================================ */
function openWorldBook() {
  document.getElementById('worldbook-app').style.display = 'flex';
  wbData = wbLoad();
  wbRenderBody();
}

function closeWorldBook() {
  document.getElementById('worldbook-app').style.display = 'none';
}

/* ============================================================
   主体列表渲染
   ============================================================ */
function wbRenderBody() {
  const body = document.getElementById('wb-body');
  body.innerHTML = '';

  if (!wbData.categories.length) {
    body.innerHTML = '<div class="wb-empty">还没有分类<br>点击顶部「新建分类」开始</div>';
    return;
  }

  wbData.categories.forEach(cat => {
    const entries = wbData.entries.filter(e => e.cat === cat);
    const block   = document.createElement('div');
    block.className = 'wb-cat-block';

    const header = document.createElement('div');
    header.className = 'wb-cat-header';
    header.innerHTML = `
      <span class="wb-cat-arrow open">&#9658;</span>
      <span class="wb-cat-name">${wbEsc(cat)}</span>
      <span class="wb-cat-count">${entries.length} 条</span>`;

    const entryWrap = document.createElement('div');
    entryWrap.className = 'wb-cat-entries open';

    header.addEventListener('click', () => {
      const arrow = header.querySelector('.wb-cat-arrow');
      entryWrap.classList.toggle('open');
      arrow.classList.toggle('open');
    });

    entries.forEach(entry => {
      entryWrap.appendChild(wbBuildEntryRow(entry));
    });

    block.appendChild(header);
    block.appendChild(entryWrap);
    body.appendChild(block);
  });

  /* 未分类条目（分类已被删除） */
  const orphans = wbData.entries.filter(e => !wbData.categories.includes(e.cat));
  if (orphans.length) {
    const block = document.createElement('div');
    block.className = 'wb-cat-block';

    const orphanHeader = document.createElement('div');
    orphanHeader.className = 'wb-cat-header';
    orphanHeader.innerHTML = `
      <span class="wb-cat-arrow open">&#9658;</span>
      <span class="wb-cat-name" style="color:#e07a7a;">未分类</span>
      <span class="wb-cat-count">${orphans.length} 条</span>`;

    const entryWrap = document.createElement('div');
    entryWrap.className = 'wb-cat-entries open';

    orphanHeader.addEventListener('click', () => {
      entryWrap.classList.toggle('open');
      orphanHeader.querySelector('.wb-cat-arrow').classList.toggle('open');
    });

    orphans.forEach(entry => entryWrap.appendChild(wbBuildEntryRow(entry)));
    block.appendChild(orphanHeader);
    block.appendChild(entryWrap);
    body.appendChild(block);
  }

  if (!wbData.entries.length && wbData.categories.length) {
    const hint = document.createElement('div');
    hint.className = 'wb-empty';
    hint.style.marginTop = '20px';
    hint.textContent = '点击顶部「新建条目」添加世界书内容';
    body.appendChild(hint);
  }
}

function wbBuildEntryRow(entry) {
  const row = document.createElement('div');
  row.className = 'wb-entry-row' + (entry.enabled ? '' : ' disabled');
  row.dataset.entryId = entry.id;

  const kwText = entry.keywords && entry.keywords.length
    ? '触发词：' + entry.keywords.join('、')
    : '默认注入';
  const roleText = entry.bindRoles && entry.bindRoles.length
    ? '绑定' + entry.bindRoles.length + '个角色'
    : '全角色';

  row.innerHTML = `
    <div class="wb-entry-info">
      <div class="wb-entry-title">${wbEsc(entry.name)}</div>
      <div class="wb-entry-meta">${wbEsc(kwText)} · ${wbEsc(roleText)}</div>
    </div>
    <div class="wb-entry-actions">
      <label class="wb-toggle-wrap" title="启用/禁用">
        <input type="checkbox" class="wb-entry-toggle" ${entry.enabled ? 'checked' : ''}>
        <span class="wb-toggle-slider"></span>
      </label>
      <button class="wb-entry-btn wb-edit-btn">编辑</button>
      <button class="wb-entry-btn danger wb-del-btn">删除</button>
    </div>`;

  row.querySelector('.wb-entry-toggle').addEventListener('change', function() {
    entry.enabled = this.checked;
    row.classList.toggle('disabled', !entry.enabled);
    wbSave();
  });

  row.querySelector('.wb-edit-btn').addEventListener('click', () => {
    wbOpenEntryModal(entry);
  });

  row.querySelector('.wb-del-btn').addEventListener('click', () => {
    if (!confirm('确定删除条目「' + entry.name + '」？')) return;
    wbData.entries = wbData.entries.filter(e => e.id !== entry.id);
    wbSave();
    wbRenderBody();
  });

  return row;
}

/* ============================================================
   新建 / 编辑条目弹窗
   ============================================================ */
var wbEditingEntryId = null;

function wbOpenEntryModal(entry) {
  wbEditingEntryId = entry ? entry.id : null;
  const modal = document.getElementById('wb-entry-modal');
  document.getElementById('wb-entry-modal-title').textContent =
    entry ? '编辑世界书条目' : '新建世界书条目';

  /* 填充分类下拉 */
  const catSel = document.getElementById('wb-entry-cat');
  catSel.innerHTML = '';
  wbData.categories.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat;
    opt.textContent = cat;
    if (entry && entry.cat === cat) opt.selected = true;
    catSel.appendChild(opt);
  });

  /* 填充角色列表 */
  const roleList = document.getElementById('wb-entry-role-list');
  roleList.innerHTML = '';
  const allRoles = (typeof liaoRoles !== 'undefined') ? liaoRoles : [];
  allRoles.forEach(role => {
    const item = document.createElement('div');
    const isChecked = entry && entry.bindRoles && entry.bindRoles.includes(role.id);
    item.className = 'wb-role-check-item' + (isChecked ? ' checked' : '');
    item.dataset.roleId = role.id;
    item.textContent = role.nickname || role.realname || role.id;
    item.addEventListener('click', () => item.classList.toggle('checked'));
    roleList.appendChild(item);
  });

  /* 填充表单 */
  document.getElementById('wb-entry-name').value =
    entry ? entry.name : '';
  document.getElementById('wb-entry-content').value =
    entry ? entry.content : '';
  document.getElementById('wb-entry-keywords').value =
    entry && entry.keywords && entry.keywords.length ? entry.keywords.join('，') : '';
  document.getElementById('wb-entry-enabled').checked =
    entry ? !!entry.enabled : true;

  modal.style.display = 'flex';
}

document.getElementById('wb-entry-confirm').addEventListener('click', () => {
  const name    = document.getElementById('wb-entry-name').value.trim();
  const cat     = document.getElementById('wb-entry-cat').value;
  const content = document.getElementById('wb-entry-content').value.trim();
  const kwRaw   = document.getElementById('wb-entry-keywords').value.trim();
  const enabled = document.getElementById('wb-entry-enabled').checked;

  if (!name || !cat || !content) {
    alert('请填写条目名称、分类和内容');
    return;
  }

  const keywords = kwRaw
    ? kwRaw.split(/[，,]/).map(s => s.trim()).filter(Boolean)
    : [];

  const checkedRoleEls = document.querySelectorAll('#wb-entry-role-list .wb-role-check-item.checked');
  const bindRoles = Array.from(checkedRoleEls).map(el => el.dataset.roleId);

  if (wbEditingEntryId) {
    const entry = wbData.entries.find(e => e.id === wbEditingEntryId);
    if (entry) {
      entry.name      = name;
      entry.cat       = cat;
      entry.content   = content;
      entry.keywords  = keywords;
      entry.bindRoles = bindRoles;
      entry.enabled   = enabled;
    }
  } else {
    wbData.entries.push({
      id:        'wb_' + Date.now() + '_' + Math.random().toString(36).slice(2),
      name, cat, content, keywords, bindRoles,
      enabled
    });
  }

  wbSave();
  wbRenderBody();
  document.getElementById('wb-entry-modal').style.display = 'none';
  wbEditingEntryId = null;
});

document.getElementById('wb-entry-cancel').addEventListener('click', () => {
  document.getElementById('wb-entry-modal').style.display = 'none';
  wbEditingEntryId = null;
});

/* ============================================================
   新建分类弹窗
   ============================================================ */
document.getElementById('wb-new-cat-btn').addEventListener('click', () => {
  document.getElementById('wb-cat-name').value = '';
  document.getElementById('wb-cat-modal').style.display = 'flex';
});

document.getElementById('wb-cat-confirm').addEventListener('click', () => {
  const name = document.getElementById('wb-cat-name').value.trim();
  if (!name) { alert('请输入分类名称'); return; }
  if (wbData.categories.includes(name)) { alert('分类名称已存在'); return; }
  wbData.categories.push(name);
  wbSave();
  wbRenderBody();
  document.getElementById('wb-cat-modal').style.display = 'none';
});

document.getElementById('wb-cat-cancel').addEventListener('click', () => {
  document.getElementById('wb-cat-modal').style.display = 'none';
});

/* ============================================================
   新建条目按钮
   ============================================================ */
document.getElementById('wb-new-entry-btn').addEventListener('click', () => {
  if (!wbData.categories.length) {
    alert('请先新建一个分类');
    return;
  }
  wbOpenEntryModal(null);
});

/* ============================================================
   管理弹窗（分类管理）
   ============================================================ */
document.getElementById('wb-manage-btn').addEventListener('click', () => {
  wbRenderManageModal();
  document.getElementById('wb-manage-modal').style.display = 'flex';
});

function wbRenderManageModal() {
  const list = document.getElementById('wb-manage-cat-list');
  list.innerHTML = '';
  if (!wbData.categories.length) {
    list.innerHTML = '<div style="font-size:13px;color:var(--text-light);padding:8px;">暂无分类</div>';
    return;
  }
  wbData.categories.forEach(cat => {
    const row = document.createElement('div');
    row.className = 'wb-manage-cat-row';
    const count = wbData.entries.filter(e => e.cat === cat).length;
    row.innerHTML = `
      <span class="wb-manage-cat-row-name">${wbEsc(cat)}</span>
      <span style="font-size:11px;color:var(--text-light);">${count} 条</span>
      <button class="wb-manage-cat-del" data-cat="${wbEsc(cat)}">删除</button>`;
    row.querySelector('.wb-manage-cat-del').addEventListener('click', function() {
      const catName = this.dataset.cat;
      if (!confirm('删除分类「' + catName + '」？该分类下的条目将变为未分类状态。')) return;
      wbData.categories = wbData.categories.filter(c => c !== catName);
      wbSave();
      wbRenderBody();
      wbRenderManageModal();
    });
    list.appendChild(row);
  });
}

/* 修复Bug：原代码此处缺少箭头符号 => 导致语法错误整个文件崩溃 */
document.getElementById('wb-manage-close').addEventListener('click', () => {
  document.getElementById('wb-manage-modal').style.display = 'none';
});

/* ============================================================
   返回按钮
   ============================================================ */
document.getElementById('wb-back-btn').addEventListener('click', () => {
  closeWorldBook();
});

/* ============================================================
   弹窗遮罩点击关闭
   ============================================================ */
['wb-entry-modal', 'wb-cat-modal', 'wb-manage-modal'].forEach(id => {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('click', function(e) {
      if (e.target === this) this.style.display = 'none';
    });
  }
});

/* ============================================================
   工具函数
   ============================================================ */
function wbEsc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/* ============================================================
   世界书注入函数（供 liao-special.js 调用）
   ============================================================ */
function getWorldBookInjection(chatMessages, roleId) {
  const data = wbLoad();
  if (!data.entries || !data.entries.length) return '';

  const recentMsgs = chatMessages
    .filter(m => !m.hidden)
    .slice(-20)
    .map(m => m.content || '')
    .join('\n');

  const injected = [];

  data.entries.forEach(entry => {
    if (!entry.enabled) return;

    if (entry.bindRoles && entry.bindRoles.length > 0) {
      if (!entry.bindRoles.includes(roleId)) return;
    }

    if (entry.keywords && entry.keywords.length > 0) {
      const hit = entry.keywords.some(kw => kw && recentMsgs.includes(kw));
      if (!hit) return;
    }

    injected.push('【世界书·' + entry.name + '】\n' + entry.content);
  });

  return injected.join('\n\n');
}
