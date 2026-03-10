/* ============================================================
   garden-main.js — 家园App 入口层
   事件绑定 / 打开关闭App / 暴露 window.GardenApp 接口
   依赖：garden-core.js 和 garden-ui.js 必须先加载
   ============================================================ */

/* ── 全局当前数据引用（ui层石头剪刀布需要访问）── */
var gdnCurrentData = null;

/* ── 全局事件绑定（只执行一次）── */
function gdnBindAllEvents() {

  /* 地图退出 */
  var mapClose = document.getElementById('gdn-map-close');
  if (mapClose) mapClose.addEventListener('click', function () { gdnCloseApp(); });

  /* 住所返回 */
  var aptBack = document.getElementById('gdn-apt-back');
  if (aptBack) aptBack.addEventListener('click', function () { gdnRenderMap(gdnCurrentData); });

  /* 住所设置按钮 */
  var aptSettings = document.getElementById('gdn-apt-settings');
  if (aptSettings) aptSettings.addEventListener('click', function () { gdnOpenInviteModal(gdnCurrentData); });

  /* 房间返回 */
  var roomBack = document.getElementById('gdn-room-back');
  if (roomBack) roomBack.addEventListener('click', function () { gdnRenderAptView(gdnCurrentData); });

  /* 广场返回 */
  var plazaBack = document.getElementById('gdn-plaza-back');
  if (plazaBack) plazaBack.addEventListener('click', function () { gdnRenderMap(gdnCurrentData); });

  /* 广场发起投票 */
  var plazaVoteBtn = document.getElementById('gdn-plaza-vote-btn');
  if (plazaVoteBtn) plazaVoteBtn.addEventListener('click', function () { gdnOpenVoteSetup(); });

  /* 投票弹窗取消 */
  var voteCancel = document.getElementById('gdn-vote-cancel');
  if (voteCancel) voteCancel.addEventListener('click', function () {
    var m = document.getElementById('gdn-vote-setup-modal');
    if (m) m.style.display = 'none';
  });

  /* 投票弹窗确认 */
  var voteConfirm = document.getElementById('gdn-vote-confirm');
  if (voteConfirm) voteConfirm.addEventListener('click', function () {
    var topic   = (document.getElementById('gdn-vote-topic')   || {}).value || '';
    var options = (document.getElementById('gdn-vote-options') || {}).value || '';
    gdnStartVote(topic, options, gdnCurrentData);
  });

  /* 气泡弹窗关闭 */
  var bubbleClose = document.getElementById('gdn-bubble-close');
  if (bubbleClose) bubbleClose.addEventListener('click', function () { gdnCloseBubblePopup(); });

  /* 气泡→对话 */
  var bubbleChat = document.getElementById('gdn-bubble-chat');
  if (bubbleChat) bubbleChat.addEventListener('click', function () {
    if (gdnBubbleTarget && !gdnBubbleTarget.isUser) {
      gdnOpenChatFloat(gdnBubbleTarget, gdnCurrentData);
    }
  });

  /* 气泡→石头剪刀布 */
  var bubbleRps = document.getElementById('gdn-bubble-rps');
  if (bubbleRps) bubbleRps.addEventListener('click', function () {
    if (gdnBubbleTarget && !gdnBubbleTarget.isUser) {
      gdnOpenRPS(gdnBubbleTarget);
    }
  });

  /* 临时对话关闭 */
  var chatFloatClose = document.getElementById('gdn-chat-float-close');
  if (chatFloatClose) chatFloatClose.addEventListener('click', function () { gdnCloseChatFloat(); });

  /* 临时对话同步 */
  var chatFloatSync = document.getElementById('gdn-chat-float-sync');
  if (chatFloatSync) chatFloatSync.addEventListener('click', function () { gdnSyncChatFloatToLiao(); });

  /* 临时对话AI发送按钮 */
  var aiBtn = document.getElementById('gdn-chat-float-ai-btn');
  if (aiBtn) aiBtn.addEventListener('click', function () {
    var input = document.getElementById('gdn-chat-float-input');
    if (!input) return;
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    gdnSendFloatMessage(text, gdnCurrentData);
  });

  /* 临时对话回车发送 */
  var chatInput = document.getElementById('gdn-chat-float-input');
  if (chatInput) chatInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      var text = chatInput.value.trim();
      if (!text) return;
      chatInput.value = '';
      gdnSendFloatMessage(text, gdnCurrentData);
    }
  });

  /* 石头剪刀布按钮 */
  document.querySelectorAll('.gdn-rps-btn').forEach(function (btn) {
    btn.addEventListener('click', function () { gdnPlayRPS(this.dataset.choice); });
  });

  /* 石头剪刀布关闭 */
  var rpsClose = document.getElementById('gdn-rps-close');
  if (rpsClose) rpsClose.addEventListener('click', function () {
    var modal = document.getElementById('gdn-rps-modal');
    if (modal) modal.style.display = 'none';
  });

  /* 叙事弹窗关闭 */
  var narrateClose = document.getElementById('gdn-narrate-close');
  if (narrateClose) narrateClose.addEventListener('click', function () {
    var modal = document.getElementById('gdn-narrate-modal');
    if (modal) modal.style.display = 'none';
  });

  /* 邀请弹窗取消 */
  var inviteCancel = document.getElementById('gdn-invite-cancel');
  if (inviteCancel) inviteCancel.addEventListener('click', function () {
    var modal = document.getElementById('gdn-invite-modal');
    if (modal) modal.style.display = 'none';
  });

  /* 邀请弹窗确认 */
  var inviteConfirm = document.getElementById('gdn-invite-confirm');
  if (inviteConfirm) inviteConfirm.addEventListener('click', function () {
    gdnConfirmInvite(gdnCurrentData);
  });

  /* 点击遮罩关闭弹窗 */
  ['gdn-invite-modal', 'gdn-rps-modal', 'gdn-narrate-modal', 'gdn-vote-setup-modal'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.addEventListener('click', function (e) {
      if (e.target === el) el.style.display = 'none';
    });
  });

  /* 初始化拖拽 */
  gdnInitChatFloatDrag();
}

/* ── 打开家园App ── */
function gdnOpenApp() {
  var appEl = document.getElementById('garden-app');
  if (!appEl) return;
  appEl.style.display = 'flex';

  gdnCurrentData = gdnInitData();
  gdnEnsureDailyActivities(gdnCurrentData);
  gdnRandomizePositions(gdnCurrentData);

  if (!appEl.dataset.gdnBound) {
    gdnBindAllEvents();
    appEl.dataset.gdnBound = '1';
  }

  gdnPlayIntro(function () {
    gdnRenderMap(gdnCurrentData);
  });
}

/* ── 关闭家园App ── */
function gdnCloseApp() {
  var appEl = document.getElementById('garden-app');
  if (appEl) appEl.style.display = 'none';
  GDN_VIEWS.forEach(function (v) {
    var el = document.getElementById(v);
    if (el) el.style.display = 'none';
  });
  gdnCloseBubblePopup();
  gdnCloseChatFloat();
}

/* ── 暴露全局接口 ── */
window.GardenApp = {
  open:       gdnOpenApp,
  close:      gdnCloseApp,
  _showDebug: gdnShowDebugPanel,
};
