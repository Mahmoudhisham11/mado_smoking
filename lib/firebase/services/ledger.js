import { collection, doc } from 'firebase/firestore';
import { db } from '../config';
import { AppError, checkCustody, safeMoney, safeQty, shortageMessage, stockKey } from '../../domain/accounting';

// سياق موحد جوه runTransaction لكل تغيير في العهد أو المخزون.
// الاستخدام: load* (قراءات) ← custodyDelta/stockDelta ← commit() (تحقق ثم كتابة).
// Firestore بيشترط إن كل القراءات تحصل قبل أي كتابة جوه الـ transaction.
export class TxLedger {
  constructor(tx, session) {
    this.tx = tx;
    this.session = session;
    this.custodies = new Map();
    this.stocks = new Map();
    this.movements = [];
  }

  // allowMissing: للإلغاء (عكس عملية قديمة) على عهدة اتحذفت — بنتجاهلها بدل ما نمنع الإلغاء
  async loadCustodies(ids, { allowMissing = false } = {}) {
    const pending = [...new Set(ids.filter(Boolean))].filter((id) => !this.custodies.has(id));
    const snaps = await Promise.all(pending.map((id) => this.tx.get(doc(db, 'custodies', id))));
    snaps.forEach((snap, i) => {
      if (!snap.exists() || snap.data().ownerId !== this.session.ownerId) {
        if (allowMissing) return;
        throw new AppError('العهدة المختارة غير موجودة');
      }
      const data = snap.data();
      this.custodies.set(pending[i], { ref: snap.ref, name: data.name || '', amount: safeMoney(data.amount), delta: 0 });
    });
  }

  async loadStocks(entries) {
    const unique = new Map();
    for (const e of entries) {
      const key = stockKey(e.storeId, e.productId);
      if (!this.stocks.has(key) && !unique.has(key)) unique.set(key, e);
    }
    const list = [...unique.entries()];
    const snaps = await Promise.all(list.map(([key]) => this.tx.get(doc(db, 'storeProducts', key))));
    snaps.forEach((snap, i) => {
      const [key, e] = list[i];
      const data = snap.exists() ? snap.data() : null;
      this.stocks.set(key, {
        ref: snap.ref,
        exists: snap.exists(),
        storeId: e.storeId,
        productId: e.productId,
        storeName: e.storeName || data?.storeName || '',
        productName: e.productName || data?.productName || '',
        quantity: safeQty(data?.totalQuantity),
        delta: 0,
      });
    });
  }

  hasCustody(id) {
    return this.custodies.has(id);
  }

  custodyQuantity(id) {
    return this.custodies.get(id)?.amount ?? 0;
  }

  stockQuantity(storeId, productId) {
    return this.stocks.get(stockKey(storeId, productId))?.quantity ?? 0;
  }

  // تغيير رصيد عهدة + تسجيل الحركة. meta: { type, refType, refId, note }
  custodyDelta(custodyId, amount, meta) {
    const entry = this.custodies.get(custodyId);
    if (!entry) throw new Error(`custody ${custodyId} not loaded`);
    const delta = safeMoney(amount);
    if (delta === 0) return;
    entry.delta = safeMoney(entry.delta + delta);
    this.movements.push({ custodyId, amount: delta, ...meta });
  }

  stockDelta({ storeId, productId, productName, storeName, delta }) {
    const entry = this.stocks.get(stockKey(storeId, productId));
    if (!entry) throw new Error(`stock ${storeId}/${productId} not loaded`);
    entry.delta = safeQty(entry.delta + safeQty(delta));
    if (productName) entry.productName = productName;
    if (storeName) entry.storeName = storeName;
  }

  commit() {
    const now = new Date();
    const { ownerId, uid, name } = this.session;

    // 1) تحقق قبل أي كتابة
    const custodyUpdates = [];
    for (const [id, entry] of this.custodies) {
      if (entry.delta === 0) continue;
      custodyUpdates.push([id, entry, checkCustody(entry.amount, entry.delta, entry.name)]);
    }
    const stockUpdates = [];
    for (const entry of this.stocks.values()) {
      if (entry.delta === 0) continue;
      const next = safeQty(entry.quantity + entry.delta);
      if (next < 0) {
        throw new AppError(shortageMessage({ productName: entry.productName, storeName: entry.storeName, available: entry.quantity, required: safeQty(-entry.delta) }));
      }
      stockUpdates.push([entry, next]);
    }

    // 2) الكتابة
    for (const [, entry, next] of custodyUpdates) {
      this.tx.update(entry.ref, { amount: next, updatedAt: now });
    }
    const running = new Map();
    for (const m of this.movements) {
      const entry = this.custodies.get(m.custodyId);
      const balance = safeMoney((running.has(m.custodyId) ? running.get(m.custodyId) : entry.amount) + m.amount);
      running.set(m.custodyId, balance);
      this.tx.set(doc(collection(db, 'custodyMovements')), {
        ownerId,
        custodyId: m.custodyId,
        custodyName: entry.name,
        amount: m.amount,
        balanceAfter: balance,
        type: m.type,
        refType: m.refType || null,
        refId: m.refId || null,
        note: m.note || '',
        userId: uid,
        userName: name || '',
        createdAt: now,
      });
    }
    for (const [entry, next] of stockUpdates) {
      if (entry.exists) {
        this.tx.update(entry.ref, { totalQuantity: next, productName: entry.productName || 'غير معروف', updatedAt: now });
      } else {
        this.tx.set(entry.ref, {
          storeId: entry.storeId,
          productId: entry.productId,
          productName: entry.productName || 'غير معروف',
          totalQuantity: next,
          ownerId,
          userId: uid,
          createdAt: now,
          updatedAt: now,
        });
      }
    }
  }
}

// قراءة مجموعة مستندات (بالتوازي) والتأكد إنها تبع نفس المالك
export const getOwnedMany = async (tx, collectionName, ids, notFoundMessage, ownerId) => {
  const unique = [...new Set(ids.filter(Boolean))];
  const snaps = await Promise.all(unique.map((id) => tx.get(doc(db, collectionName, id))));
  const map = new Map();
  snaps.forEach((snap, i) => {
    if (!snap.exists() || (ownerId && snap.data().ownerId !== ownerId)) throw new AppError(notFoundMessage);
    map.set(unique[i], { ref: snap.ref, data: snap.data() });
  });
  return map;
};

// قراءة مستند والتأكد إنه تبع نفس المالك
export const getOwned = async (tx, collectionName, id, notFoundMessage, ownerId) => {
  if (!id) throw new AppError(notFoundMessage);
  const snap = await tx.get(doc(db, collectionName, id));
  if (!snap.exists() || (ownerId && snap.data().ownerId !== ownerId)) throw new AppError(notFoundMessage);
  return { ref: snap.ref, data: snap.data() };
};
