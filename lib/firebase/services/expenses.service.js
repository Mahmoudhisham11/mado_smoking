import {
  collection,
  doc,
  getDoc,
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
import { getUserFromLocalStorage } from '../../auth';

// Real-time subscribe to expenses
export const subscribeToExpenses = (callback) => {
  try {
    const { ownerId } = getUserIds();
    const ref = collection(db, 'expenses');
    const q = query(ref, where('ownerId', '==', ownerId));
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate ? data.date.toDate() : (data.date || new Date()),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
        };
      });
      items.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
      callback(items);
    }, (error) => {
      console.error('Error subscribing to expenses:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error subscribing to expenses:', error);
    return () => {};
  }
};

// Add expense
export const addExpense = async (expenseData) => {
  try {
    const { userId, ownerId } = getUserIds();
    const userData = getUserFromLocalStorage();
    const ref = collection(db, 'expenses');
    const docData = {
      amount: Number(expenseData.amount) || 0,
      notes: expenseData.notes || '',
      date: expenseData.date || new Date(),
      userName: userData?.name || 'غير معروف',
      userId: userId,
      ownerId: ownerId || userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    if (expenseData.custodyId) {
      docData.custodyId = expenseData.custodyId;
      docData.custodyName = expenseData.custodyName || '';
    }
    const docRef = await addDoc(ref, docData);

    // Decrease custody amount if custodyId provided
    if (expenseData.custodyId) {
      await adjustCustodyAmount(expenseData.custodyId, -Number(expenseData.amount));
    }

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding expense:', error);
    return { success: false, error: error.message };
  }
};

// Update expense
export const updateExpense = async (expenseId, expenseData) => {
  try {
    const ref = doc(db, 'expenses', expenseId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { success: false, error: 'Expense not found' };

    const oldData = snap.data();
    const updateData = {
      amount: Number(expenseData.amount) || 0,
      notes: expenseData.notes || '',
      updatedAt: new Date(),
    };

    // Handle custody changes
    const oldCustodyId = oldData.custodyId;
    const newCustodyId = expenseData.custodyId;
    const oldAmount = Number(oldData.amount) || 0;
    const newAmount = Number(expenseData.amount) || 0;

    if (oldCustodyId || newCustodyId) {
      // Revert old custody
      if (oldCustodyId) {
        await adjustCustodyAmount(oldCustodyId, oldAmount);
      }
      // Apply new custody
      if (newCustodyId) {
        await adjustCustodyAmount(newCustodyId, -newAmount);
        updateData.custodyId = newCustodyId;
        updateData.custodyName = expenseData.custodyName || '';
      } else {
        updateData.custodyId = '';
        updateData.custodyName = '';
      }
    }

    await updateDoc(ref, updateData);
    return { success: true };
  } catch (error) {
    console.error('Error updating expense:', error);
    return { success: false, error: error.message };
  }
};

// Delete expense
export const deleteExpense = async (expenseId) => {
  try {
    const ref = doc(db, 'expenses', expenseId);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      // Revert custody amount if custodyId exists
      if (data.custodyId) {
        await adjustCustodyAmount(data.custodyId, Number(data.amount));
      }
    }
    await deleteDoc(ref);
    return { success: true };
  } catch (error) {
    console.error('Error deleting expense:', error);
    return { success: false, error: error.message };
  }
};
