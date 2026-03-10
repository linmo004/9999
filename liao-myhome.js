/* ============================================================
   liao-myhome.js — 我的主页
   ============================================================ */

// 人设库和收藏夹由各自专属 JS 文件处理
// 其余菜单项点击提示

document.querySelectorAll('.my-menu-item').forEach(item => {
  const id = item.id;
  // 已有专属处理的菜单项跳过
  if (id === 'menu-persona-lib' || id === 'menu-favorites') return;
  item.addEventListener('click', function () {
    const title = this.querySelector('.my-menu-title').textContent;
    alert(`「${title}」功能建设中，敬请期待`);
  });
});
