/* ============================================================
   liao-suiyan.js — 随言
   ============================================================ */

function renderSuiyan() {
  const header = document.getElementById('suiyan-header');
  if (liaoBgSrc) header.style.backgroundImage = `url(${liaoBgSrc})`;
  else header.style.backgroundImage = '';

  document.getElementById('suiyan-user-avatar').src       = liaoUserAvatar;
  document.getElementById('suiyan-user-name').textContent = liaoUserName;

  const list = document.getElementById('suiyan-list');
  list.innerHTML = '';

  if (!liaoSuiyan.length) {
    list.innerHTML = `<div style="text-align:center;padding:30px 20px;color:var(--text-light);font-size:13px;">还没有随言，点击右上角 + 发布第一条吧</div>`;
    return;
  }

  [...liaoSuiyan].reverse().forEach((post, revIdx) => {
    const realIdx = liaoSuiyan.length - 1 - revIdx;
    list.appendChild(buildSuiyanItem(post, realIdx));
  });
}

function buildSuiyanItem(post, idx) {
  const div = document.createElement('div');
  div.className = 'suiyan-item';
  const likedByUser = post.likedBy && post.likedBy.includes('user');

  let commentsHtml = '';
  if (post.comments && post.comments.length) {
    const rows = post.comments.map(c =>
      `<div class="suiyan-comment-item"><span class="suiyan-comment-author">${escHtml(c.author)}：</span>${escHtml(c.text)}</div>`
    ).join('');
    commentsHtml = `<div class="suiyan-comments">${rows}</div>`;
  }

  // 媒体内容（图片等）
  let mediaHtml = '';
  if (post.imageUrl) {
    mediaHtml = `<img src="${escHtml(post.imageUrl)}" style="width:100%;max-height:200px;object-fit:cover;border-radius:10px;margin-bottom:8px;" alt="">`;
  }

  div.innerHTML = `
    <div class="suiyan-item-header">
      <img class="suiyan-item-avatar" src="${escHtml(post.avatar || defaultAvatar())}" alt="">
      <div class="suiyan-item-meta">
        <div class="suiyan-item-name">${escHtml(post.author)}</div>
        <div class="suiyan-item-time">${formatTime(post.ts)}</div>
      </div>
    </div>
    ${mediaHtml}
    <div class="suiyan-item-content">${escHtml(post.content)}</div>
    <div class="suiyan-actions">
      <button class="suiyan-action-btn like-btn ${likedByUser ? 'liked' : ''}" data-idx="${idx}">
        <span class="action-icon">${likedByUser ? '♥' : '♡'}</span>
        <span class="like-count">${post.likes || 0}</span>
      </button>
      <button class="suiyan-action-btn comment-btn" data-idx="${idx}">
        <span class="action-icon">○</span>
        <span>${post.comments ? post.comments.length : 0}</span>
      </button>
    </div>
    ${commentsHtml}`;

  div.querySelector('.like-btn').addEventListener('click', function () {
    const i = parseInt(this.dataset.idx);
    if (!liaoSuiyan[i].likedBy) liaoSuiyan[i].likedBy = [];
    const pos = liaoSuiyan[i].likedBy.indexOf('user');
    if (pos >= 0) {
      liaoSuiyan[i].likedBy.splice(pos, 1);
      liaoSuiyan[i].likes = Math.max(0, (liaoSuiyan[i].likes || 1) - 1);
    } else {
      liaoSuiyan[i].likedBy.push('user');
      liaoSuiyan[i].likes = (liaoSuiyan[i].likes || 0) + 1;
    }
    lSave('suiyan', liaoSuiyan);
    renderSuiyan();
    // 用户点赞后，角色有概率互动
    if (typeof scheduleRoleInteractSuiyan === 'function') scheduleRoleInteractSuiyan();
  });

  div.querySelector('.comment-btn').addEventListener('click', function () {
    openCommentModal(parseInt(this.dataset.idx));
  });

  return div;
}

/* ---------- 头像点击 ---------- */
document.getElementById('suiyan-user-avatar').addEventListener('click', openSuiyanAvatarModal);
document.getElementById('suiyan-user-name').addEventListener('click', openSuiyanNameModal);
document.getElementById('suiyan-bg-btn').addEventListener('click', () => {
  document.getElementById('liao-suiyan-bg-url').value = liaoBgSrc || '';
  document.getElementById('liao-suiyan-bg-modal').style.display = 'flex';
});

/* ---------- 头像弹窗 ---------- */
function openSuiyanAvatarModal() {
  document.getElementById('liao-suiyan-avatar-url-input').value = liaoUserAvatar || '';
  document.getElementById('liao-suiyan-avatar-modal').style.display = 'flex';
}

document.getElementById('liao-suiyan-avatar-confirm').addEventListener('click', () => {
  const url = document.getElementById('liao-suiyan-avatar-url-input').value.trim();
  if (url) {
    liaoUserAvatar = url;
    lSave('userAvatar', liaoUserAvatar);
    renderSuiyan();
  }
  document.getElementById('liao-suiyan-avatar-modal').style.display = 'none';
});

document.getElementById('liao-suiyan-avatar-local').addEventListener('click', () => {
  document.getElementById('liao-suiyan-avatar-file').click();
});

document.getElementById('liao-suiyan-avatar-file').addEventListener('change', function () {
  const file = this.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    liaoUserAvatar = e.target.result;
    lSave('userAvatar', liaoUserAvatar);
    document.getElementById('liao-suiyan-avatar-modal').style.display = 'none';
    renderSuiyan();
  };
  reader.readAsDataURL(file);
  this.value = '';
});

document.getElementById('liao-suiyan-avatar-cancel').addEventListener('click', () => {
  document.getElementById('liao-suiyan-avatar-modal').style.display = 'none';
});

/* ---------- 用户名弹窗 ---------- */
function openSuiyanNameModal() {
  document.getElementById('liao-suiyan-name-input').value = liaoUserName;
  document.getElementById('liao-suiyan-name-modal').style.display = 'flex';
}

document.getElementById('liao-suiyan-name-confirm').addEventListener('click', () => {
  const name = document.getElementById('liao-suiyan-name-input').value.trim();
  if (name) {
    liaoUserName = name;
    lSave('userName', liaoUserName);
    renderSuiyan();
  }
  document.getElementById('liao-suiyan-name-modal').style.display = 'none';
});

document.getElementById('liao-suiyan-name-cancel').addEventListener('click', () => {
  document.getElementById('liao-suiyan-name-modal').style.display = 'none';
});

/* ---------- 背景图 ---------- */
document.getElementById('liao-suiyan-bg-confirm').addEventListener('click', () => {
  const url = document.getElementById('liao-suiyan-bg-url').value.trim();
  liaoBgSrc = url;
  lSave('suiyanBg', url);
  document.getElementById('liao-suiyan-bg-modal').style.display = 'none';
  renderSuiyan();
});

document.getElementById('liao-suiyan-bg-local').addEventListener('click', () => {
  document.getElementById('liao-suiyan-bg-file').click();
});

document.getElementById('liao-suiyan-bg-file').addEventListener('change', function () {
  const file = this.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    liaoBgSrc = e.target.result;
    lSave('suiyanBg', liaoBgSrc);
    document.getElementById('liao-suiyan-bg-modal').style.display = 'none';
    renderSuiyan();
  };
  reader.readAsDataURL(file);
  this.value = '';
});

document.getElementById('liao-suiyan-bg-cancel').addEventListener('click', () => {
  document.getElementById('liao-suiyan-bg-modal').style.display = 'none';
});

/* ---------- 发随言 ---------- */
document.getElementById('suiyan-post-btn').addEventListener('click', () => {
  document.getElementById('liao-post-content').value = '';
  document.getElementById('liao-post-modal').classList.add('show');
});

document.getElementById('liao-post-confirm').addEventListener('click', () => {
  const content = document.getElementById('liao-post-content').value.trim();
  if (!content) return;
  liaoSuiyan.push({
    author:  liaoUserName,
    avatar:  liaoUserAvatar,
    content,
    ts:      Date.now(),
    likes:   0,
    likedBy: [],
    comments:[],
    isUser:  true
  });
  lSave('suiyan', liaoSuiyan);
  document.getElementById('liao-post-modal').classList.remove('show');
  renderSuiyan();
  // 发完随言后，角色有概率互动
  if (typeof scheduleRoleInteractSuiyan === 'function') {
    setTimeout(scheduleRoleInteractSuiyan, 1500);
  }
});

document.getElementById('liao-post-cancel').addEventListener('click', () => {
  document.getElementById('liao-post-modal').classList.remove('show');
});

/* ---------- 评论弹窗 ---------- */
let commentTargetIdx = -1;

function openCommentModal(idx) {
  commentTargetIdx = idx;
  const post   = liaoSuiyan[idx];
  const listEl = document.getElementById('liao-comment-list');
  listEl.innerHTML = '';

  if (post.comments && post.comments.length) {
    post.comments.forEach(c => {
      const row = document.createElement('div');
      row.className = 'liao-comment-row';
      row.innerHTML = `<span class="comment-name">${escHtml(c.author)}：</span>${escHtml(c.text)}`;
      listEl.appendChild(row);
    });
  } else {
    listEl.innerHTML = '<div style="font-size:12px;color:var(--text-light);padding:4px 0;">暂无评论</div>';
  }

  document.getElementById('liao-comment-input').value = '';
  document.getElementById('liao-comment-modal').classList.add('show');
}

document.getElementById('liao-comment-confirm').addEventListener('click', () => {
  const text = document.getElementById('liao-comment-input').value.trim();
  if (!text || commentTargetIdx < 0) return;
  if (!liaoSuiyan[commentTargetIdx].comments) liaoSuiyan[commentTargetIdx].comments = [];
  liaoSuiyan[commentTargetIdx].comments.push({ author: liaoUserName, text });
  lSave('suiyan', liaoSuiyan);
  document.getElementById('liao-comment-modal').classList.remove('show');
  renderSuiyan();
});

document.getElementById('liao-comment-cancel').addEventListener('click', () => {
  document.getElementById('liao-comment-modal').classList.remove('show');
});
