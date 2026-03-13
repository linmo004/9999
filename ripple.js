/* ============================================================
   ripple.js — 涟漪 App 逻辑
   蓝牙控制：修修哒 XXD-Lush
   ============================================================ */

(function () {
  'use strict';

  /* ============================================================
     设备配置（修修哒 XXD-Lush）
     ============================================================ */
  const DEVICE_NAME_PREFIX = 'XXD-Lush';
  const SERVICE_UUID       = '53300001-0023-4bd4-bbd5-a6920e4c5653';
  const TX_CHAR_UUID       = '53300003-0023-4bd4-bbd5-a6920e4c5653';

  /* 振动指令：[0x00,0x00,0x00,0x00,0x65,0x3a,0x30,速度,0x64] */
  function buildVibeCmd(speed) {
    const s = Math.max(0, Math.min(100, Math.round(speed)));
    return new Uint8Array([0x00, 0x00, 0x00, 0x00, 0x65, 0x3a, 0x30, s, 0x64]);
  }

  /* ============================================================
     状态
     ============================================================ */
  let _device    = null;
  let _txChar    = null;
  let _connected = false;
  let _curSpeed  = 0;
  let _mode      = 'manual';  /* manual | ai */
  let _pattern   = 'steady';  /* steady | pulse | wave | climb */
  let _patTimer  = null;
  let _patPhase  = 0;

  /* ============================================================
     蓝牙操作
     ============================================================ */
  async function connectDevice() {
    if (!navigator.bluetooth) {
      alert('您的浏览器不支持 Web Bluetooth。\n请使用 Chrome 或 Edge 浏览器，且需要 HTTPS。');
      return;
    }

    try {
      setStatus('搜索中…', false);

      _device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: DEVICE_NAME_PREFIX }],
        optionalServices: [SERVICE_UUID]
      });

      _device.addEventListener('gattserverdisconnected', onDisconnected);

      setStatus('连接中…', false);
      const server  = await _device.gatt.connect();
      const service = await server.getPrimaryService(SERVICE_UUID);
      _txChar       = await service.getCharacteristic(TX_CHAR_UUID);

      _connected = true;
      setStatus('已连接', true);
      setDeviceName(_device.name || DEVICE_NAME_PREFIX);
      updateConnectBtn(true);

      /* 连接成功，发送强度0确保停止 */
      await sendSpeed(0);

    } catch (err) {
      if (err.name !== 'NotFoundError') {
        alert('连接失败：' + err.message);
      }
      setStatus('未连接', false);
      updateConnectBtn(false);
    }
  }

  async function disconnectDevice() {
    stopPattern();
    await sendSpeed(0);
    if (_device && _device.gatt.connected) {
      _device.gatt.disconnect();
    }
    onDisconnected();
  }

  function onDisconnected() {
    _connected = false;
    _txChar    = null;
    _curSpeed  = 0;
    stopPattern();
    setStatus('未连接', false);
    setDeviceName('');
    updateConnectBtn(false);
    updateIntensityDisplay(0);
  }

  async function sendSpeed(speed) {
    if (!_connected || !_txChar) return;
    try {
      _curSpeed = Math.max(0, Math.min(100, Math.round(speed)));
      await _txChar.writeValueWithoutResponse(buildVibeCmd(_curSpeed));
      updateIntensityDisplay(_curSpeed);
    } catch (e) {
      console.error('[涟漪] 发送失败:', e);
    }
  }

  /* ============================================================
     模式控制（脉冲/波浪/渐强）
     ============================================================ */
  function stopPattern() {
    if (_patTimer) { clearInterval(_patTimer); _patTimer = null; }
    _patPhase = 0;
  }

  function startPattern(baseSpeed) {
    stopPattern();
    if (_pattern === 'steady') {
      sendSpeed(baseSpeed);
      return;
    }
    if (_pattern === 'pulse') {
      let on = true;
      _patTimer = setInterval(() => {
        sendSpeed(on ? baseSpeed : 0);
        on = !on;
      }, 500);
      return;
    }
    if (_pattern === 'wave') {
      _patPhase = 0;
      _patTimer = setInterval(() => {
        const s = Math.round(baseSpeed * (0.5 + 0.5 * Math.sin(_patPhase)));
        sendSpeed(s);
        _patPhase += 0.3;
      }, 100);
      return;
    }
    if (_pattern === 'climb') {
      let cur = 0;
      _patTimer = setInterval(() => {
        cur = Math.min(baseSpeed, cur + 5);
        sendSpeed(cur);
        if (cur >= baseSpeed) stopPattern();
      }, 80);
      return;
    }
  }

  /* ============================================================
     UI 更新
     ============================================================ */
  function setStatus(text, connected) {
    const dot  = document.getElementById('rpl-status-dot');
    const txt  = document.getElementById('rpl-status-text');
    if (dot) dot.className = 'rpl-status-dot ' + (connected ? 'connected' : 'disconnected');
    if (txt) txt.textContent = text;
  }

  function setDeviceName(name) {
    const el = document.getElementById('rpl-device-name');
    if (el) el.textContent = name;
  }

  function updateConnectBtn(connected) {
    const btn = document.getElementById('rpl-connect-btn');
    if (!btn) return;
    if (connected) {
      btn.textContent = '断开设备';
      btn.classList.add('connected');
    } else {
      btn.textContent = '连接设备';
      btn.classList.remove('connected');
    }
  }

  function updateIntensityDisplay(val) {
    const d1 = document.getElementById('rpl-intensity-display');
    const d2 = document.getElementById('rpl-ai-current-val');
    const s  = document.getElementById('rpl-slider');
    if (d1) d1.textContent = val;
    if (d2) d2.textContent = val;
    if (s && _mode === 'manual') s.value = val;
  }

  function addAiLog(text) {
    const log = document.getElementById('rpl-ai-log');
    if (!log) return;
    const item = document.createElement('div');
    item.className   = 'rpl-ai-log-item';
    item.textContent = new Date().toLocaleTimeString('zh-CN', { hour:'2-digit', minute:'2-digit', second:'2-digit' }) + ' ' + text;
    log.appendChild(item);
    log.scrollTop = log.scrollHeight;
  }

  /* ============================================================
     AI 指令解析（供 liao-memory.js 调用）
     解析 [TOY:vibe=50] 格式
     ============================================================ */
  function rplParseAiCmd(content) {
    if (!content) return;
    const re = /\[TOY:vibe=(\d+)\]/gi;
    let match;
    while ((match = re.exec(content)) !== null) {
      const speed = parseInt(match[1], 10);
      if (_mode !== 'ai') return;
      if (!_connected) {
        addAiLog('⚠ 设备未连接，指令忽略');
        return;
      }
      startPattern(speed);
      addAiLog('角色控制强度 → ' + speed);
    }
  }

  window.rplParseAiCmd = rplParseAiCmd;

  /* ============================================================
     了了悬浮弹窗（聊天界面里的入口）
     ============================================================ */
  function openRplFloat() {
    let modal = document.getElementById('rpl-float-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id        = 'rpl-float-modal';
      modal.className = 'rpl-float-modal';
      modal.innerHTML = `
        <div class="rpl-float-header" id="rpl-float-header">
          <div class="rpl-float-title">涟漪</div>
          <div class="rpl-float-status">
            <div class="rpl-status-dot ${_connected ? 'connected' : 'disconnected'}" id="rpl-float-dot"></div>
            <span id="rpl-float-status-text">${_connected ? '已连接' : '未连接'}</span>
          </div>
          <button class="rpl-float-close" id="rpl-float-close">×</button>
        </div>
        <div class="rpl-float-body">
          <div class="rpl-float-intensity" id="rpl-float-intensity">${_curSpeed}</div>
          <input class="rpl-slider rpl-float-slider" id="rpl-float-slider"
            type="range" min="0" max="100" value="${_curSpeed}">
          <div class="rpl-float-btns">
            <button class="rpl-preset-btn" data-float-val="0">停</button>
            <button class="rpl-preset-btn" data-float-val="25">弱</button>
            <button class="rpl-preset-btn" data-float-val="50">中</button>
            <button class="rpl-preset-btn" data-float-val="75">强</button>
            <button class="rpl-preset-btn" data-float-val="100">最强</button>
          </div>
          <button class="rpl-float-open-btn" id="rpl-float-open-btn">打开涟漪</button>
        </div>`;
      document.body.appendChild(modal);
      bindFloatEvents(modal);
    }

    /* 更新状态 */
    const dot  = modal.querySelector('#rpl-float-dot');
    const stxt = modal.querySelector('#rpl-float-status-text');
    const ints = modal.querySelector('#rpl-float-intensity');
    const sldr = modal.querySelector('#rpl-float-slider');
    if (dot)  dot.className  = 'rpl-status-dot ' + (_connected ? 'connected' : 'disconnected');
    if (stxt) stxt.textContent = _connected ? '已连接' : '未连接';
    if (ints) ints.textContent = _curSpeed;
    if (sldr) sldr.value = _curSpeed;

    modal.style.display = 'flex';
  }

  function bindFloatEvents(modal) {
    /* 拖动 */
    const header = modal.querySelector('#rpl-float-header');
    let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
    header.addEventListener('mousedown', e => {
      dragging = true;
      sx = e.clientX; sy = e.clientY;
      ox = modal.offsetLeft; oy = modal.offsetTop;
      modal.style.transform = 'none';
    });
    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      modal.style.left = (ox + e.clientX - sx) + 'px';
      modal.style.top  = (oy + e.clientY - sy) + 'px';
    });
    document.addEventListener('mouseup', () => { dragging = false; });

    /* 关闭 */
    modal.querySelector('#rpl-float-close').addEventListener('click', () => {
      modal.style.display = 'none';
    });

    /* 滑块 */
    const sldr = modal.querySelector('#rpl-float-slider');
    const ints = modal.querySelector('#rpl-float-intensity');
    sldr.addEventListener('input', function () {
      if (ints) ints.textContent = this.value;
      startPattern(parseInt(this.value));
    });

    /* 预设按钮 */
    modal.querySelectorAll('[data-float-val]').forEach(btn => {
      btn.addEventListener('click', function () {
        const v = parseInt(this.dataset.floatVal);
        if (sldr) sldr.value = v;
        if (ints) ints.textContent = v;
        startPattern(v);
      });
    });

    /* 打开完整 App */
    modal.querySelector('#rpl-float-open-btn').addEventListener('click', () => {
      modal.style.display = 'none';
      window.RippleApp.open();
    });
  }

  window.rplOpenFloat = openRplFloat;

  /* ============================================================
     事件绑定
     ============================================================ */
  function bindEvents() {
    /* 连接/断开按钮 */
    const connectBtn = document.getElementById('rpl-connect-btn');
    if (connectBtn) {
      connectBtn.addEventListener('click', () => {
        if (_connected) disconnectDevice();
        else connectDevice();
      });
    }

    /* 返回按钮 */
    const closeBtn = document.getElementById('ripple-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', () => window.RippleApp.close());

    /* 模式切换 */
    document.querySelectorAll('.rpl-mode-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.rpl-mode-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        _mode = this.dataset.mode;
        const manualPanel = document.getElementById('rpl-panel-manual');
        const aiPanel     = document.getElementById('rpl-panel-ai');
        if (manualPanel) manualPanel.style.display = _mode === 'manual' ? 'flex' : 'none';
        if (aiPanel)     aiPanel.style.display     = _mode === 'ai'     ? 'flex' : 'none';
        if (_mode === 'manual') {
          const s = document.getElementById('rpl-slider');
          if (s) startPattern(parseInt(s.value));
        }
      });
    });

    /* 手动滑块 */
    const slider = document.getElementById('rpl-slider');
    if (slider) {
      slider.addEventListener('input', function () {
        const v = parseInt(this.value);
        updateIntensityDisplay(v);
        if (_pattern === 'steady') sendSpeed(v);
        else startPattern(v);
      });
    }

    /* 预设按钮 */
    document.querySelectorAll('.rpl-preset-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        const v = parseInt(this.dataset.val);
        const s = document.getElementById('rpl-slider');
        if (s) s.value = v;
        updateIntensityDisplay(v);
        startPattern(v);
      });
    });

    /* 模式按钮 */
    document.querySelectorAll('.rpl-pattern-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.rpl-pattern-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        _pattern = this.dataset.pattern;
        const s = document.getElementById('rpl-slider');
        const v = s ? parseInt(s.value) : _curSpeed;
        startPattern(v);
      });
    });

    /* 紧急停止 */
    const stopBtn = document.getElementById('rpl-ai-stop-btn');
    if (stopBtn) {
      stopBtn.addEventListener('click', () => {
        stopPattern();
        sendSpeed(0);
        addAiLog('🛑 紧急停止');
      });
    }
  }

  /* ============================================================
     全局接口
     ============================================================ */
  window.RippleApp = {
    open() {
      const app = document.getElementById('ripple-app');
      if (app) app.style.display = 'flex';
      bindEvents();
    },
    close() {
      const app = document.getElementById('ripple-app');
      if (app) app.style.display = 'none';
    }
  };

  /* 点击主页 App 图标 */
  document.addEventListener('click', function (e) {
    const item = e.target.closest('.app-item[data-app="ripple"]');
    if (item) window.RippleApp.open();
  });

  /* 了了特殊功能栏按钮 */
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'csb-ripple') {
      openRplFloat();
    }
  });

})();
