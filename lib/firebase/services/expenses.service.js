import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../config';
import { getUserIds, requireSession, run, toDate, subscribeWithIndexFallback, refineByDate } from './helpers';
import { TxLedger, getOwned } from './ledger';
import { AppError, safeMoney, toMoney } from '../../domain/accounting';

const mapExpense = (d) => {
  const data = d.data();
  return { id: d.id, ...data, date: toDate(data.date) || new Date(0), createdAt: toDate(data.createdAt) };
};

// المصاريف: بفترة تاريخ (كاملة) أو آخر pageSize مصروف
export const subscribeToExpenses = ({ from, to, pageSize = 100 } = {}, callback, onError) => {
  const { ownerId } = getUserIds();
  if (!ownerId) {
    callback([]);
    return () => {};
  }
  const start = from ? new Date(from.getFullYear(), from.getMonth(), from.getDate()) : null;
  const end = to ? new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999) : null;
  const base = [where('ownerId', '==', ownerId)];
  const constraints = [...base];
  if (start) constraints.push(where('date', '>=', start));
  if (end) constraints.push(where('date', '<=', end));
  constraints.push(orderBy('date', 'desc'));
  if (!start && !end) constraints.push(limit(pageSize));
  return subscribeWithIndexFallback({
    label: 'expenses',
    primary: query(collection(db, 'expenses'), ...constraints),
    fallback: query(collection(db, 'expenses'), ...base),
    refine: refineByDate('date', { from: start, to: end, max: start || end ? null : pageSize }),
    map: mapExpense,
  }, callback, onError);
};

export const subscribeTodayExpenses = (callback, onError) => {
  const today = new Date();
  return subscribeToExpenses({ from: today, to: today }, callback, onError);
};

const parseAmount = (amount) => {
  const value = toMoney(amount);
  if (value <= 0) throw new AppError('يرجى إدخال مبلغ صحيح');
  return value;
};

// كل مصروف لازم يتخصم من عهدة
export const addExpense = (expenseData) => run('adding expense', async () => {
  const session = requireSession();
  const amount = parseAmount(expenseData.amount);
  if (!expenseData.custodyId) throw new AppError('يرجى اختيار العهدة');
  const ref = doc(collection(db, 'expenses'));
  await runTransaction(db, async (tx) => {
    const ledger = new TxLedger(tx, session);
    await ledger.loadCustodies([expenseData.custodyId]);
    ledger.custodyDelta(expenseData.custodyId, -amount, { type: 'expense', refType: 'expenses', refId: ref.id, note: expenseData.notes || 'مصروف' });
    ledger.commit();
    const now = new Date();
    tx.set(ref, {
      amount,
      notes: expenseData.notes || '',
      date: now,
      custodyId: expenseData.custodyId,
      custodyName: ledger.custodies.get(expenseData.custodyId).name,
      userName: session.name || 'غير معروف',
      userId: session.uid,
      ownerId: session.ownerId,
      createdAt: now,
      updatedAt: now,
    });
  });
  return { id: ref.id };
});

// تعديل المصروف: إرجاع القديم للعهدة القديمة وخصم الجديد من العهدة الجديدة في نفس العملية
export const updateExpense = (expenseId, expenseData) => run('updating expense', async () => {
  const session = requireSession();
  const amount = parseAmount(expenseData.amount);
  await runTransaction(db, async (tx) => {
    const { ref, data } = await getOwned(tx, 'expenses', expenseId, 'المصروف غير موجود', session.ownerId);
    const oldCustodyId = data.custodyId || null;
    const newCustodyId = expenseData.custodyId || oldCustodyId;
    if (!newCustodyId) throw new AppError('يرجى اختيار العهدة');
    const oldAmount = safeMoney(data.amount);
    const ledger = new TxLedger(tx, session);
    await ledger.loadCustodies([newCustodyId]);
    if (oldCustodyId && oldCustodyId !== newCustodyId) await ledger.loadCustodies([oldCustodyId], { allowMissing: true });
    const note = expenseData.notes || data.notes || 'مصروف';
    if (oldCustodyId === newCustodyId) {
      const diff = safeMoney(oldAmount - amount);
      if (diff !== 0) ledger.custodyDelta(newCustodyId, diff, { type: 'expense', refType: 'expenses', refId: expenseId, note: `تعديل مصروف: ${note}` });
    } else {
      if (ledger.hasCustody(oldCustodyId)) ledger.custodyDelta(oldCustodyId, oldAmount, { type: 'reversal', refType: 'expenses', refId: expenseId, note: `نقل مصروف لعهدة أخرى: ${note}` });
      ledger.custodyDelta(newCustodyId, -amount, { type: 'expense', refType: 'expenses', refId: expenseId, note });
    }
    ledger.commit();
    tx.update(ref, {
      amount,
      notes: expenseData.notes || '',
      custodyId: newCustodyId,
      custodyName: ledger.custodies.get(newCustodyId).name,
      updatedAt: new Date(),
    });
  });
});

export const deleteExpense = (expenseId) => run('deleting expense', async () => {
  const session = requireSession();
  await runTransaction(db, async (tx) => {
    const { ref, data } = await getOwned(tx, 'expenses', expenseId, 'المصروف غير موجود', session.ownerId);
    const ledger = new TxLedger(tx, session);
    await ledger.loadCustodies(data.custodyId ? [data.custodyId] : [], { allowMissing: true });
    if (ledger.hasCustody(data.custodyId)) {
      ledger.custodyDelta(data.custodyId, safeMoney(data.amount), { type: 'reversal', refType: 'expenses', refId: expenseId, note: `حذف مصروف: ${data.notes || ''}` });
    }
    ledger.commit();
    tx.delete(ref);
  });
});
