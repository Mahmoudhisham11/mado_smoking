// حسابات التقارير وكشوف الحساب (بدون Firebase) عشان تبقى قابلة للاختبار.
import { safeMoney, safeQty, stockKey } from './accounting.js';

const time = (d) => (d instanceof Date ? d.getTime() : new Date(d).getTime()) || 0;
const add = (a, b) => safeMoney(a + b);

export const invoiceLabel = (invoice) =>
  invoice?.number ? `#${invoice.number}` : `#${String(invoice?.id || '').slice(-6).toUpperCase()}`;

// كشف حساب طرف (عميل أو مورد).
// الرصيد = الفواتير − المدفوعات بإشارتها؛ المدفوع السالب (صرف/استرداد) بيزود الرصيد.
export const buildStatement = (invoices, payments, { from = null, to = null } = {}) => {
  const entries = [
    ...invoices.map((inv) => ({
      id: inv.id,
      date: inv.date,
      kind: 'invoice',
      ref: invoiceLabel(inv),
      invoiceAmount: safeMoney(inv.totalCost),
      paymentAmount: 0,
      items: safeQty(inv.totalItems),
    })),
    ...payments.map((p) => {
      const amount = safeMoney(p.amount);
      return {
        id: p.id,
        date: p.date,
        kind: amount < 0 ? 'refund' : 'payment',
        ref: p.invoiceId ? invoiceLabel(invoices.find((i) => i.id === p.invoiceId) || { id: p.invoiceId }) : '',
        invoiceAmount: 0,
        paymentAmount: amount,
        custodyName: p.custodyName || '',
        notes: p.notes || '',
      };
    }),
  ].sort((a, b) => time(a.date) - time(b.date) || (a.kind === 'invoice' ? -1 : 1));

  const fromT = from ? time(from) : -Infinity;
  const toT = to ? time(to) : Infinity;
  let balance = 0;
  let opening = 0;
  const rows = [];
  const totals = { invoiced: 0, received: 0, refunded: 0, invoiceCount: 0, paymentCount: 0 };
  for (const e of entries) {
    balance = safeMoney(balance + e.invoiceAmount - e.paymentAmount);
    const t = time(e.date);
    if (t < fromT) {
      opening = balance;
      continue;
    }
    if (t > toT) continue;
    rows.push({ ...e, balance });
    if (e.kind === 'invoice') {
      totals.invoiced = add(totals.invoiced, e.invoiceAmount);
      totals.invoiceCount++;
    } else {
      totals.paymentCount++;
      if (e.paymentAmount >= 0) totals.received = add(totals.received, e.paymentAmount);
      else totals.refunded = add(totals.refunded, -e.paymentAmount);
    }
  }
  const closing = rows.length ? rows[rows.length - 1].balance : opening;
  const lastPayment = [...entries].reverse().find((e) => e.kind === 'payment') || null;
  return {
    opening,
    closing,
    rows,
    totals: { ...totals, netPaid: safeMoney(totals.received - totals.refunded) },
    lastPayment: lastPayment ? { date: lastPayment.date, amount: lastPayment.paymentAmount } : null,
    allTime: {
      invoiced: safeMoney(entries.reduce((s, e) => s + e.invoiceAmount, 0)),
      paid: safeMoney(entries.reduce((s, e) => s + e.paymentAmount, 0)),
      balance,
    },
  };
};

const MOVEMENT_TYPE_LABELS = {
  opening: 'رصيد افتتاحي',
  adjustment: 'تسوية عهدة',
  customer_payment: 'تحصيل من عميل',
  customer_refund: 'صرف لعميل',
  source_payment: 'دفع لمورد',
  source_refund: 'استرداد من مورد',
  expense: 'مصروف',
  transfer_in: 'تحويل وارد',
  transfer_out: 'تحويل صادر',
  reversal: 'إلغاء عملية',
};

export const movementLabel = (type) => MOVEMENT_TYPE_LABELS[type] || type;

// تقرير فترة (يوم أو أكتر): مبيعات وأرباح ومشتريات ونقدية وحركة مخزون وكل العمليات
export const buildPeriodReport = ({
  salesInvoices = [],
  purchaseInvoices = [],
  customerPayments = [],
  sourcePayments = [],
  expenses = [],
  transfers = [],
  adjustments = [],
  movements = [],
  customerNames = new Map(),
  sourceNames = new Map(),
  productCost = new Map(),
}) => {
  // --- المبيعات والأرباح ---
  const byProduct = new Map();
  let salesTotal = 0;
  let cogs = 0;
  let itemsSold = 0;
  for (const inv of salesInvoices) {
    salesTotal += safeMoney(inv.totalCost);
    for (const line of inv.products || []) {
      const qty = safeQty(line.quantity);
      const revenue = safeMoney(line.lineTotal ?? safeMoney(line.sellingPrice) * qty);
      const unitCost = line.unitCost !== undefined && line.unitCost !== null ? safeMoney(line.unitCost) : safeMoney(productCost.get(line.productId));
      const cost = safeMoney(unitCost * qty);
      itemsSold += qty;
      cogs += cost;
      const p = byProduct.get(line.productId) || { productId: line.productId, name: line.productName || '', qty: 0, revenue: 0, cost: 0 };
      p.qty = safeQty(p.qty + qty);
      p.revenue = add(p.revenue, revenue);
      p.cost = add(p.cost, cost);
      byProduct.set(line.productId, p);
    }
  }
  const products = [...byProduct.values()]
    .map((p) => ({ ...p, profit: safeMoney(p.revenue - p.cost), margin: p.revenue ? Math.round(((p.revenue - p.cost) / p.revenue) * 1000) / 10 : 0 }))
    .sort((a, b) => b.revenue - a.revenue);

  // --- العملاء ---
  const byCustomer = new Map();
  const customerRow = (id) => {
    if (!byCustomer.has(id)) byCustomer.set(id, { customerId: id, name: customerNames.get(id) || 'عميل محذوف', invoices: 0, total: 0, collected: 0, refunded: 0 });
    return byCustomer.get(id);
  };
  for (const inv of salesInvoices) {
    const c = customerRow(inv.customerId);
    c.invoices++;
    c.total = add(c.total, safeMoney(inv.totalCost));
  }
  let collected = 0;
  let refunded = 0;
  for (const p of customerPayments) {
    const a = safeMoney(p.amount);
    const c = customerRow(p.customerId);
    if (a >= 0) {
      collected += a;
      c.collected = add(c.collected, a);
    } else {
      refunded += -a;
      c.refunded = add(c.refunded, -a);
    }
  }

  // --- الموردين ---
  const bySource = new Map();
  const sourceRow = (id) => {
    if (!bySource.has(id)) bySource.set(id, { sourceId: id, name: sourceNames.get(id) || 'مورد محذوف', invoices: 0, total: 0, paid: 0 });
    return bySource.get(id);
  };
  let purchasesTotal = 0;
  for (const inv of purchaseInvoices) {
    purchasesTotal += safeMoney(inv.totalCost);
    const s = sourceRow(inv.sourceId);
    s.invoices++;
    s.total = add(s.total, safeMoney(inv.totalCost));
  }
  let paidToSuppliers = 0;
  let supplierRefunds = 0;
  for (const p of sourcePayments) {
    const a = safeMoney(p.amount);
    sourceRow(p.sourceId).paid = add(sourceRow(p.sourceId).paid, a);
    if (a >= 0) paidToSuppliers += a;
    else supplierRefunds += -a;
  }

  const expensesTotal = safeMoney(expenses.reduce((s, e) => s + safeMoney(e.amount), 0));

  // --- حركة المخزون ---
  const stock = new Map();
  const stockRow = (storeId, storeName, productId, productName) => {
    const key = stockKey(storeId, productId);
    if (!stock.has(key)) stock.set(key, { storeName: storeName || '', productName: productName || '', purchased: 0, sold: 0, transferIn: 0, transferOut: 0, adjusted: 0 });
    const row = stock.get(key);
    if (!row.storeName && storeName) row.storeName = storeName;
    if (!row.productName && productName) row.productName = productName;
    return row;
  };
  for (const inv of purchaseInvoices) {
    for (const l of inv.products || []) stockRow(l.storeId, l.storeName, l.productId, l.productName).purchased += safeQty(l.quantity);
  }
  for (const inv of salesInvoices) {
    for (const l of inv.products || []) stockRow(l.storeId, l.storeName, l.productId, l.productName).sold += safeQty(l.quantity);
  }
  for (const t of transfers) {
    for (const l of t.products || []) {
      stockRow(t.fromStoreId, t.fromStoreName, l.productId, l.productName).transferOut += safeQty(l.quantity);
      stockRow(t.toStoreId, t.toStoreName, l.productId, l.productName).transferIn += safeQty(l.quantity);
    }
  }
  for (const a of adjustments) {
    for (const l of a.lines || []) stockRow(a.storeId, a.storeName, l.productId, l.productName).adjusted += safeQty(safeQty(l.after) - safeQty(l.before));
  }
  const stockMovements = [...stock.values()]
    .map((r) => ({
      ...r,
      purchased: safeQty(r.purchased),
      sold: safeQty(r.sold),
      transferIn: safeQty(r.transferIn),
      transferOut: safeQty(r.transferOut),
      adjusted: safeQty(r.adjusted),
      net: safeQty(r.purchased - r.sold + r.transferIn - r.transferOut + r.adjusted),
    }))
    .sort((a, b) => a.storeName.localeCompare(b.storeName, 'ar') || a.productName.localeCompare(b.productName, 'ar'));

  // --- العهد ---
  const byCustody = new Map();
  for (const m of movements) {
    if (m.type === 'opening') continue;
    const c = byCustody.get(m.custodyId) || { custodyId: m.custodyId, name: m.custodyName || '', in: 0, out: 0 };
    const a = safeMoney(m.amount);
    if (a >= 0) c.in = add(c.in, a);
    else c.out = add(c.out, -a);
    byCustody.set(m.custodyId, c);
  }
  const custodies = [...byCustody.values()].map((c) => ({ ...c, net: safeMoney(c.in - c.out) }));

  // --- سجل العمليات ---
  const timeline = [
    ...salesInvoices.map((inv) => ({ date: inv.date, type: 'فاتورة بيع', description: `${invoiceLabel(inv)} - ${customerNames.get(inv.customerId) || ''}`, amount: safeMoney(inv.totalCost), user: inv.userName || '' })),
    ...purchaseInvoices.map((inv) => ({ date: inv.date, type: 'فاتورة شراء', description: `${invoiceLabel(inv)} - ${sourceNames.get(inv.sourceId) || ''}`, amount: safeMoney(inv.totalCost), user: inv.userName || '' })),
    ...customerPayments.map((p) => ({ date: p.date, type: safeMoney(p.amount) < 0 ? 'صرف لعميل' : 'تحصيل من عميل', description: `${customerNames.get(p.customerId) || ''}${p.custodyName ? ` ← ${p.custodyName}` : ''}`, amount: safeMoney(p.amount), user: p.userName || '' })),
    ...sourcePayments.map((p) => ({ date: p.date, type: safeMoney(p.amount) < 0 ? 'استرداد من مورد' : 'دفع لمورد', description: `${sourceNames.get(p.sourceId) || ''}${p.custodyName ? ` ← ${p.custodyName}` : ''}`, amount: safeMoney(p.amount), user: p.userName || '' })),
    ...expenses.map((e) => ({ date: e.date, type: 'مصروف', description: `${e.notes || 'مصروف'}${e.custodyName ? ` ← ${e.custodyName}` : ''}`, amount: safeMoney(e.amount), user: e.userName || '' })),
    ...transfers.map((t) => ({ date: t.createdAt, type: 'تحويل مخزون', description: `${t.fromStoreName} ← ${t.toStoreName} (${(t.products || []).length} صنف)`, amount: null, user: t.userName || '' })),
    ...adjustments.map((a) => ({ date: a.createdAt, type: a.mode === 'set' ? 'جرد مخزون' : 'إضافة مخزون', description: `${a.storeName} (${(a.lines || []).length} صنف)`, amount: null, user: a.userName || '' })),
    ...movements
      .filter((m) => ['adjustment', 'transfer_out'].includes(m.type))
      .map((m) => ({ date: m.createdAt, type: movementLabel(m.type), description: `${m.custodyName}${m.note ? ` - ${m.note}` : ''}`, amount: safeMoney(m.amount), user: m.userName || '' })),
  ].sort((a, b) => time(b.date) - time(a.date));

  salesTotal = safeMoney(salesTotal);
  cogs = safeMoney(cogs);
  collected = safeMoney(collected);
  refunded = safeMoney(refunded);
  purchasesTotal = safeMoney(purchasesTotal);
  paidToSuppliers = safeMoney(paidToSuppliers);
  supplierRefunds = safeMoney(supplierRefunds);
  const grossProfit = safeMoney(salesTotal - cogs);
  const cashIn = safeMoney(collected + supplierRefunds);
  const cashOut = safeMoney(paidToSuppliers + expensesTotal + refunded);

  return {
    kpis: {
      salesTotal,
      salesCount: salesInvoices.length,
      itemsSold: safeQty(itemsSold),
      cogs,
      grossProfit,
      margin: salesTotal ? Math.round((grossProfit / salesTotal) * 1000) / 10 : 0,
      expensesTotal,
      netProfit: safeMoney(grossProfit - expensesTotal),
      collected,
      refunded,
      purchasesTotal,
      purchasesCount: purchaseInvoices.length,
      paidToSuppliers,
      supplierRefunds,
      cashIn,
      cashOut,
      netCash: safeMoney(cashIn - cashOut),
      averageInvoice: salesInvoices.length ? safeMoney(salesTotal / salesInvoices.length) : 0,
    },
    products,
    customers: [...byCustomer.values()].sort((a, b) => b.total - a.total),
    suppliers: [...bySource.values()].sort((a, b) => b.total - a.total),
    stockMovements,
    custodies,
    expenses: [...expenses].sort((a, b) => time(b.date) - time(a.date)),
    timeline,
  };
};
