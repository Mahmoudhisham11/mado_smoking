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
import { getUserFromLocalStorage } from '../../auth';

// Real-time subscribe to stores
export const subscribeToStores = (callback) => {
  try {
    const { ownerId } = getUserIds();
    const storesRef = collection(db, 'stores');
    const q = query(storesRef, where('ownerId', '==', ownerId));
    return onSnapshot(q, (snapshot) => {
      const stores = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      callback(stores);
    }, (error) => {
      console.error('Error subscribing to stores:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error subscribing to stores:', error);
    return () => {};
  }
};

// Add new store
export const addStore = async (storeData) => {
  try {
    const { userId, ownerId } = getUserIds();
    const storesRef = collection(db, 'stores');
    const docRef = await addDoc(storesRef, {
      name: storeData.name,
      userId: userId,
      ownerId: ownerId || userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding store:', error);
    return { success: false, error: error.message };
  }
};

// Update store
export const updateStore = async (storeId, storeData) => {
  try {
    const storeRef = doc(db, 'stores', storeId);
    await updateDoc(storeRef, {
      name: storeData.name,
      updatedAt: new Date(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating store:', error);
    return { success: false, error: error.message };
  }
};

// Delete store
export const deleteStore = async (storeId) => {
  try {
    const storeRef = doc(db, 'stores', storeId);
    await deleteDoc(storeRef);
    return { success: true };
  } catch (error) {
    console.error('Error deleting store:', error);
    return { success: false, error: error.message };
  }
};

// Get single store
export const getStore = async (storeId) => {
  try {
    const storeRef = doc(db, 'stores', storeId);
    const storeSnap = await getDoc(storeRef);
    if (storeSnap.exists()) {
      return { id: storeSnap.id, ...storeSnap.data() };
    }
    return null;
  } catch (error) {
    console.error('Error getting store:', error);
    return null;
  }
};

// Store Products (inventory tracking)
export const subscribeToStoreProducts = (storeId, callback) => {
  try {
    const { ownerId } = getUserIds();
    const ref = collection(db, 'storeProducts');
    const q = query(
      ref,
      where('storeId', '==', storeId),
      where('ownerId', '==', ownerId)
    );
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      callback(items);
    }, (error) => {
      console.error('Error subscribing to store products:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error subscribing to store products:', error);
    return () => {};
  }
};

export const subscribeToAllStoreProducts = (callback) => {
  try {
    const { ownerId } = getUserIds();
    const ref = collection(db, 'storeProducts');
    const q = query(ref, where('ownerId', '==', ownerId));
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      callback(items);
    }, (error) => {
      console.error('Error subscribing to all store products:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error subscribing to all store products:', error);
    return () => {};
  }
};

const getStoreProductDocId = async (storeId, productId) => {
  const { ownerId } = getUserIds();
  const ref = collection(db, 'storeProducts');
  const q = query(
    ref,
    where('storeId', '==', storeId),
    where('productId', '==', productId),
    where('ownerId', '==', ownerId)
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  return { id: snapshot.docs[0].id, data: snapshot.docs[0].data() };
};

export const updateStoreProductQuantity = async (storeId, productId, productName, deltaQuantity) => {
  try {
    const { ownerId, userId } = getUserIds();
    if (!ownerId) return { success: false, error: 'ownerId not found' };
    const existing = await getStoreProductDocId(storeId, productId);
    const ref = collection(db, 'storeProducts');
    const qty = Math.round(Number(deltaQuantity) || 0);
    if (existing) {
      const currentQty = Number(existing.data.totalQuantity) || 0;
      const newQty = Math.max(0, currentQty + qty);
      await updateDoc(doc(db, 'storeProducts', existing.id), {
        totalQuantity: newQty,
        productName: productName || existing.data.productName || 'غير معروف',
        updatedAt: new Date(),
      });
    } else if (qty > 0) {
      await addDoc(ref, {
        storeId,
        productId,
        productName,
        totalQuantity: qty,
        ownerId,
        userId: userId || ownerId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    return { success: true };
  } catch (error) {
    console.error('Error updating store product quantity:', error);
    return { success: false, error: error.message };
  }
};

export const setStoreProductQuantity = async (storeId, productId, productName, absoluteQuantity) => {
  try {
    const { ownerId, userId } = getUserIds();
    if (!ownerId) return { success: false, error: 'ownerId not found' };
    const existing = await getStoreProductDocId(storeId, productId);
    const ref = collection(db, 'storeProducts');
    const targetQty = Math.max(0, Math.round(Number(absoluteQuantity) || 0));
    if (existing) {
      await updateDoc(doc(db, 'storeProducts', existing.id), {
        totalQuantity: targetQty,
        productName: productName || existing.data.productName || 'غير معروف',
        updatedAt: new Date(),
      });
    } else {
      await addDoc(ref, {
        storeId,
        productId,
        productName,
        totalQuantity: targetQty,
        ownerId,
        userId: userId || ownerId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    return { success: true };
  } catch (error) {
    console.error('Error setting store product quantity:', error);
    return { success: false, error: error.message };
  }
};

export const applyInvoiceToInventory = async (invoiceProducts, previousProducts = null) => {
  try {
    if (previousProducts) {
      for (const line of previousProducts) {
        await updateStoreProductQuantity(line.storeId, line.productId, line.productName, -line.quantity);
      }
    }
    for (const line of invoiceProducts) {
      await updateStoreProductQuantity(line.storeId, line.productId, line.productName, line.quantity);
    }
    return { success: true };
  } catch (error) {
    console.error('Error applying invoice to inventory:', error);
    return { success: false, error: error.message };
  }
};

// Store Transfers
export const subscribeToStoreTransfers = (callback) => {
  try {
    const { ownerId } = getUserIds();
    const ref = collection(db, 'storeTransfers');
    const q = query(ref, where('ownerId', '==', ownerId));
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date()),
        };
      });
      items.sort((a, b) => (b.createdAt?.getTime() || 0) - (a.createdAt?.getTime() || 0));
      callback(items);
    }, (error) => {
      console.error('Error subscribing to store transfers:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error subscribing to store transfers:', error);
    return () => {};
  }
};

export const addStoreTransfer = async (transferData) => {
  try {
    const { userId, ownerId } = getUserIds();
    const userData = getUserFromLocalStorage();
    const ref = collection(db, 'storeTransfers');
    const docRef = await addDoc(ref, {
      fromStoreId: transferData.fromStoreId,
      fromStoreName: transferData.fromStoreName,
      toStoreId: transferData.toStoreId,
      toStoreName: transferData.toStoreName,
      products: transferData.products,
      userId: userId,
      userName: userData?.name || 'غير معروف',
      ownerId: ownerId || userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Update inventory: decrease from source, increase to destination
    for (const line of transferData.products) {
      await updateStoreProductQuantity(transferData.fromStoreId, line.productId, line.productName, -line.quantity);
      await updateStoreProductQuantity(transferData.toStoreId, line.productId, line.productName, line.quantity);
    }

    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding store transfer:', error);
    return { success: false, error: error.message };
  }
};

export const deleteStoreTransfer = async (transferId) => {
  try {
    const ref = doc(db, 'storeTransfers', transferId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { success: false, error: 'Transfer not found' };

    const data = snap.data();

    // Revert inventory: increase back to source, decrease from destination
    for (const line of data.products) {
      await updateStoreProductQuantity(data.fromStoreId, line.productId, line.productName, line.quantity);
      await updateStoreProductQuantity(data.toStoreId, line.productId, line.productName, -line.quantity);
    }

    await deleteDoc(ref);
    return { success: true };
  } catch (error) {
    console.error('Error deleting store transfer:', error);
    return { success: false, error: error.message };
  }
};
