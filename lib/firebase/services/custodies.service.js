import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../config';
import { requireSession, getUserIds, run, onSubscribeError, toDate, subscribeWithIndexFallback, refineByDate } from './helpers';
import { TxLedger } from './ledger';
import { AppError, custodyDocId, toMoney } from '../../domain/accounting';

// Real-time subscribe to custodies
export const subscribeToCustodies = (callback, onError) => {
  const { ownerId, userId } = getUserIds();
  if (!ownerId) {
    callback([]);
    return () => {};
  }
  const ref = collection(db, 'custodies');
  // المالك يشوف كل العهد، والمستخدم العادي يشوف عهدته بس
  const q = userId === ownerId
    ? query(ref, where('ownerId', '==', ownerId))
    : query(ref, where('ownerId', '==', ownerId), where('userId', '==', userId));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
  }, onSubscribeError('custodies', onError));
};

// سجل حركات عهدة
export const subscribeToCustodyMovements = (custodyId, pageSize, callback, onError) => {
  const { ownerId } = getUserIds();
  if (!ownerId || !custodyId) {
    callback([]);
    return () => {};
  }
  const base = [where('ownerId', '==', ownerId), where('custodyId', '==', custodyId)];
  return subscribeWithIndexFallback({
    label: 'custody movements',
    primary: query(collection(db, 'custodyMovements'), ...base, orderBy('createdAt', 'desc'), limit(pageSize)),
    fallback: query(collection(db, 'custodyMovements'), ...base),
    refine: refineByDate('createdAt', { max: pageSize }),
    map: (d) => ({ id: d.id, ...d.data(), createdAt: toDate(d.data().createdAt) }),
  }, callback, onError);
};

// تعديل العهدة: الاسم + تسوية الرصيد كحركة بفرقها (مش كتابة فوق الرصيد)
export const updateCustody = (custodyId, custodyData) => run('updating custody', async () => {
  const session = requireSession();
  const target = toMoney(custodyData.amount);
  const name = String(custodyData.name || '').trim();
  if (!name) throw new AppError('يرجى إدخال الاسم');
  if (target < 0) throw new AppError('لا يمكن أن يكون رصيد العهدة بالسالب');
  await runTransaction(db, async (tx) => {
    const ledger = new TxLedger(tx, session);
    await ledger.loadCustodies([custodyId]);
    const diff = toMoney(target - ledger.custodyQuantity(custodyId));
    if (diff !== 0) {
      ledger.custodyDelta(custodyId, diff, { type: 'adjustment', note: custodyData.note || 'تسوية يدوية للرصيد' });
    }
    ledger.commit();
    tx.update(doc(db, 'custodies', custodyId), { name, updatedAt: new Date() });
  });
});

// تحويل رصيد بين عهدتين في عملية واحدة
export const transferCustodyAmount = (fromCustodyId, toCustodyId, amount) => run('transferring custody amount', async () => {
  const session = requireSession();
  const value = toMoney(amount);
  if (value <= 0) throw new AppError('يرجى إدخال مبلغ صحيح');
  if (fromCustodyId === toCustodyId) throw new AppError('لا يمكن التحويل من عهدة لنفسها');
  await runTransaction(db, async (tx) => {
    const ledger = new TxLedger(tx, session);
    await ledger.loadCustodies([fromCustodyId, toCustodyId]);
    const fromName = ledger.custodies.get(fromCustodyId).name;
    const toName = ledger.custodies.get(toCustodyId).name;
    ledger.custodyDelta(fromCustodyId, -value, { type: 'transfer_out', refType: 'custody', refId: toCustodyId, note: `تحويل إلى ${toName}` });
    ledger.custodyDelta(toCustodyId, value, { type: 'transfer_in', refType: 'custody', refId: fromCustodyId, note: `تحويل من ${fromName}` });
    ledger.commit();
  });
});

// إنشاء عهدة لمستخدم لو مش موجودة. الـ ID ثابت فمستحيل تتكرر حتى لو اتنادت مرتين في نفس اللحظة
export const ensureCustody = async (ownerId, userId, name) => {
  const ref = doc(db, 'custodies', custodyDocId(ownerId, userId));
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) return;
    tx.set(ref, { userId, name: name || '', amount: 0, ownerId, createdAt: new Date(), updatedAt: new Date() });
  });
};

// إنشاء العهد الناقصة للمالك والمستخدمين التابعين له
export const createMissingCustodies = (users = []) => run('creating missing custodies', async () => {
  const session = requireSession();
  if (session.role !== 'owner') return { created: 0 };
  const snapshot = await getDocs(query(collection(db, 'custodies'), where('ownerId', '==', session.ownerId)));
  const existing = new Set(snapshot.docs.map((d) => d.data().userId));
  // العهد اللي المالك حذفها بنفسه مابترجعش تتعمل تاني تلقائياً
  const deletedSnap = await getDocs(query(collection(db, 'deletedCustodies'), where('ownerId', '==', session.ownerId)));
  deletedSnap.docs.forEach((d) => existing.add(d.data().userId));
  const targets = [{ uid: session.uid, name: session.name }, ...users];
  let created = 0;
  for (const u of targets) {
    if (!u.uid || existing.has(u.uid)) continue;
    await ensureCustody(session.ownerId, u.uid, u.name);
    existing.add(u.uid);
    created++;
  }
  return { created };
});

// حذف عهدة (للمالك فقط). سجل الحركات بيفضل محفوظ للمراجعة.
export const deleteCustody = (custodyId) => run('deleting custody', async () => {
  const session = requireSession();
  if (session.role !== 'owner') throw new AppError('حذف العهد متاح للمالك فقط');
  const ref = doc(db, 'custodies', custodyId);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return;
    const data = snap.data();
    tx.set(doc(db, 'deletedCustodies', custodyId), {
      ownerId: session.ownerId,
      userId: data.userId || null,
      name: data.name || '',
      amount: data.amount ?? 0,
      deletedAt: new Date(),
    });
    tx.delete(ref);
  });
});
