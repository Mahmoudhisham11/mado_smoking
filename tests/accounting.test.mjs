import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AppError,
  aggregateQuantities,
  checkCreditLimit,
  checkCustody,
  customerPaymentEffect,
  inventoryDeltas,
  invoiceProfit,
  invoiceTotals,
  mergeDeltas,
  normalizeLines,
  sourcePaymentEffect,
  summarizePayments,
  toMoney,
  transferDeltas,
} from '../lib/domain/accounting.js';

// محاكاة بسيطة لأثر العمليات على رصيد العميل والعهدة (نفس معادلات الـ services)
const simulateCustomer = () => {
  const state = { invoiced: 0, paid: 0, custody: 0 };
  const balance = () => toMoney(state.invoiced - state.paid);
  const pay = (amount) => {
    const e = customerPaymentEffect(amount);
    state.custody = checkCustody(state.custody, e.custodyDelta, 'خزنة');
    state.paid = toMoney(state.paid + e.totalPaidDelta);
    return e;
  };
  const unpay = (amount) => {
    const e = customerPaymentEffect(amount);
    state.custody = checkCustody(state.custody, -e.custodyDelta, 'خزنة');
    state.paid = toMoney(state.paid - e.totalPaidDelta);
  };
  return { state, balance, pay, unpay };
};

test('toMoney: rounding and rejection of invalid values', () => {
  assert.equal(toMoney(0.1 + 0.2), 0.3);
  assert.equal(toMoney('1.005'), 1.01);
  assert.equal(toMoney(-1.005), -1.01);
  assert.equal(toMoney('-0'), 0);
  assert.throws(() => toMoney(''), AppError);
  assert.throws(() => toMoney('abc'), AppError);
  assert.throws(() => toMoney(Infinity), AppError);
});

test('positive customer payment lowers debt and adds to the custody', () => {
  const e = customerPaymentEffect(500);
  assert.deepEqual(e, { custodyDelta: 500, totalPaidDelta: 500, balanceDelta: -500, type: 'payment' });
});

test('negative customer payment (refund) raises debt and takes from the custody', () => {
  const e = customerPaymentEffect(-200);
  assert.deepEqual(e, { custodyDelta: -200, totalPaidDelta: -200, balanceDelta: 200, type: 'refund' });
});

test('add then delete of a negative payment restores everything exactly', () => {
  const sim = simulateCustomer();
  sim.state.invoiced = 1000;
  sim.pay(600);
  assert.equal(sim.balance(), 400);
  assert.equal(sim.state.custody, 600);

  sim.pay(-150.25);
  assert.equal(sim.balance(), 550.25);
  assert.equal(sim.state.custody, 449.75);

  sim.unpay(-150.25);
  assert.equal(sim.balance(), 400);
  assert.equal(sim.state.custody, 600);
});

test('refund larger than the custody balance is rejected', () => {
  const sim = simulateCustomer();
  sim.pay(100);
  assert.throws(() => sim.pay(-300), /لا يكفي/);
  // nothing changed after the rejected operation
  assert.equal(sim.state.custody, 100);
  assert.equal(sim.state.paid, 100);
});

test('credit limit: a refund that pushes debt over the limit is blocked', () => {
  // debt 900, limit 1000, refund 200 → 1100
  assert.throws(() => checkCreditLimit(900, 1100, 1000), AppError);
});

test('credit limit: reducing debt is allowed even while above the limit', () => {
  assert.doesNotThrow(() => checkCreditLimit(1500, 1200, 1000));
  assert.doesNotThrow(() => checkCreditLimit(500, 900, 0)); // no limit
});

test('supplier payment signs: paying reduces custody, refund increases it', () => {
  assert.equal(sourcePaymentEffect(300).custodyDelta, -300);
  assert.equal(sourcePaymentEffect(300).balanceDelta, -300);
  assert.equal(sourcePaymentEffect(-50).custodyDelta, 50);
  assert.equal(sourcePaymentEffect(-50).balanceDelta, 50);
});

test('summarizePayments separates received, refunded and net', () => {
  const s = summarizePayments([{ amount: 500 }, { amount: -120 }, { amount: 80.5 }, { amount: -0.5 }]);
  assert.deepEqual(s, { received: 580.5, refunded: 120.5, net: 460 });
});

test('normalizeLines validates and computes line totals', () => {
  const lines = normalizeLines([{ storeId: 's1', productId: 'p1', sellingPrice: '12.5', quantity: '3' }], 'sellingPrice');
  assert.equal(lines[0].lineTotal, 37.5);
  assert.deepEqual(invoiceTotals(lines), { totalCost: 37.5, totalItems: 3 });
  assert.throws(() => normalizeLines([{ storeId: 's1', productId: 'p1', sellingPrice: 5, quantity: 0 }], 'sellingPrice'), AppError);
  assert.throws(() => normalizeLines([{ storeId: '', productId: 'p1', sellingPrice: 5, quantity: 1 }], 'sellingPrice'), AppError);
  assert.throws(() => normalizeLines([{ storeId: 's1', productId: 'p1', sellingPrice: -1, quantity: 1 }], 'sellingPrice'), AppError);
  assert.throws(() => normalizeLines([], 'sellingPrice'), AppError);
});

test('same product on two lines is aggregated (stock check sees the real total)', () => {
  const map = aggregateQuantities([
    { storeId: 's1', productId: 'p1', quantity: 4 },
    { storeId: 's1', productId: 'p1', quantity: 3 },
  ]);
  assert.equal(map.get('s1_p1').quantity, 7);
});

test('inventory deltas: sale, purchase, edit and delete', () => {
  const sale = [{ storeId: 's1', productId: 'p1', quantity: 5 }];
  assert.deepEqual(inventoryDeltas([], sale, -1).map((d) => d.delta), [-5]);
  assert.deepEqual(inventoryDeltas([], sale, 1).map((d) => d.delta), [5]);
  // deleting a sale returns the goods
  assert.deepEqual(inventoryDeltas(sale, [], -1).map((d) => d.delta), [5]);
  // editing 5 → 8 sells 3 more; moving to another store returns to s1 and takes from s2
  assert.deepEqual(inventoryDeltas(sale, [{ storeId: 's1', productId: 'p1', quantity: 8 }], -1).map((d) => d.delta), [-3]);
  const moved = inventoryDeltas(sale, [{ storeId: 's2', productId: 'p1', quantity: 5 }], -1);
  assert.deepEqual(moved.map((d) => [d.storeId, d.delta]), [['s1', 5], ['s2', -5]]);
  // unchanged edit → no deltas
  assert.equal(inventoryDeltas(sale, sale, -1).length, 0);
});

test('editing a transfer = revert old + apply new, merged per store/product', () => {
  const oldT = { fromStoreId: 'a', toStoreId: 'b', products: [{ productId: 'p', quantity: 10 }] };
  const newT = { fromStoreId: 'a', toStoreId: 'b', products: [{ productId: 'p', quantity: 4 }] };
  const reverted = transferDeltas(oldT).map((d) => ({ ...d, delta: -d.delta }));
  const deltas = mergeDeltas(reverted, transferDeltas(newT));
  assert.deepEqual(deltas.map((d) => [d.storeId, d.delta]).sort(), [['a', 6], ['b', -6]]);
});

test('custody check blocks going negative but allows deposits', () => {
  assert.equal(checkCustody(100, -100, 'x'), 0);
  assert.throws(() => checkCustody(100, -100.01, 'x'), AppError);
  assert.equal(checkCustody(-50, 20, 'x'), -30); // deposits always allowed
  assert.equal(checkCustody(0, -10, 'x', true), -10); // when negative is explicitly allowed
});

test('profit uses the cost saved on the invoice, not the latest purchase price', () => {
  const lines = [{ productId: 'p1', sellingPrice: 15, quantity: 2, unitCost: 10 }];
  const latestCost = () => 14;
  assert.equal(invoiceProfit(lines, latestCost), 10);
  // legacy line without unitCost falls back
  assert.equal(invoiceProfit([{ productId: 'p1', sellingPrice: 15, quantity: 2 }], latestCost), 2);
});
