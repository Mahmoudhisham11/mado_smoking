import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStatement, buildPeriodReport, invoiceLabel } from '../lib/domain/reports.js';

const d = (s) => new Date(s);

test('statement: running balance with invoices, payments and a negative payment', () => {
  const invoices = [
    { id: 'i1', number: 1, date: d('2026-10-01T10:00'), totalCost: 1000 },
    { id: 'i2', number: 2, date: d('2026-10-05T10:00'), totalCost: 500 },
  ];
  const payments = [
    { id: 'p1', date: d('2026-10-01T10:00'), amount: 300, invoiceId: 'i1' },
    { id: 'p2', date: d('2026-10-03T12:00'), amount: -100 },
    { id: 'p3', date: d('2026-10-06T12:00'), amount: 400 },
  ];
  const s = buildStatement(invoices, payments);
  assert.deepEqual(s.rows.map((r) => [r.kind, r.balance]), [
    ['invoice', 1000],
    ['payment', 700],
    ['refund', 800],
    ['invoice', 1300],
    ['payment', 900],
  ]);
  assert.equal(s.closing, 900);
  assert.deepEqual(s.totals, { invoiced: 1500, received: 700, refunded: 100, invoiceCount: 2, paymentCount: 3, netPaid: 600 });
  assert.equal(s.lastPayment.amount, 400);
  assert.equal(s.rows[1].ref, '#1');
});

test('statement: date range uses an opening balance from earlier rows', () => {
  const invoices = [
    { id: 'i1', date: d('2026-09-01'), totalCost: 1000 },
    { id: 'i2', date: d('2026-10-10'), totalCost: 200 },
  ];
  const payments = [{ id: 'p1', date: d('2026-09-15'), amount: 250 }];
  const s = buildStatement(invoices, payments, { from: d('2026-10-01'), to: d('2026-10-31T23:59') });
  assert.equal(s.opening, 750);
  assert.equal(s.rows.length, 1);
  assert.equal(s.closing, 950);
  assert.equal(s.allTime.balance, 950);
});

test('invoiceLabel falls back to a short id for old invoices', () => {
  assert.equal(invoiceLabel({ id: 'abcdefghij', number: 12 }), '#12');
  assert.equal(invoiceLabel({ id: 'abcdefghij' }), '#EFGHIJ');
});

test('period report: sales, profit from saved cost, cash and stock movements', () => {
  const r = buildPeriodReport({
    salesInvoices: [
      {
        id: 's1', customerId: 'c1', date: d('2026-10-30T09:00'), totalCost: 250,
        products: [
          { storeId: 'st1', storeName: 'الرئيسي', productId: 'p1', productName: 'كليوباترا', sellingPrice: 50, quantity: 3, lineTotal: 150, unitCost: 40 },
          { storeId: 'st1', storeName: 'الرئيسي', productId: 'p2', productName: 'مارلبورو', sellingPrice: 100, quantity: 1, lineTotal: 100 },
        ],
      },
    ],
    purchaseInvoices: [
      { id: 'b1', sourceId: 'v1', date: d('2026-10-30T08:00'), totalCost: 400, products: [{ storeId: 'st1', storeName: 'الرئيسي', productId: 'p1', productName: 'كليوباترا', quantity: 10, wholesalePrice: 40 }] },
    ],
    customerPayments: [{ customerId: 'c1', amount: 200, date: d('2026-10-30T09:05') }, { customerId: 'c1', amount: -20, date: d('2026-10-30T11:00') }],
    sourcePayments: [{ sourceId: 'v1', amount: 300, date: d('2026-10-30T08:10') }],
    expenses: [{ amount: 30, notes: 'كهرباء', date: d('2026-10-30T12:00') }],
    transfers: [{ fromStoreId: 'st1', fromStoreName: 'الرئيسي', toStoreId: 'st2', toStoreName: 'الفرع', createdAt: d('2026-10-30T13:00'), products: [{ productId: 'p1', productName: 'كليوباترا', quantity: 2 }] }],
    adjustments: [{ storeId: 'st2', storeName: 'الفرع', mode: 'set', createdAt: d('2026-10-30T14:00'), lines: [{ productId: 'p1', productName: 'كليوباترا', before: 2, after: 1 }] }],
    movements: [
      { custodyId: 'k1', custodyName: 'الخزنة', amount: 200, type: 'customer_payment' },
      { custodyId: 'k1', custodyName: 'الخزنة', amount: -300, type: 'source_payment' },
      { custodyId: 'k1', custodyName: 'الخزنة', amount: 5000, type: 'opening' },
    ],
    customerNames: new Map([['c1', 'أحمد']]),
    sourceNames: new Map([['v1', 'الشرقية']]),
    productCost: new Map([['p2', 80]]),
  });

  assert.equal(r.kpis.salesTotal, 250);
  assert.equal(r.kpis.cogs, 200); // 3×40 محفوظة + 1×80 بديلة
  assert.equal(r.kpis.grossProfit, 50);
  assert.equal(r.kpis.margin, 20);
  assert.equal(r.kpis.netProfit, 20);
  assert.equal(r.kpis.collected, 200);
  assert.equal(r.kpis.refunded, 20);
  assert.equal(r.kpis.cashIn, 200);
  assert.equal(r.kpis.cashOut, 350);
  assert.equal(r.kpis.netCash, -150);
  assert.equal(r.products[0].name, 'كليوباترا');
  assert.equal(r.customers[0].name, 'أحمد');
  assert.equal(r.suppliers[0].paid, 300);

  const main = r.stockMovements.find((m) => m.storeName === 'الرئيسي' && m.productName === 'كليوباترا');
  assert.deepEqual([main.purchased, main.sold, main.transferOut, main.net], [10, 3, 2, 5]);
  const branch = r.stockMovements.find((m) => m.storeName === 'الفرع');
  assert.deepEqual([branch.transferIn, branch.adjusted, branch.net], [2, -1, 1]);

  assert.deepEqual(r.custodies, [{ custodyId: 'k1', name: 'الخزنة', in: 200, out: 300, net: -100 }]);
  assert.equal(r.timeline[0].type, 'جرد مخزون'); // الأحدث أولاً
  assert.equal(r.timeline.length, 8);
});
