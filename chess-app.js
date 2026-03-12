/* ============================================================
   chess-app.js — 棋圣 App 逻辑层
   ============================================================ */

(function () {
  'use strict';

  /* ============================================================
     工具函数
     ============================================================ */
  function csLoad(key) {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? JSON.parse(v) : null;
    } catch (e) { return null; }
  }

  function csSave(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) {}
  }

  function csGetApiConfig() {
    return csLoad('halo9_apiActiveConfig');
  }

  function csGetApiModel() {
    return csLoad('halo9_apiCurrentModel') || '';
  }

  function csGetRoles() {
    const keys = ['liao_roles', 'halo9_roles', 'roles'];
    for (const k of keys) {
      const v = csLoad(k);
      if (Array.isArray(v) && v.length > 0) return v;
    }
    return [];
  }

  function csGetRoleName(role) {
    if (!role) return '角色';
    return role.nickname || role.realname || role.name || '角色';
  }

  function csGetRoleAvatar(role) {
    if (!role) return 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=chess';
    return role.avatar ||
      'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=' +
      encodeURIComponent(csGetRoleName(role));
  }

  function csGetRoleSetting(role) {
    if (!role) return '';
    return role.setting || role.persona || role.description || '';
  }

  /* 动态时间格式：今天/昨天/X天前 + HH:MM */
  function csFormatRelativeTime(ts) {
    const now   = new Date();
    const d     = new Date(ts);
    const diff  = Math.floor((now - d) / 86400000);
    const hh    = String(d.getHours()).padStart(2, '0');
    const mm    = String(d.getMinutes()).padStart(2, '0');
    const tstr  = hh + ':' + mm;
    if (diff === 0) return '今天' + tstr;
    if (diff === 1) return '昨天' + tstr;
    return diff + '天前' + tstr;
  }

  /* ============================================================
     状态
     ============================================================ */
  let currentGameType   = '';   // 'tictactoe' | 'gomoku' | 'go'
  let currentGameMode   = '';   // 'offline' | 'online'
  let currentRole       = null; // 当前对战角色对象
  let selectedRoleId    = null; // 角色选择界面选中的 id
  let roleSelectSource  = '';   // 'tictactoe' | 'gomoku-online' | 'go'

  /* ============================================================
     视图切换
     ============================================================ */
  const CHESS_VIEWS = [
    'chess-home-view',
    'chess-gomoku-menu-view',
    'chess-role-select-view',
    'chess-tictactoe-view',
    'chess-gomoku-view',
    'chess-go-view',
  ];

  function chessShowView(id) {
    CHESS_VIEWS.forEach(v => {
      const el = document.getElementById(v);
      if (el) el.style.display = (v === id) ? 'flex' : 'none';
    });
  }

  /* ============================================================
     全局接口
     ============================================================ */
  window.ChessApp = {
    open() {
      const app = document.getElementById('chess-app');
      if (app) app.style.display = 'block';
      chessShowView('chess-home-view');
    },
    close() {
      const app = document.getElementById('chess-app');
      if (app) app.style.display = 'none';
    }
  };

  /* ============================================================
     顶栏返回按钮绑定
     ============================================================ */
  function bindBack(btnId, handler) {
    const btn = document.getElementById(btnId);
    if (btn) btn.addEventListener('click', handler);
  }

  bindBack('chess-home-back',        () => window.ChessApp.close());
  bindBack('chess-gomoku-menu-back', () => chessShowView('chess-home-view'));
  bindBack('chess-role-back',        () => {
    if (roleSelectSource === 'gomoku-online') chessShowView('chess-gomoku-menu-view');
    else chessShowView('chess-home-view');
  });
  bindBack('chess-ttt-back',    () => chessShowView('chess-home-view'));
  bindBack('chess-gomoku-back', () => chessShowView('chess-gomoku-menu-view'));
  bindBack('chess-go-back',     () => chessShowView('chess-home-view'));

  /* ============================================================
     主界面：三个游戏按钮
     ============================================================ */
  document.getElementById('chess-btn-tictactoe').addEventListener('click', () => {
    roleSelectSource = 'tictactoe';
    document.getElementById('chess-role-select-title').textContent = '井字棋 · 选择对手';
    renderRoleSelectList();
    chessShowView('chess-role-select-view');
  });

  document.getElementById('chess-btn-gomoku').addEventListener('click', () => {
    chessShowView('chess-gomoku-menu-view');
  });

  document.getElementById('chess-btn-go').addEventListener('click', () => {
    roleSelectSource = 'go';
    document.getElementById('chess-role-select-title').textContent = '围棋 · 选择对手';
    renderRoleSelectList();
    chessShowView('chess-role-select-view');
  });

  /* ============================================================
     五子棋选项界面
     ============================================================ */
  document.getElementById('chess-gomoku-offline').addEventListener('click', () => {
    currentGameMode = 'offline';
    currentGameType = 'gomoku';
    currentRole     = null;
    startGomoku();
  });

  document.getElementById('chess-gomoku-online').addEventListener('click', () => {
    currentGameMode = 'online';
    roleSelectSource = 'gomoku-online';
    document.getElementById('chess-role-select-title').textContent = '五子棋 · 选择对手';
    renderRoleSelectList();
    chessShowView('chess-role-select-view');
  });

  /* ============================================================
     角色选择视图
     ============================================================ */
  function renderRoleSelectList() {
    const container = document.getElementById('chess-role-list');
    container.innerHTML = '';
    selectedRoleId = null;

    const roles = csGetRoles();
    if (!roles.length) {
      const tip = document.createElement('div');
      tip.style.cssText = 'text-align:center;color:#9a7c52;margin-top:40px;font-size:14px;letter-spacing:.06em;';
      tip.textContent = '暂无角色，请先在了了中添加角色';
      container.appendChild(tip);
      return;
    }

    roles.forEach(role => {
      const card = document.createElement('div');
      card.className = 'chess-role-card';
      card.dataset.roleId = String(role.id || role.realname || role.nickname || role.name || '');

      const avatar = document.createElement('img');
      avatar.className = 'chess-role-avatar';
      avatar.src = csGetRoleAvatar(role);
      avatar.alt = '';

      const name = document.createElement('div');
      name.className = 'chess-role-name';
      name.textContent = csGetRoleName(role);

      card.appendChild(avatar);
      card.appendChild(name);

      card.addEventListener('click', () => {
        document.querySelectorAll('#chess-role-list .chess-role-card').forEach(c => {
          c.classList.remove('selected');
        });
        card.classList.add('selected');
        selectedRoleId = card.dataset.roleId;
      });

      container.appendChild(card);
    });
  }

  document.getElementById('chess-start-battle-btn').addEventListener('click', () => {
    if (!selectedRoleId) {
      alert('请先选择一位对手');
      return;
    }
    const roles = csGetRoles();
    currentRole = roles.find(r =>
      String(r.id || r.realname || r.nickname || r.name || '') === selectedRoleId
    ) || null;

    if (roleSelectSource === 'tictactoe') {
      currentGameType = 'tictactoe';
      currentGameMode = 'online';
      startTicTacToe();
    } else if (roleSelectSource === 'gomoku-online') {
      currentGameType = 'gomoku';
      currentGameMode = 'online';
      startGomoku();
    } else if (roleSelectSource === 'go') {
      currentGameType = 'go';
      currentGameMode = 'online';
      startGo();
    }
  });

  /* ============================================================
     结果弹窗
     ============================================================ */
  let lastGameResult = ''; // '赢' | '输' | '平'

  function showResultModal(text, result) {
    lastGameResult = result;
    document.getElementById('chess-result-text').textContent = text;
    document.getElementById('chess-result-modal').style.display = 'flex';
  }

  function hideResultModal() {
    document.getElementById('chess-result-modal').style.display = 'none';
  }

  document.getElementById('chess-result-replay').addEventListener('click', () => {
    hideResultModal();
    if (currentGameType === 'tictactoe') startTicTacToe();
    else if (currentGameType === 'gomoku')  startGomoku();
    else if (currentGameType === 'go')      startGo();
  });

  document.getElementById('chess-result-memory').addEventListener('click', () => {
    injectChessMemory();
  });

  /* ---- 记忆注入 ---- */
  function injectChessMemory() {
    if (!currentRole) { alert('无对战角色，无法注入记忆'); return; }

    const roleId = String(
      currentRole.id || currentRole.realname ||
      currentRole.nickname || currentRole.name || ''
    );
    const roleName  = csGetRoleName(currentRole);
    const gameNames = { tictactoe: '井字棋', gomoku: '五子棋', go: '围棋' };
    const gameName  = gameNames[currentGameType] || '棋局';
    const resultMap = { 赢: '用户赢了', 输: '用户输了', 平: '平局' };
    const resultStr = resultMap[lastGameResult] || '对战结束';
    const timeStr   = csFormatRelativeTime(Date.now());

    const content =
      timeStr + '与用户下了一局' + gameName + '，' + resultStr;

    /* 读取 liao_chats */
    let chats = csLoad('liao_chats') || [];
    let chat  = chats.find(c => c.roleId === roleId);

    if (!chat) {
      chat = { roleId, messages: [], memory: { longTerm: [], shortTerm: [], important: [], other: {} } };
      chats.push(chat);
    }
    if (!chat.memory)       chat.memory       = { longTerm: [], shortTerm: [], important: [], other: {} };
    if (!chat.memory.other) chat.memory.other = {};
    if (!Array.isArray(chat.memory.other.chess)) chat.memory.other.chess = [];

    chat.memory.other.chess.push({
      id:      'chess_' + Date.now() + '_' + Math.random().toString(36).slice(2),
      content,
      ts:      Date.now()
    });

    csSave('liao_chats', chats);

    /* 同步到 liao-core.js 的全局变量（如果已加载） */
    if (typeof liaoChats !== 'undefined') {
      const idx = liaoChats.findIndex(c => c.roleId === roleId);
      if (idx >= 0) {
        liaoChats[idx] = chat;
      } else {
        liaoChats.push(chat);
      }
    }

    alert('已注入记忆：' + content);
    hideResultModal();
  }

  /* ============================================================
     临时聊天框（通用）
     ============================================================ */
  let chatHistories = {}; // key: gameType, value: [{role, content}]

  function getChatHistory(gameType) {
    if (!chatHistories[gameType]) chatHistories[gameType] = [];
    return chatHistories[gameType];
  }

  function clearChatHistory(gameType) {
    chatHistories[gameType] = [];
  }

  function appendChatMsg(msgsContainerId, text, isUser) {
    const container = document.getElementById(msgsContainerId);
    if (!container) return;
    const div = document.createElement('div');
    div.className = 'chess-chat-msg ' + (isUser ? 'user-msg' : 'role-msg');
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function clearChatMsgs(msgsContainerId) {
    const container = document.getElementById(msgsContainerId);
    if (container) container.innerHTML = '';
  }

  function buildBoardStateDesc(gameType) {
    if (gameType === 'tictactoe') {
      return '当前棋盘：' + tttBoard.map((v, i) => v || (i + 1)).join('|');
    }
    if (gameType === 'gomoku') {
      let count = gomokuBoard.flat().filter(v => v !== 0).length;
      return '当前五子棋棋盘已落子' + count + '枚';
    }
    if (gameType === 'go') {
      let count = goBoard.flat().filter(v => v !== 0).length;
      return '当前围棋棋盘已落子' + count + '枚';
    }
    return '';
  }

  async function sendChatMessage(gameType, inputId, msgsId) {
    const inputEl = document.getElementById(inputId);
    if (!inputEl) return;
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';

    appendChatMsg(msgsId, text, true);

    const history = getChatHistory(gameType);
    history.push({ role: 'user', content: text });

    if (!currentRole) return;

    const cfg   = csGetApiConfig();
    const model = csGetApiModel();
    if (!cfg || !cfg.url || !model) return;

    const gameNames = { tictactoe: '井字棋', gomoku: '五子棋', go: '围棋' };
    const gameName  = gameNames[gameType] || '棋局';
    const roleName  = csGetRoleName(currentRole);
    const setting   = csGetRoleSetting(currentRole);
    const boardDesc = buildBoardStateDesc(gameType);

    const systemPrompt =
      '你扮演角色' + roleName + '，' + (setting ? setting : '') + '。' +
      '现在你们正在下' + gameName + '，' + boardDesc + '。' +
      '用口语短句回复，1-2句话，像发微信。不使用任何emoji。';

    const recent = history.slice(-5);
    const messages = [{ role: 'system', content: systemPrompt }, ...recent];

    try {
      const endpoint = cfg.url.replace(/\/$/, '') + '/chat/completions';
      const headers  = { 'Content-Type': 'application/json' };
      if (cfg.key) headers['Authorization'] = 'Bearer ' + cfg.key;

      const res = await fetch(endpoint, {
        method:  'POST',
        headers,
        body:    JSON.stringify({ model, messages, stream: false })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const json  = await res.json();
      const reply = (json.choices?.[0]?.message?.content || '').trim();
      if (!reply) return;

      history.push({ role: 'assistant', content: reply });
      appendChatMsg(msgsId, reply, false);
    } catch (e) {
      appendChatMsg(msgsId, '（回复失败：' + e.message + '）', false);
    }
  }

  /* 绑定聊天发送 */
  function bindChatSend(gameType, inputId, sendBtnId, msgsId) {
    const sendBtn = document.getElementById(sendBtnId);
    const inputEl = document.getElementById(inputId);
    if (sendBtn) {
      sendBtn.addEventListener('click', () => {
        sendChatMessage(gameType, inputId, msgsId);
      });
    }
    if (inputEl) {
      inputEl.addEventListener('keydown', e => {
        if (e.key === 'Enter') sendChatMessage(gameType, inputId, msgsId);
      });
    }
  }

  bindChatSend('tictactoe', 'chess-ttt-input',    'chess-ttt-send',    'chess-ttt-msgs');
  bindChatSend('gomoku',    'chess-gomoku-input',  'chess-gomoku-send', 'chess-gomoku-msgs');
  bindChatSend('go',        'chess-go-input',      'chess-go-send',     'chess-go-msgs');

  /* ============================================================
     ① 井字棋
     ============================================================ */
  let tttBoard    = Array(9).fill(null); // null | 'X' | 'O'
  let tttUserPiece = 'X';  // 用户棋子
  let tttAIPiece   = 'O';
  let tttIsUserTurn = true;
  let tttGameOver   = false;

  const TTT_LINES = [
    [0,1,2],[3,4,5],[6,7,8],
    [0,3,6],[1,4,7],[2,5,8],
    [0,4,8],[2,4,6]
  ];

  function startTicTacToe() {
    tttBoard      = Array(9).fill(null);
    tttGameOver   = false;
    tttUserPiece  = 'X';
    tttAIPiece    = 'O';
    tttIsUserTurn = true;

    clearChatHistory('tictactoe');
    clearChatMsgs('chess-ttt-msgs');

    /* 设置先手还是后手的选择，这里直接默认用户先手 */

    /* 恢复对手信息 */
    if (currentRole) {
      const av = document.getElementById('chess-ttt-avatar');
      const nm = document.getElementById('chess-ttt-name');
      if (av) av.src = csGetRoleAvatar(currentRole);
      if (nm) nm.textContent = csGetRoleName(currentRole);
    }

    renderTTTBoard();
    updateTTTTurnHint();
    chessShowView('chess-tictactoe-view');
  }

  function renderTTTBoard() {
    const cells = document.querySelectorAll('#chess-ttt-board .chess-ttt-cell');
    cells.forEach((cell, idx) => {
      cell.textContent = tttBoard[idx] || '';
      cell.dataset.piece = tttBoard[idx] || '';
    });
  }

  function updateTTTTurnHint() {
    const el = document.getElementById('chess-ttt-turn');
    if (!el) return;
    if (tttGameOver) { el.textContent = '对局结束'; return; }
    el.textContent = tttIsUserTurn ? '轮到你了' : '对手思考中…';
  }

  function tttCheckWinner(board) {
    for (const line of TTT_LINES) {
      const [a, b, c] = line;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }
    if (board.every(v => v !== null)) return 'draw';
    return null;
  }

  function tttAIMove() {
    /* 1. 能赢就赢 */
    for (let i = 0; i < 9; i++) {
      if (tttBoard[i]) continue;
      tttBoard[i] = tttAIPiece;
      if (tttCheckWinner(tttBoard) === tttAIPiece) return i;
      tttBoard[i] = null;
    }
    /* 2. 阻止用户赢 */
    for (let i = 0; i < 9; i++) {
      if (tttBoard[i]) continue;
      tttBoard[i] = tttUserPiece;
      if (tttCheckWinner(tttBoard) === tttUserPiece) {
        tttBoard[i] = null;
        return i;
      }
      tttBoard[i] = null;
    }
    /* 3. 优先中心 */
    if (!tttBoard[4]) return 4;
    /* 4. 随机空格 */
    const empties = tttBoard.map((v, i) => v === null ? i : -1).filter(i => i >= 0);
    return empties[Math.floor(Math.random() * empties.length)];
  }

  function tttHandleAITurn() {
    if (tttGameOver) return;
    updateTTTTurnHint();
    setTimeout(() => {
      if (tttGameOver) return;
      const idx = tttAIMove();
      if (idx === undefined || idx < 0) return;
      tttBoard[idx] = tttAIPiece;
      renderTTTBoard();
      const winner = tttCheckWinner(tttBoard);
      if (winner) {
        tttGameOver = true;
        updateTTTTurnHint();
        setTimeout(() => {
          if (winner === 'draw') showResultModal('平局！', '平');
          else showResultModal('你输了', '输');
        }, 300);
        return;
      }
      tttIsUserTurn = true;
      updateTTTTurnHint();
    }, 600);
  }

  /* 点击棋盘格子 */
  document.getElementById('chess-ttt-board').addEventListener('click', e => {
    const cell = e.target.closest('.chess-ttt-cell');
    if (!cell) return;
    if (!tttIsUserTurn || tttGameOver) return;
    const idx = parseInt(cell.dataset.idx);
    if (tttBoard[idx]) return;

    tttBoard[idx]  = tttUserPiece;
    tttIsUserTurn  = false;
    renderTTTBoard();

    const winner = tttCheckWinner(tttBoard);
    if (winner) {
      tttGameOver = true;
      updateTTTTurnHint();
      setTimeout(() => {
        if (winner === 'draw') showResultModal('平局！', '平');
        else showResultModal('你赢了！', '赢');
      }, 200);
      return;
    }
    tttHandleAITurn();
  });

  document.getElementById('chess-ttt-resign').addEventListener('click', () => {
    if (tttGameOver) return;
    tttGameOver = true;
    showResultModal('你认输了', '输');
  });

  document.getElementById('chess-ttt-replay').addEventListener('click', () => {
    hideResultModal();
    startTicTacToe();
  });

  /* ============================================================
     ② 五子棋
     ============================================================ */
  const GOMOKU_SIZE = 15;
  let gomokuBoard      = [];  // 0=空, 1=黑(用户先手), 2=白(AI)
  let gomokuUserPiece  = 1;
  let gomokuAIPiece    = 2;
  let gomokuIsUserTurn = true;
  let gomokuGameOver   = false;

  function startGomoku() {
    gomokuBoard      = Array.from({ length: GOMOKU_SIZE }, () => Array(GOMOKU_SIZE).fill(0));
    gomokuUserPiece  = 1;
    gomokuAIPiece    = 2;
    gomokuIsUserTurn = true;
    gomokuGameOver   = false;

    clearChatHistory('gomoku');
    clearChatMsgs('chess-gomoku-msgs');

    /* 在线模式显示聊天框 */
    const chatEl = document.getElementById('chess-gomoku-chat');
    if (chatEl) {
      if (currentGameMode === 'online') {
        chatEl.classList.remove('chess-gomoku-chat-hidden');
      } else {
        chatEl.classList.add('chess-gomoku-chat-hidden');
      }
    }

    /* 对手名 */
    const opEl = document.getElementById('chess-gomoku-opponent-name');
    if (opEl) opEl.textContent = currentRole ? csGetRoleName(currentRole) : 'AI';

    buildGomokuBoard();
    updateGomokuTurnHint();
    chessShowView('chess-gomoku-view');
  }

  function buildGomokuBoard() {
    const container = document.getElementById('chess-gomoku-board');
    if (!container) return;
    container.innerHTML = '';
    for (let r = 0; r < GOMOKU_SIZE; r++) {
      for (let c = 0; c < GOMOKU_SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'chess-gomoku-cell';
        cell.dataset.r = r;
        cell.dataset.c = c;
        container.appendChild(cell);
      }
    }
  }

  function renderGomokuBoard() {
    const cells = document.querySelectorAll('#chess-gomoku-board .chess-gomoku-cell');
    cells.forEach(cell => {
      const r = parseInt(cell.dataset.r);
      const c = parseInt(cell.dataset.c);
      cell.innerHTML = '';
      const val = gomokuBoard[r][c];
      if (val !== 0) {
        const piece = document.createElement('div');
        piece.className = 'chess-piece ' + (val === 1 ? 'black' : 'white');
        cell.appendChild(piece);
      }
    });
  }

  function updateGomokuTurnHint() {
    const el = document.getElementById('chess-gomoku-turn');
    if (!el) return;
    if (gomokuGameOver) { el.textContent = '对局结束'; return; }
    el.textContent = gomokuIsUserTurn ? '轮到你了（黑子）' : '对手思考中…';
  }

  /* 评分算法 */
  function gomokuScore(board, r, c, piece, size) {
    const dirs = [[1,0],[0,1],[1,1],[1,-1]];
    let total = 0;
    for (const [dr, dc] of dirs) {
      let count = 1;
      for (let step = 1; step < 5; step++) {
        const nr = r + dr * step, nc = c + dc * step;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size || board[nr][nc] !== piece) break;
        count++;
      }
      for (let step = 1; step < 5; step++) {
        const nr = r - dr * step, nc = c - dc * step;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size || board[nr][nc] !== piece) break;
        count++;
      }
      if (count >= 5) total += 100000;
      else total += Math.pow(10, count);
    }
    return total;
  }

  function gomokuAIPickMove(board, aiPiece, userPiece, size) {
    let bestScore = -1;
    let bestPos   = null;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (board[r][c] !== 0) continue;
        const atkScore = gomokuScore(board, r, c, aiPiece, size);
        const defScore = gomokuScore(board, r, c, userPiece, size);
        const score    = atkScore * 1.1 + defScore;
        if (score > bestScore) { bestScore = score; bestPos = [r, c]; }
      }
    }
    return bestPos;
  }

  function gomokuCheckWin(board, r, c, piece, size) {
    const dirs = [[1,0],[0,1],[1,1],[1,-1]];
    for (const [dr, dc] of dirs) {
      let count = 1;
      for (let step = 1; step < 5; step++) {
        const nr = r + dr * step, nc = c + dc * step;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size || board[nr][nc] !== piece) break;
        count++;
      }
      for (let step = 1; step < 5; step++) {
        const nr = r - dr * step, nc = c - dc * step;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size || board[nr][nc] !== piece) break;
        count++;
      }
      if (count >= 5) return true;
    }
    return false;
  }

  async function gomokuHandleAITurn() {
    if (gomokuGameOver) return;
    updateGomokuTurnHint();

    let pos = null;

    /* 在线模式：先尝试 API 决策 */
    if (currentGameMode === 'online' && currentRole) {
      pos = await gomokuAskRoleMove();
    }

    /* 离线或 API 失败：评分算法 */
    if (!pos) {
      pos = gomokuAIPickMove(gomokuBoard, gomokuAIPiece, gomokuUserPiece, GOMOKU_SIZE);
    }

    if (!pos) return;
    const [r, c] = pos;
    gomokuBoard[r][c] = gomokuAIPiece;
    renderGomokuBoard();

    if (gomokuCheckWin(gomokuBoard, r, c, gomokuAIPiece, GOMOKU_SIZE)) {
      gomokuGameOver = true;
      updateGomokuTurnHint();
      setTimeout(() => showResultModal('你输了', '输'), 300);
      return;
    }
    gomokuIsUserTurn = true;
    updateGomokuTurnHint();
  }

  async function gomokuAskRoleMove() {
    const cfg   = csGetApiConfig();
    const model = csGetApiModel();
    if (!cfg || !cfg.url || !model) return null;

    const roleName = csGetRoleName(currentRole);
    const setting  = csGetRoleSetting(currentRole);

    /* 简要描述棋盘 */
    let boardLines = [];
    for (let r = 0; r < GOMOKU_SIZE; r++) {
      boardLines.push(gomokuBoard[r].join(' '));
    }
    const boardStr = boardLines.join('\n');

    const systemPrompt =
      '你扮演角色' + roleName + '，' + (setting || '') + '。\n' +
      '你正在和用户下五子棋，棋盘15x15，0=空，1=黑子（用户），2=白子（你）。\n' +
      '当前棋盘（行x列）：\n' + boardStr + '\n' +
      '请选择一个空位落子，只输出坐标，格式为"行,列"（如"7,8"），行列均从0开始，不要输出任何其他文字。';

    try {
      const endpoint = cfg.url.replace(/\/$/, '') + '/chat/completions';
      const headers  = { 'Content-Type': 'application/json' };
      if (cfg.key) headers['Authorization'] = 'Bearer ' + cfg.key;

      const res = await fetch(endpoint, {
        method:  'POST',
        headers,
        body:    JSON.stringify({
          model,
          messages: [{ role: 'system', content: systemPrompt }],
          stream: false
        })
      });
      if (!res.ok) return null;

      const json  = await res.json();
      const reply = (json.choices?.[0]?.message?.content || '').trim();

      /* 解析坐标 */
      const match = reply.match(/(\d+)\s*[,，]\s*(\d+)/);
      if (!match) return null;
      const r = parseInt(match[1]);
      const c = parseInt(match[2]);
      if (r < 0 || r >= GOMOKU_SIZE || c < 0 || c >= GOMOKU_SIZE) return null;
      if (gomokuBoard[r][c] !== 0) return null;
      return [r, c];
    } catch (e) {
      return null;
    }
  }

  document.getElementById('chess-gomoku-board').addEventListener('click', e => {
    const cell = e.target.closest('.chess-gomoku-cell');
    if (!cell) return;
    if (!gomokuIsUserTurn || gomokuGameOver) return;
    const r = parseInt(cell.dataset.r);
    const c = parseInt(cell.dataset.c);
    if (gomokuBoard[r][c] !== 0) return;

    gomokuBoard[r][c]  = gomokuUserPiece;
    gomokuIsUserTurn   = false;
    renderGomokuBoard();

    if (gomokuCheckWin(gomokuBoard, r, c, gomokuUserPiece, GOMOKU_SIZE)) {
      gomokuGameOver = true;
      updateGomokuTurnHint();
      setTimeout(() => showResultModal('你赢了！', '赢'), 200);
      return;
    }

    /* 判断平局（棋盘满） */
    const full = gomokuBoard.every(row => row.every(v => v !== 0));
    if (full) {
      gomokuGameOver = true;
      updateGomokuTurnHint();
      setTimeout(() => showResultModal('平局！', '平'), 200);
      return;
    }

    setTimeout(() => gomokuHandleAITurn(), 400);
  });

  document.getElementById('chess-gomoku-resign').addEventListener('click', () => {
    if (gomokuGameOver) return;
    gomokuGameOver = true;
    showResultModal('你认输了', '输');
  });

  document.getElementById('chess-gomoku-replay').addEventListener('click', () => {
    hideResultModal();
    startGomoku();
  });

  /* ============================================================
     ③ 围棋
     ============================================================ */
  const GO_SIZE = 19;
  let goBoard       = [];   // 0=空, 1=黑(用户), 2=白(AI)
  let goUserPiece   = 1;
  let goAIPiece     = 2;
  let goIsUserTurn  = true;
  let goGameOver    = false;
  let goCaptured    = { 1: 0, 2: 0 }; // 各方被提掉的子数
  let goConsecPass  = 0;               // 连续 pass 次数（两次则终局）

  function startGo() {
    goBoard      = Array.from({ length: GO_SIZE }, () => Array(GO_SIZE).fill(0));
    goUserPiece  = 1;
    goAIPiece    = 2;
    goIsUserTurn = true;
    goGameOver   = false;
    goCaptured   = { 1: 0, 2: 0 };
    goConsecPass = 0;

    clearChatHistory('go');
    clearChatMsgs('chess-go-msgs');

    const opEl = document.getElementById('chess-go-opponent-name');
    if (opEl) opEl.textContent = currentRole ? csGetRoleName(currentRole) : 'AI';

    buildGoBoard();
    updateGoTurnHint();
    chessShowView('chess-go-view');
  }

  function buildGoBoard() {
    const container = document.getElementById('chess-go-board');
    if (!container) return;
    container.innerHTML = '';
    for (let r = 0; r < GO_SIZE; r++) {
      for (let c = 0; c < GO_SIZE; c++) {
        const cell = document.createElement('div');
        cell.className = 'chess-go-cell';
        cell.dataset.r = r;
        cell.dataset.c = c;
        container.appendChild(cell);
      }
    }
  }

  function renderGoBoard() {
    const cells = document.querySelectorAll('#chess-go-board .chess-go-cell');
    cells.forEach(cell => {
      const r = parseInt(cell.dataset.r);
      const c = parseInt(cell.dataset.c);
      cell.innerHTML = '';
      const val = goBoard[r][c];
      if (val !== 0) {
        const piece = document.createElement('div');
        piece.className = 'chess-piece ' + (val === 1 ? 'black' : 'white');
        cell.appendChild(piece);
      }
    });
  }

  function updateGoTurnHint() {
    const el = document.getElementById('chess-go-turn');
    if (!el) return;
    if (goGameOver) { el.textContent = '对局结束'; return; }
    el.textContent = goIsUserTurn ? '轮到你了（黑子）' : '对手落子中…';
  }

  /* 获取某个棋子所在连通块的气 */
  function goGetGroup(board, r, c) {
    const piece = board[r][c];
    if (!piece) return { stones: [], liberties: new Set() };

    const visited   = new Set();
    const liberties = new Set();
    const stones    = [];
    const stack     = [[r, c]];

    while (stack.length) {
      const [cr, cc] = stack.pop();
      const key = cr + ',' + cc;
      if (visited.has(key)) continue;
      visited.add(key);
      stones.push([cr, cc]);

      const neighbors = [[cr-1,cc],[cr+1,cc],[cr,cc-1],[cr,cc+1]];
      for (const [nr, nc] of neighbors) {
        if (nr < 0 || nr >= GO_SIZE || nc < 0 || nc >= GO_SIZE) continue;
        if (board[nr][nc] === 0) {
          liberties.add(nr + ',' + nc);
        } else if (board[nr][nc] === piece && !visited.has(nr + ',' + nc)) {
          stack.push([nr, nc]);
        }
      }
    }
    return { stones, liberties };
  }

  /* 提子：返回被提掉的棋子数 */
  function goCapture(board, r, c, opponentPiece) {
    let captured = 0;
    const neighbors = [[r-1,c],[r+1,c],[r,c-1],[r,c+1]];
    for (const [nr, nc] of neighbors) {
      if (nr < 0 || nr >= GO_SIZE || nc < 0 || nc >= GO_SIZE) continue;
      if (board[nr][nc] !== opponentPiece) continue;
      const group = goGetGroup(board, nr, nc);
      if (group.liberties.size === 0) {
        group.stones.forEach(([sr, sc]) => { board[sr][sc] = 0; });
        captured += group.stones.length;
      }
    }
    return captured;
  }

  /* 禁入点检测：落子后自身气为0且无法提对方子，则禁止 */
  function goIsValidMove(board, r, c, piece) {
    if (board[r][c] !== 0) return false;
    const opponent = piece === 1 ? 2 : 1;
    const testBoard = board.map(row => row.slice());
    testBoard[r][c] = piece;

    /* 先检查能否提对方子 */
    const neighbors = [[r-1,c],[r+1,c],[r,c-1],[r,c+1]];
    for (const [nr, nc] of neighbors) {
      if (nr < 0 || nr >= GO_SIZE || nc < 0 || nc >= GO_SIZE) continue;
      if (testBoard[nr][nc] !== opponent) continue;
      const group = goGetGroup(testBoard, nr, nc);
      if (group.liberties.size === 0) return true; // 能提子，合法
    }

    /* 检查自身气 */
    const selfGroup = goGetGroup(testBoard, r, c);
    return selfGroup.liberties.size > 0;
  }

  /* 围棋评分落子 */
  function goAIPickMove(board, aiPiece, userPiece, size) {
    let bestScore = -Infinity;
    let bestPos   = null;

    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (!goIsValidMove(board, r, c, aiPiece)) continue;

        const testBoard = board.map(row => row.slice());
        testBoard[r][c] = aiPiece;
        const capturedCount = goCapture(testBoard, r, c, userPiece);

        let score = capturedCount * 50;

        /* 简单启发：靠近已有子 */
        const neighbors = [[r-1,c],[r+1,c],[r,c-1],[r,c+1],
                           [r-1,c-1],[r-1,c+1],[r+1,c-1],[r+1,c+1]];
        for (const [nr, nc] of neighbors) {
          if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
          if (board[nr][nc] === aiPiece)   score += 8;
          if (board[nr][nc] === userPiece) score += 5;
        }

        /* 靠近中心 */
        const center = (size - 1) / 2;
        const dist   = Math.abs(r - center) + Math.abs(c - center);
        score -= dist * 0.5;

        /* 加入随机扰动，避免总走同一位置 */
        score += Math.random() * 3;

        if (score > bestScore) { bestScore = score; bestPos = [r, c]; }
      }
    }

    /* 若无合法位置，pass */
    return bestPos;
  }

  function goHandleAITurn() {
    if (goGameOver) return;
    updateGoTurnHint();

    setTimeout(() => {
      if (goGameOver) return;
      const pos = goAIPickMove(goBoard, goAIPiece, goUserPiece, GO_SIZE);

      if (!pos) {
        /* AI pass */
        goConsecPass++;
        if (goConsecPass >= 2) {
          goGameOver = true;
          updateGoTurnHint();
          goCalcResult();
          return;
        }
        goIsUserTurn = true;
        updateGoTurnHint();
        return;
      }

      goConsecPass = 0;
      const [r, c] = pos;
      goBoard[r][c] = goAIPiece;
      const cap = goCapture(goBoard, r, c, goUserPiece);
      goCaptured[goUserPiece] += cap;

      renderGoBoard();
      goIsUserTurn = true;
      updateGoTurnHint();
    }, 700);
  }

  /* 数子法计分 */
  function goCalcResult() {
    /* 统计各方围住的空点（flood fill 空点，看周围只有哪方的子） */
    const visited = Array.from({ length: GO_SIZE }, () => Array(GO_SIZE).fill(false));
    let blackTerritory = 0;
    let whiteTerritory = 0;

    for (let r = 0; r < GO_SIZE; r++) {
      for (let c = 0; c < GO_SIZE; c++) {
        if (goBoard[r][c] !== 0 || visited[r][c]) continue;

        /* BFS 找连通空点 */
        const queue    = [[r, c]];
        const empties  = [];
        let touchBlack = false;
        let touchWhite = false;
        visited[r][c]  = true;

        while (queue.length) {
          const [cr, cc] = queue.shift();
          empties.push([cr, cc]);
          const nbrs = [[cr-1,cc],[cr+1,cc],[cr,cc-1],[cr,cc+1]];
          for (const [nr, nc] of nbrs) {
            if (nr < 0 || nr >= GO_SIZE || nc < 0 || nc >= GO_SIZE) continue;
            if (visited[nr][nc]) continue;
            if (goBoard[nr][nc] === 0) {
              visited[nr][nc] = true;
              queue.push([nr, nc]);
            } else if (goBoard[nr][nc] === 1) {
              touchBlack = true;
            } else if (goBoard[nr][nc] === 2) {
              touchWhite = true;
            }
          }
        }

        if (touchBlack && !touchWhite) blackTerritory += empties.length;
        else if (touchWhite && !touchBlack) whiteTerritory += empties.length;
      }
    }

    /* 统计棋盘上的子数 */
    let blackStones = 0, whiteStones = 0;
    goBoard.forEach(row => row.forEach(v => {
      if (v === 1) blackStones++;
      if (v === 2) whiteStones++;
    }));

    const blackScore = blackTerritory + blackStones + goCaptured[2];
    const whiteScore = whiteTerritory + whiteStones + goCaptured[1] + 6.5; // 贴目

    if (blackScore > whiteScore) {
      showResultModal('你赢了！\n黑 ' + blackScore + ' : 白 ' + whiteScore.toFixed(1), '赢');
    } else if (whiteScore > blackScore) {
      showResultModal('你输了\n黑 ' + blackScore + ' : 白 ' + whiteScore.toFixed(1), '输');
    } else {
      showResultModal('平局！', '平');
    }
  }

  document.getElementById('chess-go-board').addEventListener('click', e => {
    const cell = e.target.closest('.chess-go-cell');
    if (!cell) return;
    if (!goIsUserTurn || goGameOver) return;
    const r = parseInt(cell.dataset.r);
    const c = parseInt(cell.dataset.c);

    if (!goIsValidMove(goBoard, r, c, goUserPiece)) return;

    goConsecPass      = 0;
    goBoard[r][c]     = goUserPiece;
    const cap         = goCapture(goBoard, r, c, goAIPiece);
    goCaptured[goAIPiece] += cap;

    goIsUserTurn = false;
    renderGoBoard();
    updateGoTurnHint();

    setTimeout(() => goHandleAITurn(), 300);
  });

  document.getElementById('chess-go-resign').addEventListener('click', () => {
    if (goGameOver) return;
    goGameOver = true;
    updateGoTurnHint();
    showResultModal('你认输了', '输');
  });

  document.getElementById('chess-go-replay').addEventListener('click', () => {
    hideResultModal();
    startGo();
  });

  /* ============================================================
     阻止棋盘触摸事件冒泡引发页面横滑
     ============================================================ */
  ['chess-ttt-board', 'chess-gomoku-board', 'chess-go-board'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
      el.addEventListener('touchmove',  e => e.stopPropagation(), { passive: true });
      el.addEventListener('touchend',   e => e.stopPropagation(), { passive: true });
    }
  });

  /* ============================================================
     入口：监听 data-app="chess" 点击
     ============================================================ */
  document.addEventListener('click', function (e) {
    const appItem = e.target.closest('.app-item[data-app="chess"]');
    if (appItem) {
      if (typeof window.ChessApp !== 'undefined') {
        window.ChessApp.open();
      }
    }
  });

})();
