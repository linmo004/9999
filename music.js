/* ============================================================
   music.js — 音乐 App 逻辑
   Last.fm API Key: 3b19200f4a3b2b8198d6258600238dc1
   ============================================================ */

(function () {
  'use strict';

  const LASTFM_KEY = '3b19200f4a3b2b8198d6258600238dc1';
  const LASTFM_URL = 'https://ws.audioscrobbler.com/2.0/';

  /* ============================================================
     数据结构
     ============================================================ */
  /*
    song: {
      id, title, artist, album, cover, src, lyrics, lrcLines, liked,
      srcType: 'local' | 'url'
    }
    playlist: { id, name, songIds[] }
    rolePlaylist: { roleId, songs: [{title, artist}] }
    chatroom: { name, roleIds[], anon, msgs[] }
    radioState: { on, roleCommentTimer }
  */

  let mpSongs        = lLoad('mpSongs',        []);
  let mpPlaylists    = lLoad('mpPlaylists',     []);
  let mpRolePlaylists= lLoad('mpRolePlaylists', []);
  let mpQueue        = [];
  let mpQueueIdx     = -1;
  let mpMode         = 'order';    /* order | repeat | single | shuffle */
  let mpShuffle      = false;
  let mpVolume       = 1.0;
  let mpIsPlaying    = false;
  let mpChatroom     = lLoad('mpChatroom', { name:'音乐聊天室', roleIds:[], anon:false, msgs:[] });
  let mpRadioOn      = false;
  let mpRadioTimer   = null;
  let mpRoleRadioTimer = null;
  let mpEditingSongId = null;
  let mpAddToPlaylistSongId = null;
  let mpChatroomAnon = false;
  let mpChatroomRoles = [];
  let _eventsBound   = false;

  /* ============================================================
     Audio 元素
     ============================================================ */
  const _audio = new Audio();
  _audio.volume = mpVolume;

  /* ── 时间更新 ── */
  _audio.addEventListener('timeupdate', () => {
    updateProgress();
    updateLyrics();
    syncMiniBar();
    syncChatroom();
  });

  _audio.addEventListener('ended', () => {
    onTrackEnded();
  });

  _audio.addEventListener('play', () => {
    mpIsPlaying = true;
    updatePlayBtn();
    const ring = document.querySelector('.mp-cover-ring');
    if (ring) ring.classList.remove('paused');
  });

  _audio.addEventListener('pause', () => {
    mpIsPlaying = false;
    updatePlayBtn();
    const ring = document.querySelector('.mp-cover-ring');
    if (ring) ring.classList.add('paused');
  });

  /* ============================================================
     lLoad / lSave 兼容（用项目现有的存储函数）
     ============================================================ */
  function lLoad(key, def) {
    try {
      const v = localStorage.getItem('halo9_' + key);
      return v !== null ? JSON.parse(v) : def;
    } catch(e) { return def; }
  }

  function lSave(key, val) {
    try { localStorage.setItem('halo9_' + key, JSON.stringify(val)); } catch(e) {}
  }

  /* ============================================================
     工具函数
     ============================================================ */
  function genId() {
    return 'mp_' + Date.now() + '_' + Math.random().toString(36).slice(2);
  }

  function fmtTime(sec) {
    if (!sec || isNaN(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return m + ':' + String(s).padStart(2, '0');
  }

  function defaultAvatar() {
    return 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=music';
  }

  function escHtml(str) {
    return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* ============================================================
     页面切换
     ============================================================ */
  function showPage(id) {
    document.querySelectorAll('#music-app .mp-page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(id);
    if (target) target.classList.add('active');
  }

  /* ============================================================
     Tab 切换（歌库页）
     ============================================================ */
  function initLibraryTabs() {
    document.querySelectorAll('.mp-tab-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.mp-tab-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const tab = this.dataset.mptab;
        document.querySelectorAll('.mp-tab-page').forEach(p => p.classList.remove('active'));
        const pg = document.getElementById('mp-tab-' + tab);
        if (pg) pg.classList.add('active');
        if (tab === 'songs')     renderSongList();
        if (tab === 'playlists') renderPlaylistList();
        if (tab === 'roles')     renderRolePlaylistList();
      });
    });
  }

  /* ============================================================
     播放核心
     ============================================================ */
  function playSong(song) {
    if (!song) return;
    _audio.src = song.src || '';
    _audio.load();
    _audio.play().catch(() => {});
    updatePlayerUI(song);
    syncChatroomNow(song);
    if (typeof window.mpOnSongChange === 'function') window.mpOnSongChange();
  }

  function playByIdx(idx) {
    if (idx < 0 || idx >= mpQueue.length) return;
    mpQueueIdx = idx;
    playSong(mpQueue[idx]);
    renderQueueList();
  }

  function onTrackEnded() {
    if (mpMode === 'single') {
      _audio.currentTime = 0;
      _audio.play().catch(() => {});
      return;
    }
    if (mpMode === 'shuffle' || mpShuffle) {
      const next = Math.floor(Math.random() * mpQueue.length);
      playByIdx(next);
      return;
    }
    const next = mpQueueIdx + 1;
    if (next < mpQueue.length) {
      playByIdx(next);
    } else if (mpMode === 'order') {
      mpIsPlaying = false;
      updatePlayBtn();
    } else {
      playByIdx(0);
    }
  }

  function playAll(songs) {
    if (!songs || !songs.length) return;
    mpQueue    = songs.slice();
    mpQueueIdx = 0;
    playSong(mpQueue[0]);
    renderQueueList();
  }

  /* ============================================================
     UI 更新
     ============================================================ */
  function updatePlayerUI(song) {
    const titleEl  = document.getElementById('mp-title');
    const artistEl = document.getElementById('mp-artist');
    const albumEl  = document.getElementById('mp-album');
    const coverEl  = document.getElementById('mp-cover');
    const coverPh  = document.getElementById('mp-cover-placeholder');

    if (titleEl)  titleEl.textContent  = song.title  || '未知歌曲';
    if (artistEl) artistEl.textContent = song.artist || '未知歌手';
    if (albumEl)  albumEl.textContent  = song.album  || '';

    if (coverEl && coverPh) {
      if (song.cover) {
        coverEl.src = song.cover;
        coverEl.style.display = 'block';
        coverPh.style.display = 'none';
      } else {
        coverEl.src = '';
        coverEl.style.display = 'none';
        coverPh.style.display = 'flex';
      }
    }

    renderLyrics(song);
    updateLikeBtn(song);
    syncMiniBar();

    /* 触发电台评论 */
    if (mpRadioOn) triggerRadioComment(song);
  }

  function updatePlayBtn() {
    const icon = document.getElementById('mp-play-icon');
    if (!icon) return;
    icon.setAttribute('data-lucide', mpIsPlaying ? 'pause' : 'play');
    if (typeof lucide !== 'undefined') lucide.createIcons();

    const miniBtn = document.getElementById('mp-mini-play-btn');
    if (miniBtn) {
      const miniIcon = miniBtn.querySelector('i');
      if (miniIcon) {
        miniIcon.setAttribute('data-lucide', mpIsPlaying ? 'pause' : 'play');
        if (typeof lucide !== 'undefined') lucide.createIcons();
      }
    }
  }

  function updateProgress() {
    const fill  = document.getElementById('mp-progress-fill');
    const thumb = document.getElementById('mp-progress-thumb');
    const cur   = document.getElementById('mp-cur-time');
    const dur   = document.getElementById('mp-dur-time');
    if (!_audio.duration) return;
    const pct = (_audio.currentTime / _audio.duration) * 100;
    if (fill)  fill.style.width = pct + '%';
    if (thumb) thumb.style.left = pct + '%';
    if (cur)   cur.textContent  = fmtTime(_audio.currentTime);
    if (dur)   dur.textContent  = fmtTime(_audio.duration);
  }

  function updateLikeBtn(song) {
    const btn = document.getElementById('mp-key-like');
    if (!btn) return;
    const icon = btn.querySelector('i');
    if (!icon) return;
    if (song && song.liked) {
      icon.style.color = '#ff6b8a';
      icon.setAttribute('data-lucide', 'heart');
    } else {
      icon.style.color = '';
      icon.setAttribute('data-lucide', 'heart');
    }
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function updateModeBtn() {
    const btn = document.getElementById('mp-key-mode');
    if (!btn) return;
    const icon = btn.querySelector('i');
    if (!icon) return;
    const modeMap = {
      order:   'repeat',
      repeat:  'repeat',
      single:  'repeat-1',
      shuffle: 'shuffle'
    };
    icon.setAttribute('data-lucide', modeMap[mpMode] || 'repeat');
    btn.style.opacity = mpMode === 'order' ? '0.5' : '1';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function syncMiniBar() {
    const bar      = document.getElementById('mp-mini-bar');
    const miniCover  = document.getElementById('mp-mini-cover');
    const miniTitle  = document.getElementById('mp-mini-title');
    const miniArtist = document.getElementById('mp-mini-artist');
    if (!bar) return;

    const appVisible = document.getElementById('music-app').style.display !== 'none'
      && document.getElementById('music-app').style.display !== '';

    if (mpIsPlaying && !appVisible) {
      bar.style.display = 'flex';
    } else {
      bar.style.display = 'none';
    }

    if (mpQueue[mpQueueIdx]) {
      const song = mpQueue[mpQueueIdx];
      if (miniTitle)  miniTitle.textContent  = song.title  || '未知歌曲';
      if (miniArtist) miniArtist.textContent = song.artist || '—';
      if (miniCover) {
        if (song.cover) {
          miniCover.src = song.cover;
          miniCover.style.display = 'block';
        } else {
          miniCover.style.display = 'none';
        }
      }
    }
  }

  /* ============================================================
     歌词渲染
     ============================================================ */
  function parseLrc(lrcText) {
    if (!lrcText) return [];
    const lines  = lrcText.split('\n');
    const result = [];
    const re     = /\[(\d+):(\d+\.?\d*)\](.*)/;
    lines.forEach(line => {
      const m = line.match(re);
      if (m) {
        const time = parseInt(m[1]) * 60 + parseFloat(m[2]);
        result.push({ time, text: m[3].trim() });
      }
    });
    return result.sort((a, b) => a.time - b.time);
  }

  function renderLyrics(song) {
    const inner = document.getElementById('mp-lyrics-inner');
    if (!inner) return;
    inner.innerHTML = '';

    if (!song || !song.lyrics) {
      inner.innerHTML = '<div class="mp-lyric-line" style="color:rgba(180,210,255,0.3);">暂无歌词</div>';
      return;
    }

    /* 判断是否 lrc 格式 */
    const hasLrc = /\[\d+:\d+/.test(song.lyrics);
    if (hasLrc) {
      const lines = parseLrc(song.lyrics);
      if (!lines.length) {
        inner.innerHTML = '<div class="mp-lyric-line" style="color:rgba(180,210,255,0.3);">歌词解析失败</div>';
        return;
      }
      /* 存到 song 对象方便 updateLyrics 使用 */
      song.lrcLines = lines;
      lines.forEach((line, idx) => {
        const div = document.createElement('div');
        div.className = 'mp-lyric-line';
        div.textContent = line.text || '　';
        div.dataset.idx = idx;
        inner.appendChild(div);
      });
    } else {
      /* 纯文字歌词 */
      song.lrcLines = null;
      song.lyrics.split('\n').forEach(line => {
        const div = document.createElement('div');
        div.className = 'mp-lyric-line';
        div.textContent = line || '　';
        inner.appendChild(div);
      });
    }
  }

  let _lastLrcIdx = -1;
  function updateLyrics() {
    const song = mpQueue[mpQueueIdx];
    if (!song || !song.lrcLines) return;
    const t = _audio.currentTime;
    let cur = 0;
    for (let i = 0; i < song.lrcLines.length; i++) {
      if (song.lrcLines[i].time <= t) cur = i;
      else break;
    }
    if (cur === _lastLrcIdx) return;
    _lastLrcIdx = cur;

    const inner = document.getElementById('mp-lyrics-inner');
    if (!inner) return;
    inner.querySelectorAll('.mp-lyric-line').forEach((el, i) => {
      el.classList.toggle('active', i === cur);
    });

    /* 滚动到当前行 */
    const activeEl = inner.querySelector('.mp-lyric-line.active');
    if (activeEl) {
      const scroll = document.getElementById('mp-lyrics-scroll');
      if (scroll) {
        const offset = activeEl.offsetTop - scroll.clientHeight / 2 + activeEl.clientHeight / 2;
        inner.style.transform = 'translateY(' + (-offset) + 'px)';
      }
    }
  }

  /* ============================================================
     歌曲列表渲染
     ============================================================ */
  function renderSongList(container, songs, onPlay) {
    const listEl = container || document.getElementById('mp-song-list');
    const data   = songs || mpSongs;
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!data.length) {
      listEl.innerHTML = '<div style="text-align:center;padding:20px;font-size:10px;color:rgba(120,170,240,0.4);">暂无歌曲，点击上方按钮添加</div>';
      return;
    }

    data.forEach((song, idx) => {
      const item = document.createElement('div');
      item.className = 'mp-song-item';
      if (mpQueue[mpQueueIdx] && mpQueue[mpQueueIdx].id === song.id) {
        item.classList.add('playing');
      }

      /* 封面 */
      if (song.cover) {
        const img = document.createElement('img');
        img.className = 'mp-song-item-cover';
        img.src = song.cover;
        img.onerror = () => { img.style.display = 'none'; };
        item.appendChild(img);
      } else {
        
        const ph = document.createElement('div');
        ph.className = 'mp-song-item-cover-ph';
        ph.innerHTML = '<i data-lucide="music" style="width:12px;height:12px;"></i>';
        item.appendChild(ph);
      }

      /* 信息 */
      const info = document.createElement('div');
      info.className = 'mp-song-item-info';
      info.innerHTML = '<div class="mp-song-item-title">' + escHtml(song.title || '未知歌曲') + '</div>' +
        '<div class="mp-song-item-artist">' + escHtml(song.artist || '未知歌手') + '</div>';
      item.appendChild(info);

      /* 操作按钮 */
      const actions = document.createElement('div');
      actions.className = 'mp-song-item-actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'mp-song-action-btn';
      editBtn.innerHTML = '<i data-lucide="pencil" style="width:10px;height:10px;"></i>';
      editBtn.addEventListener('click', e => { e.stopPropagation(); openSongEditModal(song.id); });

      const addBtn = document.createElement('button');
      addBtn.className = 'mp-song-action-btn';
      addBtn.innerHTML = '<i data-lucide="plus-circle" style="width:10px;height:10px;"></i>';
      addBtn.addEventListener('click', e => { e.stopPropagation(); openAddToPlaylistModal(song.id); });

      const delBtn = document.createElement('button');
      delBtn.className = 'mp-song-action-btn';
      delBtn.innerHTML = '<i data-lucide="trash-2" style="width:10px;height:10px;"></i>';
      delBtn.style.color = 'rgba(200,80,80,0.6)';
      delBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (!confirm('确定删除这首歌？')) return;
        mpSongs = mpSongs.filter(s => s.id !== song.id);
        lSave('mpSongs', mpSongs);
        renderSongList();
      });

      actions.appendChild(editBtn);
      actions.appendChild(addBtn);
      actions.appendChild(delBtn);
      item.appendChild(actions);

      /* 点击播放 */
      item.addEventListener('click', () => {
        if (onPlay) { onPlay(song); return; }
        mpQueue    = mpSongs.slice();
        mpQueueIdx = mpSongs.indexOf(song);
        playSong(song);
        renderQueueList();
        showPage('mp-page-player');
      });

      listEl.appendChild(item);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  /* ============================================================
     歌单列表渲染
     ============================================================ */
  function renderPlaylistList() {
    const listEl = document.getElementById('mp-playlist-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!mpPlaylists.length) {
      listEl.innerHTML = '<div style="text-align:center;padding:20px;font-size:10px;color:rgba(120,170,240,0.4);">暂无歌单，点击新建</div>';
      return;
    }

    mpPlaylists.forEach(pl => {
      const item = document.createElement('div');
      item.className = 'mp-playlist-item';

      const icon = document.createElement('div');
      icon.className = 'mp-playlist-icon';
      icon.innerHTML = '<i data-lucide="list-music" style="width:16px;height:16px;color:rgba(79,140,220,0.7);"></i>';

      const name = document.createElement('div');
      name.className = 'mp-playlist-name';
      name.textContent = pl.name;

      const count = document.createElement('div');
      count.className = 'mp-playlist-count';
      count.textContent = (pl.songIds ? pl.songIds.length : 0) + '首';

      const delBtn = document.createElement('button');
      delBtn.className = 'mp-playlist-del-btn';
      delBtn.innerHTML = '<i data-lucide="x" style="width:10px;height:10px;"></i>';
      delBtn.addEventListener('click', e => {
        e.stopPropagation();
        if (!confirm('确定删除歌单「' + pl.name + '」？')) return;
        mpPlaylists = mpPlaylists.filter(p => p.id !== pl.id);
        lSave('mpPlaylists', mpPlaylists);
        renderPlaylistList();
      });

      item.appendChild(icon);
      item.appendChild(name);
      item.appendChild(count);
      item.appendChild(delBtn);

      item.addEventListener('click', () => openPlaylistDetail(pl));
      listEl.appendChild(item);
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  function openPlaylistDetail(pl) {
    const nameEl = document.getElementById('mp-playlist-detail-name');
    const listEl = document.getElementById('mp-playlist-detail-list');
    if (nameEl) nameEl.textContent = pl.name;

    const songs = (pl.songIds || []).map(id => mpSongs.find(s => s.id === id)).filter(Boolean);
    renderSongList(listEl, songs, song => {
      mpQueue    = songs.slice();
      mpQueueIdx = songs.indexOf(song);
      playSong(song);
      renderQueueList();
      document.getElementById('mp-playlist-detail-modal').style.display = 'none';
      showPage('mp-page-player');
    });

    document.getElementById('mp-playlist-detail-modal').style.display = 'flex';

    document.getElementById('mp-playlist-detail-play').onclick = () => {
      if (!songs.length) return;
      playAll(songs);
      document.getElementById('mp-playlist-detail-modal').style.display = 'none';
      showPage('mp-page-player');
    };
  }

  /* ============================================================
     角色歌单渲染
     ============================================================ */
  function renderRolePlaylistList() {
    const listEl = document.getElementById('mp-role-playlist-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!mpRolePlaylists.length) {
      listEl.innerHTML = '<div style="text-align:center;padding:20px;font-size:10px;color:rgba(120,170,240,0.4);">暂无角色歌单，点击 AI 生成</div>';
      return;
    }

    mpRolePlaylists.forEach(rpl => {
      const role = (typeof window.liaoRoles !== 'undefined') ? liaoRoles.find(r => r.id === rpl.roleId) : null;
      const item = document.createElement('div');
      item.className = 'mp-role-playlist-item';

      const header = document.createElement('div');
      header.className = 'mp-role-playlist-header';

      const avatar = document.createElement('img');
      avatar.className = 'mp-role-playlist-avatar';
      avatar.src = (role && role.avatar) ? role.avatar : defaultAvatar();

      const name = document.createElement('div');
      name.className = 'mp-role-playlist-name';
      name.textContent = (role ? (role.nickname || role.realname) : '角色') + ' 的歌单';

      header.appendChild(avatar);
      header.appendChild(name);

      const songs = document.createElement('div');
      songs.className = 'mp-role-playlist-songs';
      (rpl.songs || []).slice(0, 5).forEach(s => {
        const sd = document.createElement('div');
        sd.className = 'mp-role-playlist-song-item';
        sd.textContent = (s.title || '未知') + ' - ' + (s.artist || '未知');
        songs.appendChild(sd);
      });

      item.appendChild(header);
      item.appendChild(songs);
      listEl.appendChild(item);
    });
  }

  /* ============================================================
     播放队列渲染
     ============================================================ */
  function renderQueueList() {
    const listEl = document.getElementById('mp-queue-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    mpQueue.forEach((song, idx) => {
      const item = document.createElement('div');
      item.className = 'mp-queue-item' + (idx === mpQueueIdx ? ' playing' : '');

      const num = document.createElement('div');
      num.className = 'mp-queue-item-num';
      num.textContent = idx === mpQueueIdx ? '▶' : (idx + 1);

      const info = document.createElement('div');
      info.className = 'mp-queue-item-info';
      info.innerHTML = '<div class="mp-queue-item-title">' + escHtml(song.title || '未知歌曲') + '</div>' +
        '<div class="mp-queue-item-artist">' + escHtml(song.artist || '—') + '</div>';

      item.appendChild(num);
      item.appendChild(info);
      item.addEventListener('click', () => playByIdx(idx));
      listEl.appendChild(item);
    });
  }

  /* ============================================================
     进度条拖动
     ============================================================ */
  function initProgressBar() {
    const bar = document.getElementById('mp-progress-bar');
    if (!bar) return;

    function seek(e) {
      const rect = bar.getBoundingClientRect();
      const x    = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
      const pct  = Math.max(0, Math.min(1, x / rect.width));
      if (_audio.duration) {
        _audio.currentTime = pct * _audio.duration;
      }
    }

    let seeking = false;
    bar.addEventListener('mousedown',  e => { seeking = true; seek(e); });
    bar.addEventListener('touchstart', e => { seeking = true; seek(e); }, { passive: true });
    document.addEventListener('mousemove',  e => { if (seeking) seek(e); });
    document.addEventListener('touchmove',  e => { if (seeking) seek(e); }, { passive: true });
    document.addEventListener('mouseup',    () => { seeking = false; });
    document.addEventListener('touchend',   () => { seeking = false; });
  }

  /* ============================================================
     歌曲信息编辑弹窗
     ============================================================ */
  function openSongEditModal(songId) {
    mpEditingSongId = songId;
    const song = mpSongs.find(s => s.id === songId);
    if (!song) return;

    document.getElementById('mp-edit-title').value   = song.title  || '';
    document.getElementById('mp-edit-artist').value  = song.artist || '';
    document.getElementById('mp-edit-album').value   = song.album  || '';
    document.getElementById('mp-edit-cover-url').value = song.cover || '';
    document.getElementById('mp-edit-lyrics').value  = song.lyrics || '';

    const preview = document.getElementById('mp-edit-cover-preview');
    if (preview) {
      if (song.cover) { preview.src = song.cover; preview.style.display = 'block'; }
      else preview.style.display = 'none';
    }

    document.getElementById('mp-song-edit-modal').style.display = 'flex';
  }

  function closeSongEditModal() {
    document.getElementById('mp-song-edit-modal').style.display = 'none';
    mpEditingSongId = null;
  }

  /* ============================================================
     添加到歌单弹窗
     ============================================================ */
  function openAddToPlaylistModal(songId) {
    mpAddToPlaylistSongId = songId;
    const listEl = document.getElementById('mp-playlist-pick-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    if (!mpPlaylists.length) {
      listEl.innerHTML = '<div style="font-size:10px;color:rgba(120,170,240,0.4);padding:8px 0;">暂无歌单，请先新建</div>';
    } else {
      mpPlaylists.forEach(pl => {
        const item = document.createElement('div');
        item.className = 'mp-playlist-pick-item';
        item.innerHTML = '<i data-lucide="list-music" style="width:12px;height:12px;"></i>' + escHtml(pl.name);
        item.addEventListener('click', () => {
          if (!pl.songIds) pl.songIds = [];
          if (!pl.songIds.includes(songId)) {
            pl.songIds.push(songId);
            lSave('mpPlaylists', mpPlaylists);
          }
          document.getElementById('mp-add-to-playlist-modal').style.display = 'none';
          mpAddToPlaylistSongId = null;
        });
        listEl.appendChild(item);
      });
    }

    document.getElementById('mp-add-to-playlist-modal').style.display = 'flex';
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }

  /* ============================================================
     Last.fm API
     ============================================================ */
  async function lastfmSearch(query) {
    const url = LASTFM_URL + '?method=track.search&track=' + encodeURIComponent(query) +
      '&api_key=' + LASTFM_KEY + '&format=json&limit=10';
    const res  = await fetch(url);
    const json = await res.json();
    return (json.results && json.results.trackmatches && json.results.trackmatches.track) || [];
  }

  async function lastfmGetTrackInfo(title, artist) {
    const url = LASTFM_URL + '?method=track.getInfo&track=' + encodeURIComponent(title) +
      '&artist=' + encodeURIComponent(artist) + '&api_key=' + LASTFM_KEY + '&format=json';
    const res  = await fetch(url);
    const json = await res.json();
    return json.track || null;
  }

  async function lastfmFillSongInfo(song) {
    try {
      const info = await lastfmGetTrackInfo(song.title || '', song.artist || '');
      if (!info) return;
      if (info.album && info.album.title && !song.album) {
        song.album = info.album.title;
      }
      if (info.album && info.album.image && !song.cover) {
        const imgs   = info.album.image;
        const large  = imgs.find(i => i.size === 'large' || i.size === 'extralarge');
        const imgUrl = large ? large['#text'] : (imgs[imgs.length - 1] ? imgs[imgs.length - 1]['#text'] : '');
        if (imgUrl) song.cover = imgUrl;
      }
    } catch(e) { /* 静默失败 */ }
  }

  /* ============================================================
     搜索弹窗
     ============================================================ */
  async function doSearch() {
    const input = document.getElementById('mp-search-input');
    const results = document.getElementById('mp-search-results');
    if (!input || !results) return;
    const q = input.value.trim();
    if (!q) return;

    results.innerHTML = '<div style="text-align:center;padding:10px;font-size:10px;color:rgba(120,170,240,0.4);">搜索中…</div>';

    try {
      const tracks = await lastfmSearch(q);
      results.innerHTML = '';

      if (!tracks.length) {
        results.innerHTML = '<div style="text-align:center;padding:10px;font-size:10px;color:rgba(120,170,240,0.4);">未找到结果</div>';
        return;
      }

      tracks.forEach(track => {
        const item = document.createElement('div');
        item.className = 'mp-search-result-item';

        const imgUrl = (track.image && track.image.length)
          ? track.image.find(i => i.size === 'medium' || i.size === 'small')?.['#text'] || ''
          : '';

        if (imgUrl) {
          const img = document.createElement('img');
          img.className = 'mp-search-result-cover';
          img.src = imgUrl;
          item.appendChild(img);
        } else {
          const ph = document.createElement('div');
          ph.className = 'mp-search-result-cover';
          ph.style.cssText = 'display:flex;align-items:center;justify-content:center;background:rgba(20,50,90,0.6);';
          ph.innerHTML = '<i data-lucide="music" style="width:12px;height:12px;color:rgba(79,140,220,0.4);"></i>';
          item.appendChild(ph);
        }

        const info = document.createElement('div');
        info.className = 'mp-search-result-info';
        info.innerHTML = '<div class="mp-search-result-title">' + escHtml(track.name) + '</div>' +
          '<div class="mp-search-result-artist">' + escHtml(track.artist) + '</div>';
        item.appendChild(info);

        /* 应用到编辑弹窗 / 直接新建歌曲 */
        const applyBtn = document.createElement('button');
        applyBtn.className = 'mp-search-result-apply';
        applyBtn.textContent = '应用';
        applyBtn.addEventListener('click', async () => {
          /* 如果当前有正在编辑的歌曲，填入信息 */
          if (mpEditingSongId) {
            const song = mpSongs.find(s => s.id === mpEditingSongId);
            if (song) {
              song.title  = track.name   || song.title;
              song.artist = track.artist || song.artist;
              if (imgUrl) song.cover = imgUrl;
              await lastfmFillSongInfo(song);
              lSave('mpSongs', mpSongs);
              document.getElementById('mp-edit-title').value  = song.title;
              document.getElementById('mp-edit-artist').value = song.artist;
              document.getElementById('mp-edit-album').value  = song.album || '';
              document.getElementById('mp-edit-cover-url').value = song.cover || '';
              const preview = document.getElementById('mp-edit-cover-preview');
              if (preview && song.cover) { preview.src = song.cover; preview.style.display = 'block'; }
              document.getElementById('mp-search-modal').style.display = 'none';
            }
          } else {
            /* 创建新歌曲条目（没有音源）*/
            const newSong = {
              id:      genId(),
              title:   track.name   || '未知歌曲',
              artist:  track.artist || '未知歌手',
              album:   '',
              cover:   imgUrl || '',
              src:     '',
              lyrics:  '',
              lrcLines: null,
              liked:   false,
              srcType: 'url'
            };
            await lastfmFillSongInfo(newSong);
            mpSongs.push(newSong);
            lSave('mpSongs', mpSongs);
            renderSongList();
            document.getElementById('mp-search-modal').style.display = 'none';
          }
        });
        results.appendChild(item);
      });

      if (typeof lucide !== 'undefined') lucide.createIcons();
    } catch(e) {
      results.innerHTML = '<div style="text-align:center;padding:10px;font-size:10px;color:rgba(200,80,80,0.5);">搜索失败：' + e.message + '</div>';
    }
  }

  /* ============================================================
     电台功能
     ============================================================ */
  function triggerRadioComment(song) {
    if (!mpRadioOn) return;
    const roles = (typeof window.liaoRoles !== 'undefined') ? window.liaoRoles : [];
if (!roles.length) return;

    if (mpRadioTimer) clearTimeout(mpRadioTimer);
    mpRadioTimer = setTimeout(async () => {
      const role = roles[Math.floor(Math.random() * roles.length)];
      const comment = await genRadioComment(role, song, false);
      if (comment) appendRadioComment('mp-radio-my-comments', role, comment);
    }, 2000 + Math.random() * 4000);
  }

  async function genRadioComment(role, song, isRoleRadio) {
    const cfg   = (typeof loadApiConfig === 'function') ? loadApiConfig() : null;
    const model = (typeof loadApiModel  === 'function') ? loadApiModel()  : null;
    if (!cfg || !cfg.url || !model) return null;

    const roleName    = role.nickname || role.realname || '角色';
    const roleSetting = role.setting  || '';
    const songTitle   = song ? (song.title  || '未知歌曲') : '未知歌曲';
    const songArtist  = song ? (song.artist || '未知歌手') : '未知歌手';

    const systemPrompt = isRoleRadio
      ? '你是角色 ' + roleName + '，' + roleSetting + '。\n' +
        '你正在主持一个音乐电台，现在正在播放歌曲《' + songTitle + '》by ' + songArtist + '。\n' +
        '请用你的风格说一段简短的电台播报词，介绍这首歌或聊聊感受。不超过40字，口语化，自然真实。只输出播报内容本身。'
      : '你是角色 ' + roleName + '，' + roleSetting + '。\n' +
        '你正在听一个音乐电台，当前播放的是《' + songTitle + '》by ' + songArtist + '。\n' +
        '请用你的风格发一条简短的评论，表达你对这首歌的感受或想法。不超过25字，口语化，像发弹幕一样。只输出评论内容本身。';

    try {
      const endpoint = cfg.url.replace(/\/$/, '') + '/chat/completions';
      const headers  = { 'Content-Type': 'application/json' };
      if (cfg.key) headers['Authorization'] = 'Bearer ' + cfg.key;
      const res = await fetch(endpoint, {
        method: 'POST', headers,
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: systemPrompt }],
          stream: false
        })
      });
      if (!res.ok) return null;
      const json = await res.json();
      return (json.choices?.[0]?.message?.content || '').trim();
    } catch(e) { return null; }
  }

  function appendRadioComment(containerId, role, text) {
    const container = document.getElementById(containerId);
    if (!container || !text) return;

    const item = document.createElement('div');
    item.className = 'mp-radio-comment-item';

    const avatar = document.createElement('img');
    avatar.className = 'mp-radio-comment-avatar';
    avatar.src = (role && role.avatar) ? role.avatar : defaultAvatar();

    const body = document.createElement('div');
    body.className = 'mp-radio-comment-body';

    const name = document.createElement('div');
    name.className = 'mp-radio-comment-name';
    name.textContent = role ? (role.nickname || role.realname) : '角色';

    const txt = document.createElement('div');
    txt.className = 'mp-radio-comment-text';
    txt.textContent = text;

    body.appendChild(name);
    body.appendChild(txt);
    item.appendChild(avatar);
    item.appendChild(body);
    container.appendChild(item);
    container.scrollTop = container.scrollHeight;
  }

  /* ── 角色电台 ── */
  async function startRoleRadio(roleId) {
    const role = (typeof window.liaoRoles !== 'undefined') ? liaoRoles.find(r => r.id === roleId) : null;
    if (!role) return;

    const roleName = role.nickname || role.realname;
    const nowEl    = document.getElementById('mp-role-radio-now');
    const comments = document.getElementById('mp-radio-role-comments');
    if (comments) comments.innerHTML = '';

    /* AI 生成角色电台播放曲目 */
    const cfg   = (typeof loadApiConfig === 'function') ? loadApiConfig() : null;
    const model = (typeof loadApiModel  === 'function') ? loadApiModel()  : null;
    if (!cfg || !cfg.url || !model) return;

    const systemPrompt =
      '你是角色 ' + roleName + '，' + (role.setting || '') + '。\n' +
      '你正在主持自己的音乐电台，请随机选一首你会喜欢的歌曲，用你的风格做简短的播报介绍。\n' +
      '输出格式（严格按此格式，整体一行）：[SONG:歌名|歌手] 播报内容\n' +
      '播报内容不超过50字，口语化自然。';

    if (nowEl) nowEl.innerHTML = '<div class="mp-radio-desc">角色电台加载中…</div>';

    if (mpRoleRadioTimer) clearInterval(mpRoleRadioTimer);

    const broadcast = async () => {
      try {
        const endpoint = cfg.url.replace(/\/$/, '') + '/chat/completions';
        const headers  = { 'Content-Type': 'application/json' };
        if (cfg.key) headers['Authorization'] = 'Bearer ' + cfg.key;
        const res = await fetch(endpoint, {
          method: 'POST', headers,
          body: JSON.stringify({
            model,
            messages: [{ role: 'system', content: systemPrompt }],
            stream: false
          })
        });
        if (!res.ok) return;
        const json    = await res.json();
        const content = (json.choices?.[0]?.message?.content || '').trim();
        const songMatch = content.match(/\[SONG:([^|]+)\|([^\]]+)\]/);
        const broadcastText = content.replace(/\[SONG:[^\]]+\]/, '').trim();

        if (songMatch && nowEl) {
          const fakeTitle  = songMatch[1].trim();
          const fakeArtist = songMatch[2].trim();
          nowEl.innerHTML =
            '<div class="mp-radio-comment-name" style="font-size:9px;color:rgba(79,140,220,0.6);">正在播放</div>' +
            '<div style="font-size:10px;font-weight:700;color:#a8d0f8;margin-bottom:4px;">《' + escHtml(fakeTitle) + '》— ' + escHtml(fakeArtist) + '</div>' +
            '<div class="mp-radio-desc">' + escHtml(broadcastText) + '</div>';
        }

        /* 角色互动评论（其他角色也会评论） */
        const allRoles = (typeof window.liaoRoles !== 'undefined') ? liaoRoles : [];
        const others   = allRoles.filter(r => r.id !== roleId);
        if (others.length) {
          const commenter = others[Math.floor(Math.random() * others.length)];
          const fakeSong  = songMatch ? { title: songMatch[1].trim(), artist: songMatch[2].trim() } : null;
          const comment   = await genRadioComment(commenter, fakeSong, false);
          if (comment) appendRadioComment('mp-radio-role-comments', commenter, comment);
        }

        /* 角色主播自己也说话 */
        if (broadcastText) appendRadioComment('mp-radio-role-comments', role, broadcastText);

      } catch(e) { /* 静默失败 */ }
    };

    await broadcast();
    mpRoleRadioTimer = setInterval(broadcast, 30000);
  }

  /* ============================================================
     聊天室功能
     ============================================================ */
  function syncChatroom() { /* timeupdate 时同步聊天室正在播放 */ }

  function syncChatroomNow(song) {
    const songEl   = document.getElementById('mp-chatroom-song');
    const artistEl = document.getElementById('mp-chatroom-artist');
    const coverEl  = document.getElementById('mp-chatroom-cover');
    const coverPh  = coverEl ? coverEl.parentElement.querySelector('.mp-chatroom-cover-ph') : null;

    if (songEl)   songEl.textContent   = song.title  || '未知歌曲';
    if (artistEl) artistEl.textContent = song.artist || '—';
    if (coverEl) {
      if (song.cover) {
        coverEl.src = song.cover;
        coverEl.style.display = 'block';
        if (coverPh) coverPh.style.display = 'none';
      } else {
        coverEl.style.display = 'none';
        if (coverPh) coverPh.style.display = 'flex';
      }
    }

    /* 通知聊天室里的角色 */
    if (mpChatroomRoles.length) {
      setTimeout(() => triggerChatroomRoleComment(song, true), 1500 + Math.random() * 2000);
    }
  }

  async function triggerChatroomRoleComment(song, isSongChange) {
    if (!mpChatroomRoles.length) return;
    const role = mpChatroomRoles[Math.floor(Math.random() * mpChatroomRoles.length)];
    const cfg   = (typeof loadApiConfig === 'function') ? loadApiConfig() : null;
    const model = (typeof loadApiModel  === 'function') ? loadApiModel()  : null;
    if (!cfg || !cfg.url || !model) return;

    const roleName    = mpChatroomAnon ? '匿名用户' : (role.nickname || role.realname);
    const songTitle   = song ? (song.title  || '未知歌曲') : '未知歌曲';
    const songArtist  = song ? (song.artist || '未知歌手') : '未知歌手';

    const systemPrompt =
      '你是角色 ' + (role.nickname || role.realname) + '，' + (role.setting || '') + '。\n' +
      '你正在一个音乐聊天室里，' +
      (isSongChange ? '刚刚切换了新歌《' + songTitle + '》by ' + songArtist + '，' : '') +
      '请用你的风格发一条简短的聊天消息，可以评论歌曲、聊天、或者说任何符合你性格的话。不超过20字，口语化。只输出消息内容本身。';

    try {
      const endpoint = cfg.url.replace(/\/$/, '') + '/chat/completions';
      const headers  = { 'Content-Type': 'application/json' };
      if (cfg.key) headers['Authorization'] = 'Bearer ' + cfg.key;
      const res = await fetch(endpoint, {
        method: 'POST', headers,
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: systemPrompt }],
          stream: false
        })
      });
      if (!res.ok) return;
      const json    = await res.json();
      const content = (json.choices?.[0]?.message?.content || '').trim();
      if (content) appendChatroomMsg(roleName, content, false, (role && role.avatar) ? role.avatar : defaultAvatar());
    } catch(e) { /* 静默 */ }
  }

  function appendChatroomMsg(name, text, isUser, avatar) {
    const container = document.getElementById('mp-chatroom-msgs');
    if (!container) return;

    const item = document.createElement('div');
    item.className = 'mp-chatroom-msg-item' + (isUser ? ' user-msg' : '');

    const avatarEl = document.createElement('img');
    avatarEl.className = 'mp-chatroom-msg-avatar';
    avatarEl.src = avatar || defaultAvatar();

    const body = document.createElement('div');
    body.className = 'mp-chatroom-msg-body';

    const nameEl = document.createElement('div');
    nameEl.className = 'mp-chatroom-msg-name';
    nameEl.textContent = name;

    const textEl = document.createElement('div');
    textEl.className = 'mp-chatroom-msg-text';
    textEl.textContent = text;

    body.appendChild(nameEl);
    body.appendChild(textEl);
    item.appendChild(avatarEl);
    item.appendChild(body);
    container.appendChild(item);
    container.scrollTop = container.scrollHeight;

    /* 存入记录 */
    mpChatroom.msgs.push({ name, text, isUser, ts: Date.now() });
    lSave('mpChatroom', mpChatroom);
  }

  function renderChatroomMsgs() {
    const container = document.getElementById('mp-chatroom-msgs');
    if (!container) return;
    container.innerHTML = '';
    (mpChatroom.msgs || []).slice(-50).forEach(msg => {
      appendChatroomMsg(msg.name, msg.text, msg.isUser, msg.avatar);
    });
  }

  /* ============================================================
     分享功能
     ============================================================ */
  function openShareModal() {
    const song = mpQueue[mpQueueIdx];
    if (!song) { alert('当前没有正在播放的歌曲'); return; }

    const coverEl  = document.getElementById('mp-share-cover');
    const titleEl  = document.getElementById('mp-share-title');
    const artistEl = document.getElementById('mp-share-artist');
    const roleSelect = document.getElementById('mp-share-role-select');

    if (coverEl)  { coverEl.src = song.cover || ''; }
    if (titleEl)  titleEl.textContent  = song.title  || '未知歌曲';
    if (artistEl) artistEl.textContent = song.artist || '未知歌手';

    /* 填充角色列表 */
    if (roleSelect) {
      roleSelect.innerHTML = '';
      const roles = (typeof window.liaoRoles !== 'undefined') ? liaoRoles : [];
      roles.forEach(role => {
        const opt = document.createElement('option');
        opt.value = role.id;
        opt.textContent = role.nickname || role.realname;
        roleSelect.appendChild(opt);
      });
    }

    document.getElementById('mp-share-modal').style.display = 'flex';
  }

  function buildMusicCard(song) {
    return '[MUSIC:title=' + (song.title || '未知歌曲') +
      ':artist=' + (song.artist || '未知歌手') +
      ':cover=' + (song.cover || '') + ']';
  }

  function shareToLiao(song, roleId) {
    if (!song) return;
    if (typeof liaoChats === 'undefined' || typeof liaoRoles === 'undefined') return;

    const chatIdx = liaoChats.findIndex(c => c.roleId === roleId);
    if (chatIdx < 0) { alert('找不到对应聊天，请先创建与该角色的对话'); return; }

    const content = buildMusicCard(song);
    const msgObj  = {
      role:    'user',
      type:    'music',
      content,
      ts:      Date.now(),
      id:      'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2)
    };
    liaoChats[chatIdx].messages.push(msgObj);
    if (typeof lSave === 'function') lSave('chats', liaoChats);
    alert('已分享到了了聊天');
    document.getElementById('mp-share-modal').style.display = 'none';
  }

  function shareToSuiyan(song) {
    if (!song) return;
    if (typeof liaoSuiyan === 'undefined') return;

    const content = '分享了一首歌《' + (song.title || '未知歌曲') + '》— ' + (song.artist || '未知歌手');
    liaoSuiyan.unshift({
      author:   (typeof liaoUserName !== 'undefined') ? liaoUserName : '我',
      avatar:   (typeof liaoUserAvatar !== 'undefined') ? liaoUserAvatar : defaultAvatar(),
      content,
      musicCard: {
        title:  song.title  || '未知歌曲',
        artist: song.artist || '未知歌手',
        cover:  song.cover  || ''
      },
      ts:       Date.now(),
      likes:    0,
      likedBy:  [],
      comments: [],
      isUser:   true
    });
    if (typeof lSave === 'function') lSave('suiyan', liaoSuiyan);
    alert('已分享到随言');
    document.getElementById('mp-share-modal').style.display = 'none';
  }

  /* ============================================================
     AI 生成角色歌单
     ============================================================ */
  async function genRolePlaylist(roleId) {
    const role = (typeof window.liaoRoles !== 'undefined') ? liaoRoles.find(r => r.id === roleId) : null;
    if (!role) return;

    const cfg   = (typeof loadApiConfig === 'function') ? loadApiConfig() : null;
    const model = (typeof loadApiModel  === 'function') ? loadApiModel()  : null;
    if (!cfg || !cfg.url || !model) { alert('请先配置 API'); return; }

    const roleName    = role.nickname || role.realname;
    const roleSetting = role.setting  || '';

    const systemPrompt =
      '你是角色 ' + roleName + '，' + roleSetting + '。\n' +
      '请根据你的性格和喜好，生成一个你的专属歌单，包含8首歌曲。\n' +
      '每首歌单独一行，格式：歌名|歌手\n' +
      '只输出歌单内容，不输出其他文字。';

    try {
      const endpoint = cfg.url.replace(/\/$/, '') + '/chat/completions';
      const headers  = { 'Content-Type': 'application/json' };
      if (cfg.key) headers['Authorization'] = 'Bearer ' + cfg.key;
      const res = await fetch(endpoint, {
        method: 'POST', headers,
        body: JSON.stringify({
          model,
          messages: [{ role: 'system', content: systemPrompt }],
          stream: false
        })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const json    = await res.json();
      const content = (json.choices?.[0]?.message?.content || '').trim();
      const songs   = content.split('\n').map(line => {
        const parts = line.split('|');
        return { title: (parts[0] || '').trim(), artist: (parts[1] || '').trim() };
      }).filter(s => s.title);

      /* 移除旧的同角色歌单，添加新的 */
      mpRolePlaylists = mpRolePlaylists.filter(p => p.roleId !== roleId);
      mpRolePlaylists.push({ roleId, songs });
      lSave('mpRolePlaylists', mpRolePlaylists);
      renderRolePlaylistList();
      alert('已为 ' + roleName + ' 生成歌单，共 ' + songs.length + ' 首');
    } catch(e) {
      alert('生成失败：' + e.message);
    }
  }

  /* ============================================================
     上传本地文件
     ============================================================ */
  function handleUploadFiles(files) {
    if (!files || !files.length) return;
    Array.from(files).forEach(file => {
      const url    = URL.createObjectURL(file);
      const name   = file.name.replace(/\.[^.]+$/, '');
      /* 尝试从文件名解析歌名和歌手 */
      const parts  = name.split(' - ');
      const title  = parts.length > 1 ? parts[1].trim() : name;
      const artist = parts.length > 1 ? parts[0].trim() : '未知歌手';

      const song = {
        id:       genId(),
        title,
        artist,
        album:    '',
        cover:    '',
        src:      url,
        lyrics:   '',
        lrcLines: null,
        liked:    false,
        srcType:  'local'
      };
      mpSongs.push(song);

      /* 后台尝试 Last.fm 补全 */
      lastfmFillSongInfo(song).then(() => {
        lSave('mpSongs', mpSongs);
        renderSongList();
      });
    });
    lSave('mpSongs', mpSongs);
    renderSongList();
  }

  /* ============================================================
     聊天室设置
     ============================================================ */
  function openChatroomSettings() {
    const nameInput = document.getElementById('mp-chatroom-name-input');
    const roleList  = document.getElementById('mp-chatroom-role-list');
    if (nameInput) nameInput.value = mpChatroom.name || '音乐聊天室';

    if (roleList) {
      roleList.innerHTML = '';
      const roles = (typeof window.liaoRoles !== 'undefined') ? liaoRoles : [];
      roles.forEach(role => {
        const item = document.createElement('div');
        item.className = 'mp-role-pick-item' + (mpChatroomRoles.some(r => r.id === role.id) ? ' selected' : '');

        const avatar = document.createElement('img');
        avatar.className = 'mp-role-pick-avatar';
        avatar.src = role.avatar || defaultAvatar();

        const name = document.createElement('div');
        name.className = 'mp-role-pick-name';
        name.textContent = role.nickname || role.realname;

        item.appendChild(avatar);
        item.appendChild(name);
        item.addEventListener('click', () => {
          item.classList.toggle('selected');
        });

        roleList.appendChild(item);
      });
    }

    /* 同步匿名模式按钮 */
    const namedBtn = document.getElementById('mp-chatroom-mode-named');
    const anonBtn  = document.getElementById('mp-chatroom-mode-anon');
    if (namedBtn) namedBtn.classList.toggle('active', !mpChatroomAnon);
    if (anonBtn)  anonBtn.classList.toggle('active',  mpChatroomAnon);

    document.getElementById('mp-chatroom-settings-modal').style.display = 'flex';
  }

  /* ============================================================
     电台模式切换
     ============================================================ */
  function initRadioTabs() {
    document.querySelectorAll('.mp-radio-tab').forEach(btn => {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.mp-radio-tab').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const tab = this.dataset.radiotab;
        document.querySelectorAll('.mp-radio-panel').forEach(p => p.classList.remove('active'));
        const panel = document.getElementById('mp-radio-' + tab);
        if (panel) panel.classList.add('active');

        /* 填充角色电台选择 */
        if (tab === 'role') {
          const select = document.getElementById('mp-role-radio-select');
          if (select) {
            select.innerHTML = '';
            const roles = (typeof window.liaoRoles !== 'undefined') ? liaoRoles : [];
            roles.forEach(role => {
              const opt = document.createElement('option');
              opt.value = role.id;
              opt.textContent = role.nickname || role.realname;
              select.appendChild(opt);
            });
          }
        }
      });
    });
  }

  /* ============================================================
     事件绑定
     ============================================================ */
  function bindEvents() {

    /* ── 屏幕导航 ── */
    const toLibrary  = document.getElementById('mp-to-library');
    const toPlaylist = document.getElementById('mp-to-playlist');
    const libBack    = document.getElementById('mp-library-back');
    const plBack     = document.getElementById('mp-playlist-back');
    const radioBack  = document.getElementById('mp-radio-back');
    const chatroomBack = document.getElementById('mp-chatroom-back');

    if (toLibrary)    toLibrary.addEventListener('click',  () => { showPage('mp-page-library');  renderSongList(); });
    if (toPlaylist)   toPlaylist.addEventListener('click', () => { showPage('mp-page-playlist'); renderQueueList(); });
    if (libBack)      libBack.addEventListener('click',    () => showPage('mp-page-player'));
    if (plBack)       plBack.addEventListener('click',     () => showPage('mp-page-player'));
    if (radioBack)    radioBack.addEventListener('click',  () => showPage('mp-page-player'));
    if (chatroomBack) chatroomBack.addEventListener('click',() => showPage('mp-page-player'));

    /* ── 顶部功能键 ── */
    const keyRadio    = document.getElementById('mp-key-radio');
    const keyChatroom = document.getElementById('mp-key-chatroom');
    const keyShare    = document.getElementById('mp-key-share');
    const keyClose    = document.getElementById('mp-key-close');

    if (keyRadio)    keyRadio.addEventListener('click',    () => { showPage('mp-page-radio'); initRadioTabs(); });
    if (keyChatroom) keyChatroom.addEventListener('click', () => { showPage('mp-page-chatroom'); renderChatroomMsgs(); });
    if (keyShare)    keyShare.addEventListener('click',    () => openShareModal());
    if (keyClose)    keyClose.addEventListener('click',    () => window.MusicApp.close());

    /* ── 圆盘按键 ── */
    const keyPlay = document.getElementById('mp-key-play');
    const keyPrev = document.getElementById('mp-key-prev');
    const keyNext = document.getElementById('mp-key-next');
    const keyVolDown = document.getElementById('mp-key-vol-down');
    const keyVolUp   = document.getElementById('mp-key-vol-up');

    if (keyPlay) {
      keyPlay.addEventListener('click', () => {
        if (mpIsPlaying) _audio.pause();
        else             _audio.play().catch(() => {});
      });
    }
    if (keyPrev) {
      keyPrev.addEventListener('click', () => {
        if (_audio.currentTime > 3) { _audio.currentTime = 0; return; }
        const prev = mpQueueIdx - 1;
        if (prev >= 0) playByIdx(prev);
        else playByIdx(mpQueue.length - 1);
      });
    }
    if (keyNext) {
      keyNext.addEventListener('click', () => {
        const next = mpQueueIdx + 1;
        if (next < mpQueue.length) playByIdx(next);
        else playByIdx(0);
      });
    }
    if (keyVolDown) {
      keyVolDown.addEventListener('click', () => {
        mpVolume = Math.max(0, mpVolume - 0.1);
        _audio.volume = mpVolume;
      });
    }
    if (keyVolUp) {
      keyVolUp.addEventListener('click', () => {
        mpVolume = Math.min(1, mpVolume + 0.1);
        _audio.volume = mpVolume;
      });
    }

    /* ── 底部功能键 ── */
    const keyMode    = document.getElementById('mp-key-mode');
    const keyShuffle = document.getElementById('mp-key-shuffle');
    const keyLike    = document.getElementById('mp-key-like');
    const keyInfo    = document.getElementById('mp-key-info');

    if (keyMode) {
      keyMode.addEventListener('click', () => {
        const modes = ['order', 'repeat', 'single', 'shuffle'];
        const idx   = modes.indexOf(mpMode);
        mpMode = modes[(idx + 1) % modes.length];
        updateModeBtn();
      });
    }
    if (keyShuffle) {
      keyShuffle.addEventListener('click', () => {
        mpShuffle = !mpShuffle;
        keyShuffle.style.opacity = mpShuffle ? '1' : '0.5';
      });
    }
    if (keyLike) {
      keyLike.addEventListener('click', () => {
        const song = mpQueue[mpQueueIdx];
        if (!song) return;
        song.liked = !song.liked;
        const idx  = mpSongs.findIndex(s => s.id === song.id);
        if (idx >= 0) mpSongs[idx].liked = song.liked;
        lSave('mpSongs', mpSongs);
        updateLikeBtn(song);
      });
    }
    if (keyInfo) {
      keyInfo.addEventListener('click', () => {
        const song = mpQueue[mpQueueIdx];
        if (!song) { alert('当前没有播放歌曲'); return; }
        openSongEditModal(song.id);
      });
    }

    /* ── 上传按钮 ── */
    const uploadBtn  = document.getElementById('mp-upload-btn');
    const uploadFile = document.getElementById('mp-upload-file');
    if (uploadBtn && uploadFile) {
      uploadBtn.addEventListener('click', () => uploadFile.click());
      uploadFile.addEventListener('change', function() {
        handleUploadFiles(this.files);
        this.value = '';
      });
    }

    /* ── 链接添加 ── */
    const urlBtn = document.getElementById('mp-url-btn');
    if (urlBtn) urlBtn.addEventListener('click', () => {
      document.getElementById('mp-url-input').value  = '';
      document.getElementById('mp-url-title').value  = '';
      document.getElementById('mp-url-artist').value = '';
      document.getElementById('mp-url-modal').style.display = 'flex';
    });

    const urlConfirm = document.getElementById('mp-url-confirm');
    if (urlConfirm) {
      urlConfirm.addEventListener('click', () => {
        const src    = document.getElementById('mp-url-input').value.trim();
        const title  = document.getElementById('mp-url-title').value.trim()  || '未知歌曲';
        const artist = document.getElementById('mp-url-artist').value.trim() || '未知歌手';
        if (!src) { alert('请输入音频链接'); return; }
        const song = { id: genId(), title, artist, album:'', cover:'', src, lyrics:'', lrcLines:null, liked:false, srcType:'url' };
        mpSongs.push(song);
        lSave('mpSongs', mpSongs);
        renderSongList();
        document.getElementById('mp-url-modal').style.display = 'none';
        /* 后台补全 */
        lastfmFillSongInfo(song).then(() => { lSave('mpSongs', mpSongs); renderSongList(); });
      });
    }

    const urlCancel = document.getElementById('mp-url-cancel');
    if (urlCancel) urlCancel.addEventListener('click', () => {
      document.getElementById('mp-url-modal').style.display = 'none';
    });

    /* ── 搜索 ── */
    const searchBtn = document.getElementById('mp-search-btn');
    if (searchBtn) searchBtn.addEventListener('click', () => {
      document.getElementById('mp-search-input').value = '';
      document.getElementById('mp-search-results').innerHTML = '';
      document.getElementById('mp-search-modal').style.display = 'flex';
    });

    const searchConfirm = document.getElementById('mp-search-confirm');
    if (searchConfirm) searchConfirm.addEventListener('click', doSearch);

    const searchInput = document.getElementById('mp-search-input');
    if (searchInput) searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

    const searchCancel = document.getElementById('mp-search-cancel');
    if (searchCancel) searchCancel.addEventListener('click', () => {
      document.getElementById('mp-search-modal').style.display = 'none';
    });

    /* ── 新建歌单 ── */
    const newPLBtn = document.getElementById('mp-new-playlist-btn');
    if (newPLBtn) newPLBtn.addEventListener('click', () => {
      document.getElementById('mp-new-playlist-name').value = '';
      document.getElementById('mp-new-playlist-modal').style.display = 'flex';
    });

    const newPLConfirm = document.getElementById('mp-new-playlist-confirm');
    if (newPLConfirm) {
      newPLConfirm.addEventListener('click', () => {
        const name = document.getElementById('mp-new-playlist-name').value.trim();
        if (!name) { alert('请输入歌单名称'); return; }
        mpPlaylists.push({ id: genId(), name, songIds: [] });
        lSave('mpPlaylists', mpPlaylists);
        renderPlaylistList();
        document.getElementById('mp-new-playlist-modal').style.display = 'none';
      });
    }

    const newPLCancel = document.getElementById('mp-new-playlist-cancel');
    if (newPLCancel) newPLCancel.addEventListener('click', () => {
      document.getElementById('mp-new-playlist-modal').style.display = 'none';
    });

    /* ── 歌单详情关闭 ── */
    const plDetailClose = document.getElementById('mp-playlist-detail-close');
    if (plDetailClose) plDetailClose.addEventListener('click', () => {
      document.getElementById('mp-playlist-detail-modal').style.display = 'none';
    });

    /* ── 添加到歌单取消 ── */
    const addToPLCancel = document.getElementById('mp-add-to-playlist-cancel');
    if (addToPLCancel) addToPLCancel.addEventListener('click', () => {
      document.getElementById('mp-add-to-playlist-modal').style.display = 'none';
    });

    /* ── 歌曲信息编辑弹窗 ── */
    const songEditConfirm = document.getElementById('mp-song-edit-confirm');
    if (songEditConfirm) {
      songEditConfirm.addEventListener('click', () => {
        if (!mpEditingSongId) return;
        const song = mpSongs.find(s => s.id === mpEditingSongId);
        if (!song) return;
        song.title  = document.getElementById('mp-edit-title').value.trim()  || song.title;
        song.artist = document.getElementById('mp-edit-artist').value.trim() || song.artist;
        song.album  = document.getElementById('mp-edit-album').value.trim();
        song.cover  = document.getElementById('mp-edit-cover-url').value.trim() || song.cover;
        song.lyrics = document.getElementById('mp-edit-lyrics').value;
        /* 重新解析歌词 */
        if (song.lyrics && /\[\d+:\d+/.test(song.lyrics)) {
          song.lrcLines = parseLrc(song.lyrics);
        } else {
          song.lrcLines = null;
        }
        lSave('mpSongs', mpSongs);
        renderSongList();
        /* 如果正在播放此歌曲，更新UI */
        if (mpQueue[mpQueueIdx] && mpQueue[mpQueueIdx].id === song.id) {
          updatePlayerUI(song);
        }
        closeSongEditModal();
      });
    }

    const songEditCancel = document.getElementById('mp-song-edit-cancel');
    if (songEditCancel) songEditCancel.addEventListener('click', closeSongEditModal);

    /* ── 封面本地上传 ── */
    const coverLocalBtn  = document.getElementById('mp-edit-cover-local-btn');
    const coverLocalFile = document.getElementById('mp-edit-cover-file');
    if (coverLocalBtn && coverLocalFile) {
      coverLocalBtn.addEventListener('click', () => coverLocalFile.click());
      coverLocalFile.addEventListener('change', function() {
        const file = this.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
          const src = e.target.result;
          document.getElementById('mp-edit-cover-url').value = src;
          const preview = document.getElementById('mp-edit-cover-preview');
          if (preview) { preview.src = src; preview.style.display = 'block'; }
        };
        reader.readAsDataURL(file);
        this.value = '';
      });
    }

    /* ── lrc 文件上传 ── */
    const lrcBtn  = document.getElementById('mp-edit-lrc-btn');
    const lrcFile = document.getElementById('mp-edit-lrc-file');
    if (lrcBtn && lrcFile) {
      lrcBtn.addEventListener('click', () => lrcFile.click());
      lrcFile.addEventListener('change', function() {
        const file = this.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
          document.getElementById('mp-edit-lyrics').value = e.target.result;
        };
        reader.readAsText(file, 'UTF-8');
        this.value = '';
      });
    }

    /* ── Last.fm 补全按钮 ── */
    const lastfmBtn = document.getElementById('mp-lastfm-search-btn');
    if (lastfmBtn) {
      lastfmBtn.addEventListener('click', async () => {
        const title  = document.getElementById('mp-edit-title').value.trim();
        const artist = document.getElementById('mp-edit-artist').value.trim();
        if (!title) { alert('请先填写歌曲名'); return; }
        lastfmBtn.textContent = '补全中…';
        lastfmBtn.disabled    = true;
        try {
          const fakeSong = { title, artist, album:'', cover:'' };
          await lastfmFillSongInfo(fakeSong);
          if (fakeSong.album) document.getElementById('mp-edit-album').value = fakeSong.album;
          if (fakeSong.cover) {
            document.getElementById('mp-edit-cover-url').value = fakeSong.cover;
            const preview = document.getElementById('mp-edit-cover-preview');
            if (preview) { preview.src = fakeSong.cover; preview.style.display = 'block'; }
          }
          if (!fakeSong.album && !fakeSong.cover) alert('Last.fm 未找到相关信息');
        } catch(e) {
          alert('补全失败：' + e.message);
        } finally {
          lastfmBtn.innerHTML  = '<i data-lucide="sparkles" style="width:10px;height:10px;"></i> Last.fm 补全';
          lastfmBtn.disabled   = false;
          if (typeof lucide !== 'undefined') lucide.createIcons();
        }
      });
    }

    /* ── AI 生成角色歌单 ── */
    const genRolePLBtn = document.getElementById('mp-gen-role-playlist-btn');
    if (genRolePLBtn) {
      genRolePLBtn.addEventListener('click', () => {
        const roles = (typeof window.liaoRoles !== 'undefined') ? liaoRoles : [];
        if (!roles.length) { alert('请先在了了中添加角色'); return; }
        /* 弹出角色选择 */
        const roleId = roles.length === 1
          ? roles[0].id
          : prompt('输入角色序号选择角色：\n' +
              roles.map((r, i) => (i + 1) + '. ' + (r.nickname || r.realname)).join('\n') +
              '\n（输入数字）');
        if (!roleId) return;
        const idx  = parseInt(roleId) - 1;
        const role = roles[idx] || roles[0];
        genRolePlaylist(role.id);
      });
    }

    /* ── 电台开始直播 ── */
    const radioStartBtn = document.getElementById('mp-radio-start-btn');
    if (radioStartBtn) {
      radioStartBtn.addEventListener('click', () => {
        mpRadioOn = !mpRadioOn;
        radioStartBtn.textContent = mpRadioOn ? '停止直播' : '开始直播';
        radioStartBtn.classList.toggle('on-air', mpRadioOn);
        if (mpRadioOn) {
          const song = mpQueue[mpQueueIdx];
          if (song) triggerRadioComment(song);
        } else {
          if (mpRadioTimer) { clearTimeout(mpRadioTimer); mpRadioTimer = null; }
        }
      });
    }

    /* ── 角色电台收听 ── */
    const roleRadioStartBtn = document.getElementById('mp-role-radio-start-btn');
    if (roleRadioStartBtn) {
      roleRadioStartBtn.addEventListener('click', () => {
        const select = document.getElementById('mp-role-radio-select');
        const roleId = select ? select.value : null;
        if (!roleId) { alert('请选择角色'); return; }
        startRoleRadio(roleId);
      });
    }

    /* ── 聊天室设置 ── */
    const chatroomSettingsBtn = document.getElementById('mp-chatroom-settings-btn');
    if (chatroomSettingsBtn) chatroomSettingsBtn.addEventListener('click', openChatroomSettings);

    const chatroomSettingsConfirm = document.getElementById('mp-chatroom-settings-confirm');
    if (chatroomSettingsConfirm) {
      chatroomSettingsConfirm.addEventListener('click', () => {
        const nameInput = document.getElementById('mp-chatroom-name-input');
        const roleList  = document.getElementById('mp-chatroom-role-list');

        if (nameInput) {
          mpChatroom.name = nameInput.value.trim() || '音乐聊天室';
          const titleEl   = document.getElementById('mp-chatroom-title');
          if (titleEl) titleEl.textContent = mpChatroom.name;
        }

        /* 读取选中角色 */
        /* 读取选中角色 */
if (roleList) {
  const allRoles = (typeof window.liaoRoles !== 'undefined') ? window.liaoRoles : [];
  mpChatroomRoles = [];
  const roleItems = roleList.querySelectorAll('.mp-role-pick-item');
  roleItems.forEach((item, idx) => {
    if (item.classList.contains('selected') && allRoles[idx]) {
      mpChatroomRoles.push(allRoles[idx]);
    }
  });
  mpChatroom.roleIds = mpChatroomRoles.map(r => r.id);
}


        mpChatroom.anon = mpChatroomAnon;
        lSave('mpChatroom', mpChatroom);
        document.getElementById('mp-chatroom-settings-modal').style.display = 'none';

        /* 如果有角色加入，发一条欢迎消息 */
        if (mpChatroomRoles.length) {
          setTimeout(() => {
            const song = mpQueue[mpQueueIdx];
            triggerChatroomRoleComment(song, false);
          }, 1000);
        }
      });
    }

    const chatroomSettingsCancel = document.getElementById('mp-chatroom-settings-cancel');
    if (chatroomSettingsCancel) chatroomSettingsCancel.addEventListener('click', () => {
      document.getElementById('mp-chatroom-settings-modal').style.display = 'none';
    });

    /* ── 聊天室匿名模式 ── */
    const namedBtn = document.getElementById('mp-chatroom-mode-named');
    const anonBtn  = document.getElementById('mp-chatroom-mode-anon');
    if (namedBtn) {
      namedBtn.addEventListener('click', () => {
        mpChatroomAnon = false;
        namedBtn.classList.add('active');
        if (anonBtn) anonBtn.classList.remove('active');
      });
    }
    if (anonBtn) {
      anonBtn.addEventListener('click', () => {
        mpChatroomAnon = true;
        anonBtn.classList.add('active');
        if (namedBtn) namedBtn.classList.remove('active');
      });
    }

    /* ── 聊天室发送消息 ── */
    const chatroomInput   = document.getElementById('mp-chatroom-input');
    const chatroomSendBtn = document.getElementById('mp-chatroom-send-btn');

    function sendChatroomMsg() {
      if (!chatroomInput) return;
      const text = chatroomInput.value.trim();
      if (!text) return;
      const userName = (typeof liaoUserName !== 'undefined') ? liaoUserName : '我';
      const userAvatar = (typeof liaoUserAvatar !== 'undefined') ? liaoUserAvatar : defaultAvatar();
      const displayName = mpChatroomAnon ? '匿名用户' : userName;
      appendChatroomMsg(displayName, text, true, userAvatar);
      chatroomInput.value = '';
      /* 角色随机回复 */
      if (mpChatroomRoles.length) {
        setTimeout(() => {
          const song = mpQueue[mpQueueIdx];
          triggerChatroomRoleComment(song, false);
        }, 1000 + Math.random() * 2000);
      }
    }

    if (chatroomSendBtn) chatroomSendBtn.addEventListener('click', sendChatroomMsg);
    if (chatroomInput)   chatroomInput.addEventListener('keydown', e => { if (e.key === 'Enter') sendChatroomMsg(); });

    /* ── 聊天室切歌 ── */
    const chatroomChangeBtn = document.getElementById('mp-chatroom-change-btn');
    if (chatroomChangeBtn) {
      chatroomChangeBtn.addEventListener('click', () => {
        /* 弹出歌曲选择 */
        showPage('mp-page-library');
        renderSongList();
      });
    }

    /* ── 分享弹窗 ── */
    const shareToLiaoBtn   = document.getElementById('mp-share-to-liao');
    const shareToSuiyanBtn = document.getElementById('mp-share-to-suiyan');
    const shareCancel      = document.getElementById('mp-share-cancel');
    const shareRoleSelect  = document.getElementById('mp-share-role-select');

    if (shareToLiaoBtn) {
      shareToLiaoBtn.addEventListener('click', () => {
        const song   = mpQueue[mpQueueIdx];
        const roleId = shareRoleSelect ? shareRoleSelect.value : null;
        if (!roleId) { alert('请选择角色'); return; }
        shareToLiao(song, roleId);
      });
    }
    if (shareToSuiyanBtn) {
      shareToSuiyanBtn.addEventListener('click', () => {
        const song = mpQueue[mpQueueIdx];
        shareToSuiyan(song);
      });
    }
    if (shareCancel) shareCancel.addEventListener('click', () => {
      document.getElementById('mp-share-modal').style.display = 'none';
    });

    /* ── 迷你播放条 ── */
    const miniPlayBtn = document.getElementById('mp-mini-play-btn');
    const miniOpenBtn = document.getElementById('mp-mini-open-btn');
    if (miniPlayBtn) {
      miniPlayBtn.addEventListener('click', () => {
        if (mpIsPlaying) _audio.pause();
        else             _audio.play().catch(() => {});
      });
    }
    if (miniOpenBtn) {
      miniOpenBtn.addEventListener('click', () => {
        window.MusicApp.open();
      });
    }

    /* ── 弹窗遮罩点击关闭 ── */
    document.querySelectorAll('.mp-modal-mask').forEach(mask => {
      mask.addEventListener('click', function(e) {
        if (e.target === this) this.style.display = 'none';
      });
    });

/* ── 设置面板 ── */
const settingsBtn   = document.getElementById('mp-shell-settings-btn');
const settingsPanel = document.getElementById('mp-settings-panel');
if (settingsBtn && settingsPanel) {
  settingsBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    settingsPanel.style.display = settingsPanel.style.display === 'none' ? 'flex' : 'none';
  });
  document.addEventListener('click', () => {
    if (settingsPanel) settingsPanel.style.display = 'none';
  });
}

/* ── 视图切换 ── */
document.querySelectorAll('.mp-view-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.mp-view-btn').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    const view = this.dataset.view;
    const app  = document.getElementById('music-app');
    if (view === 'fullscreen') {
      app.classList.add('mp-fullscreen');
    } else {
      app.classList.remove('mp-fullscreen');
    }
    lSave('mpViewMode', view);
    if (settingsPanel) settingsPanel.style.display = 'none';
  });
});  /* ← 这里是关键，补上这个 }); */

/* ── 主题色切换 ── */
document.querySelectorAll('.mp-theme-swatch').forEach(btn => {
  btn.addEventListener('click', function() {
    document.querySelectorAll('.mp-theme-swatch').forEach(b => b.classList.remove('active'));
    this.classList.add('active');
    const theme = this.dataset.theme;
    const app   = document.getElementById('music-app');
    app.classList.remove('mp-theme-rosegold','mp-theme-dark','mp-theme-green','mp-theme-purple','mp-theme-gold');
    if (theme !== 'blue') {
      app.classList.add('mp-theme-' + theme);
    }
    lSave('mpTheme', theme);
    if (settingsPanel) settingsPanel.style.display = 'none';
  });
});

/* ── 恢复保存的视图和主题 ── */
const savedView  = lLoad('mpViewMode', 'outline');
const savedTheme = lLoad('mpTheme', 'blue');
const appEl      = document.getElementById('music-app');

if (savedView === 'fullscreen') {
  appEl.classList.add('mp-fullscreen');
  const fullBtn = document.getElementById('mp-view-fullscreen');
  const outBtn  = document.getElementById('mp-view-outline');
  if (fullBtn) fullBtn.classList.add('active');
  if (outBtn)  outBtn.classList.remove('active');
}

if (savedTheme && savedTheme !== 'blue') {
  appEl.classList.add('mp-theme-' + savedTheme);
  document.querySelectorAll('.mp-theme-swatch').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === savedTheme);
  });
}


    /* ── 进度条 ── */
    initProgressBar();

    /* ── Library tabs ── */
    initLibraryTabs();
  }

  /* ============================================================
     了了聊天界面音乐卡片渲染
     ============================================================ */
  function renderMusicCardInLiao(content, msg) {
    const re    = /\[MUSIC:title=([^:]*):artist=([^:]*):cover=([^\]]*)\]/;
    const match = content.match(re);
    if (!match) return null;

    const title  = match[1] || '未知歌曲';
    const artist = match[2] || '未知歌手';
    const cover  = match[3] || '';

    const card = document.createElement('div');
    card.className = 'music-card-bubble';

    if (cover) {
      const img = document.createElement('img');
      img.className = 'music-card-cover';
      img.src = cover;
      img.onerror = () => { img.style.display = 'none'; };
      card.appendChild(img);
    } else {
      const ph = document.createElement('div');
      ph.className = 'music-card-cover-ph';
      ph.innerHTML = '<i data-lucide="music" style="width:14px;height:14px;"></i>';
      card.appendChild(ph);
    }

    const info = document.createElement('div');
    info.className = 'music-card-info';
    info.innerHTML =
      '<div class="music-card-label">分享了一首歌</div>' +
      '<div class="music-card-title">' + escHtml(title) + '</div>' +
      '<div class="music-card-artist">' + escHtml(artist) + '</div>';
    card.appendChild(info);

    const playIcon = document.createElement('div');
    playIcon.className = 'music-card-play-icon';
    playIcon.innerHTML = '<i data-lucide="play-circle" style="width:18px;height:18px;"></i>';
    card.appendChild(playIcon);

    /* 点击音乐卡片，找到对应歌曲播放 */
    card.addEventListener('click', () => {
      const song = mpSongs.find(s => s.title === title && s.artist === artist);
      if (song) {
        mpQueue    = [song];
        mpQueueIdx = 0;
        playSong(song);
        window.MusicApp.open();
      } else {
        window.MusicApp.open();
      }
    });

    if (typeof lucide !== 'undefined') lucide.createIcons();
    return card;
  }

  /* 暴露给 liao-special.js 里的 renderSpecialContent，让它能处理 music 类型的消息 */
  window.mpRenderMusicCard = renderMusicCardInLiao;
  
  /* 暴露给 liao-memory.js 调用，角色切歌用 */
window.mpPlayByName = function(title) {
  if (!mpSongs || !mpSongs.length) return false;
  /* 优先完全匹配，其次模糊匹配 */
  let found = mpSongs.find(s => s.title === title);
  if (!found) found = mpSongs.find(s => s.title && s.title.includes(title));
  if (!found) return false;
  mpQueue    = mpSongs.slice();
  mpQueueIdx = mpSongs.indexOf(found);
  playSong(found);
  renderQueueList();
  if (typeof window.mpOnSongChange === 'function') window.mpOnSongChange();
  return true;
};

/* 暴露歌单列表给 prompt 用 */
window.mpGetSongTitles = function() {
  if (!mpSongs || !mpSongs.length) return [];
  return mpSongs.map(s => s.title || '未知歌曲');
};


  /* ============================================================
     全局接口
     ============================================================ */
window.MusicApp = {
  open() {
    const app = document.getElementById('music-app');
    if (app) app.style.display = 'flex';
    if (!_eventsBound) {
      bindEvents();
      _eventsBound = true;
    }
    showPage('mp-page-player');
    syncMiniBar();
    if (typeof lucide !== 'undefined') lucide.createIcons();
  },
  close() {
    const app = document.getElementById('music-app');
    if (app) app.style.display = 'none';
    syncMiniBar();
  }
};

  /* ============================================================
     初始化
     ============================================================ */
  /* 页面横滑时不影响音乐播放（后台播放） */
  window.addEventListener('visibilitychange', () => {
    syncMiniBar();
  });

})();
