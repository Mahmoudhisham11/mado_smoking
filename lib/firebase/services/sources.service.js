import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../config';
import { getUserIds } from './helpers';
import { adjustCustodyAmount } from './custodies.service';

// Real-time subscribe to sources
export const subscribeToSources = (callback) => {
  try {
    const { ownerId } = getUserIds();
    const sourcesRef = collection(db, 'sources');
    const q = query(sourcesRef, where('ownerId', '==', ownerId));
    return onSnapshot(q, (snapshot) => {
      const sources = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      callback(sources);
    }, (error) => {
      console.error('Error subscribing to sources:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error subscribing to sources:', error);
    return () => {};
  }
};

// Add source
export const addSource = async (sourceData) => {
  try {
    const { userId, ownerId } = getUserIds();
    const sourcesRef = collection(db, 'sources');
    const docRef = await addDoc(sourcesRef, {
      name: sourceData.name,
      userId: userId,
      ownerId: ownerId || userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding source:', error);
    return { success: false, error: error.message };
  }
};

// Update source
export const updateSource = async (sourceId, sourceData) => {
  try {
    const sourceRef = doc(db, 'sources', sourceId);
    await updateDoc(sourceRef, {
      name: sourceData.name,
      updatedAt: new Date(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating source:', error);
    return { success: false, error: error.message };
  }
};

// Delete source
export const deleteSource = async (sourceId) => {
  try {
    const sourceRef = doc(db, 'sources', sourceId);
    await deleteDoc(sourceRef);
    return { success: true };
  } catch (error) {
    console.error('Error deleting source:', error);
    return { success: false, error: error.message };
  }
};

// Get single source
export const getSource = async (sourceId) => {
  try {
    const sourceRef = doc(db, 'sources', sourceId);
    const sourceSnap = await getDoc(sourceRef);
    if (sourceSnap.exists()) {
      return { id: sourceSnap.id, ...sourceSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting source:', error);
    return null;
  }
};

// Source Invoices
export const addSourceInvoice = async (invoiceData) => {
  try {
    const { userId, ownerId } = getUserIds();
    const invoicesRef = collection(db, 'sourceInvoices');
    const docRef = await addDoc(invoicesRef, {
      sourceId: invoiceData.sourceId,
      products: invoiceData.products || [],
      totalCost: Number(invoiceData.totalCost) || 0,
      totalItems: Number(invoiceData.totalItems) || 0,
      date: invoiceData.date || new Date(),
      notes: invoiceData.notes || '',
      userId: userId,
      ownerId: ownerId || userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding source invoice:', error);
    return { success: false, error: error.message };
  }
};

export const subscribeAllSourceInvoices = (callback) => {
  try {
    const { ownerId } = getUserIds();
    const ref = collection(db, 'sourceInvoices');
    const q = query(ref, where('ownerId', '==', ownerId));
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => {
        const data = doc.data();
        return { id: doc.id, ...data, date: data.date?.toDate ? data.date.toDate() : (data.date || new Date()) };
      });
      items.sort((a, b) => b.date - a.date);
      callback(items);
    }, (error) => {
      console.error('Error subscribing to all source invoices:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error subscribing to all source invoices:', error);
    return () => {};
  }
};

export const subscribeToSourceInvoices = (sourceId, callback) => {
  try {
    const { ownerId } = getUserIds();
    const invoicesRef = collection(db, 'sourceInvoices');
    const q = query(
      invoicesRef,
      where('sourceId', '==', sourceId),
      where('ownerId', '==', ownerId)
    );
    return onSnapshot(q, (snapshot) => {
      const invoices = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate ? data.date.toDate() : (data.date || new Date()),
        };
      });
      invoices.sort((a, b) => b.date - a.date);
      callback(invoices);
    }, (error) => {
      console.error('Error subscribing to source invoices:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error subscribing to source invoices:', error);
    return () => {};
  }
};

export const getSourcePaymentsByInvoiceId = async (invoiceId) => {
  try {
    const { ownerId } = getUserIds();
    const paymentsRef = collection(db, 'sourcePayments');
    const q = query(
      paymentsRef,
      where('invoiceId', '==', invoiceId),
      where('ownerId', '==', ownerId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting payments by invoice:', error);
    return [];
  }
};

export const deleteSourceInvoice = async (invoiceId) => {
  try {
    const payments = await getSourcePaymentsByInvoiceId(invoiceId);
    for (const p of payments) {
      if (p.custodyId) {
        await adjustCustodyAmount(p.custodyId, Number(p.amount));
      }
      await deleteDoc(doc(db, 'sourcePayments', p.id));
    }
    const invoiceRef = doc(db, 'sourceInvoices', invoiceId);
    await deleteDoc(invoiceRef);
    return { success: true, deletedPayments: payments.length };
  } catch (error) {
    console.error('Error deleting source invoice:', error);
    return { success: false, error: error.message };
  }
};

// Source Payments
export const addSourcePayment = async (paymentData) => {
  try {
    const { userId, ownerId } = getUserIds();
    const paymentsRef = collection(db, 'sourcePayments');
    const docData = {
      sourceId: paymentData.sourceId,
      amount: Number(paymentData.amount) || 0,
      notes: paymentData.notes || '',
      date: paymentData.date || new Date(),
      userId: userId,
      ownerId: ownerId || userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    if (paymentData.invoiceId) {
      docData.invoiceId = paymentData.invoiceId;
    }
    if (paymentData.custodyId) {
      docData.custodyId = paymentData.custodyId;
    }
    const docRef = await addDoc(paymentsRef, docData);

    // Decrease custody amount if custodyId provided
    if (paymentData.custodyId) {
      await adjustCustodyAmount(paymentData.custodyId, -Number(paymentData.amount));
    }

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding source payment:', error);
    return { success: false, error: error.message };
  }
};

export const subscribeToSourcePayments = (sourceId, callback) => {
  try {
    const { ownerId } = getUserIds();
    const paymentsRef = collection(db, 'sourcePayments');
    const q = query(
      paymentsRef,
      where('sourceId', '==', sourceId),
      where('ownerId', '==', ownerId)
    );
    return onSnapshot(q, (snapshot) => {
      const payments = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate ? data.date.toDate() : (data.date || new Date()),
        };
      });
      payments.sort((a, b) => b.date - a.date);
      callback(payments);
    }, (error) => {
      console.error('Error subscribing to source payments:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error subscribing to source payments:', error);
    return () => {};
  }
};

export const deleteSourcePayment = async (paymentId) => {
  try {
    const paymentRef = doc(db, 'sourcePayments', paymentId);
    const snap = await getDoc(paymentRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.custodyId) {
        await adjustCustodyAmount(data.custodyId, Number(data.amount));
      }
    }
    await deleteDoc(paymentRef);
    return { success: true };
  } catch (error) {
    console.error('Error deleting source payment:', error);
    return { success: false, error: error.message };
  }
};

export const updateSourceInvoice = async (invoiceId, invoiceData) => {
  try {
    const invoiceRef = doc(db, 'sourceInvoices', invoiceId);
    await updateDoc(invoiceRef, {
      products: invoiceData.products || [],
      totalCost: Number(invoiceData.totalCost) || 0,
      totalItems: Number(invoiceData.totalItems) || 0,
      notes: invoiceData.notes || '',
      updatedAt: new Date(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating source invoice:', error);
    return { success: false, error: error.message };
  }
};
