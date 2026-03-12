/* ============================================================
   liao-favorites.js — 收藏夹
   ============================================================ */

let liaoFavorites = lLoad('favorites', []);
// 格式: { id, roleId, roleName, roleAvatar, content, ts, group }

/* ---------- 添加收藏 ---------- */
function addFavorite(item) {
  liaoFavorites.push({
    id:          'fav_' + Date.now() + '_' + Math.random().toString(36).slice(2),
    roleId:      item.roleId      || '',
    roleName:    item.roleName    || '',
    roleAvatar:  item.roleAvatar  || defaultAvatar(),
    content:     item.content     || '',
    ts:          item.ts          || Date.now(),
    group:       item.group       || '我的收藏',
    byRole:      item.byRole      || false
  });
  lSave('favorites', liaoFavorites);
}

/* ---------- 入口 ---------- */
document.getElementById('menu-favorites').addEventListener('click', openFavorites);

function openFavorites() {
  renderFavorites();
  const view = document.getElementById('liao-favorites-view');
  if (view) {
    view.style.display = 'flex';
    view.style.flexDirection = 'column';
  }
}


const _favBack = document.getElementById('favorites-back');
if (_favBack) {
  _favBack.addEventListener('click', () => {
    const view = document.getElementById('liao-favorites-view');
    if (view) view.style.display = 'none';
  });
}

/* ---------- 渲染 ---------- */
function renderFavorites() {
  const list = document.getElementById('favorites-list');
  list.innerHTML = '';

  if (!liaoFavorites.length) {
    list.innerHTML = '<div style="text-align:center;padding:30px;font-size:13px;color:var(--text-light);">还没有收藏，在聊天中点击时间戳收藏消息吧</div>';
    return;
  }

  // 按分组聚合
  const groups = {};
  liaoFavorites.forEach(fav => {
    const g = fav.group || '我的收藏';
    if (!groups[g]) groups[g] = [];
    groups[g].push(fav);
  });

  Object.keys(groups).forEach(groupName => {
    const titleEl = document.createElement('div');
    titleEl.className = 'favorites-group-title';
    titleEl.textContent = groupName;
    list.appendChild(titleEl);

    groups[groupName].forEach(fav => {
      const card = document.createElement('div');
      card.className = 'favorite-card';
      card.innerHTML = `
        <div class="favorite-card-header">
          <img class="favorite-card-avatar" src="${escHtml(fav.roleAvatar)}" alt="">
          <div class="favorite-card-meta">
            <div class="favorite-card-role">${escHtml(fav.roleName || '未知角色')}</div>
            <div class="favorite-card-time">${formatTime(fav.ts)}</div>
          </div>
        </div>
        <div class="favorite-card-content">${escHtml(fav.content)}</div>
        <button class="favorite-card-del" data-fav-id="${escHtml(fav.id)}">删除</button>`;

      card.querySelector('.favorite-card-del').addEventListener('click', () => {
        liaoFavorites = liaoFavorites.filter(f => f.id !== fav.id);
        lSave('favorites', liaoFavorites);
        renderFavorites();
      });

      list.appendChild(card);
    });
  });
}
