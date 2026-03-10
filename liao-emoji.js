/* ============================================================
   liao-emoji.js — 表情包面板 / 导入 / 管理
   ============================================================ */

var liaoEmojis    = lLoad('emojis',    []);
var liaoEmojiCats = lLoad('emojiCats', ['默认']);

var emojiPanelOpen         = false;
var emojiCurrentCat        = 'all';
var emojiManageSelectedIds = [];
var emojiManageCurrentCat  = 'all';

/* ============================================================
   表情包面板
   ============================================================ */
function toggleEmojiPanel() {
  emojiPanelOpen = !emojiPanelOpen;
  const panel = document.getElementById('emoji-panel');
  panel.style.display = emojiPanelOpen ? 'flex' : 'none';
  document.getElementById('csb-emoji').classList.toggle('active', emojiPanelOpen);
  if (emojiPanelOpen) renderEmojiPanel();
}

function renderEmojiPanel() {
  const catList = document.getElementById('emoji-cat-list');
  catList.innerHTML = '';

  liaoEmojiCats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className   = 'emoji-sidebar-btn' + (emojiCurrentCat === cat ? ' active' : '');
    btn.textContent = cat;
    btn.addEventListener('click', () => {
      emojiCurrentCat = cat;
      document.querySelectorAll('#emoji-cat-list .emoji-sidebar-btn, .emoji-sidebar-btn[data-cat="all"]')
        .forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderEmojiGrid();
    });
    catList.appendChild(btn);
  });

  const allBtn = document.querySelector('.emoji-sidebar-btn[data-cat="all"]');
  if (allBtn) {
    allBtn.className = 'emoji-sidebar-btn' + (emojiCurrentCat === 'all' ? ' active' : '');
    const newAllBtn = allBtn.cloneNode(true);
    allBtn.parentNode.replaceChild(newAllBtn, allBtn);
    newAllBtn.addEventListener('click', () => {
      emojiCurrentCat = 'all';
      document.querySelectorAll('#emoji-cat-list .emoji-sidebar-btn')
        .forEach(b => b.classList.remove('active'));
      newAllBtn.classList.add('active');
      renderEmojiGrid();
    });
  }

  renderEmojiGrid();
}

function renderEmojiGrid() {
  const grid     = document.getElementById('emoji-panel-grid');
  grid.innerHTML = '';
  const filtered = emojiCurrentCat === 'all'
    ? liaoEmojis
    : liaoEmojis.filter(e => e.cat === emojiCurrentCat);

  if (!filtered.length) {
    const empty = document.createElement('div');
    empty.style.cssText = 'grid-column:1/-1;text-align:center;padding:20px;font-size:12px;color:var(--text-light);';
    empty.textContent   = '还没有表情包，点击导入吧';
    grid.appendChild(empty);
    return;
  }

  filtered.forEach(emoji => {
    const wrap = document.createElement('div');
    wrap.className = 'emoji-grid-wrap';
    wrap.addEventListener('click', () => sendEmojiMsg(emoji));

    const img     = document.createElement('img');
    img.className = 'emoji-grid-item';
    img.src       = emoji.url;
    img.alt       = emoji.name || '';
    img.title     = emoji.name || '';
    img.loading   = 'lazy';

    const nameP       = document.createElement('p');
    nameP.className   = 'emoji-grid-name';
    nameP.textContent = emoji.name || '';

    wrap.appendChild(img);
    wrap.appendChild(nameP);
    grid.appendChild(wrap);
  });
}

function sendEmojiMsg(emoji) {
  if (currentChatIdx < 0) return;
  const chat     = liaoChats[currentChatIdx];
  const role     = liaoRoles.find(r => r.id === chat.roleId);
  const uAvt     = chat.chatUserAvatar || liaoUserAvatar;
  const userName = chat.chatUserName || liaoUserName;

  const content = `[(${userName})发送了一个表情包：${emoji.name || '表情包'}]`;
  const msgObj  = {
    role: 'user', type: 'text', content,
    ts: Date.now(),
    id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2)
  };
  chat.messages.push(msgObj);
  lSave('chats', liaoChats);

  currentQuoteMsgIdx = -1;
  const qb = document.getElementById('chat-quote-bar');
  if (qb) qb.style.display = 'none';

  appendMessageBubble(msgObj, role, uAvt, true);

  emojiPanelOpen = false;
  document.getElementById('emoji-panel').style.display = 'none';
  document.getElementById('csb-emoji').classList.remove('active');
}

/* ---------- 表情包导入/管理按钮 ---------- */
document.getElementById('emoji-import-btn').addEventListener('click', () => {
  emojiPanelOpen = false;
  document.getElementById('emoji-panel').style.display = 'none';
  document.getElementById('csb-emoji').classList.remove('active');
  openEmojiImportModal();
});

document.getElementById('emoji-manage-btn').addEventListener('click', () => {
  emojiPanelOpen = false;
  document.getElementById('emoji-panel').style.display = 'none';
  document.getElementById('csb-emoji').classList.remove('active');
  openEmojiManageModal();
});

/* ============================================================
   表情包导入弹窗
   ============================================================ */
function openEmojiImportModal() {
  const wrap = document.getElementById('liao-emoji-import-cat-wrap');
  wrap.innerHTML = '';
  liaoEmojiCats.forEach(cat => {
    const btn = document.createElement('button');
    btn.className   = 'emoji-cat-tag';
    btn.textContent = cat;
    btn.addEventListener('click', () => {
      wrap.querySelectorAll('.emoji-cat-tag').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
    wrap.appendChild(btn);
  });
  document.getElementById('liao-emoji-batch-input').value    = '';
  document.getElementById('liao-emoji-import-new-cat').value = '';
  document.getElementById('liao-emoji-import-modal').style.display = 'flex';
}

document.getElementById('liao-emoji-import-confirm').addEventListener('click', () => {
  const batchText  = document.getElementById('liao-emoji-batch-input').value.trim();
  const newCatName = document.getElementById('liao-emoji-import-new-cat').value.trim();
  const wrap       = document.getElementById('liao-emoji-import-cat-wrap');
  const activeTag  = wrap.querySelector('.emoji-cat-tag.active');
  let targetCat    = activeTag ? activeTag.textContent : (newCatName || '默认');

  if (newCatName && !liaoEmojiCats.includes(newCatName)) {
    liaoEmojiCats.push(newCatName);
    lSave('emojiCats', liaoEmojiCats);
    targetCat = newCatName;
  }

  let imported = 0;
  if (batchText) {
    batchText.split('\n').map(l => l.trim()).filter(l => l).forEach(line => {
      const match = line.match(/^(.+?)[：:](https?:\/\/.+)$/);
      if (match) {
        liaoEmojis.push({
          id:   'emoji_' + Date.now() + '_' + Math.random().toString(36).slice(2),
          name: match[1].trim(),
          url:  match[2].trim(),
          cat:  targetCat
        });
        imported++;
      }
    });
  }

  lSave('emojis', liaoEmojis);
  document.getElementById('liao-emoji-import-modal').style.display = 'none';
  if (imported > 0) alert(`成功导入 ${imported} 个表情包`);
});

document.getElementById('liao-emoji-import-cancel').addEventListener('click', () => {
  document.getElementById('liao-emoji-import-modal').style.display = 'none';
});

document.getElementById('liao-emoji-local-btn').addEventListener('click', () => {
  document.getElementById('liao-emoji-local-file').click();
});

document.getElementById('liao-emoji-local-file').addEventListener('change', function () {
  const files = Array.from(this.files);
  if (!files.length) return;
  const wrap       = document.getElementById('liao-emoji-import-cat-wrap');
  const activeTag  = wrap.querySelector('.emoji-cat-tag.active');
  const newCatName = document.getElementById('liao-emoji-import-new-cat').value.trim();
  let targetCat    = activeTag ? activeTag.textContent : (newCatName || '默认');

  if (newCatName && !liaoEmojiCats.includes(newCatName)) {
    liaoEmojiCats.push(newCatName);
    lSave('emojiCats', liaoEmojiCats);
    targetCat = newCatName;
  }

  let done = 0;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = e => {
      liaoEmojis.push({
        id:   'emoji_' + Date.now() + '_' + Math.random().toString(36).slice(2),
        name: file.name.replace(/\.[^.]+$/, ''),
        url:  e.target.result,
        cat:  targetCat
      });
      done++;
      if (done === files.length) {
        lSave('emojis', liaoEmojis);
        alert(`成功导入 ${done} 个本地表情包`);
        document.getElementById('liao-emoji-import-modal').style.display = 'none';
      }
    };
    reader.readAsDataURL(file);
  });
  this.value = '';
});

/* ============================================================
   表情包管理弹窗
   ============================================================ */
function openEmojiManageModal() {
  emojiManageSelectedIds = [];
  emojiManageCurrentCat  = 'all';
  renderEmojiManageModal();
  document.getElementById('liao-emoji-manage-modal').style.display = 'flex';
}

function renderEmojiManageModal() {
  const catsEl     = document.getElementById('liao-emoji-manage-cats');
  catsEl.innerHTML = '';

  const allTag = document.createElement('button');
  allTag.className   = 'emoji-cat-tag' + (emojiManageCurrentCat === 'all' ? ' active' : '');
  allTag.textContent = '全部';
  allTag.addEventListener('click', () => { emojiManageCurrentCat = 'all'; renderEmojiManageModal(); });
  catsEl.appendChild(allTag);

  liaoEmojiCats.forEach(cat => {
    const tag = document.createElement('button');
    tag.className   = 'emoji-cat-tag' + (emojiManageCurrentCat === cat ? ' active' : '');
    tag.textContent = cat;
    tag.addEventListener('click', () => { emojiManageCurrentCat = cat; renderEmojiManageModal(); });
    catsEl.appendChild(tag);
  });

  const grid     = document.getElementById('liao-emoji-manage-grid');
  grid.innerHTML = '';
  const filtered = emojiManageCurrentCat === 'all'
    ? liaoEmojis
    : liaoEmojis.filter(e => e.cat === emojiManageCurrentCat);

  filtered.forEach(emoji => {
    const item = document.createElement('div');
    item.className = 'emoji-manage-item' + (emojiManageSelectedIds.includes(emoji.id) ? ' selected' : '');

    const img       = document.createElement('img');
    img.src         = emoji.url;
    img.alt         = emoji.name || '';
    img.loading     = 'lazy';

    const nameP       = document.createElement('p');
    nameP.className   = 'emoji-manage-name';
    nameP.textContent = emoji.name || '';

    const check       = document.createElement('span');
    check.className   = 'emoji-manage-check';
    check.textContent = '√';

    item.appendChild(img);
    item.appendChild(nameP);
    item.appendChild(check);

    item.addEventListener('click', () => {
      const idx = emojiManageSelectedIds.indexOf(emoji.id);
      if (idx >= 0) emojiManageSelectedIds.splice(idx, 1);
      else emojiManageSelectedIds.push(emoji.id);
      item.classList.toggle('selected', emojiManageSelectedIds.includes(emoji.id));
    });
    grid.appendChild(item);
  });
}

document.getElementById('liao-emoji-manage-delete').addEventListener('click', () => {
  if (!emojiManageSelectedIds.length) { alert('请先选择要删除的表情包'); return; }
  liaoEmojis = liaoEmojis.filter(e => !emojiManageSelectedIds.includes(e.id));
  emojiManageSelectedIds = [];
  lSave('emojis', liaoEmojis);
  renderEmojiManageModal();
});

document.getElementById('liao-emoji-manage-move').addEventListener('click', () => {
  if (!emojiManageSelectedIds.length) { alert('请先选择表情包'); return; }
  const catName = prompt('移动到哪个分类？（输入已有分类名或新建名称）');
  if (!catName) return;
  if (!liaoEmojiCats.includes(catName)) {
    liaoEmojiCats.push(catName);
    lSave('emojiCats', liaoEmojiCats);
  }
  liaoEmojis.forEach(e => {
    if (emojiManageSelectedIds.includes(e.id)) e.cat = catName;
  });
  emojiManageSelectedIds = [];
  lSave('emojis', liaoEmojis);
  renderEmojiManageModal();
});

document.getElementById('liao-emoji-manage-export').addEventListener('click', () => {
  const toExport = emojiManageSelectedIds.length
    ? liaoEmojis.filter(e => emojiManageSelectedIds.includes(e.id))
    : liaoEmojis;
  const lines = toExport.filter(e => e.url.startsWith('http')).map(e => `${e.name}:${e.url}`);
  if (!lines.length) { alert('没有可导出的网络图片链接'); return; }
  const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'emoji-export.txt';
  a.click();
});

document.getElementById('liao-emoji-manage-close').addEventListener('click', () => {
  document.getElementById('liao-emoji-manage-modal').style.display = 'none';
});
