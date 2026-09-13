/**
 * 宝宝辅食库存与消耗记录 —— 界面逻辑（零依赖，直接 <script> 引入）
 */
(function () {
  'use strict';
  var C = window.BabyInventoryCore;

  var GROUP_META = {
    expired: { cls: 'group-expired', title: '⛔ 已过期', desc: '已过到期日，禁止喂食，请尽快清理' },
    low: { cls: 'group-low', title: '🔥 低库存', desc: '数量已低于或等于下限，建议补货' },
    expiring: { cls: 'group-expiring', title: '⏳ 临期提醒（3 天内到期）', desc: '尽快食用，过期后将无法扣减' },
    ok: { cls: 'group-ok', title: '✅ 正常', desc: '' }
  };

  // ===== DOM 引用 =====
  var $ = function (sel) { return document.querySelector(sel); };
  var babySelect = $('#babySelect');
  var babyMeta = $('#babyMeta');
  var noticeEl = $('#notice');
  var stockGroupsEl = $('#stockGroups');
  var logListEl = $('#logList');
  var stockSummaryEl = $('#stockSummary');
  var undoBtn = $('#undoBtn');
  var stockForm = $('#stockForm');
  var babyModal = $('#babyModal');
  var babyForm = $('#babyForm');
  var babyError = $('#babyError');
  var promptModal = $('#promptModal');
  var promptTitle = $('#promptTitle');
  var promptDesc = $('#promptDesc');
  var promptInput = $('#promptInput');
  var promptError = $('#promptError');
  var promptOk = $('#promptOk');
  var noticeTimer = null;

  // ===== 工具 =====
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function showNotice(type, message) {
    noticeEl.className = 'notice ' + type;
    noticeEl.textContent = message;
    noticeEl.hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(function () { noticeEl.hidden = true; }, type === 'error' ? 6000 : 3500);
  }
  /** 统一包装核心层抛出的业务错误 */
  function run(action, successMsg) {
    try {
      var result = action();
      render();
      if (successMsg) showNotice('success', successMsg);
      return result;
    } catch (e) {
      if (e && e.code) showNotice('error', e.message);
      else { showNotice('error', '操作失败，请重试'); /* 意外错误不吞掉细节 */ console.error(e); }
      return null;
    }
  }
  function expiryText(daysLeft) {
    if (daysLeft < 0) return '已过期 ' + Math.abs(daysLeft) + ' 天';
    if (daysLeft === 0) return '今天到期';
    if (daysLeft <= 3) return '还剩 ' + daysLeft + ' 天到期';
    return daysLeft + ' 天后到期';
  }
  function expiryTagClass(group) {
    if (group === 'expired') return 'tag-danger';
    if (group === 'low' || group === 'expiring') return 'tag-warn';
    return 'tag-muted';
  }

  // ===== 渲染：宝宝 =====
  function renderBabies() {
    var babies = C.listBabies();
    var active = C.activeBaby();
    var html = babies.map(function (b) {
      return '<option value="' + esc(b.id) + '"' + (active && String(b.id) === String(active.id) ? ' selected' : '') + '>' + esc(b.name) + '</option>';
    }).join('');
    if (!babies.length) html = '<option value="">（暂无宝宝）</option>';
    babySelect.innerHTML = html;
    if (active) {
      babyMeta.textContent = active.name + ' · ' + active.monthAge + ' 月龄 · 出生日期 ' + active.birthday +
        '　|　只显示 ' + active.name + ' 的库存与消耗';
    } else {
      babyMeta.textContent = '还没有宝宝档案，点击右上角“添加宝宝”开始登记';
    }
  }

  // ===== 渲染：库存分组 =====
  function renderGroups() {
    var groups = C.groupedItems();
    var total = groups.expired.length + groups.low.length + groups.expiring.length + groups.ok.length;
    stockSummaryEl.textContent = total ? ('共 ' + total + ' 种食材') : '';

    if (total === 0) {
      stockGroupsEl.innerHTML = '<p class="empty">当前宝宝还没有库存，用上方表单登记第一批食材吧。</p>';
      undoBtn.disabled = true;
      renderLogs();
      return;
    }

    var html = ['expired', 'low', 'expiring', 'ok'].map(function (key) {
      var items = groups[key];
      if (!items.length) return '';
      var meta = GROUP_META[key];
      var cards = items.map(function (it) {
        var zero = it.quantity <= 0;
        var minHint = it.minQuantity > 0
          ? '<span class="tag tag-muted">下限 ' + esc(it.minQuantity) + esc(it.unit) + '</span>'
          : '<span class="tag tag-muted">未设下限</span>';
        return '' +
          '<article class="item" data-id="' + esc(it.id) + '">' +
            '<div class="item-main">' +
              '<span class="item-name">' + esc(it.name) + '</span>' +
              '<span class="item-qty' + (zero ? ' zero' : '') + '">' + esc(it.quantity) + esc(it.unit) + '</span>' +
            '</div>' +
            '<div class="item-meta">' +
              '<span class="tag ' + expiryTagClass(it.group) + '">' + expiryText(it.daysLeft) + '</span>' +
              '<span class="tag tag-muted">到期日 ' + esc(it.expiry) + '</span>' +
              minHint +
            '</div>' +
            '<div class="item-actions">' +
              '<button type="button" class="btn btn-feed" data-act="consume" data-id="' + esc(it.id) + '">喂食扣减</button>' +
              '<button type="button" class="btn btn-restock" data-act="restock" data-id="' + esc(it.id) + '">补货</button>' +
              '<button type="button" class="btn btn-min" data-act="min" data-id="' + esc(it.id) + '">设下限</button>' +
              '<button type="button" class="btn btn-del" data-act="delete" data-id="' + esc(it.id) + '">删除</button>' +
            '</div>' +
          '</article>';
      }).join('');
      return '<div class="' + meta.cls + '">' +
        '<div class="group-title">' + meta.title +
          '<span class="count">' + items.length + '</span>' +
          '<span style="font-weight:400;font-size:12px;">' + esc(meta.desc) + '</span>' +
        '</div>' + cards + '</div>';
    }).join('');

    stockGroupsEl.innerHTML = html;
  }

  // ===== 渲染：消耗记录 =====
  function renderLogs() {
    var logs = C.activeLogs();
    var undoable = logs.some(function (l) { return !l.undone; });
    undoBtn.disabled = !undoable;
    if (!logs.length) {
      logListEl.innerHTML = '<p class="empty">暂无喂食记录。喂食扣减后会自动在这里留痕。</p>';
      return;
    }
    logListEl.innerHTML = logs.map(function (l) {
      return '<li class="' + (l.undone ? 'log-undone' : '') + '">' +
        '<div>' +
          '<div>' + esc(l.itemName) + (l.undone ? '（已撤销）' : '') + '</div>' +
          '<div class="log-time">' + esc(l.consumedAt) + '</div>' +
        '</div>' +
        '<div class="log-amount">−' + esc(l.amount) + esc(l.unit) + '</div>' +
      '</li>';
    }).join('');
  }

  function render() {
    renderBabies();
    renderGroups();
    renderLogs();
  }

  // ===== 通用小弹层（喂食 / 补货 / 设下限） =====
  var promptState = null;
  function openPrompt(opts) {
    promptState = opts;
    promptTitle.textContent = opts.title;
    promptDesc.textContent = opts.desc || '';
    promptInput.value = '';
    promptInput.placeholder = opts.placeholder || '';
    promptInput.inputMode = opts.inputMode || 'decimal';
    promptError.hidden = true;
    promptError.textContent = '';
    promptModal.hidden = false;
    setTimeout(function () { promptInput.focus(); }, 30);
  }
  function closePrompt() {
    promptModal.hidden = true;
    promptState = null;
  }
  function promptFail(msg) {
    promptError.textContent = msg;
    promptError.hidden = false;
    promptInput.focus();
    promptInput.select();
  }
  promptOk.addEventListener('click', function () {
    if (!promptState) return;
    var value = promptInput.value;
    var successMsg = promptState.successMsg;
    try {
      promptState.onOk(value); // 核心层校验失败会抛 InventoryError
      closePrompt();
      render();
      if (successMsg) showNotice('success', successMsg);
    } catch (e) {
      if (e && e.code) promptFail(e.message);
      else { console.error(e); promptFail('操作失败，请重试'); }
    }
  });
  promptInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') { e.preventDefault(); promptOk.click(); }
  });

  // ===== 库存卡片按钮（事件委托） =====
  stockGroupsEl.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-act]');
    if (!btn) return;
    var act = btn.dataset.act;
    var id = btn.dataset.id;
    var item = C.activeItems().find(function (x) { return String(x.id) === String(id); });
    if (!item) return;

    if (act === 'consume') {
      openPrompt({
        title: '喂食扣减：' + item.name,
        desc: '当前库存 ' + item.quantity + item.unit + '，到期日 ' + item.expiry + '（' + expiryText(item.daysLeft) + '）。请输入本次实际喂食用量：',
        placeholder: '用量，如 20' + (item.unit ? '（' + item.unit + '）' : ''),
        onOk: function (v) {
          var r = C.consume(item.id, v);
          showNotice('success', '已记录喂食：' + item.name + ' −' + r.log.amount + r.log.unit +
            '，剩余 ' + r.item.quantity + r.item.unit);
          return r;
        }
      });
    } else if (act === 'restock') {
      openPrompt({
        title: '补货：' + item.name,
        desc: '当前库存 ' + item.quantity + item.unit + '，输入本次补充数量：',
        placeholder: '补货数量（' + (item.unit || '单位') + '）',
        onOk: function (v) { var it = C.restock(item.id, v); showNotice('success', '补货成功：' + item.name + ' 现有 ' + it.quantity + it.unit); return it; },
        successMsg: null
      });
    } else if (act === 'min') {
      openPrompt({
        title: '设置低库存下限：' + item.name,
        desc: '当库存 ≤ 下限时会进入“低库存”分组。当前下限 ' + item.minQuantity + item.unit + '，输入 0 表示不提醒。',
        placeholder: '下限数量（' + (item.unit || '单位') + '）',
        onOk: function (v) { var it = C.updateMinQuantity(item.id, v); showNotice('success', '已更新「' + item.name + '」的低库存下限为 ' + it.minQuantity + it.unit); return it; },
        successMsg: null
      });
    } else if (act === 'delete') {
      if (window.confirm('确定删除食材「' + item.name + '」吗？其历史消耗记录仍会保留。')) {
        run(function () { C.deleteItem(item.id); }, '已删除「' + item.name + '」');
      }
    }
  });

  // ===== 入库表单 =====
  stockForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var fd = new FormData(stockForm);
    var input = {
      name: fd.get('name'),
      quantity: fd.get('quantity'),
      unit: fd.get('unit') || '',
      expiry: fd.get('expiry'),
      minQuantity: fd.get('minQuantity')
    };
    var created = run(function () { return C.addItem(input); });
    if (created) {
      stockForm.reset();
      stockForm.elements.unit.value = '克';
      setDefaultExpiry();
      showNotice('success', '已入库：' + created.name + ' ' + created.quantity + created.unit +
        '，到期日 ' + created.expiry);
    }
  });

  // ===== 宝宝切换 / 添加 =====
  babySelect.addEventListener('change', function () {
    if (!babySelect.value) return;
    run(function () { return C.switchBaby(babySelect.value); });
  });
  $('#addBabyBtn').addEventListener('click', function () {
    babyForm.reset();
    babyError.hidden = true;
    babyModal.hidden = false;
    setTimeout(function () { babyForm.elements.name.focus(); }, 30);
  });
  babyModal.addEventListener('click', function (e) {
    if (e.target === babyModal || e.target.hasAttribute('data-close')) babyModal.hidden = true;
  });
  promptModal.addEventListener('click', function (e) {
    if (e.target === promptModal || e.target.hasAttribute('data-close')) closePrompt();
  });
  babyForm.addEventListener('submit', function (e) {
    e.preventDefault();
    var fd = new FormData(babyForm);
    try {
      var b = C.addBaby({ name: fd.get('name'), birthday: fd.get('birthday') });
      C.switchBaby(b.id);
      babyModal.hidden = true;
      render();
      showNotice('success', '已为 ' + b.name + '（' + b.monthAge + ' 月龄）建立独立辅食库存');
    } catch (err) {
      babyError.textContent = err.message;
      babyError.hidden = false;
    }
  });

  // ===== 撤销最近一次消耗 =====
  undoBtn.addEventListener('click', function () {
    run(function () {
      var r = C.undoLastConsume();
      showNotice('success', '已撤销最近一次喂食，' + r.log.itemName + ' 库存加回 ' + r.log.amount + r.log.unit);
      return r;
    }, null);
  });

  // ===== 恢复演示数据 =====
  $('#resetDemoBtn').addEventListener('click', function () {
    if (window.confirm('将清空当前全部数据并恢复为演示数据，确定吗？')) {
      C.reset();
      render();
      showNotice('success', '已恢复演示数据');
    }
  });

  // ===== 初始化 =====
  function setDefaultExpiry() {
    var d = new Date();
    d.setDate(d.getDate() + 30);
    stockForm.elements.expiry.value =
      d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  setDefaultExpiry();
  render();

  // 对外暴露最小接口（便于自测与二次开发）
  window.BabyInventoryApp = { render: render };
})();
