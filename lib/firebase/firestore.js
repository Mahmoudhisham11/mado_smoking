import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from './config';
import { getUserFromLocalStorage } from '../auth';

// Helper function to get current user ID and owner ID
const getUserIds = () => {
  if (typeof window === 'undefined') return { userId: null, ownerId: null };
  
  try {
    const uidStr = localStorage.getItem('uid');
    const ownerIdStr = localStorage.getItem('ownerId');
    const roleStr = localStorage.getItem('role');
    
    if (!uidStr) return { userId: null, ownerId: null };
    
    const uid = JSON.parse(uidStr);
    const role = roleStr ? JSON.parse(roleStr) : null;
    let ownerId = ownerIdStr ? JSON.parse(ownerIdStr) : null;
    
    // If user is owner, their ownerId is their own uid
    if (role === 'owner') {
      ownerId = uid;
    }
    
    // If no ownerId but we have uid, use uid as fallback (for backward compatibility)
    if (!ownerId && uid) {
      ownerId = uid;
    }
    
    return {
      userId: uid,
      ownerId: ownerId,
    };
  } catch (error) {
    console.error('Error getting user IDs:', error);
    return { userId: null, ownerId: null };
  }
};

// Users
export const createUser = async (userData) => {
  try {
    const userRef = doc(db, 'users', userData.uid);
    const userSnap = await getDoc(userRef);
    
    // Only create if user doesn't exist
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: userData.uid,
        name: userData.name || '',
        email: userData.email || '',
        isSubscribe: false,
        role: userData.role || 'user',
        ownerId: userData.ownerId || null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      // Verify the document was created by reading it back
      const verifySnap = await getDoc(userRef);
      if (!verifySnap.exists()) {
        return { success: false, error: 'Failed to create user document' };
      }

      // Auto-create a custody record for the new user
      try {
        const custodiesRef = collection(db, 'custodies');
        await addDoc(custodiesRef, {
          userId: userData.uid,
          name: userData.name || '',
          amount: 0,
          ownerId: userData.ownerId || userData.uid,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (custodyError) {
        console.error('Error creating custody for new user:', custodyError);
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error creating user:', error);
    return { success: false, error: error.message };
  }
};

// Create user by owner (for owner to create sub-users)
export const createUserByOwner = async (ownerId, userData) => {
  try {
    const userRef = doc(db, 'users', userData.uid);
    const userSnap = await getDoc(userRef);
    
    // Only create if user doesn't exist
    if (!userSnap.exists()) {
      await setDoc(userRef, {
        uid: userData.uid,
        name: userData.name || '',
        email: userData.email || '',
        isSubscribe: userData.isSubscribe !== undefined ? userData.isSubscribe : true,
        role: userData.role || 'user',
        ownerId: ownerId, // Link to owner
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      // Verify the document was created
      const verifySnap = await getDoc(userRef);
      if (!verifySnap.exists()) {
        return { success: false, error: 'Failed to create user document' };
      }
      
      // Auto-create a custody record for the new user
      try {
        const custodiesRef = collection(db, 'custodies');
        await addDoc(custodiesRef, {
          userId: userData.uid,
          name: userData.name || '',
          amount: 0,
          ownerId: ownerId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      } catch (custodyError) {
        console.error('Error creating custody for new user:', custodyError);
      }
      
      return { success: true };
    } else {
      return { success: false, error: 'User already exists' };
    }
  } catch (error) {
    console.error('Error creating user by owner:', error);
    return { success: false, error: error.message };
  }
};

// Get all users by owner
export const getUsersByOwner = async (ownerId) => {
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('ownerId', '==', ownerId));
    const snapshot = await getDocs(q);
    
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date()),
      };
    });
  } catch (error) {
    console.error('Error getting users by owner:', error);
    return [];
  }
};

// Update user role
export const updateUserRole = async (userId, newRole) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      role: newRole,
      updatedAt: new Date(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating user role:', error);
    return { success: false, error: error.message };
  }
};

// Update user data
export const updateUserData = async (userId, userData) => {
  try {
    const userRef = doc(db, 'users', userId);
    await updateDoc(userRef, {
      ...userData,
      updatedAt: new Date(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating user data:', error);
    return { success: false, error: error.message };
  }
};

export const getUser = async (uid) => {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const data = userSnap.data();
      return {
        id: userSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date()),
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
};

export const updateUser = async (uid, userData) => {
  try {
    const userRef = doc(db, 'users', uid);
    await updateDoc(userRef, {
      ...userData,
      updatedAt: new Date(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating user:', error);
    return { success: false, error: error.message };
  }
};

// Delete user from Firestore
export const deleteUser = async (userId) => {
  try {
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
      return { success: false, error: 'المستخدم غير موجود في Firestore' };
    }
    
    await deleteDoc(userRef);
    return { success: true };
  } catch (error) {
    console.error('Error deleting user from Firestore:', error);
    return { success: false, error: error.message };
  }
};

export const subscribeToUser = (uid, callback) => {
  try {
    const userRef = doc(db, 'users', uid);
    return onSnapshot(userRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        callback({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date()),
        });
      } else {
        callback(null);
      }
    });
  } catch (error) {
    console.error('Error subscribing to user:', error);
    return () => {};
  }
};

// Custodies
export const subscribeToCustodies = (callback) => {
  try {
    const { ownerId, userId } = getUserIds();
    const ref = collection(db, 'custodies');
    let q;
    if (userId === ownerId) {
      // Owner sees all custodies under their ownership
      q = query(ref, where('ownerId', '==', ownerId));
    } else {
      // Regular user sees only their own custody
      q = query(ref, where('ownerId', '==', ownerId), where('userId', '==', userId));
    }
    return onSnapshot(q, (snapshot) => {
      const items = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      callback(items);
    }, (error) => {
      console.error('Error subscribing to custodies:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error subscribing to custodies:', error);
    return () => {};
  }
};

export const updateCustody = async (custodyId, custodyData) => {
  try {
    const ref = doc(db, 'custodies', custodyId);
    await updateDoc(ref, {
      name: custodyData.name,
      amount: Number(custodyData.amount) || 0,
      updatedAt: new Date(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating custody:', error);
    return { success: false, error: error.message };
  }
};

export const adjustCustodyAmount = async (custodyId, delta) => {
  try {
    const ref = doc(db, 'custodies', custodyId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return { success: false, error: 'Custody not found' };
    const currentAmount = Number(snap.data().amount) || 0;
    const newAmount = currentAmount + delta;
    await updateDoc(ref, {
      amount: newAmount,
      updatedAt: new Date(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error adjusting custody amount:', error);
    return { success: false, error: error.message };
  }
};

export const transferCustodyAmount = async (fromCustodyId, toCustodyId, amount) => {
  try {
    const fromResult = await adjustCustodyAmount(fromCustodyId, -amount);
    if (!fromResult.success) return fromResult;
    const toResult = await adjustCustodyAmount(toCustodyId, amount);
    if (!toResult.success) {
      await adjustCustodyAmount(fromCustodyId, amount);
      return { success: false, error: 'Failed to transfer to target custody, source reverted' };
    }
    return { success: true };
  } catch (error) {
    console.error('Error transferring custody amount:', error);
    return { success: false, error: error.message };
  }
};

export const createMissingCustodies = async () => {
  try {
    const { ownerId, userId } = getUserIds();
    if (!ownerId && !userId) return { success: false, error: 'user not found' };

    const effectiveOwnerId = ownerId || userId;
    const custodiesRef = collection(db, 'custodies');
    const q = query(custodiesRef, where('ownerId', '==', effectiveOwnerId));
    const snapshot = await getDocs(q);
    const existingUserIds = new Set(snapshot.docs.map((d) => d.data().userId));

    let created = 0;

    // Create custody for the owner (the logged-in user) if missing
    if (!existingUserIds.has(userId)) {
      const userDoc = await getDoc(doc(db, 'users', userId));
      const userName = userDoc.exists() ? (userDoc.data().name || '') : '';
      await addDoc(custodiesRef, {
        userId: userId,
        name: userName,
        amount: 0,
        ownerId: effectiveOwnerId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      existingUserIds.add(userId);
      created++;
    }

    // Create custodies for sub-users if missing
    const users = await getUsersByOwner(effectiveOwnerId);
    for (const user of users) {
      if (!existingUserIds.has(user.uid)) {
        await addDoc(custodiesRef, {
          userId: user.uid,
          name: user.name || '',
          amount: 0,
          ownerId: effectiveOwnerId,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        created++;
      }
    }

    return { success: true, created };
  } catch (error) {
    console.error('Error creating missing custodies:', error);
    return { success: false, error: error.message };
  }
};

// Products (Items)
export const getProducts = async () => {
  try {
    const { ownerId, userId } = getUserIds();
    const productsRef = collection(db, 'smokingProducts');
    let q;
    if (ownerId) {
      q = query(productsRef, where('ownerId', '==', ownerId));
    } else if (userId) {
      q = query(productsRef, where('ownerId', '==', userId));
    } else {
      q = productsRef;
    }
    const snapshot = await getDocs(q);
    let products = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
      };
    });
    products.sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
      const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
      return dateB - dateA;
    });
    return products;
  } catch (error) {
    console.error('Error getting products:', error);
    return [];
  }
};

export const subscribeToProducts = (callback) => {
  try {
    const { ownerId, userId } = getUserIds();
    const productsRef = collection(db, 'smokingProducts');
    let q;
    if (ownerId) {
      q = query(productsRef, where('ownerId', '==', ownerId));
    } else if (userId) {
      q = query(productsRef, where('ownerId', '==', userId));
    } else {
      callback([]);
      return () => {};
    }
    return onSnapshot(q, (snapshot) => {
      let products = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : (doc.data().createdAt || new Date()),
      }));
      products.sort((a, b) => {
        const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
        const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
        return dateB - dateA;
      });
      callback(products);
    }, (error) => {
      console.error('Error subscribing to products:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error subscribing to products:', error);
    return () => {};
  }
};

export const getProduct = async (productId) => {
  try {
    const ref = doc(db, 'smokingProducts', productId);
    const snap = await getDoc(ref);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch (error) {
    console.error('Error getting product:', error);
    return null;
  }
};

export const addProduct = async (productData) => {
  try {
    const { userId, ownerId } = getUserIds();
    const productsRef = collection(db, 'smokingProducts');
    const docRef = await addDoc(productsRef, {
      name: productData.name,
      price: Number(productData.price) || 0,
      storeId: productData.storeId || null,
      userId: productData.userId || userId,
      ownerId: productData.ownerId || ownerId || userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding product:', error);
    return { success: false, error: error.message };
  }
};

export const updateProduct = async (productId, productData) => {
  try {
    const productRef = doc(db, 'smokingProducts', productId);
    const updates = {
      name: productData.name,
      price: Number(productData.price) || 0,
      updatedAt: new Date(),
    };
    if (productData.storeId !== undefined) {
      updates.storeId = productData.storeId;
    }
    await updateDoc(productRef, updates);
    return { success: true };
  } catch (error) {
    console.error('Error updating product:', error);
    return { success: false, error: error.message };
  }
};

export const deleteProduct = async (productId) => {
  try {
    const productRef = doc(db, 'smokingProducts', productId);
    await deleteDoc(productRef);
    return { success: true };
  } catch (error) {
    console.error('Error deleting product:', error);
    return { success: false, error: error.message };
  }
};

// Stores
export const getStores = async () => {
  try {
    const { ownerId } = getUserIds();
    const storesRef = collection(db, 'stores');
    const q = query(storesRef, where('ownerId', '==', ownerId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting stores:', error);
    return [];
  }
};

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

export const getProductsByStore = async (storeId) => {
  try {
    const { ownerId } = getUserIds();
    const productsRef = collection(db, 'smokingProducts');
    const q = query(
      productsRef,
      where('storeId', '==', storeId),
      where('ownerId', '==', ownerId)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => {
      const data = doc.data();
      return { id: doc.id, ...data };
    });
  } catch (error) {
    console.error('Error getting products by store:', error);
    return [];
  }
};

export const subscribeToProductsByStore = (storeId, callback) => {
  try {
    const { ownerId } = getUserIds();
    const productsRef = collection(db, 'smokingProducts');
    const q = query(
      productsRef,
      where('storeId', '==', storeId),
      where('ownerId', '==', ownerId)
    );
    return onSnapshot(q, (snapshot) => {
      const products = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      callback(products);
    }, (error) => {
      console.error('Error subscribing to products by store:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error subscribing to products by store:', error);
    return () => {};
  }
};

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

// Sources
export const getSources = async () => {
  try {
    const { ownerId } = getUserIds();
    const sourcesRef = collection(db, 'sources');
    const q = query(sourcesRef, where('ownerId', '==', ownerId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  } catch (error) {
    console.error('Error getting sources:', error);
    return [];
  }
};

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

export const deleteSourceInvoice = async (invoiceId) => {
  try {
    const payments = await getSourcePaymentsByInvoiceId(invoiceId);
    for (const p of payments) {
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
      const newQty = (Number(existing.data.totalQuantity) || 0) + qty;
      if (newQty <= 0) {
        await deleteDoc(doc(db, 'storeProducts', existing.id));
      } else {
        await updateDoc(doc(db, 'storeProducts', existing.id), {
          totalQuantity: newQty,
          updatedAt: new Date(),
        });
      }
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

// Customers
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

export const deleteCustomer = async (customerId) => {
  try {
    await deleteDoc(doc(db, 'customers', customerId));
    return { success: true };
  } catch (error) {
    console.error('Error deleting customer:', error);
    return { success: false, error: error.message };
  }
};

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

export const deleteCustomerInvoice = async (invoiceId) => {
  try {
    const payments = await getCustomerPaymentsByInvoiceId(invoiceId);
    for (const p of payments) {
      await deleteDoc(doc(db, 'customerPayments', p.id));
    }
    await deleteDoc(doc(db, 'customerInvoices', invoiceId));
    return { success: true, deletedPayments: payments.length };
  } catch (error) {
    console.error('Error deleting customer invoice:', error);
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

// Expenses
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
