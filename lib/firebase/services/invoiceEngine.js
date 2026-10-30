import {
  collection,
  doc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
} from 'firebase/firestore';
import { db } from '../config';
import { getUserIds, requireSession, toDate, subscribeWithIndexFallback, refineByDate } from './helpers';
import { TxLedger, getOwned, getOwnedMany } from './ledger';
import {
  AppError,
  checkCreditLimit,
  inventoryDeltas,
  invoiceTotals,
  normalizeLines,
  safeMoney,
  toMoney,
} from '../../domain/accounting';

// محرك موحد لفواتير البيع (العملاء) والشراء (الموردين).
// كل عملية = transaction واحد: الفاتورة + المخزون + السداد + العهدة + رصيد الطرف.
// رصيد الطرف (balance) = إجمالي الفواتير − إجمالي المدفوعات (بإشارتها)، في الحالتين.

const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

const mapDated = (d) => {
  const data = d.data();
  return { id: d.id, ...data, date: toDate(data.date) || toDate(data.createdAt) || new Date(0) };
};

const partyTotals = (data) => ({
  totalInvoiced: safeMoney(data.totalInvoiced),
  totalPaid: safeMoney(data.totalPaid),
  balance: safeMoney(data.balance),
});

const applyPartyDelta = (tx, ref, before, { invoiced = 0, paid = 0 }) => {
  const totalInvoiced = safeMoney(before.totalInvoiced + invoiced);
  const totalPaid = safeMoney(before.totalPaid + paid);
  const balance = safeMoney(totalInvoiced - totalPaid);
  tx.update(ref, { totalInvoiced, totalPaid, balance, updatedAt: new Date() });
  return balance;
};

export const createInvoiceEngine = (cfg) => {
  const {
    invoiceColl,
    paymentColl,
    partyColl,
    partyField,
    priceField,
    direction,
    paymentEffect,
    partyNotFound,
    useCreditLimit,
    recordUnitCost,
    updateLastCost,
    movementTypes,
  } = cfg;

  // تجهيز السطور بأسماء الأصناف والمخازن من قاعدة البيانات (مش من الواجهة)
  const buildLines = async (tx, session, rawLines, oldLines = []) => {
    const normalized = normalizeLines(rawLines, priceField);
    const [products, stores] = await Promise.all([
      getOwnedMany(tx, 'smokingProducts', normalized.map((l) => l.productId), 'أحد الأصناف غير موجود', session.ownerId),
      getOwnedMany(tx, 'stores', normalized.map((l) => l.storeId), 'أحد المخازن غير موجود', session.ownerId),
    ]);
    const oldCost = new Map(oldLines.filter((l) => l.unitCost !== undefined).map((l) => [l.productId, l.unitCost]));
    const lines = normalized.map((l) => {
      const product = products.get(l.productId).data;
      const line = {
        storeId: l.storeId,
        storeName: stores.get(l.storeId).data.name || 'غير معروف',
        productId: l.productId,
        productName: product.name || 'غير معروف',
        [priceField]: l[priceField],
        quantity: l.quantity,
        lineTotal: l.lineTotal,
      };
      if (recordUnitCost) {
        // تكلفة الصنف وقت البيع: بتتحفظ مع الفاتورة فالربح مايتغيرش بأثر رجعي
        line.unitCost = oldCost.has(l.productId) ? safeMoney(oldCost.get(l.productId)) : safeMoney(product.lastCost);
      }
      return line;
    });
    return { lines, products };
  };

  const writeLastCost = (tx, products, lines, invoiceDate) => {
    if (!updateLastCost) return;
    const latest = new Map();
    for (const l of lines) latest.set(l.productId, l[priceField]);
    for (const [productId, price] of latest) {
      const p = products.get(productId);
      const lastAt = toDate(p.data.lastCostAt);
      if (!lastAt || invoiceDate >= lastAt) {
        tx.update(p.ref, { lastCost: price, lastCostAt: invoiceDate, updatedAt: new Date() });
      }
    }
  };

  const createInvoice = async ({ partyId, lines: rawLines, paidAmount, custodyId, notes }) => {
    const session = requireSession();
    const paid = toMoney(paidAmount === '' || paidAmount === undefined || paidAmount === null ? 0 : paidAmount);
    if (paid < 0) throw new AppError('المبلغ المدفوع لا يمكن أن يكون بالسالب. استخدم شاشة السداد.');
    if (paid > 0 && !custodyId) throw new AppError('يرجى اختيار العهدة للسداد');
    const invoiceRef = doc(collection(db, invoiceColl));
    const paymentRef = doc(collection(db, paymentColl));

    // رقم مسلسل للفاتورة لكل مالك ونوع (بيتحجز جوه نفس الـ transaction فمفيش رقمين متكررين)
    const counterRef = doc(db, 'counters', `${session.ownerId}_${invoiceColl}`);

    let number = 0;
    await runTransaction(db, async (tx) => {
      const counterSnap = await tx.get(counterRef);
      number = (counterSnap.exists() ? Number(counterSnap.data().seq) || 0 : 0) + 1;
      const party = await getOwned(tx, partyColl, partyId, partyNotFound, session.ownerId);
      const { lines, products } = await buildLines(tx, session, rawLines);
      const deltas = inventoryDeltas([], lines, direction);
      const ledger = new TxLedger(tx, session);
      await Promise.all([ledger.loadStocks(deltas), ledger.loadCustodies(paid > 0 ? [custodyId] : [])]);

      const { totalCost, totalItems } = invoiceTotals(lines);
      const before = partyTotals(party.data);
      const balanceAfter = safeMoney(before.balance + totalCost - paid);
      if (useCreditLimit) checkCreditLimit(before.balance, balanceAfter, party.data.creditLimit);

      deltas.forEach((d) => ledger.stockDelta(d));
      if (paid > 0) {
        ledger.custodyDelta(custodyId, paymentEffect(paid).custodyDelta, {
          type: movementTypes.payment,
          refType: paymentColl,
          refId: paymentRef.id,
          note: `سداد مع فاتورة - ${party.data.name || ''}`,
        });
      }
      ledger.commit();

      const now = new Date();
      tx.set(counterRef, { ownerId: session.ownerId, seq: number, updatedAt: now });
      tx.set(invoiceRef, {
        [partyField]: partyId,
        number,
        products: lines,
        productIds: [...new Set(lines.map((l) => l.productId))],
        totalCost,
        totalItems,
        date: now,
        notes: notes || '',
        userId: session.uid,
        userName: session.name || '',
        ownerId: session.ownerId,
        createdAt: now,
        updatedAt: now,
      });
      if (paid > 0) {
        tx.set(paymentRef, {
          [partyField]: partyId,
          invoiceId: invoiceRef.id,
          amount: paid,
          type: 'payment',
          notes: '',
          date: now,
          custodyId,
          custodyName: ledger.custodies.get(custodyId).name,
          userId: session.uid,
          userName: session.name || '',
          ownerId: session.ownerId,
          createdAt: now,
          updatedAt: now,
        });
      }
      applyPartyDelta(tx, party.ref, before, { invoiced: totalCost, paid });
      writeLastCost(tx, products, lines, now);
    });
    return { id: invoiceRef.id, number };
  };

  const updateInvoice = async (invoiceId, { lines: rawLines, notes }) => {
    const session = requireSession();
    await runTransaction(db, async (tx) => {
      const invoice = await getOwned(tx, invoiceColl, invoiceId, 'الفاتورة غير موجودة', session.ownerId);
      const party = await getOwned(tx, partyColl, invoice.data[partyField], partyNotFound, session.ownerId);
      const oldLines = invoice.data.products || [];
      const { lines, products } = await buildLines(tx, session, rawLines, oldLines);
      const deltas = inventoryDeltas(oldLines, lines, direction);
      const ledger = new TxLedger(tx, session);
      await ledger.loadStocks(deltas);

      const { totalCost, totalItems } = invoiceTotals(lines);
      const diff = safeMoney(totalCost - safeMoney(invoice.data.totalCost));
      const before = partyTotals(party.data);
      if (useCreditLimit) checkCreditLimit(before.balance, safeMoney(before.balance + diff), party.data.creditLimit);

      deltas.forEach((d) => ledger.stockDelta(d));
      ledger.commit();

      tx.update(invoice.ref, {
        products: lines,
        productIds: [...new Set(lines.map((l) => l.productId))],
        totalCost,
        totalItems,
        notes: notes !== undefined ? notes : invoice.data.notes || '',
        updatedAt: new Date(),
      });
      applyPartyDelta(tx, party.ref, before, { invoiced: diff });
      writeLastCost(tx, products, lines, toDate(invoice.data.date) || new Date());
    });
  };

  // حذف الفاتورة + المدفوعات المرتبطة بيها، وعكس أثرهم على المخزون والعهدة والرصيد
  const deleteInvoice = async (invoiceId) => {
    const session = requireSession();
    const linked = await getDocs(query(
      collection(db, paymentColl),
      where('ownerId', '==', session.ownerId),
      where('invoiceId', '==', invoiceId)
    ));
    const paymentIds = linked.docs.map((d) => d.id);

    await runTransaction(db, async (tx) => {
      const invoice = await getOwned(tx, invoiceColl, invoiceId, 'الفاتورة غير موجودة', session.ownerId);
      const party = await getOwned(tx, partyColl, invoice.data[partyField], partyNotFound, session.ownerId);
      const paymentSnaps = await Promise.all(paymentIds.map((id) => tx.get(doc(db, paymentColl, id))));
      const payments = paymentSnaps.filter((s) => s.exists()).map((s) => ({ ref: s.ref, data: s.data() }));
      const lines = invoice.data.products || [];
      const deltas = inventoryDeltas(lines, [], direction);
      const ledger = new TxLedger(tx, session);
      await Promise.all([
        ledger.loadStocks(deltas),
        ledger.loadCustodies(payments.map((p) => p.data.custodyId), { allowMissing: true }),
      ]);

      deltas.forEach((d) => ledger.stockDelta(d));
      let paidSum = 0;
      for (const p of payments) {
        const amount = safeMoney(p.data.amount);
        paidSum += amount;
        if (ledger.hasCustody(p.data.custodyId)) {
          ledger.custodyDelta(p.data.custodyId, -paymentEffect(amount).custodyDelta, {
            type: 'reversal',
            refType: paymentColl,
            refId: p.ref.id,
            note: `إلغاء سداد بسبب حذف فاتورة - ${party.data.name || ''}`,
          });
        }
        tx.delete(p.ref);
      }
      ledger.commit();
      tx.delete(invoice.ref);
      applyPartyDelta(tx, party.ref, partyTotals(party.data), {
        invoiced: -safeMoney(invoice.data.totalCost),
        paid: -safeMoney(paidSum),
      });
    });
    return { deletedPayments: paymentIds.length };
  };

  // سداد بإشارته: موجب أو سالب، وكل الأثر بيتحسب من paymentEffect
  const addPayment = async ({ partyId, amount, custodyId, notes }) => {
    const session = requireSession();
    const effect = paymentEffect(amount);
    const value = toMoney(amount);
    if (value === 0) throw new AppError('يرجى إدخال مبلغ صحيح');
    if (!custodyId) throw new AppError('يرجى اختيار العهدة');
    const paymentRef = doc(collection(db, paymentColl));

    await runTransaction(db, async (tx) => {
      const party = await getOwned(tx, partyColl, partyId, partyNotFound, session.ownerId);
      const ledger = new TxLedger(tx, session);
      await ledger.loadCustodies([custodyId]);
      const before = partyTotals(party.data);
      const balanceAfter = safeMoney(before.balance + effect.balanceDelta);
      if (useCreditLimit) checkCreditLimit(before.balance, balanceAfter, party.data.creditLimit);

      ledger.custodyDelta(custodyId, effect.custodyDelta, {
        type: effect.type === 'refund' ? movementTypes.refund : movementTypes.payment,
        refType: paymentColl,
        refId: paymentRef.id,
        note: party.data.name || '',
      });
      ledger.commit();

      const now = new Date();
      tx.set(paymentRef, {
        [partyField]: partyId,
        amount: value,
        type: effect.type,
        notes: notes || '',
        date: now,
        custodyId,
        custodyName: ledger.custodies.get(custodyId).name,
        userId: session.uid,
        userName: session.name || '',
        ownerId: session.ownerId,
        createdAt: now,
        updatedAt: now,
      });
      applyPartyDelta(tx, party.ref, before, { paid: effect.totalPaidDelta });
    });
    return { id: paymentRef.id };
  };

  // حذف سداد = عكس أثره بالظبط بنفس الدالة (مفيش حساب إشارة منفصل ممكن يغلط)
  const deletePayment = async (paymentId) => {
    const session = requireSession();
    await runTransaction(db, async (tx) => {
      const payment = await getOwned(tx, paymentColl, paymentId, 'السداد غير موجود', session.ownerId);
      const party = await getOwned(tx, partyColl, payment.data[partyField], partyNotFound, session.ownerId);
      const amount = safeMoney(payment.data.amount);
      const ledger = new TxLedger(tx, session);
      await ledger.loadCustodies(payment.data.custodyId ? [payment.data.custodyId] : [], { allowMissing: true });
      if (ledger.hasCustody(payment.data.custodyId) && amount !== 0) {
        ledger.custodyDelta(payment.data.custodyId, -paymentEffect(amount).custodyDelta, {
          type: 'reversal',
          refType: paymentColl,
          refId: paymentId,
          note: `إلغاء سداد - ${party.data.name || ''}`,
        });
      }
      ledger.commit();
      tx.delete(payment.ref);
      applyPartyDelta(tx, party.ref, partyTotals(party.data), { paid: -amount });
    });
  };

  // اشتراك في فواتير/مدفوعات طرف: بفترة تاريخ (كاملة) أو آخر pageSize عنصر
  const subscribeList = (coll, label) => (partyId, { from, to, pageSize = 50 } = {}, callback, onError) => {
    const { ownerId } = getUserIds();
    if (!ownerId || !partyId) {
      callback([]);
      return () => {};
    }
    const base = [where('ownerId', '==', ownerId), where(partyField, '==', partyId)];
    const constraints = [...base];
    if (from) constraints.push(where('date', '>=', startOfDay(from)));
    if (to) constraints.push(where('date', '<=', endOfDay(to)));
    constraints.push(orderBy('date', 'desc'));
    if (!from && !to) constraints.push(limit(pageSize));
    return subscribeWithIndexFallback({
      label,
      primary: query(collection(db, coll), ...constraints),
      fallback: query(collection(db, coll), ...base),
      refine: refineByDate('date', { from: from ? startOfDay(from) : null, to: to ? endOfDay(to) : null, max: from || to ? null : pageSize }),
      map: mapDated,
    }, callback, onError);
  };

  const subscribeProductInvoices = (productId, pageSize, callback, onError) => {
    const { ownerId } = getUserIds();
    if (!ownerId || !productId) {
      callback([]);
      return () => {};
    }
    const base = [where('ownerId', '==', ownerId), where('productIds', 'array-contains', productId)];
    return subscribeWithIndexFallback({
      label: `${invoiceColl} by product`,
      primary: query(collection(db, invoiceColl), ...base, orderBy('date', 'desc'), limit(pageSize)),
      fallback: query(collection(db, invoiceColl), ...base),
      refine: refineByDate('date', { max: pageSize }),
      map: mapDated,
    }, callback, onError);
  };

  // كل فواتير ومدفوعات الطرف (لكشف الحساب). استعلام بالتساوي فقط فمش محتاج فهرس مركب
  const fetchPartyLedger = async (partyId) => {
    const { ownerId } = requireSession();
    const [inv, pay] = await Promise.all([
      getDocs(query(collection(db, invoiceColl), where('ownerId', '==', ownerId), where(partyField, '==', partyId))),
      getDocs(query(collection(db, paymentColl), where('ownerId', '==', ownerId), where(partyField, '==', partyId))),
    ]);
    return { invoices: inv.docs.map(mapDated), payments: pay.docs.map(mapDated) };
  };

  const fetchInvoicePayments = async (invoiceId) => {
    const { ownerId } = requireSession();
    const snap = await getDocs(query(collection(db, paymentColl), where('ownerId', '==', ownerId), where('invoiceId', '==', invoiceId)));
    return snap.docs.map(mapDated).sort((a, b) => a.date - b.date);
  };

  return {
    fetchPartyLedger,
    fetchInvoicePayments,
    createInvoice,
    updateInvoice,
    deleteInvoice,
    addPayment,
    deletePayment,
    subscribeInvoices: subscribeList(invoiceColl, invoiceColl),
    subscribePayments: subscribeList(paymentColl, paymentColl),
    subscribeProductInvoices,
  };
};
