import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  writeBatch,
} from 'firebase/firestore';
import { db } from '../config';
import { requireSession, run, toDate } from './helpers';
import {
  AppError,
  custodyDocId,
  normalizeName,
  safeMoney,
  safeQty,
  stockKey,
} from '../../domain/accounting';

// ترحيل بيانات المالك للشكل الجديد (مرة واحدة). بيشتغل من جوه التطبيق بحساب المالك:
// "فحص" بيطلع تقرير من غير أي كتابة، و"تطبيق" بيكتب نفس التغييرات.
export const MIGRATION_VERSION = 2;

const OWNED_COLLECTIONS = [
  'smokingProducts', 'stores', 'storeProducts', 'storeTransfers', 'customers', 'customerInvoices',
  'customerPayments', 'sources', 'sourceInvoices', 'sourcePayments', 'custodies', 'custodyMovements',
  'expenses', 'inventoryAdjustments',
];

export const subscribeToMigrationStatus = (ownerId, callback) =>
  onSnapshot(doc(db, 'migrations', ownerId), (snap) => {
    callback(snap.exists() ? Number(snap.data().version) || 0 : 0);
  }, (error) => {
    console.error('Error reading migration status:', error);
    callback(0);
  });

const loadAll = async (ownerId) => {
  const entries = await Promise.all(OWNED_COLLECTIONS.map(async (name) => {
    const snap = await getDocs(query(collection(db, name), where('ownerId', '==', ownerId)));
    return [name, snap.docs.map((d) => ({ id: d.id, ref: d.ref, data: d.data() }))];
  }));
  return Object.fromEntries(entries);
};

const serialize = (value) => {
  if (value === null || value === undefined) return value;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialize(v)]));
  return value;
};

// نسخة احتياطية كاملة لبيانات المالك (JSON)
export const exportBackup = () => run('exporting backup', async () => {
  const { ownerId } = requireSession();
  const data = await loadAll(ownerId);
  const users = await getDocs(query(collection(db, 'users'), where('ownerId', '==', ownerId)));
  const collections = Object.fromEntries(Object.entries(data).map(([name, docs]) => [name, docs.map((d) => ({ id: d.id, ...serialize(d.data) }))]));
  collections.users = users.docs.map((d) => ({ id: d.id, ...serialize(d.data()) }));
  return { backup: { exportedAt: new Date().toISOString(), ownerId, collections } };
});

// تجميع الكتابات: كل مستند ليه عملية واحدة نهائية
class Writer {
  constructor() {
    this.ops = new Map();
    this.groups = [];
  }

  // مجموعة عمليات لازم تتكتب مع بعض في batch واحد (بعد باقي العمليات)
  atomic(ops) {
    this.groups.push(ops);
  }

  set(ref, data) {
    this.ops.set(ref.path, { kind: 'set', ref, data });
  }

  update(ref, fields) {
    const prev = this.ops.get(ref.path);
    if (prev && prev.kind !== 'delete') prev.data = { ...prev.data, ...fields };
    else this.ops.set(ref.path, { kind: 'update', ref, data: fields });
  }

  delete(ref) {
    this.ops.set(ref.path, { kind: 'delete', ref });
  }

  get size() {
    return this.ops.size + this.groups.reduce((s, g) => s + g.length, 0);
  }

  async commit() {
    const ops = [...this.ops.values()];
    // الإنشاء والتعديل الأول، والحذف في الآخر
    ops.sort((a, b) => (a.kind === 'delete') - (b.kind === 'delete'));
    for (let i = 0; i < ops.length; i += 400) {
      const batch = writeBatch(db);
      for (const op of ops.slice(i, i + 400)) {
        if (op.kind === 'set') batch.set(op.ref, op.data);
        else if (op.kind === 'update') batch.update(op.ref, op.data);
        else batch.delete(op.ref);
      }
      await batch.commit();
    }
    for (const group of this.groups) {
      const batch = writeBatch(db);
      for (const op of group) {
        if (op.kind === 'update') batch.update(op.ref, op.data);
        else batch.delete(op.ref);
      }
      await batch.commit();
    }
  }
}

const dateOf = (data) => toDate(data.date) || toDate(data.createdAt) || new Date(0);

const buildPlan = async (session, all) => {
  const { ownerId, uid } = session;
  const writer = new Writer();
  const report = [];
  const step = (title) => {
    const s = { title, changes: 0, details: [], warnings: [] };
    report.push(s);
    return s;
  };
  const now = new Date();

  const products = new Map(all.smokingProducts.map((p) => [p.id, p]));
  const productsByName = new Map();
  const duplicateNames = new Set();
  for (const p of all.smokingProducts) {
    const key = normalizeName(p.data.name);
    if (!key) continue;
    if (productsByName.has(key)) duplicateNames.add(key);
    else productsByName.set(key, p);
  }
  const resolveProduct = (productId, productName) => {
    if (products.has(productId)) return productId;
    const key = normalizeName(productName);
    if (!key || duplicateNames.has(key)) return null;
    return productsByName.get(key)?.id || null;
  };

  // 1) تصحيح productId في سطور الفواتير
  const s1 = step('تصحيح أكواد الأصناف في الفواتير');
  const invoiceLines = new Map();
  for (const coll of ['customerInvoices', 'sourceInvoices']) {
    for (const inv of all[coll]) {
      const lines = (inv.data.products || []).map((line) => {
        const fixed = resolveProduct(line.productId, line.productName);
        if (fixed && fixed !== line.productId) {
          s1.changes++;
          if (s1.details.length < 30) s1.details.push(`"${line.productName}" في فاتورة ${inv.id}`);
          return { ...line, productId: fixed };
        }
        if (!fixed) s1.warnings.push(`الصنف "${line.productName || line.productId}" في فاتورة ${inv.id} غير موجود في قائمة الأصناف`);
        return { ...line };
      });
      invoiceLines.set(inv.ref.path, lines);
    }
  }

  // 2) أرصدة المخازن: ID ثابت (مخزن_صنف) + دمج المكرر
  const s2 = step('توحيد أرصدة المخازن');
  const groups = new Map();
  for (const sp of all.storeProducts) {
    const productId = resolveProduct(sp.data.productId, sp.data.productName) || sp.data.productId;
    const key = stockKey(sp.data.storeId, productId);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...sp, productId });
  }
  const stores = new Map(all.stores.map((s) => [s.id, s]));
  for (const [key, docs] of groups) {
    docs.sort((a, b) => (toDate(b.data.updatedAt)?.getTime() || 0) - (toDate(a.data.updatedAt)?.getTime() || 0));
    const winner = docs[0];
    const quantity = Math.max(0, safeQty(winner.data.totalQuantity));
    const alreadyOk = docs.length === 1 && winner.id === key && winner.productId === winner.data.productId && quantity === safeQty(winner.data.totalQuantity);
    if (docs.length > 1) {
      s2.warnings.push(`الصنف "${winner.data.productName}" في مخزن "${stores.get(winner.data.storeId)?.data.name || winner.data.storeId}" كان متسجل ${docs.length} مرات بكميات (${docs.map((d) => safeQty(d.data.totalQuantity)).join('، ')}). تم اعتماد الأحدث: ${quantity}`);
    }
    if (safeQty(winner.data.totalQuantity) < 0) s2.warnings.push(`كمية سالبة للصنف "${winner.data.productName}" اتعدلت لصفر`);
    if (!stores.has(winner.data.storeId)) s2.warnings.push(`رصيد للصنف "${winner.data.productName}" في مخزن غير موجود`);
    if (alreadyOk) continue;
    s2.changes++;
    writer.set(doc(db, 'storeProducts', key), {
      storeId: winner.data.storeId,
      productId: winner.productId,
      productName: products.get(winner.productId)?.data.name || winner.data.productName || 'غير معروف',
      totalQuantity: quantity,
      ownerId,
      userId: winner.data.userId || uid,
      createdAt: winner.data.createdAt || now,
      updatedAt: now,
    });
    for (const d of docs) if (d.id !== key) writer.delete(d.ref);
  }

  // 3) العهد: عهدة واحدة لكل مستخدم
  const s3 = step('دمج العهد المكررة');
  const custodyByUser = new Map();
  for (const c of all.custodies) {
    if (!custodyByUser.has(c.data.userId)) custodyByUser.set(c.data.userId, []);
    custodyByUser.get(c.data.userId).push(c);
  }
  const custodyRemap = new Map();
  const custodyFinal = new Map();
  for (const [userId, list] of custodyByUser) {
    list.sort((a, b) => {
      const det = custodyDocId(ownerId, userId);
      if (a.id === det) return -1;
      if (b.id === det) return 1;
      return (toDate(a.data.createdAt)?.getTime() || 0) - (toDate(b.data.createdAt)?.getTime() || 0);
    });
    const keep = list[0];
    const amount = safeMoney(list.reduce((s, c) => s + safeMoney(c.data.amount), 0));
    custodyFinal.set(keep.id, { ...keep, amount });
    if (list.length > 1) {
      s3.changes += list.length - 1;
      s3.details.push(`"${keep.data.name}": ${list.length} عهد اتدمجت في واحدة برصيد ${amount}`);
      // تعديل الرصيد وحذف المكرر في batch واحد، عشان لو الترحيل اتعاد مايتجمعش الرصيد مرتين
      const group = [{ kind: 'update', ref: keep.ref, data: { amount, updatedAt: now } }];
      for (const dup of list.slice(1)) {
        custodyRemap.set(dup.id, keep.id);
        group.push({ kind: 'delete', ref: dup.ref });
      }
      writer.atomic(group);
    }
  }
  for (const coll of ['customerPayments', 'sourcePayments', 'expenses']) {
    for (const d of all[coll]) {
      const target = custodyRemap.get(d.data.custodyId);
      if (target) writer.update(d.ref, { custodyId: target, updatedAt: now });
    }
  }

  // 4) ربط مدفوعات الموردين بفواتيرها (المدفوع وقت إنشاء الفاتورة كان بيتسجل من غير invoiceId)
  const s4 = step('ربط مدفوعات الموردين بفواتيرها');
  const freePayments = all.sourcePayments.filter((p) => !p.data.invoiceId);
  const used = new Set();
  for (const inv of all.sourceInvoices) {
    const created = toDate(inv.data.createdAt)?.getTime();
    if (!created) continue;
    let best = null;
    for (const p of freePayments) {
      if (used.has(p.id) || p.data.sourceId !== inv.data.sourceId) continue;
      const t = toDate(p.data.createdAt)?.getTime();
      if (!t || t < created || t - created > 120000) continue;
      if (safeMoney(p.data.amount) > safeMoney(inv.data.totalCost)) continue;
      if (!best || t < toDate(best.data.createdAt).getTime()) best = p;
    }
    if (best) {
      used.add(best.id);
      s4.changes++;
      writer.update(best.ref, { invoiceId: inv.id, updatedAt: now });
    }
  }

  // 5) آخر سعر توريد على الصنف نفسه
  const s5 = step('حفظ آخر سعر توريد على كل صنف');
  const purchases = [];
  for (const inv of all.sourceInvoices) {
    for (const line of invoiceLines.get(inv.ref.path)) {
      purchases.push({ productId: line.productId, price: safeMoney(line.wholesalePrice), date: dateOf(inv.data) });
    }
  }
  purchases.sort((a, b) => a.date - b.date);
  const purchasesByProduct = new Map();
  for (const p of purchases) {
    if (!purchasesByProduct.has(p.productId)) purchasesByProduct.set(p.productId, []);
    purchasesByProduct.get(p.productId).push(p);
  }
  for (const [productId, list] of purchasesByProduct) {
    const product = products.get(productId);
    if (!product) continue;
    const last = list[list.length - 1];
    if (safeMoney(product.data.lastCost) !== last.price || !product.data.lastCostAt) {
      s5.changes++;
      writer.update(product.ref, { lastCost: last.price, lastCostAt: last.date, updatedAt: now });
    }
  }

  // 6) سطور الفواتير: تكلفة البيع وقت الفاتورة + إجمالي السطر + قايمة الأصناف
  const s6 = step('حفظ تكلفة الأصناف في فواتير البيع');
  const costAt = (productId, date) => {
    const list = purchasesByProduct.get(productId) || [];
    let found = null;
    for (const p of list) {
      if (p.date <= date) found = p;
      else break;
    }
    return found || list[0] || null;
  };
  let missingCost = 0;
  for (const coll of ['customerInvoices', 'sourceInvoices']) {
    const priceField = coll === 'customerInvoices' ? 'sellingPrice' : 'wholesalePrice';
    for (const inv of all[coll]) {
      const date = dateOf(inv.data);
      const lines = invoiceLines.get(inv.ref.path).map((line) => {
        const out = { ...line, quantity: safeQty(line.quantity), [priceField]: safeMoney(line[priceField]) };
        out.lineTotal = safeMoney(out[priceField] * out.quantity);
        if (coll === 'customerInvoices' && (line.unitCost === undefined || line.unitCost === null)) {
          const purchase = costAt(line.productId, date);
          if (!purchase) missingCost++;
          out.unitCost = purchase ? purchase.price : 0;
          s6.changes++;
        }
        return out;
      });
      const linesTotal = safeMoney(lines.reduce((s, l) => s + l.lineTotal, 0));
      if (linesTotal !== safeMoney(inv.data.totalCost)) {
        s6.warnings.push(`فاتورة ${inv.id}: الإجمالي المسجل ${safeMoney(inv.data.totalCost)} لا يساوي مجموع السطور ${linesTotal} (تم الإبقاء على المسجل)`);
      }
      writer.update(inv.ref, {
        products: lines,
        productIds: [...new Set(lines.map((l) => l.productId))],
        date,
      });
    }
  }
  // ترقيم الفواتير القديمة بالترتيب الزمني، وضبط العداد على آخر رقم
  const sNum = step('ترقيم الفواتير');
  for (const coll of ['customerInvoices', 'sourceInvoices']) {
    const list = [...all[coll]].sort((a, b) => dateOf(a.data) - dateOf(b.data));
    let seq = list.reduce((m, inv) => Math.max(m, Number(inv.data.number) || 0), 0);
    for (const inv of list) {
      if (Number(inv.data.number) > 0) continue;
      seq++;
      sNum.changes++;
      writer.update(inv.ref, { number: seq });
    }
    writer.set(doc(db, 'counters', `${ownerId}_${coll}`), { ownerId, seq, updatedAt: now });
  }

  if (missingCost > 0) s6.warnings.push(`${missingCost} سطر بيع لصنف مالوش أي فاتورة توريد: التكلفة اتسجلت صفر`);

  // 7) أرصدة العملاء والموردين المجمعة
  const s7 = step('حساب أرصدة العملاء والموردين');
  const aggregate = (parties, invoices, payments, field, label) => {
    const ids = new Set(parties.map((p) => p.id));
    const totals = new Map(parties.map((p) => [p.id, { invoiced: 0, paid: 0 }]));
    for (const inv of invoices) {
      if (!ids.has(inv.data[field])) {
        s7.warnings.push(`فاتورة ${inv.id} مرتبطة بـ${label} غير موجود (${safeMoney(inv.data.totalCost)} ج.م)`);
        continue;
      }
      totals.get(inv.data[field]).invoiced += safeMoney(inv.data.totalCost);
    }
    for (const p of payments) {
      if (!ids.has(p.data[field])) {
        s7.warnings.push(`سداد ${p.id} مرتبط بـ${label} غير موجود (${safeMoney(p.data.amount)} ج.م)`);
        continue;
      }
      totals.get(p.data[field]).paid += safeMoney(p.data.amount);
    }
    for (const party of parties) {
      const t = totals.get(party.id);
      const totalInvoiced = safeMoney(t.invoiced);
      const totalPaid = safeMoney(t.paid);
      const balance = safeMoney(totalInvoiced - totalPaid);
      s7.changes++;
      if (s7.details.length < 50) s7.details.push(`${label} "${party.data.name}": الرصيد ${balance.toLocaleString()} ج.م`);
      writer.update(party.ref, { totalInvoiced, totalPaid, balance, updatedAt: now });
    }
  };
  aggregate(all.customers, all.customerInvoices, all.customerPayments, 'customerId', 'العميل');
  aggregate(all.sources, all.sourceInvoices, all.sourcePayments, 'sourceId', 'المورد');

  // 8) رصيد افتتاحي في سجل حركات كل عهدة
  const s8 = step('تسجيل الرصيد الافتتاحي للعهد');
  const openingIds = [...custodyFinal.keys()].map((id) => `opening_${id}`);
  const existingOpenings = await Promise.all(openingIds.map((id) => getDoc(doc(db, 'custodyMovements', id))));
  [...custodyFinal.values()].forEach((c, i) => {
    if (existingOpenings[i].exists() || c.amount === 0) return;
    s8.changes++;
    s8.details.push(`"${c.data.name}": ${c.amount.toLocaleString()} ج.م`);
    writer.set(doc(db, 'custodyMovements', openingIds[i]), {
      ownerId,
      custodyId: c.id,
      custodyName: c.data.name || '',
      amount: c.amount,
      balanceAfter: c.amount,
      type: 'opening',
      refType: null,
      refId: null,
      note: 'رصيد افتتاحي عند تحديث النظام',
      userId: uid,
      userName: session.name || '',
      createdAt: now,
    });
  });

  return { writer, report };
};

// apply = false: فحص وتقرير بس. apply = true: تطبيق التغييرات وتسجيل إن الترحيل خلص
export const runMigration = ({ apply }) => run('running migration', async () => {
  const session = requireSession();
  if (session.role !== 'owner') throw new AppError('تحديث البيانات متاح للمالك فقط');
  const all = await loadAll(session.ownerId);
  const { writer, report } = await buildPlan(session, all);
  if (apply) {
    await writer.commit();
    // علامة الانتهاء بتتكتب بعد ما كل الدفعات تنجح، فلو حصل فشل في النص الترحيل يتعاد
    const done = writeBatch(db);
    done.set(doc(db, 'migrations', session.ownerId), {
      version: MIGRATION_VERSION,
      appliedAt: new Date(),
      appliedBy: session.uid,
      summary: report.map((s) => ({ title: s.title, changes: s.changes, warnings: s.warnings.length })),
    });
    await done.commit();
  }
  return { report, totalWrites: writer.size };
});
