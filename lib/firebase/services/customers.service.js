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
import { AppError, customerPaymentEffect, safeMoney, toMoney } from '../../domain/accounting';

const engine = createInvoiceEngine({
  invoiceColl: 'customerInvoices',
  paymentColl: 'customerPayments',
  partyColl: 'customers',
  partyField: 'customerId',
  priceField: 'sellingPrice',
  direction: -1,
  paymentEffect: customerPaymentEffect,
  partyNotFound: 'العميل غير موجود',
  useCreditLimit: true,
  recordUnitCost: true,
  updateLastCost: false,
  movementTypes: { payment: 'customer_payment', refund: 'customer_refund' },
});

// Real-time subscribe to customers (المؤرشف مش بيظهر)
export const subscribeToCustomers = (callback, onError) => {
  const { ownerId } = getUserIds();
  if (!ownerId) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, 'customers'), where('ownerId', '==', ownerId));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).filter((c) => !c.archived));
  }, onSubscribeError('customers', onError));
};

// العميل نفسه لحظياً (فيه الرصيد المجمع: totalInvoiced / totalPaid / balance)
export const subscribeToCustomer = (customerId, callback, onError) => {
  if (!customerId) return () => {};
  return onSnapshot(doc(db, 'customers', customerId), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null);
  }, onSubscribeError('customer', onError));
};

const parseCustomer = (customerData) => {
  const name = String(customerData.name || '').trim();
  if (!name) throw new AppError('يرجى إدخال اسم العميل');
  const creditLimit = toMoney(customerData.creditLimit === '' || customerData.creditLimit === undefined ? 0 : customerData.creditLimit);
  if (creditLimit < 0) throw new AppError('حد الائتمان لا يمكن أن يكون بالسالب');
  return { name, phone: String(customerData.phone || '').trim(), creditLimit };
};

export const addCustomer = (customerData) => run('adding customer', async () => {
  const { uid, ownerId } = requireSession();
  const docRef = await addDoc(collection(db, 'customers'), {
    ...parseCustomer(customerData),
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

export const updateCustomer = (customerId, customerData) => run('updating customer', async () => {
  requireSession();
  await updateDoc(doc(db, 'customers', customerId), { ...parseCustomer(customerData), updatedAt: new Date() });
});

// العميل اللي عليه رصيد مايتحذفش؛ واللي رصيده صفر بيتأرشف عشان فواتيره تفضل موجودة
export const deleteCustomer = (customerId) => run('deleting customer', async () => {
  const { ownerId } = requireSession();
  await runTransaction(db, async (tx) => {
    const { ref, data } = await getOwned(tx, 'customers', customerId, 'العميل غير موجود', ownerId);
    const balance = safeMoney(data.balance);
    if (balance !== 0) {
      throw new AppError(`لا يمكن حذف العميل لأن رصيده ${balance.toLocaleString()} ج.م. يرجى تسوية الحساب أولاً.`);
    }
    tx.update(ref, { archived: true, archivedAt: new Date(), updatedAt: new Date() });
  });
});

export const getCustomer = async (customerId) => {
  try {
    const snap = await getDoc(doc(db, 'customers', customerId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (error) {
    console.error('Error getting customer:', error);
    return null;
  }
};

// Customer Invoices
export const subscribeToCustomerInvoices = engine.subscribeInvoices;
export const subscribeProductCustomerInvoices = engine.subscribeProductInvoices;

// { customerId, lines: [{ storeId, productId, sellingPrice, quantity }], paidAmount, custodyId }
export const addCustomerInvoice = ({ customerId, ...rest }) =>
  run('adding customer invoice', () => engine.createInvoice({ partyId: customerId, ...rest }));

export const updateCustomerInvoice = (invoiceId, data) =>
  run('updating customer invoice', () => engine.updateInvoice(invoiceId, data));

export const deleteCustomerInvoice = (invoiceId) =>
  run('deleting customer invoice', () => engine.deleteInvoice(invoiceId));

// Customer Payments
export const subscribeToCustomerPayments = engine.subscribePayments;

// المبلغ بإشارته: موجب = تحصيل من العميل (يزود العهدة)، سالب = صرف للعميل (يخصم من العهدة ويزود المديونية)
export const addCustomerPayment = ({ customerId, ...rest }) =>
  run('adding customer payment', () => engine.addPayment({ partyId: customerId, ...rest }));

export const deleteCustomerPayment = (paymentId) =>
  run('deleting customer payment', () => engine.deletePayment(paymentId));

// كشف الحساب + مدفوعات فاتورة (للـ PDF)
export const fetchCustomerLedger = (partyId) => run('fetching customer ledger', () => engine.fetchPartyLedger(partyId));

export const fetchCustomerInvoicePayments = (invoiceId) => run('fetching invoice payments', async () => ({ payments: await engine.fetchInvoicePayments(invoiceId) }));
