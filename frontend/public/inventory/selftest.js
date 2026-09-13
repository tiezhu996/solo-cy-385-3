/**
 * 核心逻辑自测：node frontend/public/inventory/selftest.js
 * 不依赖任何第三方包；用内存版 localStorage 隔离浏览器存储。
 */
const assert = require('assert');
const core = require('./core.js');

// 固定“今天” = 2026-09-13，保证断言可复现
core.setClock(() => new Date(2026, 8, 13, 9, 0, 0));

// 内存 localStorage
const mem = new Map();
global.localStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, v),
  removeItem: (k) => mem.delete(k),
};

let passed = 0;
function ok(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (e) {
    console.error('  ✗ ' + name + '\n    ' + (e && e.message));
    process.exitCode = 1;
  }
}
function expectThrow(fn, code) {
  try {
    fn();
    assert.fail('应当拒绝，但成功了');
  } catch (e) {
    assert.strictEqual(e.code, code, '错误码应为 ' + code + '，实际 ' + e.code + '（' + e.message + '）');
  }
}

// 空状态（清掉 seed 数据）：手动构造
core.reset({ babies: [], activeBabyId: null, items: [], logs: [], seq: 1 });

console.log('月龄计算');
ok('出生 0 天 = 0 月龄', () => assert.strictEqual(core.monthAge('2026-09-13'), 0));
ok('满 10 个日历月 = 10 月龄（按对日计算）', () => assert.strictEqual(core.monthAge('2025-11-11'), 10));
ok('出生日期未来不允许建档', () => {
  expectThrow(() => core.addBaby({ name: '未来宝宝', birthday: '2026-10-01' }), 'BIRTHDAY_FUTURE');
});

console.log('宝宝建档与切换');
const xm = core.addBaby({ name: '小满', birthday: '2025-11-11' });
assert.strictEqual(xm.monthAge, 10);
const dd = core.addBaby({ name: '豆豆', birthday: '2026-02-13' });
assert.strictEqual(dd.monthAge, 7);
ok('当前宝宝是小满', () => assert.strictEqual(core.activeBaby().name, '小满'));
ok('切换到不存在的宝宝被拒绝', () => expectThrow(() => core.switchBaby('nobody'), 'BABY_NOT_FOUND'));
ok('当天出生的宝宝可以建档（不会误判为未来日期），月龄为 0，且不抢走当前宝宝', () => {
  const t = core.addBaby({ name: '今日宝宝', birthday: '2026-09-13' });
  assert.strictEqual(t.monthAge, 0);
  assert.strictEqual(core.activeBaby().name, '小满');
});

console.log('入库校验');
expectThrow(() => core.addItem({ name: '坏数量', quantity: '0', unit: '克', expiry: '2026-12-01', minQuantity: '' }), 'QUANTITY_INVALID');
expectThrow(() => core.addItem({ name: '负数量', quantity: '-3', unit: '克', expiry: '2026-12-01', minQuantity: '' }), 'QUANTITY_INVALID');
expectThrow(() => core.addItem({ name: '非数字', quantity: 'abc', unit: '克', expiry: '2026-12-01', minQuantity: '' }), 'QUANTITY_INVALID');
expectThrow(() => core.addItem({ name: '小数太多位', quantity: '1.2345', unit: '克', expiry: '2026-12-01', minQuantity: '' }), 'QUANTITY_INVALID');
expectThrow(() => core.addItem({ name: '坏日期', quantity: '10', unit: '克', expiry: '2026-02-30', minQuantity: '' }), 'EXPIRY_INVALID');
expectThrow(() => core.addItem({ name: '坏下限', quantity: '10', unit: '克', expiry: '2026-12-01', minQuantity: '-1' }), 'MIN_QUANTITY_INVALID');
ok('非法数量/日期/下限全部被拒绝', () => {});

const rice = core.addItem({ name: '高铁米粉', quantity: '200', unit: '克', expiry: '2026-11-12', minQuantity: '50' });
const pumpkin = core.addItem({ name: '南瓜泥', quantity: '80', unit: '克', expiry: '2026-09-15', minQuantity: '100' });
const expired = core.addItem({ name: '鳕鱼泥', quantity: '50', unit: '克', expiry: '2026-09-12', minQuantity: '0' });
const normal = core.addItem({ name: '苹果泥', quantity: '120', unit: '克', expiry: '2026-09-30', minQuantity: '20' });
ok('入库成功', () => {
  assert.strictEqual(rice.quantity, 200);
  assert.strictEqual(rice.daysLeft, 60);
});

console.log('分组（已过期 > 低库存 > 临期 > 正常）');
const g = core.groupedItems();
ok('南瓜泥数量 80 <= 下限 100 → 低库存组', () => assert.deepStrictEqual(g.low.map((i) => i.name), ['南瓜泥']));
ok('鳕鱼泥昨天到期 → 已过期组', () => assert.deepStrictEqual(g.expired.map((i) => i.name), ['鳕鱼泥']));
ok('苹果泥 9/30 到期、高铁米粉 11/12 到期且库存充足 → 正常组（按到期日升序）', () => assert.deepStrictEqual(g.ok.map((i) => i.name), ['苹果泥', '高铁米粉']));
// 高铁米粉正常库存 60 天后到期；再造一个 2 天后到期且库存充足的食材 → 临期
const soon = core.addItem({ name: '西兰花泥', quantity: '100', unit: '克', expiry: '2026-09-15', minQuantity: '50' });
ok('西兰花泥 2 天后到期且库存充足 → 临期组', () => {
  const g2 = core.groupedItems();
  assert.deepStrictEqual(g2.expiring.map((i) => i.name), ['西兰花泥']);
  assert.deepStrictEqual(g2.ok.map((i) => i.name), ['苹果泥', '高铁米粉']);
});
ok('列表整体顺序：已过期→低库存→临期→正常，组内按到期日升序', () => {
  const names = core.activeItems().map((i) => i.name);
  assert.deepStrictEqual(names, ['鳕鱼泥', '南瓜泥', '西兰花泥', '苹果泥', '高铁米粉']);
});

console.log('喂食扣减');
ok('用量非法被拒绝（0/负数/文字/超限小数）', () => {
  expectThrow(() => core.consume(rice.id, '0'), 'AMOUNT_INVALID');
  expectThrow(() => core.consume(rice.id, '-5'), 'AMOUNT_INVALID');
  expectThrow(() => core.consume(rice.id, '勺'), 'AMOUNT_INVALID');
  expectThrow(() => core.consume(rice.id, '1.0001'), 'AMOUNT_INVALID');
});
ok('数值型入参同样拒绝超过三位小数（字符串与数字口径一致）', () => {
  assert.strictEqual(core.parsePositiveAmount(1.2345).ok, false);
  assert.strictEqual(core.parsePositiveAmount(1.0001).ok, false);
  assert.strictEqual(core.parsePositiveAmount(1.234).ok, true);
  assert.strictEqual(core.parsePositiveAmount(30).ok, true);
  expectThrow(() => core.consume(rice.id, 1.2345), 'AMOUNT_INVALID');
});
ok('已过期食材拒绝喂食', () => expectThrow(() => core.consume(expired.id, '10'), 'ITEM_EXPIRED'));
ok('库存不足拒绝扣减并提示剩余量', () => {
  try {
    core.consume(rice.id, '999');
    assert.fail();
  } catch (e) {
    assert.strictEqual(e.code, 'INSUFFICIENT_STOCK');
    assert.ok(e.message.includes('仅剩 200克'), e.message);
  }
});
const r = core.consume(pumpkin.id, '30');
ok('合法扣减成功并生成消耗记录', () => {
  assert.strictEqual(r.item.quantity, 50);
  assert.strictEqual(core.activeLogs()[0].amount, 30);
  assert.strictEqual(core.activeLogs()[0].itemName, '南瓜泥');
});
ok('恰好扣到 0 允许（清空库存）', () => {
  const res = core.consume(soon.id, '100');
  assert.strictEqual(res.item.quantity, 0);
});
ok('扣到 0 后继续扣被拒绝（库存不足）', () => expectThrow(() => core.consume(soon.id, '1'), 'INSUFFICIENT_STOCK'));
ok('撤销把数量加回且记录标记 undone', () => {
  const before = core.activeLogs().length;
  const u = core.undoLastConsume();
  assert.strictEqual(u.log.undone, true);
  assert.strictEqual(u.item.quantity, 100);
  assert.strictEqual(core.activeLogs().length, before);
});

console.log('低库存下限');
ok('下限非法被拒绝', () => {
  expectThrow(() => core.updateMinQuantity(rice.id, 'abc'), 'MIN_QUANTITY_INVALID');
});
core.updateMinQuantity(rice.id, '300');
ok('提高下限后高铁米粉进入低库存组', () => {
  assert.strictEqual(core.classify(core.activeItems().find((i) => i.id === rice.id)), 'low');
});
core.updateMinQuantity(rice.id, '50');
ok('补货后数量增加', () => {
  const it = core.restock(rice.id, '50.5');
  assert.strictEqual(it.quantity, 250.5);
});

console.log('宝宝切换的数据隔离');
core.switchBaby(dd.id);
ok('切到豆豆后看不到小满的库存与消耗记录', () => {
  assert.deepStrictEqual(core.activeItems(), []);
  assert.deepStrictEqual(core.activeLogs(), []);
});
ok('豆豆名下入库的食材，小满看不到；在豆豆名下不能扣减或移除小满的食材', () => {
  core.addItem({ name: '豆豆专属米糊', quantity: '1', unit: '盒', expiry: '2026-12-01', minQuantity: '0' });
  assert.strictEqual(core.activeItems().length, 1);
  expectThrow(() => core.consume(soon.id, '1'), 'ITEM_NOT_FOUND');
  const totalBefore = core.getState().items.length;
  expectThrow(() => core.deleteItem(rice.id), 'ITEM_NOT_FOUND');
  assert.strictEqual(core.getState().items.length, totalBefore, '跨宝宝删除被拒绝后食材数量不变');
  assert.ok(core.getState().items.some((i) => i.id === rice.id), '被拒绝删除的小满食材应仍存在');
  core.switchBaby(xm.id);
  assert.ok(!core.activeItems().some((i) => i.name === '豆豆专属米糊'));
  assert.strictEqual(core.activeLogs().length, 2); // 南瓜泥30 + 西兰花100（撤销后记录仍保留并标记已撤销）
});

console.log('持久化');
ok('数据已写入 localStorage', () => {
  const saved = JSON.parse(mem.get(core.STORAGE_KEY));
  assert.strictEqual(saved.babies.length, 3); // 小满、豆豆、今日宝宝
  assert.ok(saved.items.some((i) => i.name === '高铁米粉'));
});

console.log('\n通过 ' + passed + ' 项断言。');
