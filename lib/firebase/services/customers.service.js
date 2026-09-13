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

// Real-time subscribe to customers
export const subscribeToCustomers = (callback) => {
  try {
    const { ownerId } = getUserIds();
    const ref = collection(db, 'customers');
    const q = query(ref, where('ownerId', '==', ownerId));
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      callback(items);
    }, (error) => {
      console.error('Error subscribing to customers:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error subscribing to customers:', error);
    return () => {};
  }
};

// Add customer
export const addCustomer = async (customerData) => {
  try {
    const { userId, ownerId } = getUserIds();
    const ref = collection(db, 'customers');
    const docRef = await addDoc(ref, {
      name: customerData.name,
      phone: customerData.phone || '',
      creditLimit: Math.max(0, Number(customerData.creditLimit) || 0),
      userId: userId,
      ownerId: ownerId || userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding customer:', error);
    return { success: false, error: error.message };
  }
};

// Update customer
export const updateCustomer = async (customerId, customerData) => {
  try {
    const ref = doc(db, 'customers', customerId);
    await updateDoc(ref, {
      name: customerData.name,
      phone: customerData.phone || '',
      creditLimit: Math.max(0, Number(customerData.creditLimit) || 0),
      updatedAt: new Date(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating customer:', error);
    return { success: false, error: error.message };
  }
};

// Delete customer
export const deleteCustomer = async (customerId) => {
  try {
    await deleteDoc(doc(db, 'customers', customerId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting customer:', error);
    return { success: false, error: error.message };
  }
};

// Get single customer
export const getCustomer = async (customerId) => {
  try {
    const snap = await getDoc(doc(db, 'customers', customerId));
    if (snap.exists()) return { id: snap.id, ...snap.data() };
    return null;
  } catch (error) {
    console.error('Error getting customer:', error);
    return null;
  }
};

// Customer Invoices
export const subscribeAllCustomerInvoices = (callback) => {
  try {
    const { ownerId } = getUserIds();
    const ref = collection(db, 'customerInvoices');
    const q = query(ref, where('ownerId', '==', ownerId));
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => {
        const data = doc.data();
        return { id: doc.id, ...data, date: data.date?.toDate ? data.date.toDate() : (data.date || new Date()) };
      });
      items.sort((a, b) => b.date - a.date);
      callback(items);
    }, (error) => {
      console.error('Error subscribing to all customer invoices:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error subscribing to all customer invoices:', error);
    return () => {};
  }
};

export const subscribeToCustomerInvoices = (customerId, callback) => {
  try {
    const { ownerId } = getUserIds();
    const ref = collection(db, 'customerInvoices');
    const q = query(ref, where('customerId', '==', customerId), where('ownerId', '==', ownerId));
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => {
        const data = doc.data();
        return { id: doc.id, ...data, date: data.date?.toDate ? data.date.toDate() : (data.date || new Date()) };
      });
      items.sort((a, b) => b.date - a.date);
      callback(items);
    }, (error) => {
      console.error('Error subscribing to customer invoices:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error subscribing to customer invoices:', error);
    return () => {};
  }
};

export const addCustomerInvoice = async (invoiceData) => {
  try {
    const { userId, ownerId } = getUserIds();
    const ref = collection(db, 'customerInvoices');
    const docRef = await addDoc(ref, {
      customerId: invoiceData.customerId,
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
    console.error('Error adding customer invoice:', error);
    return { success: false, error: error.message };
  }
};

export const updateCustomerInvoice = async (invoiceId, invoiceData) => {
  try {
    const ref = doc(db, 'customerInvoices', invoiceId);
    await updateDoc(ref, {
      products: invoiceData.products || [],
      totalCost: Number(invoiceData.totalCost) || 0,
      totalItems: Number(invoiceData.totalItems) || 0,
      notes: invoiceData.notes || '',
      updatedAt: new Date(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating customer invoice:', error);
    return { success: false, error: error.message };
  }
};

export const getCustomerPaymentsByInvoiceId = async (invoiceId) => {
  try {
    const { ownerId } = getUserIds();
    const ref = collection(db, 'customerPayments');
    const q = query(ref, where('invoiceId', '==', invoiceId), where('ownerId', '==', ownerId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting customer payments by invoice:', error);
    return [];
  }
};

export const deleteCustomerInvoice = async (invoiceId) => {
  try {
    const payments = await getCustomerPaymentsByInvoiceId(invoiceId);
    for (const p of payments) {
      if (p.custodyId) {
        await adjustCustodyAmount(p.custodyId, -Number(p.amount));
      }
      await deleteDoc(doc(db, 'customerPayments', p.id));
    }
    await deleteDoc(doc(db, 'customerInvoices', invoiceId));
    return { success: true, deletedPayments: payments.length };
  } catch (error) {
    console.error('Error deleting customer invoice:', error);
    return { success: false, error: error.message };
  }
};

// Customer Payments
export const subscribeToCustomerPayments = (customerId, callback) => {
  try {
    const { ownerId } = getUserIds();
    const ref = collection(db, 'customerPayments');
    const q = query(ref, where('customerId', '==', customerId), where('ownerId', '==', ownerId));
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => {
        const data = doc.data();
        return { id: doc.id, ...data, date: data.date?.toDate ? data.date.toDate() : (data.date || new Date()) };
      });
      items.sort((a, b) => b.date - a.date);
      callback(items);
    }, (error) => {
      console.error('Error subscribing to customer payments:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error subscribing to customer payments:', error);
    return () => {};
  }
};

export const addCustomerPayment = async (paymentData) => {
  try {
    const { userId, ownerId } = getUserIds();
    const ref = collection(db, 'customerPayments');
    const docData = {
      customerId: paymentData.customerId,
      amount: Number(paymentData.amount) || 0,
      notes: paymentData.notes || '',
      date: paymentData.date || new Date(),
      userId: userId,
      ownerId: ownerId || userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    if (paymentData.invoiceId) docData.invoiceId = paymentData.invoiceId;
    if (paymentData.custodyId) docData.custodyId = paymentData.custodyId;
    const docRef = await addDoc(ref, docData);

    // Increase custody amount if custodyId provided
    if (paymentData.custodyId) {
      await adjustCustodyAmount(paymentData.custodyId, Number(paymentData.amount));
    }

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding customer payment:', error);
    return { success: false, error: error.message };
  }
};

export const deleteCustomerPayment = async (paymentId) => {
  try {
    const paymentRef = doc(db, 'customerPayments', paymentId);
    const snap = await getDoc(paymentRef);
    if (snap.exists()) {
      const data = snap.data();
      if (data.custodyId) {
        await adjustCustodyAmount(data.custodyId, -Number(data.amount));
      }
    }
    await deleteDoc(paymentRef);
    return { success: true };
  } catch (error) {
    console.error('Error deleting customer payment:', error);
    return { success: false, error: error.message };
  }
};
