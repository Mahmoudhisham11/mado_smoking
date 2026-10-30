import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../config';
import { getUserIds, requireSession, run, onSubscribeError } from './helpers';
import { getOwned } from './ledger';
import { createInvoiceEngine } from './invoiceEngine';
import { AppError, safeMoney, sourcePaymentEffect } from '../../domain/accounting';

const engine = createInvoiceEngine({
  invoiceColl: 'sourceInvoices',
  paymentColl: 'sourcePayments',
  partyColl: 'sources',
  partyField: 'sourceId',
  priceField: 'wholesalePrice',
  direction: 1,
  paymentEffect: sourcePaymentEffect,
  partyNotFound: 'المصدر غير موجود',
  useCreditLimit: false,
  recordUnitCost: false,
  updateLastCost: true,
  movementTypes: { payment: 'source_payment', refund: 'source_refund' },
});

// Real-time subscribe to sources (المؤرشف مش بيظهر)
export const subscribeToSources = (callback, onError) => {
  const { ownerId } = getUserIds();
  if (!ownerId) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, 'sources'), where('ownerId', '==', ownerId));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => !s.archived));
  }, onSubscribeError('sources', onError));
};

export const subscribeToSource = (sourceId, callback, onError) => {
  if (!sourceId) return () => {};
  return onSnapshot(doc(db, 'sources', sourceId), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  }, onSubscribeError('source', onError));
};

export const addSource = (sourceData) => run('adding source', async () => {
  const { uid, ownerId } = requireSession();
  const name = String(sourceData.name || '').trim();
  if (!name) throw new AppError('يرجى إدخال اسم المصدر');
  const docRef = await addDoc(collection(db, 'sources'), {
    name,
    phone: String(sourceData.phone || '').trim(),
    totalInvoiced: 0,
    totalPaid: 0,
    balance: 0,
    userId: uid,
    ownerId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { id: docRef.id };
});

export const updateSource = (sourceId, sourceData) => run('updating source', async () => {
  requireSession();
  const name = String(sourceData.name || '').trim();
  if (!name) throw new AppError('يرجى إدخال اسم المصدر');
  await updateDoc(doc(db, 'sources', sourceId), { name, phone: String(sourceData.phone || '').trim(), updatedAt: new Date() });
});

// المورد اللي ليه رصيد مايتحذفش؛ واللي رصيده صفر بيتأرشف
export const deleteSource = (sourceId) => run('deleting source', async () => {
  const { ownerId } = requireSession();
  await runTransaction(db, async (tx) => {
    const { ref, data } = await getOwned(tx, 'sources', sourceId, 'المصدر غير موجود', ownerId);
    const balance = safeMoney(data.balance);
    if (balance !== 0) {
      throw new AppError(`لا يمكن حذف المصدر لأن رصيده ${balance.toLocaleString()} ج.م. يرجى تسوية الحساب أولاً.`);
    }
    tx.update(ref, { archived: true, archivedAt: new Date(), updatedAt: new Date() });
  });
});

export const getSource = async (sourceId) => {
  try {
    const snap = await getDoc(doc(db, 'sources', sourceId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (error) {
    console.error('Error getting source:', error);
    return null;
  }
};

// Source Invoices
export const subscribeToSourceInvoices = engine.subscribeInvoices;
export const subscribeProductSourceInvoices = engine.subscribeProductInvoices;

// { sourceId, lines: [{ storeId, productId, wholesalePrice, quantity }], paidAmount, custodyId }
export const addSourceInvoice = ({ sourceId, ...rest }) =>
  run('adding source invoice', () => engine.createInvoice({ partyId: sourceId, ...rest }));

export const updateSourceInvoice = (invoiceId, data) =>
  run('updating source invoice', () => engine.updateInvoice(invoiceId, data));

export const deleteSourceInvoice = (invoiceId) =>
  run('deleting source invoice', () => engine.deleteInvoice(invoiceId));

// Source Payments
export const subscribeToSourcePayments = engine.subscribePayments;

// موجب = دفعنا للمورد (يخصم من العهدة)، سالب = المورد رجّع فلوس (يزود العهدة)
export const addSourcePayment = ({ sourceId, ...rest }) =>
  run('adding source payment', () => engine.addPayment({ partyId: sourceId, ...rest }));

export const deleteSourcePayment = (paymentId) =>
  run('deleting source payment', () => engine.deletePayment(paymentId));

// كشف الحساب + مدفوعات فاتورة (للـ PDF)
export const fetchSourceLedger = (partyId) => run('fetching source ledger', () => engine.fetchPartyLedger(partyId));

export const fetchSourceInvoicePayments = (invoiceId) => run('fetching invoice payments', async () => ({ payments: await engine.fetchInvoicePayments(invoiceId) }));
