/* ============================================================
   lockscreen.js — 锁屏 & 密码逻辑
   ============================================================ */

(function () {

  const DEFAULT_PIN = '444444';
  const PIN_LENGTH  = 6;

  function getSavedPin() {
    try {
      const v = localStorage.getItem('halo9_lockPin');
      return v || DEFAULT_PIN;
    } catch (e) { return DEFAULT_PIN; }
  }

  function savePin(pin) {
    try { localStorage.setItem('halo9_lockPin', pin); } catch (e) {}
  }

  let pinBuffer   = '';
  let pinUnlocked = false;

  /* ---- 启动时加载锁屏壁纸 ---- */
  (async function applyLockscreenWallpaper() {
    try {
      /* 优先 IndexedDB，其次 localStorage */
      const fromIdb = await imgLoad('lockWallpaper', null);
      const fromLs  = sLoad('lockWallpaper', null);
      const src     = fromIdb || fromLs;
      if (src) {
        const lsEl = document.getElementById('lockscreen');
        if (lsEl) {
          lsEl.style.backgroundImage    = 'url(' + src + ')';
          lsEl.style.backgroundSize     = 'cover';
          lsEl.style.backgroundPosition = 'center';
        }
      }
    } catch (e) {}
  })();

  function updateLsClock() {
    const now  = new Date();
    const h    = String(now.getHours()).padStart(2, '0');
    const m    = String(now.getMinutes()).padStart(2, '0');
    const wds  = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'];
    const mo   = now.getMonth() + 1;
    const d    = now.getDate();
    const wd   = wds[now.getDay()];
    const timeEl = document.getElementById('ls-time');
    const dateEl = document.getElementById('ls-date');
    if (timeEl) timeEl.textContent = h + ':' + m;
    if (dateEl) dateEl.textContent = mo + '月' + d + '日  ' + wd;
  }

  setInterval(updateLsClock, 1000);
  updateLsClock();

  const lsEl  = document.getElementById('lockscreen');
  const pinEl = document.getElementById('pinscreen');

  let lsTouchStartY = 0;

  function showPinScreen() {
    if (!lsEl || !pinEl) return;
    pinEl.classList.add('show');
    lsEl.classList.add('hide-up');
    pinBuffer = '';
    renderDots();
    clearError();
    /* 锁屏头像：优先 IndexedDB，其次 localStorage，最后默认 */
    (async function () {
      try {
        const fromIdb = await imgLoad('pinAvatar', null);
        const fromLs  = (() => {
          try {
            const v = localStorage.getItem('halo9_pinAvatar');
            return v && v !== 'null' ? JSON.parse(v) : null;
          } catch (e) { return null; }
        })();
        const fallbackIdb = await imgLoad('userAvatar', null);
        const fallbackLs  = (() => {
          try {
            const v = localStorage.getItem('halo9_userAvatar') || localStorage.getItem('liao_userAvatar');
            return v ? JSON.parse(v) : null;
          } catch (e) { return null; }
        })();
        const src = fromIdb || fromLs || fallbackIdb || fallbackLs;
        const av  = document.getElementById('pin-avatar-img');
        if (av && src) av.src = src;
      } catch (e) {}
    })();
  }

  if (lsEl) {
    lsEl.addEventListener('touchstart', e => {
      lsTouchStartY = e.touches[0].clientY;
    }, { passive: true });

    lsEl.addEventListener('touchend', e => {
      const dy = lsTouchStartY - e.changedTouches[0].clientY;
      if (dy > 40) showPinScreen();
    }, { passive: true });

    lsEl.addEventListener('click', showPinScreen);
  }

  function renderDots() {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((dot, i) => {
      dot.classList.toggle('filled', i < pinBuffer.length);
      dot.classList.remove('error');
    });
  }

  function showError() {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach(dot => dot.classList.add('error'));
    const msg = document.getElementById('pin-error-msg');
    if (msg) { msg.textContent = '密码错误，请重试'; msg.classList.add('show'); }
    setTimeout(() => {
      dots.forEach(dot => dot.classList.remove('error'));
      if (msg) msg.classList.remove('show');
      pinBuffer = '';
      renderDots();
    }, 800);
  }

  function clearError() {
    const msg = document.getElementById('pin-error-msg');
    if (msg) { msg.textContent = ''; msg.classList.remove('show'); }
  }

  function unlockSuccess() {
    pinUnlocked = true;
    if (pinEl) {
      pinEl.style.transition = 'opacity 0.38s ease';
      pinEl.style.opacity = '0';
      setTimeout(() => {
        pinEl.style.display = 'none';
        pinEl.style.opacity = '';
        pinEl.style.transition = '';
        if (lsEl) lsEl.style.display = 'none';
      }, 400);
    }
  }

  function handleKeyPress(val) {
    if (pinUnlocked) return;
    if (val === 'del') {
      if (pinBuffer.length > 0) {
        pinBuffer = pinBuffer.slice(0, -1);
        renderDots();
        clearError();
      }
      return;
    }
    if (pinBuffer.length >= PIN_LENGTH) return;
    pinBuffer += val;
    renderDots();

    if (pinBuffer.length === PIN_LENGTH) {
      const correct = getSavedPin();
      if (pinBuffer === correct) {
        unlockSuccess();
      } else {
        setTimeout(showError, 80);
      }
    }
  }

  document.querySelectorAll('.pin-key[data-key]').forEach(key => {
    const val = key.dataset.key;
    key.addEventListener('touchstart', e => {
      e.preventDefault();
      key.classList.add('pressed');
      handleKeyPress(val);
    }, { passive: false });
    key.addEventListener('touchend', e => {
      e.preventDefault();
      key.classList.remove('pressed');
    }, { passive: false });
    key.addEventListener('click', () => {
      handleKeyPress(val);
    });
  });

  document.addEventListener('keydown', e => {
    if (pinUnlocked) return;
    if (!pinEl || !pinEl.classList.contains('show')) return;
    if (e.key >= '0' && e.key <= '9') handleKeyPress(e.key);
    if (e.key === 'Backspace') handleKeyPress('del');
  });

  window.LockScreen = {
    lock: function () {
      pinUnlocked = false;
      pinBuffer   = '';
      if (lsEl) {
        lsEl.style.display  = '';
        lsEl.classList.remove('hide-up');
      }
      if (pinEl) {
        pinEl.style.display  = '';
        pinEl.style.opacity  = '1';
        pinEl.classList.remove('show');
      }
    },
    isUnlocked: function () { return pinUnlocked; },
    changePin: function (oldPin, newPin) {
      if (oldPin !== getSavedPin()) return false;
      if (!newPin || newPin.length !== PIN_LENGTH || !/^\d+$/.test(newPin)) return false;
      savePin(newPin);
      return true;
    },
    setPinDirect: function (newPin) {
      if (!newPin || newPin.length !== PIN_LENGTH || !/^\d+$/.test(newPin)) return false;
      savePin(newPin);
      return true;
    },
    getSavedPin
  };

})();
