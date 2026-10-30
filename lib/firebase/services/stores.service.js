import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../config';
import { getUserIds, requireSession, run, onSubscribeError, toDate, subscribeWithIndexFallback, refineByDate } from './helpers';
import { TxLedger, getOwned } from './ledger';
import { AppError, mergeDeltas, safeQty, toQty, transferDeltas } from '../../domain/accounting';

// Real-time subscribe to stores (المؤرشف مش بيظهر)
export const subscribeToStores = (callback, onError) => {
  const { ownerId } = getUserIds();
  if (!ownerId) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, 'stores'), where('ownerId', '==', ownerId));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => !s.archived));
  }, onSubscribeError('stores', onError));
};

export const addStore = (storeData) => run('adding store', async () => {
  const { uid, ownerId } = requireSession();
  const name = String(storeData.name || '').trim();
  if (!name) throw new AppError('يرجى إدخال اسم المخزن');
  const docRef = await addDoc(collection(db, 'stores'), {
    name,
    userId: uid,
    ownerId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { id: docRef.id };
});

export const updateStore = (storeId, storeData) => run('updating store', async () => {
  requireSession();
  const name = String(storeData.name || '').trim();
  if (!name) throw new AppError('يرجى إدخال اسم المخزن');
  await updateDoc(doc(db, 'stores', storeId), { name, updatedAt: new Date() });
});

// المخزن مايتحذفش لو فيه بضاعة؛ ولو فاضي بيتأرشف عشان الفواتير القديمة تفضل سليمة
export const deleteStore = (storeId) => run('deleting store', async () => {
  const { ownerId } = requireSession();
  const stock = await getDocs(query(collection(db, 'storeProducts'), where('ownerId', '==', ownerId), where('storeId', '==', storeId)));
  const withStock = stock.docs.filter((d) => safeQty(d.data().totalQuantity) > 0);
  if (withStock.length > 0) {
    throw new AppError(`لا يمكن حذف المخزن لأنه يحتوي على ${withStock.length} صنف. يرجى تحويل البضاعة أولاً.`);
  }
  await updateDoc(doc(db, 'stores', storeId), { archived: true, archivedAt: new Date(), updatedAt: new Date() });
});

export const getStore = async (storeId) => {
  try {
    const snap = await getDoc(doc(db, 'stores', storeId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (error) {
    console.error('Error getting store:', error);
    return null;
  }
};

// Store Products (inventory tracking)
const subscribeStock = (filters, label, callback, onError) => {
  const { ownerId } = getUserIds();
  if (!ownerId) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, 'storeProducts'), where('ownerId', '==', ownerId), ...filters);
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, onSubscribeError(label, onError));
};

export const subscribeToStoreProducts = (storeId, callback, onError) =>
  subscribeStock([where('storeId', '==', storeId)], 'store products', callback, onError);

export const subscribeToAllStoreProducts = (callback, onError) =>
  subscribeStock([], 'all store products', callback, onError);

export const subscribeToProductStock = (productId, callback, onError) =>
  subscribeStock([where('productId', '==', productId)], 'product stock', callback, onError);

// استيراد كميات من Excel.
// mode = 'add': يضيف على الموجود — mode = 'set': جرد (يستبدل الكمية) ويتسجل كتسوية
export const importStoreQuantities = (storeId, storeName, rows, mode) => run('importing store quantities', async () => {
  const session = requireSession();
  if (!['add', 'set'].includes(mode)) throw new AppError('نوع الاستيراد غير صحيح');
  const CHUNK = 150;
  let imported = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    await runTransaction(db, async (tx) => {
      const ledger = new TxLedger(tx, session);
      await ledger.loadStocks(chunk.map((r) => ({ storeId, storeName, productId: r.productId, productName: r.productName })));
      const lines = [];
      for (const r of chunk) {
        const qty = toQty(r.quantity);
        const before = ledger.stockQuantity(storeId, r.productId);
        const delta = mode === 'set' ? safeQty(qty - before) : qty;
        if (delta !== 0) ledger.stockDelta({ storeId, productId: r.productId, productName: r.productName, delta });
        lines.push({ productId: r.productId, productName: r.productName, before, after: safeQty(before + delta) });
      }
      ledger.commit();
      tx.set(doc(collection(db, 'inventoryAdjustments')), {
        storeId,
        storeName: storeName || '',
        mode,
        source: 'excel',
        lines,
        ownerId: session.ownerId,
        userId: session.uid,
        userName: session.name || '',
        createdAt: new Date(),
      });
    });
    imported += chunk.length;
  }
  return { imported };
});

// Store Transfers
export const subscribeToStoreTransfers = (pageSize, callback, onError) => {
  const { ownerId } = getUserIds();
  if (!ownerId) {
    callback([]);
    return () => {};
  }
  const base = [where('ownerId', '==', ownerId)];
  return subscribeWithIndexFallback({
    label: 'store transfers',
    primary: query(collection(db, 'storeTransfers'), ...base, orderBy('createdAt', 'desc'), limit(pageSize)),
    fallback: query(collection(db, 'storeTransfers'), ...base),
    refine: refineByDate('createdAt', { max: pageSize }),
    map: (d) => {
      const data = d.data();
      return { id: d.id, ...data, createdAt: toDate(data.createdAt), updatedAt: toDate(data.updatedAt) };
    },
  }, callback, onError);
};

const normalizeTransfer = (t) => {
  if (!t.fromStoreId || !t.toStoreId) throw new AppError('يرجى اختيار المخازن');
  if (t.fromStoreId === t.toStoreId) throw new AppError('لا يمكن التحويل لنفس المخزن');
  if (!Array.isArray(t.products) || t.products.length === 0) throw new AppError('يرجى إضافة صنف واحد على الأقل');
  const products = t.products.map((line, i) => {
    if (!line.productId) throw new AppError(`الصنف رقم ${i + 1} لم يتم اختياره`);
    const quantity = toQty(line.quantity);
    if (quantity <= 0) throw new AppError(`الكمية للصنف رقم ${i + 1} غير صحيحة`);
    return { productId: line.productId, productName: line.productName || '', quantity };
  });
  return { ...t, products };
};

// إضافة أو تعديل تحويلة في عملية واحدة: (عكس القديمة + تطبيق الجديدة) مع التحقق من المتاح
const saveTransfer = async (transferId, transferData) => {
  const session = requireSession();
  const next = normalizeTransfer(transferData);
  const ref = transferId ? doc(db, 'storeTransfers', transferId) : doc(collection(db, 'storeTransfers'));
  await runTransaction(db, async (tx) => {
    let old = null;
    if (transferId) old = (await getOwned(tx, 'storeTransfers', transferId, 'التحويلة غير موجودة', session.ownerId)).data;
    const reverted = old ? transferDeltas(old).map((d) => ({ ...d, delta: -d.delta })) : [];
    const deltas = mergeDeltas(reverted, transferDeltas(next));
    const ledger = new TxLedger(tx, session);
    await ledger.loadStocks(deltas);
    deltas.forEach((d) => ledger.stockDelta(d));
    ledger.commit();
    const now = new Date();
    const payload = {
      fromStoreId: next.fromStoreId,
      fromStoreName: next.fromStoreName || '',
      toStoreId: next.toStoreId,
      toStoreName: next.toStoreName || '',
      products: next.products,
      updatedAt: now,
    };
    if (old) {
      tx.update(ref, payload);
    } else {
      tx.set(ref, { ...payload, userId: session.uid, userName: session.name || 'غير معروف', ownerId: session.ownerId, createdAt: now });
    }
  });
  return { id: ref.id };
};

export const addStoreTransfer = (transferData) => run('adding store transfer', () => saveTransfer(null, transferData));

export const updateStoreTransfer = (transferId, transferData) => run('updating store transfer', () => saveTransfer(transferId, transferData));

export const deleteStoreTransfer = (transferId) => run('deleting store transfer', async () => {
  const session = requireSession();
  await runTransaction(db, async (tx) => {
    const { ref, data } = await getOwned(tx, 'storeTransfers', transferId, 'التحويلة غير موجودة', session.ownerId);
    const deltas = mergeDeltas(transferDeltas(data).map((d) => ({ ...d, delta: -d.delta })));
    const ledger = new TxLedger(tx, session);
    await ledger.loadStocks(deltas);
    deltas.forEach((d) => ledger.stockDelta(d));
    ledger.commit();
    tx.delete(ref);
  });
});
