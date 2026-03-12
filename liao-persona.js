/* ============================================================
   liao-persona.js — 我的人设库
   ============================================================ */

let liaoPersonas    = lLoad('personas', []);
let editingPersonaIdx = -1;
let personaAvatarSrc  = '';

/* ---------- 入口（兼容旧版按钮，不报错）---------- */
const _menuPersonaLib = document.getElementById('menu-persona-lib');
if (_menuPersonaLib) _menuPersonaLib.addEventListener('click', openPersonaLib);

function openPersonaLib() {
  renderPersonaLib();
  const view = document.getElementById('liao-persona-lib-view');
  if (view) {
    view.style.display = 'flex';
    view.style.flexDirection = 'column';
  }
}

document.getElementById('persona-lib-back').addEventListener('click', () => {
  const view = document.getElementById('liao-persona-lib-view');
  if (view) view.style.display = 'none';
});

/* ---------- 渲染 ---------- */
function renderPersonaLib() {
  const list = document.getElementById('persona-lib-list');
  list.innerHTML = '';

  if (!liaoPersonas.length) {
    list.innerHTML = '<div style="text-align:center;padding:30px;font-size:13px;color:var(--text-light);">还没有人设，点击右上角新建吧</div>';
    return;
  }

  liaoPersonas.forEach((p, idx) => {
    const card = document.createElement('div');
    card.className = 'persona-card';
    card.innerHTML = `
      <img class="persona-card-avatar" src="${escHtml(p.avatar || defaultAvatar())}" alt="">
      <div class="persona-card-info">
        <div class="persona-card-name">${escHtml(p.name)}</div>
        <div class="persona-card-setting">${escHtml((p.setting || '').slice(0, 50))}${(p.setting || '').length > 50 ? '…' : ''}</div>
      </div>
      <div class="persona-card-actions">
        <button class="persona-card-btn edit-btn" data-idx="${idx}">编辑</button>
        <button class="persona-card-btn danger del-btn" data-idx="${idx}">删除</button>
      </div>`;

    card.querySelector('.edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      openPersonaEdit(idx);
    });
    card.querySelector('.del-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`确定删除人设「${p.name}」？`)) {
        liaoPersonas.splice(idx, 1);
        lSave('personas', liaoPersonas);
        renderPersonaLib();
      }
    });

    list.appendChild(card);
  });
}

/* ---------- 新建 ---------- */
document.getElementById('persona-lib-add-btn').addEventListener('click', () => {
  openPersonaEdit(-1);
});

/* ---------- 编辑弹窗 ---------- */
function openPersonaEdit(idx) {
  editingPersonaIdx = idx;
  personaAvatarSrc  = '';

  if (idx >= 0 && liaoPersonas[idx]) {
    const p = liaoPersonas[idx];
    document.getElementById('persona-edit-title').textContent  = '编辑人设';
    document.getElementById('persona-edit-avatar-preview').src = p.avatar || defaultAvatar();
    document.getElementById('persona-edit-avatar-url').value   = '';
    document.getElementById('persona-edit-name').value         = p.name    || '';
    document.getElementById('persona-edit-setting').value      = p.setting || '';
    personaAvatarSrc = p.avatar || '';
  } else {
    document.getElementById('persona-edit-title').textContent  = '新建人设';
    document.getElementById('persona-edit-avatar-preview').src = defaultAvatar();
    document.getElementById('persona-edit-avatar-url').value   = '';
    document.getElementById('persona-edit-name').value         = '';
    document.getElementById('persona-edit-setting').value      = '';
  }

  document.getElementById('liao-persona-edit-modal').style.display = 'flex';
}

document.getElementById('persona-edit-avatar-url').addEventListener('input', function () {
  const url = this.value.trim();
  if (url) {
    personaAvatarSrc = url;
    document.getElementById('persona-edit-avatar-preview').src = url;
  }
});

document.getElementById('persona-edit-avatar-local').addEventListener('click', () => {
  document.getElementById('persona-edit-avatar-file').click();
});

document.getElementById('persona-edit-avatar-file').addEventListener('change', function () {
  const file = this.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    personaAvatarSrc = e.target.result;
    document.getElementById('persona-edit-avatar-preview').src = personaAvatarSrc;
  };
  reader.readAsDataURL(file);
  this.value = '';
});

document.getElementById('persona-edit-confirm').addEventListener('click', () => {
  const name    = document.getElementById('persona-edit-name').value.trim();
  const setting = document.getElementById('persona-edit-setting').value.trim();
  if (!name) { alert('请填写名字'); return; }

  const personaObj = {
    id:      editingPersonaIdx >= 0 ? liaoPersonas[editingPersonaIdx].id : ('persona_' + Date.now()),
    name,
    setting,
    avatar:  personaAvatarSrc || defaultAvatar()
  };

  if (editingPersonaIdx >= 0) {
    liaoPersonas[editingPersonaIdx] = personaObj;
  } else {
    liaoPersonas.push(personaObj);
  }

  lSave('personas', liaoPersonas);
  document.getElementById('liao-persona-edit-modal').style.display = 'none';
  renderPersonaLib();
});

document.getElementById('persona-edit-cancel').addEventListener('click', () => {
  document.getElementById('liao-persona-edit-modal').style.display = 'none';
});
