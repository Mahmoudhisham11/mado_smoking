import { collection, orderBy, query, where } from 'firebase/firestore';
import { db } from '../config';
import { requireSession, run, toDate, getDocsWithIndexFallback, refineByDate } from './helpers';

// بيانات فترة للتقارير. كل استعلام محصور بالمالك والفترة (من السيرفر مش فلترة في المتصفح)
const fetchRange = (ownerId, coll, field, from, to) =>
  getDocsWithIndexFallback({
    label: `report ${coll}`,
    primary: query(collection(db, coll), where('ownerId', '==', ownerId), where(field, '>=', from), where(field, '<=', to), orderBy(field, 'desc')),
    fallback: query(collection(db, coll), where('ownerId', '==', ownerId)),
    refine: refineByDate(field, { from, to }),
    map: (d) => {
      const data = d.data();
      return { id: d.id, ...data, date: toDate(data.date) || toDate(data.createdAt), createdAt: toDate(data.createdAt) };
    },
  });

export const fetchPeriodData = (from, to) => run('fetching report data', async () => {
  const { ownerId, role } = requireSession();
  const isOwner = role === 'owner';
  const [
    salesInvoices,
    customerPayments,
    expenses,
    transfers,
    adjustments,
    movements,
    purchaseInvoices,
    sourcePayments,
  ] = await Promise.all([
    fetchRange(ownerId, 'customerInvoices', 'date', from, to),
    fetchRange(ownerId, 'customerPayments', 'date', from, to),
    fetchRange(ownerId, 'expenses', 'date', from, to),
    fetchRange(ownerId, 'storeTransfers', 'createdAt', from, to),
    fetchRange(ownerId, 'inventoryAdjustments', 'createdAt', from, to),
    fetchRange(ownerId, 'custodyMovements', 'createdAt', from, to),
    // الموردين للمالك فقط
    isOwner ? fetchRange(ownerId, 'sourceInvoices', 'date', from, to) : [],
    isOwner ? fetchRange(ownerId, 'sourcePayments', 'date', from, to) : [],
  ]);
  return { data: { salesInvoices, customerPayments, expenses, transfers, adjustments, movements, purchaseInvoices, sourcePayments } };
});
