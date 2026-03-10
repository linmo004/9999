/* ============================================================
   settings-1.js — 全局工具函数（供 settings-2/3 使用）
   ============================================================ */

function sSave(key, val) {
  try {
    localStorage.setItem('halo9_' + key, JSON.stringify(val));
  } catch (e) {
    console.warn('[sSave] 存储失败，key:', key, e);
    alert('保存失败：本地存储空间不足。图片已自动压缩但仍超限，请尝试使用图片 URL 代替本地上传。');
  }
}

function sLoad(key, def) {
  try {
    const v = localStorage.getItem('halo9_' + key);
    return v !== null ? JSON.parse(v) : def;
  } catch (e) { return def; }
}

function compressImage(dataUrl, maxSize, quality) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = function () {
      let w = img.width;
      let h = img.height;
      if (w > maxSize || h > maxSize) {
        if (w >= h) { h = Math.round(h * maxSize / w); w = maxSize; }
        else        { w = Math.round(w * maxSize / h); h = maxSize; }
      }
      const canvas = document.createElement('canvas');
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = function () { resolve(dataUrl); };
    img.src = dataUrl;
  });
}
