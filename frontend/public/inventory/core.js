/**
 * 宝宝辅食库存与消耗记录 —— 核心逻辑（纯函数 + localStorage 持久化）
 *
 * 零依赖，同时支持：
 *  - 浏览器 <script> 直接引入：window.BabyInventoryCore
 *  - Node 自测：require('./core.js')
 * 分组：已过期 > 低库存 > 临期 > 正常
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BabyInventoryCore = factory();
})(typeof self !== 'undefined' ? self : globalThis, function () {
  'use strict';

  // ===== 常量 =====
  var STORAGE_KEY = 'babytracker-inventory-v1';
  /** 到期日距今 <= 该天数视为临期（不含已过期） */
  var EXPIRING_SOON_DAYS = 3;
  var GROUPS = Object.freeze({
    EXPIRED: 'expired',
    LOW: 'low',
    EXPIRING: 'expiring',
    OK: 'ok',
  });

  // ===== 可注入的时钟（自测时可固定“今天”） =====
  var clock = function () { return new Date(); };
  function setClock(fn) { clock = fn; }
  /** 本地时区的今天，返回 YYYY-MM-DD */
  function todayStr() { return toDateStr(clock()); }
  function toDateStr(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  // ===== 数值解析：只接受 > 0 的有限数字，支持最多三位小数 =====
  function parsePositiveAmount(raw) {
    if (typeof raw === 'number') {
      if (!Number.isFinite(raw) || raw <= 0) return { ok: false };
      return { ok: true, value: round3(raw) };
    }
    if (typeof raw !== 'string') return { ok: false };
    var s = raw.trim();
    if (s === '') return { ok: false };
    if (!/^\d+(\.\d{1,3})?$/.test(s)) return { ok: false };
    var v = Number(s);
    if (!Number.isFinite(v) || v <= 0) return { ok: false };
    return { ok: true, value: round3(v) };
  }
  function round3(n) { return Math.round((n + Number.EPSILON) * 1000) / 1000; }

  // ===== 日期工具 =====
  function isValidDateStr(s) {
    if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    var parts = s.split('-');
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return d.getFullYear() === Number(parts[0]) && d.getMonth() === Number(parts[1]) - 1 && d.getDate() === Number(parts[2]);
  }
  /** 距到期还剩几天（负数表示已过期几天） */
  function daysUntil(dateStr) {
    var today = clock();
    var a = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var parts = dateStr.split('-');
    var b = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return Math.round((b - a) / 86400000);
  }
  /** 按月龄计算：出生当月为 0 月龄，每经过一个完整日历月加 1（2/13 出生，9/13 满 7 个月） */
  function monthAge(birthday) {
    if (!birthday) return null;
    var now = clock();
    var parts = birthday.split('-');
    var by = Number(parts[0]), bm = Number(parts[1]) - 1, bd = Number(parts[2]);
    var months = (now.getFullYear() - by) * 12 + (now.getMonth() - bm);
    if (now.getDate() < bd) months -= 1;
    return Math.max(0, months);
  }

  // ===== 数据加载 / 保存 / 演示数据 =====
  function defaultState() {
    return { babies: [], activeBabyId: null, items: [], logs: [], seq: 1 };
  }
  function load() {
    if (typeof localStorage === 'undefined') return defaultState();
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return seed(defaultState());
      var s = JSON.parse(raw);
      if (!s || !Array.isArray(s.babies) || !Array.isArray(s.items) || !Array.isArray(s.logs)) return seed(defaultState());
      s.activeBabyId = normalizeActive(s);
      if (s.seq == null) s.seq = Math.max(0, maxId(s)) + 1;
      return s;
    } catch (e) {
      return seed(defaultState());
    }
  }
  function save() {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
  function normalizeActive(s) {
    if (s.activeBabyId != null && s.babies.some(function (b) { return String(b.id) === String(s.activeBabyId); })) return s.activeBabyId;
    return s.babies.length ? s.babies[0].id : null;
  }
  function maxId(s) {
    var ids = [].concat(
      s.babies.map(function (x) { return x.id; }),
      s.items.map(function (x) { return x.id; }),
      s.logs.map(function (x) { return x.id; })
    );
    return ids.reduce(function (m, x) { return Math.max(m, Number(x) || 0); }, 0);
  }
  function nextId(prefix) {
    return prefix + '_' + (state.seq++);
  }

  function seed(s) {
    // 以“今天”为基准造演示数据，保证各类分组都有样本
    var t = todayStr();
    function offset(n) {
      var d = new Date(clock().getFullYear(), clock().getMonth(), clock().getDate() + n);
      return toDateStr(d);
    }
    function birthAtMonths(m) {
      var d = new Date(clock().getFullYear(), clock().getMonth() - m, clock().getDate());
      return toDateStr(d);
    }
    var b1 = { id: 'b_demo1', name: '小满', birthday: birthAtMonths(10) };
    var b2 = { id: 'b_demo2', name: '豆豆', birthday: birthAtMonths(7) };
    s.babies = [b1, b2];
    s.activeBabyId = b1.id;
    s.items = [
      { id: 'i_demo1', babyId: b1.id, name: '高铁米粉', quantity: 1, unit: '盒', expiry: offset(60), minQuantity: 1, createdAt: t },
      { id: 'i_demo2', babyId: b1.id, name: '南瓜泥', quantity: 80, unit: '克', expiry: offset(2), minQuantity: 100, createdAt: t },
      { id: 'i_demo3', babyId: b1.id, name: '鳕鱼泥', quantity: 50, unit: '克', expiry: offset(-1), minQuantity: 0, createdAt: t },
      { id: 'i_demo4', babyId: b2.id, name: '苹果泥', quantity: 120, unit: '克', expiry: offset(10), minQuantity: 50, createdAt: t }
    ];
    s.logs = [{
      id: 'l_demo1', babyId: b1.id, itemId: 'i_demo1', itemName: '高铁米粉',
      amount: 15, unit: '克', consumedAt: t + ' 08:30', undone: false
    }];
    s.seq = 100;
    return s;
  }

  var state = load();

  // ===== 宝宝 =====
  function listBabies() {
    return state.babies.map(function (b) {
      return { id: b.id, name: b.name, birthday: b.birthday, monthAge: monthAge(b.birthday) };
    });
  }
  function activeBaby() {
    var b = state.babies.find(function (x) { return String(x.id) === String(state.activeBabyId); });
    return b ? { id: b.id, name: b.name, birthday: b.birthday, monthAge: monthAge(b.birthday) } : null;
  }
  function switchBaby(id) {
    if (!state.babies.some(function (b) { return String(b.id) === String(id); })) throw new InventoryError('BABY_NOT_FOUND', '未找到该宝宝，无法切换');
    state.activeBabyId = id;
    save();
    return activeBaby();
  }
  function addBaby(input) {
    var name = (input.name || '').trim();
    if (!name) throw new InventoryError('NAME_REQUIRED', '请填写宝宝姓名/昵称');
    if (name.length > 20) throw new InventoryError('NAME_TOO_LONG', '姓名最多 20 个字');
    if (!isValidDateStr(input.birthday)) throw new InventoryError('BIRTHDAY_INVALID', '请选择正确的出生日期');
    if (new Date(input.birthday + 'T23:59:59') > clock()) throw new InventoryError('BIRTHDAY_FUTURE', '出生日期不能晚于今天');
    var b = { id: nextId('b'), name: name, birthday: input.birthday };
    state.babies.push(b);
    if (state.activeBabyId == null) state.activeBabyId = b.id;
    save();
    return { id: b.id, name: b.name, birthday: b.birthday, monthAge: monthAge(b.birthday) };
  }

  // ===== 库存 =====
  function validateItemInput(input) {
    if (state.activeBabyId == null) throw new InventoryError('NO_BABY', '请先添加一个宝宝');
    var name = (input.name || '').trim();
    if (!name) throw new InventoryError('NAME_REQUIRED', '请填写食材名称');
    if (name.length > 30) throw new InventoryError('NAME_TOO_LONG', '食材名称最多 30 个字');
    var q = parsePositiveAmount(input.quantity);
    if (!q.ok) throw new InventoryError('QUANTITY_INVALID', '数量必须是大于 0 的数字（最多三位小数）');
    var unit = (input.unit || '').trim();
    if (unit.length > 8) throw new InventoryError('UNIT_TOO_LONG', '单位最多 8 个字');
    if (!isValidDateStr(input.expiry)) throw new InventoryError('EXPIRY_INVALID', '请选择正确的到期日');
    var minQty = 0;
    if (input.minQuantity !== '' && input.minQuantity != null) {
      var m = parseNonNegative(input.minQuantity);
      if (!m.ok) throw new InventoryError('MIN_QUANTITY_INVALID', '低库存下限必须是不小于 0 的数字（最多三位小数）');
      minQty = m.value;
    }
    return { name: name, quantity: q.value, unit: unit, expiry: input.expiry, minQuantity: round3(minQty) };
  }
  function parseNonNegative(raw) {
    if (typeof raw === 'number') {
      if (!Number.isFinite(raw) || raw < 0) return { ok: false };
      return { ok: true, value: round3(raw) };
    }
    if (typeof raw !== 'string') return { ok: false };
    var s = raw.trim();
    if (s === '') return { ok: true, value: 0 };
    if (!/^\d+(\.\d{1,3})?$/.test(s)) return { ok: false };
    var v = Number(s);
    if (!Number.isFinite(v) || v < 0) return { ok: false };
    return { ok: true, value: round3(v) };
  }

  function addItem(input) {
    var v = validateItemInput(input);
    var item = {
      id: nextId('i'), babyId: state.activeBabyId, name: v.name,
      quantity: v.quantity, unit: v.unit, expiry: v.expiry,
      minQuantity: v.minQuantity, createdAt: todayStr()
    };
    state.items.push(item);
    save();
    return decorate(item);
  }
  function updateMinQuantity(itemId, rawMin) {
    var item = requireActiveItem(itemId);
    var m = parseNonNegative(rawMin);
    if (!m.ok) throw new InventoryError('MIN_QUANTITY_INVALID', '低库存下限必须是不小于 0 的数字（最多三位小数）');
    item.minQuantity = m.value;
    save();
    return decorate(item);
  }
  /** 补货：在现有库存上追加数量 */
  function restock(itemId, rawAmount) {
    var item = requireActiveItem(itemId);
    var a = parsePositiveAmount(rawAmount);
    if (!a.ok) throw new InventoryError('AMOUNT_INVALID', '补货数量必须是大于 0 的数字（最多三位小数）');
    item.quantity = round3(item.quantity + a.value);
    save();
    return decorate(item);
  }
  function deleteItem(itemId) {
    var idx = state.items.findIndex(function (x) { return String(x.id) === String(itemId); });
    if (idx === -1) throw new InventoryError('ITEM_NOT_FOUND', '未找到该食材');
    state.items.splice(idx, 1);
    save();
  }

  function requireItem(itemId) {
    var item = state.items.find(function (x) { return String(x.id) === String(itemId); });
    if (!item) throw new InventoryError('ITEM_NOT_FOUND', '未找到该食材');
    return item;
  }
  function requireActiveItem(itemId) {
    var item = requireItem(itemId);
    if (state.activeBabyId == null || String(item.babyId) !== String(state.activeBabyId)) {
      throw new InventoryError('ITEM_NOT_FOUND', '未找到该食材');
    }
    return item;
  }

  /** 喂食扣减：数量非法 → 已过期 → 库存不足，任一不满足都拒绝 */
  function consume(itemId, rawAmount) {
    var item = requireActiveItem(itemId);
    var a = parsePositiveAmount(rawAmount);
    if (!a.ok) throw new InventoryError('AMOUNT_INVALID', '用量必须是大于 0 的数字（最多三位小数）');
    var left = daysUntil(item.expiry);
    if (left < 0) throw new InventoryError('ITEM_EXPIRED', '「' + item.name + '」已于 ' + item.expiry + ' 过期，不能喂食，请先丢弃并删除该食材');
    if (a.value > round3(item.quantity)) {
      throw new InventoryError('INSUFFICIENT_STOCK',
        '库存不足：「' + item.name + '」当前仅剩 ' + item.quantity + item.unit + '，无法扣减 ' + a.value + item.unit);
    }
    item.quantity = round3(item.quantity - a.value);
    var log = {
      id: nextId('l'), babyId: item.babyId, itemId: item.id, itemName: item.name,
      amount: a.value, unit: item.unit, consumedAt: formatNow(), undone: false,
      remaining: item.quantity
    };
    state.logs.push(log);
    save();
    return { item: decorate(item), log: log };
  }

  /** 撤销最近一次未撤销的消耗（把数量加回去） */
  function undoLastConsume() {
    for (var i = state.logs.length - 1; i >= 0; i--) {
      var log = state.logs[i];
      if (!log.undone && String(log.babyId) === String(state.activeBabyId)) {
        log.undone = true;
        var item = state.items.find(function (x) { return String(x.id) === String(log.itemId); });
        if (item) item.quantity = round3(item.quantity + log.amount);
        save();
        return { log: log, item: item ? decorate(item) : null };
      }
    }
    throw new InventoryError('NO_CONSUME_LOG', '当前没有可撤销的喂食记录');
  }

  function formatNow() {
    var d = clock();
    return toDateStr(d) + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  // ===== 查询 / 分组 =====
  function classify(item) {
    var left = daysUntil(item.expiry);
    if (left < 0) return GROUPS.EXPIRED;
    if (round3(item.quantity) <= item.minQuantity) return GROUPS.LOW;
    if (left <= EXPIRING_SOON_DAYS) return GROUPS.EXPIRING;
    return GROUPS.OK;
  }
  function decorate(item) {
    var left = daysUntil(item.expiry);
    return Object.assign({}, item, {
      quantity: round3(item.quantity),
      minQuantity: round3(item.minQuantity || 0),
      daysLeft: left,
      group: classify(item),
      low: round3(item.quantity) <= round3(item.minQuantity || 0)
    });
  }
  function activeItems() {
    if (state.activeBabyId == null) return [];
    return state.items
      .filter(function (x) { return String(x.babyId) === String(state.activeBabyId); })
      .map(decorate)
      .sort(function (a, b) {
        var rank = {}; rank[GROUPS.EXPIRED] = 0; rank[GROUPS.LOW] = 1; rank[GROUPS.EXPIRING] = 2; rank[GROUPS.OK] = 3;
        if (rank[a.group] !== rank[b.group]) return rank[a.group] - rank[b.group];
        if (a.expiry !== b.expiry) return a.expiry < b.expiry ? -1 : 1;
        return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
      });
  }
  function groupedItems() {
    var g = {};
    g[GROUPS.EXPIRED] = []; g[GROUPS.LOW] = []; g[GROUPS.EXPIRING] = []; g[GROUPS.OK] = [];
    activeItems().forEach(function (it) { g[it.group].push(it); });
    return g;
  }
  function activeLogs() {
    if (state.activeBabyId == null) return [];
    return state.logs
      .filter(function (x) { return String(x.babyId) === String(state.activeBabyId); })
      .slice()
      .reverse();
  }

  // ===== 仅供自测：重置状态 =====
  function reset(initial) {
    state = initial || seed(defaultState());
    save();
    return state;
  }
  function getState() { return state; }

  function InventoryError(code, message) {
    this.name = 'InventoryError';
    this.code = code;
    this.message = message;
  }
  InventoryError.prototype = Object.create(Error.prototype);

  return {
    STORAGE_KEY: STORAGE_KEY,
    EXPIRING_SOON_DAYS: EXPIRING_SOON_DAYS,
    GROUPS: GROUPS,
    setClock: setClock,
    todayStr: todayStr,
    parsePositiveAmount: parsePositiveAmount,
    isValidDateStr: isValidDateStr,
    daysUntil: daysUntil,
    monthAge: monthAge,
    listBabies: listBabies,
    activeBaby: activeBaby,
    switchBaby: switchBaby,
    addBaby: addBaby,
    addItem: addItem,
    updateMinQuantity: updateMinQuantity,
    restock: restock,
    deleteItem: deleteItem,
    consume: consume,
    undoLastConsume: undoLastConsume,
    classify: classify,
    activeItems: activeItems,
    groupedItems: groupedItems,
    activeLogs: activeLogs,
    reset: reset,
    getState: getState,
    InventoryError: InventoryError
  };
});
