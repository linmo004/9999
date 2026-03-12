/* ============================================================
   db-images.js — 图片专用 IndexedDB 存储
   使用 Dexie.js，专门存储本地上传的图片（Base64）
   文字类数据仍使用 localStorage，互不干扰
   ============================================================ */

const _imgDB = new Dexie('Halo9Images');

_imgDB.version(1).stores({
  images: '&key'
});

/**
 * 存储图片到 IndexedDB
 * @param {string} key  键名（不含前缀）
 * @param {string} val  Base64 字符串或 URL 字符串
 */
async function imgSave(key, val) {
  try {
    await _imgDB.images.put({ key, val });
  } catch (e) {
    console.error('[imgSave] 存储失败:', key, e);
  }
}

/**
 * 从 IndexedDB 读取图片
 * @param {string} key          键名
 * @param {string} defaultVal   默认值
 * @returns {Promise<string>}
 */
async function imgLoad(key, defaultVal = null) {
  try {
    const row = await _imgDB.images.get(key);
    if (row !== undefined) return row.val;
    /* 兼容旧数据：如果 IndexedDB 里没有，尝试从 localStorage 迁移 */
    const lsVal = localStorage.getItem('halo9_' + key);
    if (lsVal !== null) {
      try {
        const parsed = JSON.parse(lsVal);
        if (parsed) {
          /* 迁移到 IndexedDB，同时清除 localStorage */
          await imgSave(key, parsed);
          localStorage.removeItem('halo9_' + key);
          return parsed;
        }
      } catch (e) {}
    }
    return defaultVal;
  } catch (e) {
    console.error('[imgLoad] 读取失败:', key, e);
    return defaultVal;
  }
}

/**
 * 删除图片
 * @param {string} key
 */
async function imgDelete(key) {
  try {
    await _imgDB.images.delete(key);
  } catch (e) {}
}

/**
 * 读取所有图片（用于导出）
 * @returns {Promise<Array>}
 */
async function imgLoadAll() {
  try {
    return await _imgDB.images.toArray();
  } catch (e) {
    return [];
  }
}

/**
 * 批量写入图片（用于导入）
 * @param {Array} items  [{key, val}, ...]
 */
async function imgSaveAll(items) {
  try {
    await _imgDB.images.bulkPut(items);
  } catch (e) {
    console.error('[imgSaveAll] 批量写入失败:', e);
  }
}

window.imgSave    = imgSave;
window.imgLoad    = imgLoad;
window.imgDelete  = imgDelete;
window.imgLoadAll = imgLoadAll;
window.imgSaveAll = imgSaveAll;
