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

// Stores
export const getStores = async () => {
  try {
    const { ownerId, userId } = getUserIds();
    const storesRef = collection(db, 'stores');
    
    // Filter by ownerId if available, otherwise get all (for backward compatibility)
    let q;
    if (ownerId) {
      q = query(storesRef, where('ownerId', '==', ownerId));
    } else if (userId) {
      // If no ownerId but userId exists, use userId as ownerId (for owners)
      q = query(storesRef, where('ownerId', '==', userId));
    } else {
      q = storesRef; // Get all if no user info (shouldn't happen in production)
    }
    
    const snapshot = await getDocs(q);
    let stores = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    
    // Filter by userIds for regular users (owner sees all)
    const userRole = getUserFromLocalStorage()?.role || 'user';
    if (userRole !== 'owner' && userId) {
      stores = stores.filter((store) => {
        const userIds = store.userIds;
        // null = owner only, [] = all users, [userId1, userId2] = specific users
        if (userIds === null) return false; // Owner only
        if (Array.isArray(userIds) && userIds.length === 0) return true; // All users
        if (Array.isArray(userIds) && userIds.includes(userId)) return true; // User in list
        return false;
      });
    }
    
    return stores;
  } catch (error) {
    console.error('Error getting stores:', error);
    return [];
  }
};

// Subscribe to stores with real-time updates
export const subscribeToStores = (callback) => {
  try {
    const { ownerId, userId } = getUserIds();
    const storesRef = collection(db, 'stores');
    
    // Build query based on ownerId
    let q;
    if (ownerId) {
      q = query(storesRef, where('ownerId', '==', ownerId));
    } else if (userId) {
      q = query(storesRef, where('ownerId', '==', userId));
    } else {
      q = storesRef;
    }
    
    return onSnapshot(q, (snapshot) => {
      let stores = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      
      // Filter by userIds for regular users (owner sees all)
      const userRole = getUserFromLocalStorage()?.role || 'user';
      if (userRole !== 'owner' && userId) {
        stores = stores.filter((store) => {
          const userIds = store.userIds;
          // null = owner only, [] = all users, [userId1, userId2] = specific users
          if (userIds === null) return false; // Owner only
          if (Array.isArray(userIds) && userIds.length === 0) return true; // All users
          if (Array.isArray(userIds) && userIds.includes(userId)) return true; // User in list
          return false;
        });
      }
      
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

export const addStore = async (storeData) => {
  try {
    const { userId, ownerId } = getUserIds();
    const storesRef = collection(db, 'stores');
    const docRef = await addDoc(storesRef, {
      storeName: storeData.storeName,
      userIds: storeData.userIds !== undefined ? storeData.userIds : null, // null = owner only
      userId: storeData.userId || userId,
      ownerId: storeData.ownerId || ownerId || userId, // If no ownerId, use userId (for owners)
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
      storeName: storeData.storeName,
      userIds: storeData.userIds !== undefined ? storeData.userIds : null,
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
    // 1. حذف جميع الفواتير المرتبطة بالمخزن
    const invoicesRef = collection(db, 'invoices');
    const invoicesQuery = query(invoicesRef, where('storeId', '==', storeId));
    const invoicesSnapshot = await getDocs(invoicesQuery);
    const deleteInvoicesPromises = invoicesSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deleteInvoicesPromises);
    
    // 2. حذف جميع المنتجات المرتبطة بالمخزن
    const productsRef = collection(db, 'products');
    const productsQuery = query(productsRef, where('storeId', '==', storeId));
    const productsSnapshot = await getDocs(productsQuery);
    const deleteProductsPromises = productsSnapshot.docs.map(doc => deleteDoc(doc.ref));
    await Promise.all(deleteProductsPromises);
    
    // 3. حذف المخزن نفسه
    const storeRef = doc(db, 'stores', storeId);
    await deleteDoc(storeRef);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting store:', error);
    return { success: false, error: error.message };
  }
};

// Sources
export const getSources = async () => {
  try {
    const { ownerId, userId } = getUserIds();
    const sourcesRef = collection(db, 'sources');
    
    // Filter by ownerId if available
    let q;
    if (ownerId) {
      q = query(sourcesRef, where('ownerId', '==', ownerId));
    } else if (userId) {
      q = query(sourcesRef, where('ownerId', '==', userId));
    } else {
      q = sourcesRef;
    }
    
    const snapshot = await getDocs(q);
    let sources = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    
    // Filter by userIds for regular users (owner sees all)
    const userRole = getUserFromLocalStorage()?.role || 'user';
    if (userRole !== 'owner' && userId) {
      sources = sources.filter((source) => {
        const userIds = source.userIds;
        // null = owner only, [] = all users, [userId1, userId2] = specific users
        if (userIds === null) return false; // Owner only
        if (Array.isArray(userIds) && userIds.length === 0) return true; // All users
        if (Array.isArray(userIds) && userIds.includes(userId)) return true; // User in list
        return false;
      });
    }
    
    return sources;
  } catch (error) {
    console.error('Error getting sources:', error);
    return [];
  }
};

// Subscribe to sources with real-time updates
export const subscribeToSources = (callback) => {
  try {
    const { ownerId, userId } = getUserIds();
    const sourcesRef = collection(db, 'sources');
    
    // Build query based on ownerId
    let q;
    if (ownerId) {
      q = query(sourcesRef, where('ownerId', '==', ownerId));
    } else if (userId) {
      q = query(sourcesRef, where('ownerId', '==', userId));
    } else {
      q = sourcesRef;
    }
    
    return onSnapshot(q, (snapshot) => {
      let sources = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      
      // Filter by userIds for regular users (owner sees all)
      const userRole = getUserFromLocalStorage()?.role || 'user';
      if (userRole !== 'owner' && userId) {
        sources = sources.filter((source) => {
          const userIds = source.userIds;
          // null = owner only, [] = all users, [userId1, userId2] = specific users
          if (userIds === null) return false; // Owner only
          if (Array.isArray(userIds) && userIds.length === 0) return true; // All users
          if (Array.isArray(userIds) && userIds.includes(userId)) return true; // User in list
          return false;
        });
      }
      
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

// Subscribe to a specific source with real-time updates
export const subscribeToSource = (sourceId, callback) => {
  try {
    const sourceRef = doc(db, 'sources', sourceId);
    return onSnapshot(sourceRef, (docSnap) => {
      if (docSnap.exists()) {
        callback({ id: docSnap.id, ...docSnap.data() });
      } else {
        callback(null);
      }
    }, (error) => {
      console.error('Error subscribing to source:', error);
      callback(null);
    });
  } catch (error) {
    console.error('Error subscribing to source:', error);
    return () => {};
  }
};

// Subscribe to invoices for a specific source with real-time updates
export const subscribeToInvoices = (sourceId, callback) => {
  try {
    const { ownerId, userId } = getUserIds();
    const invoicesRef = collection(db, 'invoices');
    
    // Build query based on sourceId and ownerId
    let q;
    if (sourceId && ownerId) {
      q = query(
        invoicesRef,
        where('sourceId', '==', sourceId),
        where('ownerId', '==', ownerId)
      );
    } else if (sourceId && userId) {
      q = query(
        invoicesRef,
        where('sourceId', '==', sourceId),
        where('ownerId', '==', userId)
      );
    } else if (sourceId) {
      q = query(invoicesRef, where('sourceId', '==', sourceId));
    } else {
      return () => {};
    }
    
    return onSnapshot(q, async (snapshot) => {
      let invoices = snapshot.docs.map((doc) => {
        const data = doc.data();
        return { 
          id: doc.id, 
          ...data,
          date: data.date?.toDate ? data.date.toDate() : (data.date || new Date())
        };
      });
      
      // Fetch store names for invoices
      for (const invoice of invoices) {
        if (invoice.storeId && !invoice.storeName) {
          try {
            const store = await getStore(invoice.storeId);
            if (store) {
              invoice.storeName = store.storeName || store.name || 'N/A';
            }
          } catch (error) {
            console.error('Error fetching store name:', error);
            invoice.storeName = 'N/A';
          }
        }
      }
      
      // Sort by date in descending order
      invoices.sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : new Date(a.date);
        const dateB = b.date instanceof Date ? b.date : new Date(b.date);
        return dateB - dateA;
      });
      
      callback(invoices);
    }, (error) => {
      console.error('Error subscribing to invoices:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error subscribing to invoices:', error);
    return () => {};
  }
};

// Update source
export const updateSource = async (sourceId, sourceData) => {
  try {
    const sourceRef = doc(db, 'sources', sourceId);
    await updateDoc(sourceRef, {
      sourceName: sourceData.sourceName,
      userIds: sourceData.userIds !== undefined ? sourceData.userIds : null,
      updatedAt: new Date(),
    });
    return { success: true };
  } catch (error) {
    console.error('Error updating source:', error);
    return { success: false, error: error.message };
  }
};

// Delete source and all related invoices and products
export const deleteSource = async (sourceId) => {
  try {
    const { ownerId } = getUserIds();
    
    // Get all invoices for this source
    const invoicesRef = collection(db, 'invoices');
    const invoicesQuery = query(
      invoicesRef,
      where('sourceId', '==', sourceId),
      where('ownerId', '==', ownerId)
    );
    const invoicesSnapshot = await getDocs(invoicesQuery);
    
    // Delete all invoices and return products to store
    for (const invoiceDoc of invoicesSnapshot.docs) {
      const invoiceData = invoiceDoc.data();
      
      // Return products to store if invoice has products
      if (invoiceData.products && invoiceData.products.length > 0) {
        for (const product of invoiceData.products) {
          if (product.storeId && product.code) {
            const productsQuery = query(
              collection(db, 'products'),
              where('storeId', '==', product.storeId),
              where('code', '==', product.code)
            );
            const productsSnapshot = await getDocs(productsQuery);
            
            if (!productsSnapshot.empty) {
              const productDoc = productsSnapshot.docs[0];
              const productData = productDoc.data();
              const currentQuantity = productData.quantity || 0;
              const returnedQuantity = product.quantity || 0;
              const newQuantity = currentQuantity + returnedQuantity;
              
              await updateDoc(productDoc.ref, { quantity: newQuantity });
            } else {
              // Product doesn't exist, create it
              await addProduct({
                code: product.code,
                productName: product.name || product.productName,
                wholesalePrice: product.wholesalePrice,
                sellPrice: product.sellPrice,
                finalPrice: product.finalPrice,
                quantity: product.quantity,
                category: product.category,
                storeId: product.storeId,
              });
            }
          }
        }
      }
      
      // Delete all payments related to this invoice
      const paymentsRef = collection(db, 'payments');
      const paymentsQuery = query(paymentsRef, where('invoiceId', '==', invoiceDoc.id));
      const paymentsSnapshot = await getDocs(paymentsQuery);
      
      for (const paymentDoc of paymentsSnapshot.docs) {
        await deleteDoc(paymentDoc.ref);
      }
      
      // Delete the invoice
      await deleteDoc(invoiceDoc.ref);
    }
    
    // Delete the source itself
    const sourceRef = doc(db, 'sources', sourceId);
    await deleteDoc(sourceRef);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting source:', error);
    return { success: false, error: error.message };
  }
};

export const addSource = async (sourceData) => {
  try {
    const { userId, ownerId } = getUserIds();
    const sourcesRef = collection(db, 'sources');
    const docRef = await addDoc(sourcesRef, {
      sourceName: sourceData.sourceName,
      userIds: sourceData.userIds !== undefined ? sourceData.userIds : null, // null = owner only
      userId: sourceData.userId || userId,
      ownerId: sourceData.ownerId || ownerId || userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding source:', error);
    return { success: false, error: error.message };
  }
};

// Products
export const getProducts = async (storeId = null) => {
  try {
    const { ownerId, userId } = getUserIds();
    const productsRef = collection(db, 'products');
    let q;
    
    // Build query based on storeId and ownerId
    if (storeId && ownerId) {
      q = query(
        productsRef,
        where('storeId', '==', storeId),
        where('ownerId', '==', ownerId)
      );
    } else if (storeId && userId) {
      q = query(
        productsRef,
        where('storeId', '==', storeId),
        where('ownerId', '==', userId)
      );
    } else if (storeId) {
      q = query(productsRef, where('storeId', '==', storeId));
    } else if (ownerId) {
      q = query(productsRef, where('ownerId', '==', ownerId));
    } else if (userId) {
      q = query(productsRef, where('ownerId', '==', userId));
    } else {
      q = query(productsRef, orderBy('createdAt', 'desc'));
    }
    
    const snapshot = await getDocs(q);
    let products = snapshot.docs.map((doc) => {
      const data = doc.data();
      return { 
        id: doc.id, 
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date())
      };
    });
    
    // Sort by createdAt in descending order
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

export const addProduct = async (productData) => {
  try {
    const { userId, ownerId } = getUserIds();
    const productsRef = collection(db, 'products');
    const docRef = await addDoc(productsRef, {
      ...productData,
      userId: productData.userId || userId,
      ownerId: productData.ownerId || ownerId || userId,
      createdAt: new Date(),
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding product:', error);
    return { success: false, error: error.message };
  }
};

export const updateProduct = async (productId, updates) => {
  try {
    const productRef = doc(db, 'products', productId);
    await updateDoc(productRef, updates);
    return { success: true };
  } catch (error) {
    console.error('Error updating product:', error);
    return { success: false, error: error.message };
  }
};

export const deleteProduct = async (productId) => {
  try {
    const productRef = doc(db, 'products', productId);
    await deleteDoc(productRef);
    return { success: true };
  } catch (error) {
    console.error('Error deleting product:', error);
    return { success: false, error: error.message };
  }
};

export const deleteZeroQuantityProducts = async (storeId = null) => {
  try {
    const productsRef = collection(db, 'products');
    let q;
    
    if (storeId) {
      q = query(productsRef, where('storeId', '==', storeId));
    } else {
      q = query(productsRef);
    }
    
    const snapshot = await getDocs(q);
    const deletePromises = [];
    
    snapshot.docs.forEach((docSnapshot) => {
      const productData = docSnapshot.data();
      const quantity = productData.quantity || 0;
      
      if (quantity <= 0) {
        deletePromises.push(deleteDoc(docSnapshot.ref));
      }
    });
    
    if (deletePromises.length > 0) {
      await Promise.all(deletePromises);
      return { success: true, deletedCount: deletePromises.length };
    }
    
    return { success: true, deletedCount: 0 };
  } catch (error) {
    console.error('Error deleting zero quantity products:', error);
    return { success: false, error: error.message };
  }
};

export const transferProducts = async (sourceStoreId, targetStoreId, items) => {
  try {
    // items: [{ productId, quantity }]
    for (const item of items) {
      // 1. تقليل الكمية من المخزن الحالي
      const sourceProductRef = doc(db, 'products', item.productId);
      const sourceProduct = await getDoc(sourceProductRef);
      
      if (!sourceProduct.exists()) {
        throw new Error(`Product ${item.productId} not found`);
      }
      
      const sourceData = sourceProduct.data();
      if ((sourceData.quantity || 0) < item.quantity) {
        throw new Error(`Insufficient quantity for product ${sourceData.name || item.productId}`);
      }
      
      await updateDoc(sourceProductRef, {
        quantity: (sourceData.quantity || 0) - item.quantity
      });
      
      // 2. البحث عن المنتج في المخزن الهدف أو إضافته
      const targetProductsQuery = query(
        collection(db, 'products'),
        where('storeId', '==', targetStoreId),
        where('code', '==', sourceData.code)
      );
      const targetProductsSnapshot = await getDocs(targetProductsQuery);
      
      if (targetProductsSnapshot.empty) {
        // إضافة منتج جديد في المخزن الهدف
        await addProduct({
          ...sourceData,
          storeId: targetStoreId,
          quantity: item.quantity,
        });
      } else {
        // تحديث الكمية في المخزن الهدف
        const targetProduct = targetProductsSnapshot.docs[0];
        await updateDoc(targetProduct.ref, {
          quantity: (targetProduct.data().quantity || 0) + item.quantity
        });
      }
    }
    
    // Delete products with zero quantity from source store after transfer
    await deleteZeroQuantityProducts(sourceStoreId);
    
    return { success: true };
  } catch (error) {
    console.error('Error transferring products:', error);
    return { success: false, error: error.message };
  }
};

// Invoices
export const getInvoices = async (sourceId = null) => {
  try {
    const { ownerId, userId } = getUserIds();
    const invoicesRef = collection(db, 'invoices');
    let q;
    
    // Build query based on sourceId and ownerId
    if (sourceId && ownerId) {
      q = query(
        invoicesRef,
        where('sourceId', '==', sourceId),
        where('ownerId', '==', ownerId)
      );
    } else if (sourceId && userId) {
      q = query(
        invoicesRef,
        where('sourceId', '==', sourceId),
        where('ownerId', '==', userId)
      );
    } else if (sourceId) {
      q = query(invoicesRef, where('sourceId', '==', sourceId));
    } else if (ownerId) {
      q = query(invoicesRef, where('ownerId', '==', ownerId));
    } else if (userId) {
      q = query(invoicesRef, where('ownerId', '==', userId));
    } else {
      q = query(invoicesRef, orderBy('date', 'desc'));
    }
    
    const snapshot = await getDocs(q);
    let invoices = snapshot.docs.map((doc) => {
      const data = doc.data();
      return { 
        id: doc.id, 
        ...data,
        date: data.date?.toDate ? data.date.toDate() : (data.date || new Date())
      };
    });
    
    // Fetch store names for invoices
    for (const invoice of invoices) {
      if (invoice.storeId && !invoice.storeName) {
        try {
          const store = await getStore(invoice.storeId);
          if (store) {
            invoice.storeName = store.storeName || store.name || 'N/A';
          }
        } catch (error) {
          console.error('Error fetching store name:', error);
          invoice.storeName = 'N/A';
        }
      }
    }
    
    // Sort by date in descending order
    invoices.sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : new Date(a.date);
      const dateB = b.date instanceof Date ? b.date : new Date(b.date);
      return dateB - dateA;
    });
    
    return invoices;
  } catch (error) {
    console.error('Error getting invoices:', error);
    return [];
  }
};

export const getNextProductCode = async () => {
  try {
    const { ownerId } = getUserIds();
    const invoicesRef = collection(db, 'invoices');
    
    // البحث في فواتير الـ owner فقط
    let q;
    if (ownerId) {
      q = query(invoicesRef, where('ownerId', '==', ownerId));
    } else {
      q = invoicesRef;
    }
    
    const snapshot = await getDocs(q);
    let maxCode = 1000;
    
    snapshot.docs.forEach((docSnapshot) => {
      const invoiceData = docSnapshot.data();
      if (invoiceData.products && Array.isArray(invoiceData.products)) {
        invoiceData.products.forEach((product) => {
          const code = product.code || 0;
          if (typeof code === 'number' && code > maxCode) {
            maxCode = code;
          }
        });
      }
    });
    
    return maxCode + 1;
  } catch (error) {
    console.error('Error getting next product code:', error);
    return 1000;
  }
};

export const addInvoice = async (invoiceData) => {
  try {
    const { userId, ownerId } = getUserIds();
    const invoicesRef = collection(db, 'invoices');
    const docRef = await addDoc(invoicesRef, {
      ...invoiceData,
      userId: invoiceData.userId || userId,
      ownerId: invoiceData.ownerId || ownerId || userId,
      date: invoiceData.date || new Date(),
      createdAt: new Date(),
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding invoice:', error);
    return { success: false, error: error.message };
  }
};

export const returnInvoice = async (invoiceId) => {
  try {
    const invoiceRef = doc(db, 'invoices', invoiceId);
    const invoiceSnap = await getDoc(invoiceRef);
    
    if (!invoiceSnap.exists()) {
      return { success: false, error: 'Invoice not found' };
    }
    
    const invoiceData = invoiceSnap.data();
    
    // حذف كل المنتجات من كل المخازن حسب code فقط (لأن المنتجات قد تكون منقولة أو مقسمة على مخازن متعددة)
    if (invoiceData.products && invoiceData.products.length > 0) {
      for (const product of invoiceData.products) {
        // البحث في كل المخازن حسب code فقط
        const productsQuery = query(
          collection(db, 'products'),
          where('code', '==', product.code)
        );
        const productsSnapshot = await getDocs(productsQuery);
        
        const returnedQuantity = product.quantity || 0;
        let remainingToReturn = returnedQuantity;
        
        // حذف/تحديث الكمية في كل المخازن
        for (const productDoc of productsSnapshot.docs) {
          if (remainingToReturn <= 0) break;
          
          const productData = productDoc.data();
          const currentQuantity = productData.quantity || 0;
          const quantityToDeduct = Math.min(remainingToReturn, currentQuantity);
          const newQuantity = currentQuantity - quantityToDeduct;
          
          if (newQuantity <= 0) {
            // Delete product if quantity becomes 0 or less
            await deleteDoc(productDoc.ref);
          } else {
            // Update quantity
            await updateDoc(productDoc.ref, { quantity: newQuantity });
          }
          
          remainingToReturn -= quantityToDeduct;
        }
      }
    }
    
    // في حالة المرتجع الكامل، حذف الفاتورة بالكامل
    await deleteDoc(invoiceRef);
    
    return { success: true, deleted: true };
  } catch (error) {
    console.error('Error returning invoice:', error);
    return { success: false, error: error.message };
  }
};

export const addPayment = async (sourceId, paymentAmount, cashRegisterId) => {
  try {
    const { ownerId } = getUserIds();
    if (!ownerId || !sourceId) {
      return { success: false, error: 'Source ID and owner ID are required' };
    }

    if (!cashRegisterId) {
      return { success: false, error: 'يجب اختيار العهدة للسداد' };
    }

    // Validate cash register and balance
    const cashRegisterRef = doc(db, 'cashRegisters', cashRegisterId);
    const cashRegisterSnap = await getDoc(cashRegisterRef);
    if (!cashRegisterSnap.exists()) {
      return { success: false, error: 'العهدة غير موجودة' };
    }

    const currentBalance = cashRegisterSnap.data().balance || 0;
    if (currentBalance < paymentAmount) {
      return { success: false, error: 'الرصيد في العهدة غير كافي للسداد' };
    }

    // Get all invoices for this source
    const invoicesRef = collection(db, 'invoices');
    const invoicesQuery = query(
      invoicesRef,
      where('sourceId', '==', sourceId),
      where('ownerId', '==', ownerId)
    );
    const invoicesSnapshot = await getDocs(invoicesQuery);
    
    if (invoicesSnapshot.empty) {
      return { success: false, error: 'No invoices found for this source' };
    }

    // Get all invoices with remaining amount > 0, sorted by remaining amount (descending)
    const invoices = [];
    invoicesSnapshot.forEach((doc) => {
      const data = doc.data();
      const remainingAmount = data.remainingAmount || 0;
      if (remainingAmount > 0) {
        invoices.push({
          id: doc.id,
          ref: doc.ref,
          ...data,
          remainingAmount: remainingAmount,
        });
      }
    });

    // Sort by remaining amount (descending) - pay largest remaining first
    invoices.sort((a, b) => b.remainingAmount - a.remainingAmount);

    if (invoices.length === 0) {
      return { success: false, error: 'No invoices with remaining amount' };
    }

    // Distribute payment across invoices
    let remainingPayment = paymentAmount;
    const updatedInvoices = [];

    for (const invoice of invoices) {
      if (remainingPayment <= 0) break;

      const currentPaidAmount = invoice.paidAmount || 0;
      const totalCost = invoice.totalCost || 0;
      const currentRemaining = invoice.remainingAmount || 0;

      // Calculate how much to pay for this invoice
      const paymentForThisInvoice = Math.min(remainingPayment, currentRemaining);
      const newPaidAmount = currentPaidAmount + paymentForThisInvoice;
      const newRemainingAmount = totalCost - newPaidAmount;
      const overpaid = newPaidAmount > totalCost;

      // Update invoice
      await updateDoc(invoice.ref, {
        paidAmount: newPaidAmount,
        remainingAmount: newRemainingAmount,
        overpaid: overpaid,
      });

      updatedInvoices.push({
        invoiceId: invoice.id,
        paidAmount: newPaidAmount,
        remainingAmount: newRemainingAmount,
        overpaid: overpaid,
      });

      remainingPayment -= paymentForThisInvoice;
    }

    // Save payment record in payments collection (linked to sourceId, not invoiceId)
    const paymentsRef = collection(db, 'payments');
    const paymentDocRef = await addDoc(paymentsRef, {
      sourceId: sourceId,
      amount: paymentAmount,
      cashRegisterId,
      date: new Date(),
      createdAt: new Date(),
      invoiceIds: updatedInvoices.map(inv => inv.invoiceId), // Track which invoices were affected
    });

    // Deduct from selected cash register (money out) and record cash movement
    await updateCashRegisterBalance(cashRegisterId, -paymentAmount);
    await recordCashMovement({
      cashRegisterId,
      amount: paymentAmount,
      description: 'سداد للمصدر',
      flow: 'out',
      kind: 'source_payment',
      refId: paymentDocRef.id,
      refType: 'source_payment',
    });
    
    return { 
      success: true, 
      updatedInvoices: updatedInvoices,
      remainingPayment: remainingPayment > 0 ? remainingPayment : 0 // If payment was more than total remaining
    };
  } catch (error) {
    console.error('Error adding payment:', error);
    return { success: false, error: error.message };
  }
};

export const getPayments = async (sourceId = null, invoiceId = null) => {
  try {
    const paymentsRef = collection(db, 'payments');
    let q;
    
    // When using where, we can't use orderBy without an index
    // So we'll filter first, then sort in JavaScript
    if (invoiceId) {
      q = query(paymentsRef, where('invoiceIds', 'array-contains', invoiceId));
    } else if (sourceId) {
      q = query(paymentsRef, where('sourceId', '==', sourceId));
    } else {
      q = query(paymentsRef, orderBy('date', 'desc'));
    }
    
    const snapshot = await getDocs(q);
    let payments = snapshot.docs.map((doc) => {
      const data = doc.data();
      return { 
        id: doc.id, 
        ...data,
        date: data.date?.toDate ? data.date.toDate() : (data.date || new Date()),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date())
      };
    });
    
    // Sort by date in descending order
    payments.sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : new Date(a.date);
      const dateB = b.date instanceof Date ? b.date : new Date(b.date);
      return dateB - dateA;
    });
    
    return payments;
  } catch (error) {
    console.error('Error getting payments:', error);
    return [];
  }
};

export const deletePayment = async (paymentId) => {
  try {
    const { ownerId } = getUserIds();
    if (!ownerId) {
      return { success: false, error: 'Owner ID is required' };
    }

    // Get payment record
    const paymentRef = doc(db, 'payments', paymentId);
    const paymentSnap = await getDoc(paymentRef);
    
    if (!paymentSnap.exists()) {
      return { success: false, error: 'Payment not found' };
    }

    const paymentData = paymentSnap.data();
    const paymentAmount = paymentData.amount || 0;
    const invoiceIds = paymentData.invoiceIds || [];
    const cashRegisterId = paymentData.cashRegisterId || null;

    // Reverse the payment: subtract the amount from invoices
    // We need to reverse the distribution logic
    // Get all invoices that were affected
    const invoicesRef = collection(db, 'invoices');
    const invoicesToUpdate = [];

    for (const invoiceId of invoiceIds) {
      try {
        const invoiceRef = doc(db, 'invoices', invoiceId);
        const invoiceSnap = await getDoc(invoiceRef);
        
        if (invoiceSnap.exists()) {
          const invoiceData = invoiceSnap.data();
          invoicesToUpdate.push({
            id: invoiceId,
            ref: invoiceRef,
            currentPaidAmount: invoiceData.paidAmount || 0,
            totalCost: invoiceData.totalCost || 0,
            currentRemaining: invoiceData.remainingAmount || 0,
          });
        }
      } catch (error) {
        console.error(`Error fetching invoice ${invoiceId}:`, error);
      }
    }

    // Sort by remaining amount (ascending) - reverse the largest payments first
    invoicesToUpdate.sort((a, b) => b.currentRemaining - a.currentRemaining);

    // Distribute the reversal: subtract from invoices
    let remainingToReverse = paymentAmount;

    for (const invoice of invoicesToUpdate) {
      if (remainingToReverse <= 0) break;

      // Calculate how much to reverse for this invoice
      // We reverse based on how much was paid (can't reverse more than was paid)
      const maxReversible = invoice.currentPaidAmount;
      const reverseForThisInvoice = Math.min(remainingToReverse, maxReversible);

      const newPaidAmount = invoice.currentPaidAmount - reverseForThisInvoice;
      const newRemainingAmount = invoice.totalCost - newPaidAmount;
      const overpaid = newPaidAmount > invoice.totalCost;

      // Update invoice
      await updateDoc(invoice.ref, {
        paidAmount: newPaidAmount,
        remainingAmount: newRemainingAmount,
        overpaid: overpaid,
      });

      remainingToReverse -= reverseForThisInvoice;
    }

    // If this payment was tied to a cash register, return the amount back
    if (cashRegisterId) {
      await updateCashRegisterBalance(cashRegisterId, paymentAmount);

      // Delete related cash movement expense entries
      try {
        const expensesRef = collection(db, 'expenses');
        const expensesQuery = query(
          expensesRef,
          where('ownerId', '==', ownerId),
          where('refId', '==', paymentId),
          where('kind', '==', 'source_payment')
        );
        const expensesSnapshot = await getDocs(expensesQuery);
        for (const expDoc of expensesSnapshot.docs) {
          await deleteDoc(expDoc.ref);
        }
      } catch (err) {
        console.error('Error deleting related source payment expenses:', err);
      }
    }

    // Delete payment record itself
    await deleteDoc(paymentRef);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting payment:', error);
    return { success: false, error: error.message };
  }
};

export const updatePayment = async (paymentId, newAmount, cashRegisterId = null) => {
  try {
    const { ownerId } = getUserIds();
    if (!ownerId) {
      return { success: false, error: 'Owner ID is required' };
    }

    if (!newAmount || parseFloat(newAmount) <= 0) {
      return { success: false, error: 'Invalid payment amount' };
    }

    // Get payment record
    const paymentRef = doc(db, 'payments', paymentId);
    const paymentSnap = await getDoc(paymentRef);
    
    if (!paymentSnap.exists()) {
      return { success: false, error: 'Payment not found' };
    }

    const paymentData = paymentSnap.data();
    const oldAmount = paymentData.amount || 0;
    const sourceId = paymentData.sourceId;
    const invoiceIds = paymentData.invoiceIds || [];
    const oldCashRegisterId = paymentData.cashRegisterId || null;
    const targetCashRegisterId = cashRegisterId || oldCashRegisterId;

    if (!targetCashRegisterId) {
      return { success: false, error: 'لا توجد عهدة مرتبطة بهذا السداد' };
    }

    const amountDifference = parseFloat(newAmount) - oldAmount;

    if (amountDifference === 0) {
      return { success: true, message: 'No change in amount' };
    }

    // --- Adjust cash register balance (money out) ---
    // If cash register changed: refund old then deduct new
    if (cashRegisterId && oldCashRegisterId && cashRegisterId !== oldCashRegisterId) {
      // Refund old amount to old register
      await updateCashRegisterBalance(oldCashRegisterId, oldAmount);

      // Validate new register balance before deducting full new amount
      const newRegisterRef = doc(db, 'cashRegisters', cashRegisterId);
      const newRegisterSnap = await getDoc(newRegisterRef);
      if (!newRegisterSnap.exists()) {
        return { success: false, error: 'العهدة غير موجودة' };
      }
      const newRegisterBalance = newRegisterSnap.data().balance || 0;
      if (newRegisterBalance < parseFloat(newAmount)) {
        // Rollback refund? (best effort: re-deduct from old to keep consistent)
        await updateCashRegisterBalance(oldCashRegisterId, -oldAmount);
        return { success: false, error: 'الرصيد في العهدة الجديدة غير كافي' };
      }

      await updateCashRegisterBalance(cashRegisterId, -parseFloat(newAmount));
    } else {
      // Same register: apply only the delta
      if (amountDifference > 0) {
        // Need to deduct additional amountDifference
        const regRef = doc(db, 'cashRegisters', targetCashRegisterId);
        const regSnap = await getDoc(regRef);
        if (!regSnap.exists()) {
          return { success: false, error: 'العهدة غير موجودة' };
        }
        const regBalance = regSnap.data().balance || 0;
        if (regBalance < amountDifference) {
          return { success: false, error: 'الرصيد في العهدة غير كافي لتعديل السداد' };
        }
        await updateCashRegisterBalance(targetCashRegisterId, -amountDifference);
      } else {
        // amountDifference < 0 => return money back to register
        await updateCashRegisterBalance(targetCashRegisterId, Math.abs(amountDifference));
      }
    }

    // If decreasing payment, reverse the difference
    if (amountDifference < 0) {
      // Reverse the difference from invoices
      const reverseAmount = Math.abs(amountDifference);
      
      // Get all invoices that were affected
      const invoicesToUpdate = [];
      for (const invoiceId of invoiceIds) {
        try {
          const invoiceRef = doc(db, 'invoices', invoiceId);
          const invoiceSnap = await getDoc(invoiceRef);
          
          if (invoiceSnap.exists()) {
            const invoiceData = invoiceSnap.data();
            invoicesToUpdate.push({
              id: invoiceId,
              ref: invoiceRef,
              currentPaidAmount: invoiceData.paidAmount || 0,
              totalCost: invoiceData.totalCost || 0,
              currentRemaining: invoiceData.remainingAmount || 0,
            });
          }
        } catch (error) {
          console.error(`Error fetching invoice ${invoiceId}:`, error);
        }
      }

      // Sort by remaining amount (descending) - reverse from largest remaining first
      invoicesToUpdate.sort((a, b) => b.currentRemaining - a.currentRemaining);

      let remainingToReverse = reverseAmount;
      for (const invoice of invoicesToUpdate) {
        if (remainingToReverse <= 0) break;

        const maxReversible = invoice.currentPaidAmount;
        const reverseForThisInvoice = Math.min(remainingToReverse, maxReversible);

        const newPaidAmount = invoice.currentPaidAmount - reverseForThisInvoice;
        const newRemainingAmount = invoice.totalCost - newPaidAmount;
        const overpaid = newPaidAmount > invoice.totalCost;

        await updateDoc(invoice.ref, {
          paidAmount: newPaidAmount,
          remainingAmount: newRemainingAmount,
          overpaid: overpaid,
        });

        remainingToReverse -= reverseForThisInvoice;
      }
    } else {
      // If increasing payment, add the difference to invoices
      // Get all invoices for this source
      const invoicesRef = collection(db, 'invoices');
      const invoicesQuery = query(
        invoicesRef,
        where('sourceId', '==', sourceId),
        where('ownerId', '==', ownerId)
      );
      const invoicesSnapshot = await getDocs(invoicesQuery);
      
      // Get all invoices with remaining amount > 0, sorted by remaining amount (descending)
      const invoices = [];
      invoicesSnapshot.forEach((doc) => {
        const data = doc.data();
        const remainingAmount = data.remainingAmount || 0;
        if (remainingAmount > 0) {
          invoices.push({
            id: doc.id,
            ref: doc.ref,
            ...data,
            remainingAmount: remainingAmount,
          });
        }
      });

      // Sort by remaining amount (descending)
      invoices.sort((a, b) => b.remainingAmount - a.remainingAmount);

      // Distribute the additional payment
      let remainingPayment = amountDifference;
      const newInvoiceIds = [];

      for (const invoice of invoices) {
        if (remainingPayment <= 0) break;

        const currentPaidAmount = invoice.paidAmount || 0;
        const totalCost = invoice.totalCost || 0;
        const currentRemaining = invoice.remainingAmount || 0;

        const paymentForThisInvoice = Math.min(remainingPayment, currentRemaining);
        const newPaidAmount = currentPaidAmount + paymentForThisInvoice;
        const newRemainingAmount = totalCost - newPaidAmount;
        const overpaid = newPaidAmount > totalCost;

        await updateDoc(invoice.ref, {
          paidAmount: newPaidAmount,
          remainingAmount: newRemainingAmount,
          overpaid: overpaid,
        });

        if (!newInvoiceIds.includes(invoice.id)) {
          newInvoiceIds.push(invoice.id);
        }

        remainingPayment -= paymentForThisInvoice;
      }

      // Update payment record with new amount and invoiceIds
      const allInvoiceIds = [...new Set([...invoiceIds, ...newInvoiceIds])];
      await updateDoc(paymentRef, {
        amount: parseFloat(newAmount),
        invoiceIds: allInvoiceIds,
        cashRegisterId: targetCashRegisterId,
      });
    }
    
    // Update payment amount if decreasing
    if (amountDifference < 0) {
      await updateDoc(paymentRef, {
        amount: parseFloat(newAmount),
        cashRegisterId: targetCashRegisterId,
      });
    }

    // Update related cash movement record in expenses
    try {
      const expensesRef = collection(db, 'expenses');
      const expensesQuery = query(
        expensesRef,
        where('ownerId', '==', ownerId),
        where('refId', '==', paymentId),
        where('kind', '==', 'source_payment')
      );
      const expensesSnapshot = await getDocs(expensesQuery);

      if (expensesSnapshot.empty) {
        // Backfill if it didn't exist for older data
        await recordCashMovement({
          cashRegisterId: targetCashRegisterId,
          amount: parseFloat(newAmount),
          description: 'سداد للمصدر',
          flow: 'out',
          kind: 'source_payment',
          refId: paymentId,
          refType: 'source_payment',
        });
      } else {
        for (const expDoc of expensesSnapshot.docs) {
          await updateDoc(expDoc.ref, {
            cashRegisterId: targetCashRegisterId,
            amount: parseFloat(newAmount),
            flow: 'out',
            kind: 'source_payment',
            updatedAt: new Date(),
          });
        }
      }
    } catch (err) {
      console.error('Error updating related source payment expenses:', err);
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error updating payment:', error);
    return { success: false, error: error.message };
  }
};

export const returnProduct = async (invoiceId, productIndex) => {
  try {
    const invoiceRef = doc(db, 'invoices', invoiceId);
    const invoiceSnap = await getDoc(invoiceRef);
    
    if (!invoiceSnap.exists()) {
      return { success: false, error: 'Invoice not found' };
    }
    
    const invoiceData = invoiceSnap.data();
    
    if (!invoiceData.products || !invoiceData.products[productIndex]) {
      return { success: false, error: 'Product not found in invoice' };
    }
    
    const product = invoiceData.products[productIndex];
    
    // البحث في كل المخازن حسب code فقط (لأن المنتج قد يكون منقولاً أو مقسماً على مخازن متعددة)
    const productsQuery = query(
      collection(db, 'products'),
      where('code', '==', product.code)
    );
    const productsSnapshot = await getDocs(productsQuery);
    
    // حذف/تحديث الكمية في كل المخازن
    const returnedQuantity = product.quantity || 0;
    let remainingToReturn = returnedQuantity;
    
    for (const productDoc of productsSnapshot.docs) {
      if (remainingToReturn <= 0) break;
      
      const productData = productDoc.data();
      const currentQuantity = productData.quantity || 0;
      const quantityToDeduct = Math.min(remainingToReturn, currentQuantity);
      const newQuantity = currentQuantity - quantityToDeduct;
      
      if (newQuantity <= 0) {
        // Delete product if quantity becomes 0 or less
        await deleteDoc(productDoc.ref);
      } else {
        // Update quantity
        await updateDoc(productDoc.ref, { quantity: newQuantity });
      }
      
      remainingToReturn -= quantityToDeduct;
    }
    
    // Remove product from invoice completely (not just mark as returned)
    const updatedProducts = invoiceData.products.filter((_, index) => index !== productIndex);
    
    // إذا لم يبق أي منتجات، احذف الفاتورة بالكامل
    if (updatedProducts.length === 0) {
      await deleteDoc(invoiceRef);
      return { success: true, deleted: true };
    }
    
    // Recalculate totalCost and totalItems after removing product
    const newTotalItems = updatedProducts.reduce((sum, p) => sum + (p.quantity || 0), 0);
    const newTotalCost = updatedProducts.reduce((sum, p) => sum + ((p.finalPrice || 0) * (p.quantity || 0)), 0);
    
    // Update remaining amount if paid amount exists
    const paidAmount = invoiceData.paidAmount || 0;
    const newRemainingAmount = newTotalCost - paidAmount;
    
    await updateDoc(invoiceRef, {
      products: updatedProducts,
      totalItems: newTotalItems,
      totalCost: newTotalCost,
      remainingAmount: newRemainingAmount,
    });
    
    return { success: true, deleted: false };
  } catch (error) {
    console.error('Error returning product:', error);
    return { success: false, error: error.message };
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

// ==================== Customers ====================

// Add customer
export const addCustomer = async (customerData) => {
  try {
    const { userId, ownerId } = getUserIds();
    const customersRef = collection(db, 'customers');
    const docRef = await addDoc(customersRef, {
      ...customerData,
      // userIds: null = owner only, [] = all users, [userId1, userId2] = specific users
      userIds: customerData.userIds !== undefined ? customerData.userIds : null,
      ownerId: customerData.ownerId || ownerId || userId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return { success: true, id: docRef.id };
  } catch (error) {
    console.error('Error adding customer:', error);
    return { success: false, error: error.message };
  }
};

// Get customers
export const getCustomers = async (userId = null) => {
  try {
    const { ownerId, userId: currentUserId } = getUserIds();
    const customersRef = collection(db, 'customers');
    let q;
    
    // If userId is provided, filter by userId (for backward compatibility)
    if (userId) {
      q = query(customersRef, where('ownerId', '==', ownerId));
    } else {
      // Owner sees all customers for their ownerId
      // Regular users see customers where userIds includes them or userIds is []
      const role = localStorage.getItem('role') ? JSON.parse(localStorage.getItem('role')) : 'user';
      if (role === 'owner') {
        // Owner sees all customers for their ownerId
        q = query(customersRef, where('ownerId', '==', ownerId));
      } else {
        // Regular users: filter in memory after fetching
        q = query(customersRef, where('ownerId', '==', ownerId));
      }
    }
    
    const snapshot = await getDocs(q);
    let customers = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : (doc.data().createdAt || new Date()),
      updatedAt: doc.data().updatedAt?.toDate ? doc.data().updatedAt.toDate() : (doc.data().updatedAt || new Date()),
    }));

    // Filter by userIds for regular users (owner sees all)
    const role = localStorage.getItem('role') ? JSON.parse(localStorage.getItem('role')) : 'user';
    if (role !== 'owner' && currentUserId) {
      customers = customers.filter((customer) => {
        const userIds = customer.userIds;
        // Handle legacy data: if userIds is undefined, treat as owner only
        if (userIds === undefined || userIds === null) return false;
        // [] = all users - regular users can see
        if (Array.isArray(userIds) && userIds.length === 0) return true;
        // [userId1, userId2] = specific users - check if current user is in list
        if (Array.isArray(userIds) && userIds.includes(currentUserId)) return true;
        return false;
      });
    }
    
    return customers;
  } catch (error) {
    console.error('Error getting customers:', error);
    return [];
  }
};

// Subscribe to customers with real-time updates
export const subscribeToCustomers = (callback) => {
  try {
    const { ownerId, userId: currentUserId } = getUserIds();
    const customersRef = collection(db, 'customers');
    
    // Build query based on ownerId
    let q;
    if (ownerId) {
      q = query(customersRef, where('ownerId', '==', ownerId));
    } else if (currentUserId) {
      q = query(customersRef, where('ownerId', '==', currentUserId));
    } else {
      q = customersRef;
    }
    
    return onSnapshot(q, (snapshot) => {
      // Get fresh user IDs on each snapshot (in case they changed)
      const { ownerId: freshOwnerId, userId: freshCurrentUserId } = getUserIds();
      
      let customers = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date()),
        };
      });
      
      // Filter by userIds for regular users (owner sees all)
      const role = localStorage.getItem('role') ? JSON.parse(localStorage.getItem('role')) : 'user';
      if (role !== 'owner' && freshCurrentUserId) {
        customers = customers.filter((customer) => {
          const userIds = customer.userIds;
          // Handle legacy data: if userIds is undefined, treat as owner only
          if (userIds === undefined || userIds === null) return false;
          // [] = all users - regular users can see
          if (Array.isArray(userIds) && userIds.length === 0) return true;
          // [userId1, userId2] = specific users - check if current user is in list
          if (Array.isArray(userIds) && userIds.includes(freshCurrentUserId)) return true;
          return false;
        });
      }
      
      callback(customers);
    }, (error) => {
      console.error('Error subscribing to customers:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error subscribing to customers:', error);
    return () => {};
  }
};

// Subscribe to customer with real-time updates
export const subscribeToCustomer = (customerId, callback) => {
  try {
    const customerRef = doc(db, 'customers', customerId);
    return onSnapshot(customerRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        callback({
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date()),
        });
      } else {
        callback(null);
      }
    }, (error) => {
      console.error('Error subscribing to customer:', error);
      callback(null);
    });
  } catch (error) {
    console.error('Error subscribing to customer:', error);
    return () => {};
  }
};

// Get customer by ID
export const getCustomer = async (customerId) => {
  try {
    const customerRef = doc(db, 'customers', customerId);
    const customerSnap = await getDoc(customerRef);
    
    if (customerSnap.exists()) {
      const data = customerSnap.data();
      return {
        id: customerSnap.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date()),
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting customer:', error);
    return null;
  }
};

// Update customer
export const updateCustomer = async (customerId, customerData) => {
  try {
    const customerRef = doc(db, 'customers', customerId);
    await updateDoc(customerRef, {
      ...customerData,
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
    const customerRef = doc(db, 'customers', customerId);
    await deleteDoc(customerRef);
    return { success: true };
  } catch (error) {
    console.error('Error deleting customer:', error);
    return { success: false, error: error.message };
  }
};

// ==================== Customer Invoices ====================

// Add customer invoice
export const addCustomerInvoice = async (invoiceData) => {
  try {
    const { userId, ownerId } = getUserIds();
    
    // Get customer to check credit limit
    const customer = await getCustomer(invoiceData.customerId);
    if (!customer) {
      return { success: false, error: 'العميل غير موجود' };
    }
    
    // Calculate remaining amount
    const totalCost = invoiceData.totalCost || 0;
    const paidAmount = invoiceData.paidAmount || 0;
    const remainingAmount = totalCost - paidAmount;
    
    // Check if remaining amount exceeds credit limit
    const creditLimit = customer.creditLimit || 0;
    const status = remainingAmount > creditLimit ? 'pending' : 'active';
    
    // If status is active, deduct products from store
    if (status === 'active' && invoiceData.products && invoiceData.products.length > 0) {
      for (const product of invoiceData.products) {
        if (product.storeId && product.code) {
          // Find product in store
          const productsQuery = query(
            collection(db, 'products'),
            where('storeId', '==', product.storeId),
            where('code', '==', product.code)
          );
          const productsSnapshot = await getDocs(productsQuery);
          
          if (!productsSnapshot.empty) {
            const productDoc = productsSnapshot.docs[0];
            const productData = productDoc.data();
            const currentQuantity = productData.quantity || 0;
            const requestedQuantity = product.quantity || 0;
            
            if (currentQuantity >= requestedQuantity) {
              const newQuantity = currentQuantity - requestedQuantity;
              if (newQuantity <= 0) {
                await deleteDoc(productDoc.ref);
              } else {
                await updateDoc(productDoc.ref, { quantity: newQuantity });
              }
            } else {
              return { success: false, error: `الكمية المتاحة غير كافية للمنتج ${product.name}` };
            }
          } else {
            return { success: false, error: `المنتج ${product.name} غير موجود في المخزن` };
          }
        }
      }
    }
    
    // Add invoice - use price from product if available, otherwise use finalPrice
    const invoiceProducts = invoiceData.products.map(p => ({
      ...p,
      finalPrice: p.price || p.finalPrice, // Use user-selected price
    }));
    
    const invoicesRef = collection(db, 'customerInvoices');
    const docRef = await addDoc(invoicesRef, {
      ...invoiceData,
      products: invoiceProducts,
      status,
      remainingAmount,
      userId: invoiceData.userId || userId,
      ownerId: invoiceData.ownerId || ownerId || userId,
      date: invoiceData.date || new Date(),
      createdAt: new Date(),
    });
    
    // Add paid amount to main cash register if invoice is active
    if (status === 'active' && paidAmount > 0) {
      await updateCashRegisterBalance(null, paidAmount); // null = main cash register
    }
    
    return { success: true, id: docRef.id, status };
  } catch (error) {
    console.error('Error adding customer invoice:', error);
    return { success: false, error: error.message };
  }
};

// Subscribe to customer invoices with real-time updates
export const subscribeToCustomerInvoices = (customerId, callback) => {
  try {
    const { ownerId, userId } = getUserIds();
    const invoicesRef = collection(db, 'customerInvoices');
    
    let q;
    if (customerId && ownerId) {
      q = query(
        invoicesRef,
        where('customerId', '==', customerId),
        where('ownerId', '==', ownerId)
      );
    } else if (customerId && userId) {
      q = query(
        invoicesRef,
        where('customerId', '==', customerId),
        where('ownerId', '==', ownerId)
      );
    } else if (ownerId) {
      q = query(invoicesRef, where('ownerId', '==', ownerId));
    } else if (userId) {
      q = query(invoicesRef, where('ownerId', '==', ownerId));
    } else {
      q = invoicesRef;
    }
    
    return onSnapshot(q, (snapshot) => {
      let invoices = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate ? data.date.toDate() : (data.date || new Date()),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
        };
      });
      
      // Sort by date in descending order
      invoices.sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : new Date(a.date);
        const dateB = b.date instanceof Date ? b.date : new Date(b.date);
        return dateB - dateA;
      });
      
      callback(invoices);
    }, (error) => {
      console.error('Error subscribing to customer invoices:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error subscribing to customer invoices:', error);
    return () => {};
  }
};

// Get customer invoices
export const getCustomerInvoices = async (customerId = null) => {
  try {
    const { ownerId, userId } = getUserIds();
    const invoicesRef = collection(db, 'customerInvoices');
    let q;
    
    if (customerId && ownerId) {
      q = query(
        invoicesRef,
        where('customerId', '==', customerId),
        where('ownerId', '==', ownerId)
      );
    } else if (customerId && userId) {
      q = query(
        invoicesRef,
        where('customerId', '==', customerId),
        where('ownerId', '==', ownerId)
      );
    } else if (ownerId) {
      q = query(invoicesRef, where('ownerId', '==', ownerId));
    } else if (userId) {
      q = query(invoicesRef, where('ownerId', '==', ownerId));
    } else {
      q = query(invoicesRef);
    }
    
    const snapshot = await getDocs(q);
    let invoices = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date?.toDate ? data.date.toDate() : (data.date || new Date()),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
      };
    });
    
    // Sort by date in descending order
    invoices.sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : new Date(a.date);
      const dateB = b.date instanceof Date ? b.date : new Date(b.date);
      return dateB - dateA;
    });
    
    return invoices;
  } catch (error) {
    console.error('Error getting customer invoices:', error);
    return [];
  }
};

// Get customer invoice by ID
export const getCustomerInvoice = async (invoiceId) => {
  try {
    const invoiceRef = doc(db, 'customerInvoices', invoiceId);
    const invoiceSnap = await getDoc(invoiceRef);
    
    if (invoiceSnap.exists()) {
      const data = invoiceSnap.data();
      return {
        id: invoiceSnap.id,
        ...data,
        date: data.date?.toDate ? data.date.toDate() : (data.date || new Date()),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
      };
    }
    
    return null;
  } catch (error) {
    console.error('Error getting customer invoice:', error);
    return null;
  }
};

// Get all customer invoices (for all users under owner)
export const getAllCustomerInvoices = async () => {
  try {
    const { ownerId, userId } = getUserIds();
    const role = localStorage.getItem('role') ? JSON.parse(localStorage.getItem('role')) : 'user';
    
    const invoicesRef = collection(db, 'customerInvoices');
    
    // Fetch all invoices for ownerId
    const q = query(
      invoicesRef,
      where('ownerId', '==', ownerId)
    );
    
    const snapshot = await getDocs(q);
    let invoices = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date?.toDate ? data.date.toDate() : (data.date || new Date()),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
      };
    });
    
    // Filter by customerId for regular users (only their customers' invoices)
    if (role !== 'owner') {
      const customers = await getCustomers(userId);
      const customerIds = customers.map(c => c.id);
      
      if (customerIds.length === 0) {
        return [];
      }
      
      invoices = invoices.filter(inv => customerIds.includes(inv.customerId));
    }
    
    // Sort by date in descending order
    invoices.sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : new Date(a.date);
      const dateB = b.date instanceof Date ? b.date : new Date(b.date);
      return dateB - dateA;
    });
    
    return invoices;
  } catch (error) {
    console.error('Error getting all customer invoices:', error);
    return [];
  }
};

// Get today's customer invoices
export const getTodayCustomerInvoices = async () => {
  try {
    const { ownerId, userId } = getUserIds();
    const role = localStorage.getItem('role') ? JSON.parse(localStorage.getItem('role')) : 'user';
    
    // Get start and end of today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    const invoicesRef = collection(db, 'customerInvoices');
    let q;
    
    // Fetch all invoices for ownerId (simpler query to avoid index requirement)
    // Then filter by date and customerId in memory
    q = query(
      invoicesRef,
      where('ownerId', '==', ownerId)
    );
    
    const snapshot = await getDocs(q);
    let invoices = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date?.toDate ? data.date.toDate() : (data.date || new Date()),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
      };
    });
    
    // Filter by date (today only) in memory
    invoices = invoices.filter(inv => {
      const invDate = inv.date instanceof Date ? inv.date : new Date(inv.date);
      return invDate >= today && invDate < tomorrow;
    });
    
    // Filter by customerId for regular users
    if (role !== 'owner') {
      const customers = await getCustomers(userId);
      const customerIds = customers.map(c => c.id);
      
      if (customerIds.length === 0) {
        return [];
      }
      
      invoices = invoices.filter(inv => customerIds.includes(inv.customerId));
    }
    
    // Sort by date in descending order (sort in memory to avoid index requirement)
    invoices.sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : new Date(a.date);
      const dateB = b.date instanceof Date ? b.date : new Date(b.date);
      return dateB - dateA;
    });
    
    return invoices;
  } catch (error) {
    console.error('Error getting today customer invoices:', error);
    return [];
  }
};

// Get today's total sales (cash) from active customer invoices only
export const getTodayTotalSales = async () => {
  try {
    const invoices = await getTodayCustomerInvoices();
    return invoices
      .filter((inv) => inv.status === 'active')
      .reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
  } catch (error) {
    console.error('Error getting today total sales:', error);
    return 0;
  }
};

// Get today's total profit (owner only) from active customer invoices only
export const getTodayTotalProfit = async () => {
  try {
    const role = localStorage.getItem('role') ? JSON.parse(localStorage.getItem('role')) : 'user';
    if (role !== 'owner') return 0;

    const invoices = await getTodayCustomerInvoices();
    const activeInvoices = invoices.filter((inv) => inv.status === 'active');

    const totalProfit = activeInvoices.reduce((invoiceSum, inv) => {
      const products = inv.products || [];
      const invoiceProfit = products.reduce((sum, p) => {
        const salePrice = p.finalPrice ?? p.price ?? 0;
        const costPrice = p.wholesalePrice ?? 0;
        const qty = p.quantity ?? 0;
        return sum + (salePrice - costPrice) * qty;
      }, 0);
      return invoiceSum + invoiceProfit;
    }, 0);

    return totalProfit;
  } catch (error) {
    console.error('Error getting today total profit:', error);
    return 0;
  }
};

// Get total sales (cash) from active customer invoices
export const getTotalSales = async () => {
  try {
    const { ownerId, userId } = getUserIds();
    const role = localStorage.getItem('role') ? JSON.parse(localStorage.getItem('role')) : 'user';
    
    let invoices;
    if (role === 'owner') {
      // Owner: get all customer invoices
      invoices = await getCustomerInvoices();
    } else {
      // Regular user: get customers for this user first
      const customers = await getCustomers(userId);
      const customerIds = customers.map(c => c.id);
      
      if (customerIds.length === 0) {
        return 0;
      }
      
      // Get all invoices and filter by customerIds
      invoices = await getCustomerInvoices();
      invoices = invoices.filter(inv => customerIds.includes(inv.customerId));
    }
    
    // Sum paidAmount from active invoices only
    const totalSales = invoices
      .filter(inv => inv.status === 'active')
      .reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    
    return totalSales;
  } catch (error) {
    console.error('Error getting total sales:', error);
    return 0;
  }
};

// Add customer payment
export const addCustomerPayment = async (customerId, paymentAmount, cashRegisterId) => {
  try {
    const { userId, ownerId } = getUserIds();

    if (!cashRegisterId) {
      return { success: false, error: 'يجب اختيار العهدة للتحصيل' };
    }

    // Validate cash register exists
    const cashRegisterRef = doc(db, 'cashRegisters', cashRegisterId);
    const cashRegisterSnap = await getDoc(cashRegisterRef);
    if (!cashRegisterSnap.exists()) {
      return { success: false, error: 'العهدة غير موجودة' };
    }
    
    // Get all invoices for this customer
    const invoicesRef = collection(db, 'customerInvoices');
    const invoicesQuery = query(
      invoicesRef,
      where('customerId', '==', customerId),
      where('ownerId', '==', ownerId)
    );
    const invoicesSnapshot = await getDocs(invoicesQuery);
    
    if (invoicesSnapshot.empty) {
      return { success: false, error: 'لا توجد فواتير لهذا العميل' };
    }

    // Get all invoices with remaining amount > 0, sorted by remaining amount (descending)
    const invoices = [];
    invoicesSnapshot.forEach((doc) => {
      const data = doc.data();
      const remainingAmount = data.remainingAmount || 0;
      if (remainingAmount > 0 && data.status !== 'returned') {
        invoices.push({
          id: doc.id,
          ref: doc.ref,
          ...data,
          remainingAmount: remainingAmount,
        });
      }
    });

    // Sort by remaining amount (descending) - pay largest remaining first
    invoices.sort((a, b) => b.remainingAmount - a.remainingAmount);

    if (invoices.length === 0) {
      return { success: false, error: 'لا توجد فواتير بمتبقي' };
    }

    // Get customer to check credit limit
    const customer = await getCustomer(customerId);
    const creditLimit = customer?.creditLimit || 0;

    // Distribute payment across invoices
    let remainingPayment = paymentAmount;
    const updatedInvoices = [];

    for (const invoice of invoices) {
      if (remainingPayment <= 0) break;

      const currentPaidAmount = invoice.paidAmount || 0;
      const totalCost = invoice.totalCost || 0;
      const currentRemaining = invoice.remainingAmount || 0;

      // Calculate how much to pay for this invoice
      const paymentForThisInvoice = Math.min(remainingPayment, currentRemaining);
      const newPaidAmount = currentPaidAmount + paymentForThisInvoice;
      const newRemainingAmount = totalCost - newPaidAmount;

      // Check if status should change from pending to active
      let newStatus = invoice.status;
      if (newStatus === 'pending' && newRemainingAmount <= creditLimit) {
        newStatus = 'active';
        // Apply invoice to store (deduct products)
        if (invoice.products && invoice.products.length > 0) {
          for (const product of invoice.products) {
            if (product.storeId && product.code) {
              const productsQuery = query(
                collection(db, 'products'),
                where('storeId', '==', product.storeId),
                where('code', '==', product.code)
              );
              const productsSnapshot = await getDocs(productsQuery);
              
              if (!productsSnapshot.empty) {
                const productDoc = productsSnapshot.docs[0];
                const productData = productDoc.data();
                const currentQuantity = productData.quantity || 0;
                const requestedQuantity = product.quantity || 0;
                
                if (currentQuantity >= requestedQuantity) {
                  const newQuantity = currentQuantity - requestedQuantity;
                  if (newQuantity <= 0) {
                    await deleteDoc(productDoc.ref);
                  } else {
                    await updateDoc(productDoc.ref, { quantity: newQuantity });
                  }
                }
              }
            }
          }
        }
      }

      // Update invoice
      await updateDoc(invoice.ref, {
        paidAmount: newPaidAmount,
        remainingAmount: newRemainingAmount,
        status: newStatus,
      });

      updatedInvoices.push({
        invoiceId: invoice.id,
        paidAmount: newPaidAmount,
        remainingAmount: newRemainingAmount,
        status: newStatus,
      });

      remainingPayment -= paymentForThisInvoice;
    }

    // Save payment record in customerPayments collection (linked to customerId, not invoiceId)
    const paymentsRef = collection(db, 'customerPayments');
    const paymentDocRef = await addDoc(paymentsRef, {
      customerId: customerId,
      amount: paymentAmount,
      cashRegisterId,
      userId: userId,
      ownerId: ownerId || userId,
      date: new Date(),
      createdAt: new Date(),
      invoiceIds: updatedInvoices.map(inv => inv.invoiceId), // Track which invoices were affected
    });
    
    // Add payment amount to selected cash register (money in)
    await updateCashRegisterBalance(cashRegisterId, paymentAmount);

    // Note: Customer payments are NOT recorded in expenses (only source payments are)
    
    return { 
      success: true, 
      updatedInvoices: updatedInvoices,
      remainingPayment: remainingPayment > 0 ? remainingPayment : 0 // If payment was more than total remaining
    };
  } catch (error) {
    console.error('Error adding customer payment:', error);
    return { success: false, error: error.message };
  }
};

// Return customer invoice (full return)
export const returnCustomerInvoice = async (invoiceId) => {
  try {
    const invoiceRef = doc(db, 'customerInvoices', invoiceId);
    const invoiceSnap = await getDoc(invoiceRef);
    
    if (!invoiceSnap.exists()) {
      return { success: false, error: 'الفاتورة غير موجودة' };
    }
    
    const invoiceData = invoiceSnap.data();
    
    // Return products to store if invoice was active
    if (invoiceData.status === 'active' && invoiceData.products && invoiceData.products.length > 0) {
      for (const product of invoiceData.products) {
        if (product.storeId && product.code) {
          const productsQuery = query(
            collection(db, 'products'),
            where('storeId', '==', product.storeId),
            where('code', '==', product.code)
          );
          const productsSnapshot = await getDocs(productsQuery);
          
          if (!productsSnapshot.empty) {
            const productDoc = productsSnapshot.docs[0];
            const productData = productDoc.data();
            const currentQuantity = productData.quantity || 0;
            const returnedQuantity = product.quantity || 0;
            await updateDoc(productDoc.ref, { quantity: currentQuantity + returnedQuantity });
          } else {
            // Product doesn't exist, create it
            await addProduct({
              code: product.code,
              productName: product.name,
              wholesalePrice: product.wholesalePrice,
              sellPrice: product.sellPrice,
              finalPrice: product.finalPrice,
              quantity: product.quantity,
              category: product.category,
              storeId: product.storeId,
            });
          }
        }
      }
    }
    
    // في حالة المرتجع الكامل، جميع المنتجات تم إرجاعها للمخزن
    // إذا كانت الفاتورة فارغة تماماً، احذفها
    if (!invoiceData.products || invoiceData.products.length === 0) {
      await deleteDoc(invoiceRef);
      return { success: true, deleted: true };
    }
    
    // Mark invoice as returned
    await updateDoc(invoiceRef, {
      status: 'returned',
      returnedAt: new Date(),
    });
    
    return { success: true, deleted: false };
  } catch (error) {
    console.error('Error returning customer invoice:', error);
    return { success: false, error: error.message };
  }
};

// Update customer invoice
export const updateCustomerInvoice = async (invoiceId, invoiceData) => {
  try {
    const { userId, ownerId } = getUserIds();
    
    const invoiceRef = doc(db, 'customerInvoices', invoiceId);
    const invoiceSnap = await getDoc(invoiceRef);
    
    if (!invoiceSnap.exists()) {
      return { success: false, error: 'الفاتورة غير موجودة' };
    }
    
    const existingInvoice = invoiceSnap.data();
    
    // Get customer to check credit limit
    const customer = await getCustomer(invoiceData.customerId || existingInvoice.customerId);
    if (!customer) {
      return { success: false, error: 'العميل غير موجود' };
    }
    
    // Calculate remaining amount
    const totalCost = invoiceData.totalCost || existingInvoice.totalCost || 0;
    const paidAmount = invoiceData.paidAmount !== undefined ? invoiceData.paidAmount : existingInvoice.paidAmount || 0;
    const remainingAmount = totalCost - paidAmount;
    
    // Check if remaining amount exceeds credit limit
    const creditLimit = customer.creditLimit || 0;
    const status = remainingAmount > creditLimit ? 'pending' : 'active';
    
    // Handle product quantity changes
    if (invoiceData.products && invoiceData.products.length > 0) {
      // If invoice was active, return old products to store
      if (existingInvoice.status === 'active' && existingInvoice.products) {
        for (const product of existingInvoice.products) {
          if (product.storeId && product.code) {
            const productsQuery = query(
              collection(db, 'products'),
              where('storeId', '==', product.storeId),
              where('code', '==', product.code)
            );
            const productsSnapshot = await getDocs(productsQuery);
            
            if (!productsSnapshot.empty) {
              const productDoc = productsSnapshot.docs[0];
              const productData = productDoc.data();
              const currentQuantity = productData.quantity || 0;
              const returnedQuantity = product.quantity || 0;
              await updateDoc(productDoc.ref, { quantity: currentQuantity + returnedQuantity });
            }
          }
        }
      }
      
      // If new status is active, deduct new products from store
      if (status === 'active') {
        for (const product of invoiceData.products) {
          if (product.storeId && product.code) {
            const productsQuery = query(
              collection(db, 'products'),
              where('storeId', '==', product.storeId),
              where('code', '==', product.code)
            );
            const productsSnapshot = await getDocs(productsQuery);
            
            if (!productsSnapshot.empty) {
              const productDoc = productsSnapshot.docs[0];
              const productData = productDoc.data();
              const currentQuantity = productData.quantity || 0;
              const requestedQuantity = product.quantity || 0;
              
              if (currentQuantity >= requestedQuantity) {
                const newQuantity = currentQuantity - requestedQuantity;
                if (newQuantity <= 0) {
                  await deleteDoc(productDoc.ref);
                } else {
                  await updateDoc(productDoc.ref, { quantity: newQuantity });
                }
              } else {
                return { success: false, error: `الكمية المتاحة غير كافية للمنتج ${product.name}` };
              }
            } else {
              return { success: false, error: `المنتج ${product.name} غير موجود في المخزن` };
            }
          }
        }
      }
    }
    
    // Prepare products with price
    const invoiceProducts = invoiceData.products 
      ? invoiceData.products.map(p => ({
          ...p,
          finalPrice: p.price || p.finalPrice,
        }))
      : existingInvoice.products;
    
    // Update invoice
    await updateDoc(invoiceRef, {
      ...invoiceData,
      products: invoiceProducts,
      status,
      remainingAmount,
      totalCost: invoiceData.totalCost !== undefined ? invoiceData.totalCost : existingInvoice.totalCost,
      totalItems: invoiceData.totalItems !== undefined ? invoiceData.totalItems : existingInvoice.totalItems,
      paidAmount,
      updatedAt: new Date(),
    });
    
    return { success: true, status };
  } catch (error) {
    console.error('Error updating customer invoice:', error);
    return { success: false, error: error.message };
  }
};

// Return customer invoice product (partial return)
export const returnCustomerInvoiceProduct = async (invoiceId, productIndex) => {
  try {
    const invoiceRef = doc(db, 'customerInvoices', invoiceId);
    const invoiceSnap = await getDoc(invoiceRef);
    
    if (!invoiceSnap.exists()) {
      return { success: false, error: 'الفاتورة غير موجودة' };
    }
    
    const invoiceData = invoiceSnap.data();
    const products = invoiceData.products || [];
    
    if (productIndex < 0 || productIndex >= products.length) {
      return { success: false, error: 'المنتج غير موجود في الفاتورة' };
    }
    
    const product = products[productIndex];
    
    // Return product to store if invoice was active
    if (invoiceData.status === 'active' && product.storeId && product.code) {
      const productsQuery = query(
        collection(db, 'products'),
        where('storeId', '==', product.storeId),
        where('code', '==', product.code)
      );
      const productsSnapshot = await getDocs(productsQuery);
      
      if (!productsSnapshot.empty) {
        const productDoc = productsSnapshot.docs[0];
        const productData = productDoc.data();
        const currentQuantity = productData.quantity || 0;
        const returnedQuantity = product.quantity || 0;
        await updateDoc(productDoc.ref, { quantity: currentQuantity + returnedQuantity });
      } else {
        // Product doesn't exist, create it
        await addProduct({
          code: product.code,
          productName: product.name,
          wholesalePrice: product.wholesalePrice,
          sellPrice: product.sellPrice,
          finalPrice: product.finalPrice,
          quantity: product.quantity,
          category: product.category,
          storeId: product.storeId,
        });
      }
    }
    
    // Remove product from invoice
    const updatedProducts = products.filter((_, i) => i !== productIndex);
    
    // إذا لم يبق أي منتجات، احذف الفاتورة بالكامل
    if (updatedProducts.length === 0) {
      await deleteDoc(invoiceRef);
      return { success: true, deleted: true };
    }
    
    // تحديث الفاتورة بالمنتجات المتبقية
    const totalItems = updatedProducts.reduce((sum, p) => sum + (p.quantity || 0), 0);
    const totalCost = updatedProducts.reduce((sum, p) => sum + ((p.finalPrice || p.price || 0) * (p.quantity || 0)), 0);
    const remainingAmount = totalCost - (invoiceData.paidAmount || 0);
    
    // Update invoice
    await updateDoc(invoiceRef, {
      products: updatedProducts,
      totalItems,
      totalCost,
      remainingAmount,
    });
    
    return { success: true, deleted: false };
  } catch (error) {
    console.error('Error returning customer invoice product:', error);
    return { success: false, error: error.message };
  }
};

// Get customer payments
export const getCustomerPayments = async (customerId) => {
  try {
    const { ownerId } = getUserIds();
    const paymentsRef = collection(db, 'customerPayments');
    const q = query(
      paymentsRef,
      where('customerId', '==', customerId),
      where('ownerId', '==', ownerId)
    );
    
    const snapshot = await getDocs(q);
    let payments = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date?.toDate ? data.date.toDate() : (data.date || new Date()),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
      };
    });
    
    // Sort by date in descending order
    payments.sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : new Date(a.date);
      const dateB = b.date instanceof Date ? b.date : new Date(b.date);
      return dateB - dateA;
    });
    
    return payments;
  } catch (error) {
    console.error('Error getting customer payments:', error);
    return [];
  }
};

// Subscribe to customer payments with real-time updates
export const subscribeToCustomerPayments = (customerId, callback) => {
  try {
    const { ownerId } = getUserIds();
    const paymentsRef = collection(db, 'customerPayments');
    const q = query(
      paymentsRef,
      where('customerId', '==', customerId),
      where('ownerId', '==', ownerId)
    );
    
    return onSnapshot(q, (snapshot) => {
      let payments = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate ? data.date.toDate() : (data.date || new Date()),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
        };
      });
      
      // Sort by date in descending order
      payments.sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : new Date(a.date);
        const dateB = b.date instanceof Date ? b.date : new Date(b.date);
        return dateB - dateA;
      });
      
      callback(payments);
    }, (error) => {
      console.error('Error subscribing to customer payments:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error subscribing to customer payments:', error);
    return () => {};
  }
};

// Delete customer payment
export const deleteCustomerPayment = async (paymentId) => {
  try {
    const { ownerId } = getUserIds();
    const paymentRef = doc(db, 'customerPayments', paymentId);
    const paymentSnap = await getDoc(paymentRef);
    
    if (!paymentSnap.exists()) {
      return { success: false, error: 'السداد غير موجود' };
    }
    
    const paymentData = paymentSnap.data();
    
    // Verify ownership
    if (paymentData.ownerId !== ownerId) {
      return { success: false, error: 'غير مصرح لك بحذف هذا السداد' };
    }
    
    const customerId = paymentData.customerId;
    const paymentAmount = paymentData.amount || 0;
    const invoiceIds = paymentData.invoiceIds || [];
    const cashRegisterId = paymentData.cashRegisterId || null;
    
    // Reverse the payment: subtract from invoices
    const customer = await getCustomer(customerId);
    const creditLimit = customer?.creditLimit || 0;
    
    let remainingToReverse = paymentAmount;
    
    // Process invoices in reverse order (last paid first)
    for (let i = invoiceIds.length - 1; i >= 0; i--) {
      if (remainingToReverse <= 0) break;
      
      const invoiceId = invoiceIds[i];
      const invoiceRef = doc(db, 'customerInvoices', invoiceId);
      const invoiceSnap = await getDoc(invoiceRef);
      
      if (!invoiceSnap.exists()) continue;
      
      const invoiceData = invoiceSnap.data();
      const currentPaidAmount = invoiceData.paidAmount || 0;
      const totalCost = invoiceData.totalCost || 0;
      
      // Calculate how much to reverse from this invoice
      const paidForThisInvoice = Math.min(remainingToReverse, currentPaidAmount);
      const newPaidAmount = currentPaidAmount - paidForThisInvoice;
      const newRemainingAmount = totalCost - newPaidAmount;
      
      // Check if status should change from active to pending
      let newStatus = invoiceData.status;
      if (newStatus === 'active' && newRemainingAmount > creditLimit) {
        newStatus = 'pending';
        // Return products to store
        if (invoiceData.products && invoiceData.products.length > 0) {
          for (const product of invoiceData.products) {
            if (product.storeId && product.code) {
              const productsQuery = query(
                collection(db, 'products'),
                where('storeId', '==', product.storeId),
                where('code', '==', product.code)
              );
              const productsSnapshot = await getDocs(productsQuery);
              
              if (!productsSnapshot.empty) {
                const productDoc = productsSnapshot.docs[0];
                const productData = productDoc.data();
                const currentQuantity = productData.quantity || 0;
                const returnedQuantity = product.quantity || 0;
                await updateDoc(productDoc.ref, { quantity: currentQuantity + returnedQuantity });
              } else {
                // Product doesn't exist, create it
                await addProduct({
                  code: product.code,
                  productName: product.name,
                  wholesalePrice: product.wholesalePrice,
                  sellPrice: product.sellPrice,
                  finalPrice: product.finalPrice,
                  quantity: product.quantity,
                  category: product.category,
                  storeId: product.storeId,
                });
              }
            }
          }
        }
      }
      
      await updateDoc(invoiceRef, {
        paidAmount: newPaidAmount,
        remainingAmount: newRemainingAmount,
        status: newStatus,
      });
      
      remainingToReverse -= paidForThisInvoice;
    }
    
    // Remove payment amount from selected cash register (money out of the register because we are undoing inflow)
    if (cashRegisterId) {
      const regRef = doc(db, 'cashRegisters', cashRegisterId);
      const regSnap = await getDoc(regRef);
      if (!regSnap.exists()) {
        return { success: false, error: 'العهدة غير موجودة' };
      }
      const regBalance = regSnap.data().balance || 0;
      if (regBalance < paymentAmount) {
        return { success: false, error: 'الرصيد في العهدة غير كافي لحذف هذا التحصيل' };
      }
      await updateCashRegisterBalance(cashRegisterId, -paymentAmount);

      // Note: Customer payments are NOT recorded in expenses, so no need to delete expense entries
    }
    
    // Delete payment record
    await deleteDoc(paymentRef);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting customer payment:', error);
    return { success: false, error: error.message };
  }
};

// Update customer payment
export const updateCustomerPayment = async (paymentId, newAmount, cashRegisterId = null) => {
  try {
    const { ownerId } = getUserIds();
    const paymentRef = doc(db, 'customerPayments', paymentId);
    const paymentSnap = await getDoc(paymentRef);
    
    if (!paymentSnap.exists()) {
      return { success: false, error: 'السداد غير موجود' };
    }
    
    const paymentData = paymentSnap.data();
    
    // Verify ownership
    if (paymentData.ownerId !== ownerId) {
      return { success: false, error: 'غير مصرح لك بتعديل هذا السداد' };
    }
    
    const customerId = paymentData.customerId;
    const oldAmount = paymentData.amount || 0;
    const invoiceIds = paymentData.invoiceIds || [];
    const amountDifference = newAmount - oldAmount;
    const oldCashRegisterId = paymentData.cashRegisterId || null;
    const targetCashRegisterId = cashRegisterId || oldCashRegisterId;

    if (!targetCashRegisterId) {
      return { success: false, error: 'لا توجد عهدة مرتبطة بهذا التحصيل' };
    }
    
    if (amountDifference === 0) {
      // No change, just update the amount
      await updateDoc(paymentRef, { amount: newAmount, cashRegisterId: targetCashRegisterId });
      return { success: true };
    }
    
    const customer = await getCustomer(customerId);
    const creditLimit = customer?.creditLimit || 0;

    // --- Adjust cash register balance (money in) ---
    // If cash register changed: remove old from old register, add new to new register
    if (cashRegisterId && oldCashRegisterId && cashRegisterId !== oldCashRegisterId) {
      // Ensure old register has enough balance to remove oldAmount
      const oldRegRef = doc(db, 'cashRegisters', oldCashRegisterId);
      const oldRegSnap = await getDoc(oldRegRef);
      if (!oldRegSnap.exists()) {
        return { success: false, error: 'العهدة القديمة غير موجودة' };
      }
      const oldRegBalance = oldRegSnap.data().balance || 0;
      if (oldRegBalance < oldAmount) {
        return { success: false, error: 'الرصيد في العهدة القديمة غير كافي لتغيير العهدة' };
      }

      await updateCashRegisterBalance(oldCashRegisterId, -oldAmount);
      await updateCashRegisterBalance(cashRegisterId, newAmount);
    } else {
      // Same register: apply delta
      if (amountDifference > 0) {
        await updateCashRegisterBalance(targetCashRegisterId, amountDifference);
      } else {
        // Need to remove money from register (undo inflow)
        const regRef = doc(db, 'cashRegisters', targetCashRegisterId);
        const regSnap = await getDoc(regRef);
        if (!regSnap.exists()) {
          return { success: false, error: 'العهدة غير موجودة' };
        }
        const regBalance = regSnap.data().balance || 0;
        if (regBalance < Math.abs(amountDifference)) {
          return { success: false, error: 'الرصيد في العهدة غير كافي لتعديل التحصيل' };
        }
        await updateCashRegisterBalance(targetCashRegisterId, amountDifference); // negative
      }
    }
    
    if (amountDifference > 0) {
      // Increasing payment: apply additional amount to invoices
      let remainingToApply = amountDifference;
      
      // Get all invoices with remaining amount > 0, sorted by remaining amount (descending)
      const invoicesRef = collection(db, 'customerInvoices');
      const invoicesQuery = query(
        invoicesRef,
        where('customerId', '==', customerId),
        where('ownerId', '==', ownerId)
      );
      const invoicesSnapshot = await getDocs(invoicesQuery);
      
      const invoices = [];
      invoicesSnapshot.forEach((doc) => {
        const data = doc.data();
        const remainingAmount = data.remainingAmount || 0;
        if (remainingAmount > 0 && data.status !== 'returned') {
          invoices.push({
            id: doc.id,
            ref: doc.ref,
            ...data,
            remainingAmount: remainingAmount,
          });
        }
      });
      
      invoices.sort((a, b) => b.remainingAmount - a.remainingAmount);
      
      for (const invoice of invoices) {
        if (remainingToApply <= 0) break;
        
        const currentPaidAmount = invoice.paidAmount || 0;
        const totalCost = invoice.totalCost || 0;
        const currentRemaining = invoice.remainingAmount || 0;
        
        const paymentForThisInvoice = Math.min(remainingToApply, currentRemaining);
        const newPaidAmount = currentPaidAmount + paymentForThisInvoice;
        const newRemainingAmount = totalCost - newPaidAmount;
        
        let newStatus = invoice.status;
        if (newStatus === 'pending' && newRemainingAmount <= creditLimit) {
          newStatus = 'active';
          // Apply invoice to store
          if (invoice.products && invoice.products.length > 0) {
            for (const product of invoice.products) {
              if (product.storeId && product.code) {
                const productsQuery = query(
                  collection(db, 'products'),
                  where('storeId', '==', product.storeId),
                  where('code', '==', product.code)
                );
                const productsSnapshot = await getDocs(productsQuery);
                
                if (!productsSnapshot.empty) {
                  const productDoc = productsSnapshot.docs[0];
                  const productData = productDoc.data();
                  const currentQuantity = productData.quantity || 0;
                  const requestedQuantity = product.quantity || 0;
                  
                  if (currentQuantity >= requestedQuantity) {
                    const newQuantity = currentQuantity - requestedQuantity;
                    if (newQuantity <= 0) {
                      await deleteDoc(productDoc.ref);
                    } else {
                      await updateDoc(productDoc.ref, { quantity: newQuantity });
                    }
                  }
                }
              }
            }
          }
        }
        
        await updateDoc(invoice.ref, {
          paidAmount: newPaidAmount,
          remainingAmount: newRemainingAmount,
          status: newStatus,
        });
        
        remainingToApply -= paymentForThisInvoice;
      }
      
    } else {
      // Decreasing payment: reverse the difference
      let remainingToReverse = Math.abs(amountDifference);
      
      // Process invoices in reverse order
      for (let i = invoiceIds.length - 1; i >= 0; i--) {
        if (remainingToReverse <= 0) break;
        
        const invoiceId = invoiceIds[i];
        const invoiceRef = doc(db, 'customerInvoices', invoiceId);
        const invoiceSnap = await getDoc(invoiceRef);
        
        if (!invoiceSnap.exists()) continue;
        
        const invoiceData = invoiceSnap.data();
        const currentPaidAmount = invoiceData.paidAmount || 0;
        const totalCost = invoiceData.totalCost || 0;
        
        const paidForThisInvoice = Math.min(remainingToReverse, currentPaidAmount);
        const newPaidAmount = currentPaidAmount - paidForThisInvoice;
        const newRemainingAmount = totalCost - newPaidAmount;
        
        let newStatus = invoiceData.status;
        if (newStatus === 'active' && newRemainingAmount > creditLimit) {
          newStatus = 'pending';
          // Return products to store
          if (invoiceData.products && invoiceData.products.length > 0) {
            for (const product of invoiceData.products) {
              if (product.storeId && product.code) {
                const productsQuery = query(
                  collection(db, 'products'),
                  where('storeId', '==', product.storeId),
                  where('code', '==', product.code)
                );
                const productsSnapshot = await getDocs(productsQuery);
                
                if (!productsSnapshot.empty) {
                  const productDoc = productsSnapshot.docs[0];
                  const productData = productDoc.data();
                  const currentQuantity = productData.quantity || 0;
                  const returnedQuantity = product.quantity || 0;
                  await updateDoc(productDoc.ref, { quantity: currentQuantity + returnedQuantity });
                } else {
                  await addProduct({
                    code: product.code,
                    productName: product.name,
                    wholesalePrice: product.wholesalePrice,
                    sellPrice: product.sellPrice,
                    finalPrice: product.finalPrice,
                    quantity: product.quantity,
                    category: product.category,
                    storeId: product.storeId,
                  });
                }
              }
            }
          }
        }
        
        await updateDoc(invoiceRef, {
          paidAmount: newPaidAmount,
          remainingAmount: newRemainingAmount,
          status: newStatus,
        });
        
        remainingToReverse -= paidForThisInvoice;
      }
      
    }
    
    // Update payment record
    await updateDoc(paymentRef, { amount: newAmount, cashRegisterId: targetCashRegisterId });

    // Note: Customer payments are NOT recorded in expenses (only source payments are)
    
    return { success: true };
  } catch (error) {
    console.error('Error updating customer payment:', error);
    return { success: false, error: error.message };
  }
};

// ==================== Cash Registers ====================

// Get or create main cash register (for owner)
const getOrCreateMainCashRegister = async () => {
  try {
    const { ownerId } = getUserIds();
    const cashRegistersRef = collection(db, 'cashRegisters');
    
    // Check if main cash register exists (userId = null)
    const q = query(
      cashRegistersRef,
      where('ownerId', '==', ownerId),
      where('userId', '==', null)
    );
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : (doc.data().createdAt || new Date()),
        updatedAt: doc.data().updatedAt?.toDate ? doc.data().updatedAt.toDate() : (doc.data().updatedAt || new Date()),
      };
    }
    
    // Create main cash register if it doesn't exist
    const docRef = await addDoc(cashRegistersRef, {
      userId: null,
      ownerId,
      balance: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    return {
      id: docRef.id,
      userId: null,
      ownerId,
      balance: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  } catch (error) {
    console.error('Error getting/creating main cash register:', error);
    return null;
  }
};

// Get or create cash register for a user
const getOrCreateUserCashRegister = async (userId) => {
  try {
    const { ownerId } = getUserIds();
    const cashRegistersRef = collection(db, 'cashRegisters');
    
    // Check if user cash register exists
    const q = query(
      cashRegistersRef,
      where('ownerId', '==', ownerId),
      where('userId', '==', userId)
    );
    const snapshot = await getDocs(q);
    
    if (!snapshot.empty) {
      const doc = snapshot.docs[0];
      return {
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate ? doc.data().createdAt.toDate() : (doc.data().createdAt || new Date()),
        updatedAt: doc.data().updatedAt?.toDate ? doc.data().updatedAt.toDate() : (doc.data().updatedAt || new Date()),
      };
    }
    
    // Create user cash register if it doesn't exist
    const docRef = await addDoc(cashRegistersRef, {
      userId,
      ownerId,
      balance: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    return {
      id: docRef.id,
      userId,
      ownerId,
      balance: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  } catch (error) {
    console.error('Error getting/creating user cash register:', error);
    return null;
  }
};

// Get all cash registers
export const getCashRegisters = async () => {
  try {
    const { ownerId } = getUserIds();
    const cashRegistersRef = collection(db, 'cashRegisters');
    const q = query(cashRegistersRef, where('ownerId', '==', ownerId));
    const snapshot = await getDocs(q);
    
    const registers = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
        updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date()),
      };
    });
    
    // Remove duplicates: if there are multiple main cash registers (userId = null), keep only the first one
    const mainRegisters = registers.filter(r => r.userId === null);
    const userRegisters = registers.filter(r => r.userId !== null);
    
    // If there are multiple main registers, keep the first one and delete the rest
    if (mainRegisters.length > 1) {
      const firstMainRegister = mainRegisters[0];
      // Merge balances if needed
      const totalBalance = mainRegisters.reduce((sum, r) => sum + (r.balance || 0), 0);
      
      // Update the first main register with total balance
      if (totalBalance !== firstMainRegister.balance) {
        const firstMainRef = doc(db, 'cashRegisters', firstMainRegister.id);
        await updateDoc(firstMainRef, {
          balance: totalBalance,
          updatedAt: new Date(),
        });
        firstMainRegister.balance = totalBalance;
      }
      
      // Delete duplicate main registers
      for (let i = 1; i < mainRegisters.length; i++) {
        const duplicateRef = doc(db, 'cashRegisters', mainRegisters[i].id);
        await deleteDoc(duplicateRef);
      }
      
      return [firstMainRegister, ...userRegisters];
    }
    
    return registers;
  } catch (error) {
    console.error('Error getting cash registers:', error);
    return [];
  }
};

// Get cash register by userId (null for main)
export const getCashRegister = async (userId = null) => {
  try {
    if (userId === null) {
      return await getOrCreateMainCashRegister();
    } else {
      return await getOrCreateUserCashRegister(userId);
    }
  } catch (error) {
    console.error('Error getting cash register:', error);
    return null;
  }
};

// Update cash register balance
export const updateCashRegisterBalance = async (cashRegisterId, amount) => {
  try {
    if (!cashRegisterId) {
      // If no ID provided, get or create main cash register
      const mainRegister = await getOrCreateMainCashRegister();
      if (!mainRegister) {
        return { success: false, error: 'فشل في الحصول على العهدة الرئيسية' };
      }
      cashRegisterId = mainRegister.id;
    }
    
    const cashRegisterRef = doc(db, 'cashRegisters', cashRegisterId);
    const cashRegisterSnap = await getDoc(cashRegisterRef);
    
    if (!cashRegisterSnap.exists()) {
      return { success: false, error: 'العهدة غير موجودة' };
    }
    
    const currentBalance = cashRegisterSnap.data().balance || 0;
    const newBalance = currentBalance + amount;
    
    await updateDoc(cashRegisterRef, {
      balance: newBalance,
      updatedAt: new Date(),
    });
    
    return { success: true, newBalance };
  } catch (error) {
    console.error('Error updating cash register balance:', error);
    return { success: false, error: error.message };
  }
};

// Add cash transfer
export const addCashTransfer = async (fromCashRegisterId, toCashRegisterId, amount, description = '') => {
  try {
    const { userId, ownerId } = getUserIds();
    
    // Validate amount
    if (!amount || amount <= 0) {
      return { success: false, error: 'المبلغ يجب أن يكون أكبر من صفر' };
    }
    
    // Get from cash register
    const fromRef = doc(db, 'cashRegisters', fromCashRegisterId);
    const fromSnap = await getDoc(fromRef);
    
    if (!fromSnap.exists()) {
      return { success: false, error: 'العهدة المصدر غير موجودة' };
    }
    
    const fromBalance = fromSnap.data().balance || 0;
    
    // Check if balance is sufficient
    if (fromBalance < amount) {
      return { success: false, error: 'الرصيد غير كافي' };
    }
    
    // Get to cash register
    const toRef = doc(db, 'cashRegisters', toCashRegisterId);
    const toSnap = await getDoc(toRef);
    
    if (!toSnap.exists()) {
      return { success: false, error: 'العهدة الهدف غير موجودة' };
    }
    
    // Update balances
    const fromNewBalance = fromBalance - amount;
    const toBalance = toSnap.data().balance || 0;
    const toNewBalance = toBalance + amount;
    
    await updateDoc(fromRef, {
      balance: fromNewBalance,
      updatedAt: new Date(),
    });
    
    await updateDoc(toRef, {
      balance: toNewBalance,
      updatedAt: new Date(),
    });
    
    // Add transfer record
    const transfersRef = collection(db, 'cashTransfers');
    await addDoc(transfersRef, {
      fromCashRegisterId,
      toCashRegisterId,
      amount,
      description: description || '',
      userId,
      ownerId,
      date: new Date(),
      createdAt: new Date(),
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error adding cash transfer:', error);
    return { success: false, error: error.message };
  }
};

// Get cash transfers
export const getCashTransfers = async (cashRegisterId = null) => {
  try {
    const { ownerId } = getUserIds();
    const transfersRef = collection(db, 'cashTransfers');
    let transfers = [];
    
    if (cashRegisterId) {
      // Get transfers for specific cash register (from or to)
      const fromQuery = query(
        transfersRef,
        where('ownerId', '==', ownerId),
        where('fromCashRegisterId', '==', cashRegisterId)
      );
      const fromSnapshot = await getDocs(fromQuery);
      transfers = fromSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate ? data.date.toDate() : (data.date || new Date()),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
        };
      });
      
      // Also get transfers TO this register
      const toQuery = query(
        transfersRef,
        where('ownerId', '==', ownerId),
        where('toCashRegisterId', '==', cashRegisterId)
      );
      const toSnapshot = await getDocs(toQuery);
      const toTransfers = toSnapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate ? data.date.toDate() : (data.date || new Date()),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
        };
      });
      transfers = [...transfers, ...toTransfers];
    } else {
      // Get all transfers
      const q = query(transfersRef, where('ownerId', '==', ownerId));
      const snapshot = await getDocs(q);
      transfers = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate ? data.date.toDate() : (data.date || new Date()),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
        };
      });
    }
    
    // Sort by date descending
    transfers.sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : new Date(a.date);
      const dateB = b.date instanceof Date ? b.date : new Date(b.date);
      return dateB - dateA;
    });
    
    return transfers;
  } catch (error) {
    console.error('Error getting cash transfers:', error);
    return [];
  }
};

// ==================== Expenses & Cash Movements ====================

// Internal helper to record a cash movement as an expense-like entry
// NOTE: function declaration is hoisted (safe to call from earlier exports in this file).
// flow: 'out' (money goes out of the register) | 'in' (money goes into the register)
// kind: 'expense' | 'customer_payment' | 'source_payment' | other future kinds
async function recordCashMovement({
  cashRegisterId,
  amount,
  description = '',
  flow = 'out',
  kind = 'expense',
  refId = null,
  refType = null,
}) {
  const { userId, ownerId } = getUserIds();

  const expensesRef = collection(db, 'expenses');
  await addDoc(expensesRef, {
    cashRegisterId,
    amount,
    description: description || '',
    userId,
    ownerId,
    flow,        // 'in' | 'out'
    kind,        // e.g. 'expense', 'customer_payment', 'source_payment'
    refId,       // related payment/operation id
    refType,     // optional discriminator if needed later
    date: new Date(),
    createdAt: new Date(),
  });
}

// Add expense (manual, always treated as money out)
export const addExpense = async (cashRegisterId, amount, description = '') => {
  try {
    const { ownerId } = getUserIds();
    
    // Validate amount
    if (!amount || amount <= 0) {
      return { success: false, error: 'المبلغ يجب أن يكون أكبر من صفر' };
    }
    
    // Get cash register
    const cashRegisterRef = doc(db, 'cashRegisters', cashRegisterId);
    const cashRegisterSnap = await getDoc(cashRegisterRef);
    
    if (!cashRegisterSnap.exists()) {
      return { success: false, error: 'العهدة غير موجودة' };
    }
    
    const currentBalance = cashRegisterSnap.data().balance || 0;
    
    // Check if balance is sufficient
    if (currentBalance < amount) {
      return { success: false, error: 'الرصيد غير كافي' };
    }
    
    // Update balance (outflow)
    const newBalance = currentBalance - amount;
    await updateDoc(cashRegisterRef, {
      balance: newBalance,
      updatedAt: new Date(),
    });
    
    // Record movement in expenses collection with flow/kind
    await recordCashMovement({
      cashRegisterId,
      amount,
      description,
      flow: 'out',
      kind: 'expense',
      refId: null,
      refType: 'manual_expense',
    });
    
    return { success: true, newBalance };
  } catch (error) {
    console.error('Error adding expense:', error);
    return { success: false, error: error.message };
  }
};

// Get expenses
export const getExpenses = async (cashRegisterId = null) => {
  try {
    const { ownerId } = getUserIds();
    const expensesRef = collection(db, 'expenses');
    let q;
    
    if (cashRegisterId) {
      q = query(
        expensesRef,
        where('ownerId', '==', ownerId),
        where('cashRegisterId', '==', cashRegisterId)
      );
    } else {
      q = query(expensesRef, where('ownerId', '==', ownerId));
    }
    
    const snapshot = await getDocs(q);
    let expenses = snapshot.docs.map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        ...data,
        date: data.date?.toDate ? data.date.toDate() : (data.date || new Date()),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
      };
    });
    
    // Sort by date descending
    expenses.sort((a, b) => {
      const dateA = a.date instanceof Date ? a.date : new Date(a.date);
      const dateB = b.date instanceof Date ? b.date : new Date(b.date);
      return dateB - dateA;
    });
    
    return expenses;
  } catch (error) {
    console.error('Error getting expenses:', error);
    return [];
  }
};

// Subscribe to cash registers with real-time updates
export const subscribeToCashRegisters = (callback) => {
  try {
    const { ownerId } = getUserIds();
    const cashRegistersRef = collection(db, 'cashRegisters');
    const q = query(cashRegistersRef, where('ownerId', '==', ownerId));
    
    return onSnapshot(q, (snapshot) => {
      let registers = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
          updatedAt: data.updatedAt?.toDate ? data.updatedAt.toDate() : (data.updatedAt || new Date()),
        };
      });
      
      // Remove duplicates: if there are multiple main cash registers (userId = null), keep only the first one
      const mainRegisters = registers.filter(r => r.userId === null);
      const userRegisters = registers.filter(r => r.userId !== null);
      
      if (mainRegisters.length > 1) {
        const firstMainRegister = mainRegisters[0];
        const totalBalance = mainRegisters.reduce((sum, r) => sum + (r.balance || 0), 0);
        firstMainRegister.balance = totalBalance;
        registers = [firstMainRegister, ...userRegisters];
      }
      
      callback(registers);
    }, (error) => {
      console.error('Error subscribing to cash registers:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error subscribing to cash registers:', error);
    return () => {};
  }
};

// Subscribe to cash transfers with real-time updates
export const subscribeToCashTransfers = (callback) => {
  try {
    const { ownerId } = getUserIds();
    const transfersRef = collection(db, 'cashTransfers');
    const q = query(transfersRef, where('ownerId', '==', ownerId));
    
    return onSnapshot(q, (snapshot) => {
      let transfers = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate ? data.date.toDate() : (data.date || new Date()),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
        };
      });
      
      // Sort by date descending
      transfers.sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : new Date(a.date);
        const dateB = b.date instanceof Date ? b.date : new Date(b.date);
        return dateB - dateA;
      });
      
      callback(transfers);
    }, (error) => {
      console.error('Error subscribing to cash transfers:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error subscribing to cash transfers:', error);
    return () => {};
  }
};

// Subscribe to expenses with real-time updates
export const subscribeToExpenses = (callback) => {
  try {
    const { ownerId } = getUserIds();
    const expensesRef = collection(db, 'expenses');
    const q = query(expensesRef, where('ownerId', '==', ownerId));
    
    return onSnapshot(q, (snapshot) => {
      let expenses = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: data.date?.toDate ? data.date.toDate() : (data.date || new Date()),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : (data.createdAt || new Date()),
        };
      });
      
      // Sort by date descending
      expenses.sort((a, b) => {
        const dateA = a.date instanceof Date ? a.date : new Date(a.date);
        const dateB = b.date instanceof Date ? b.date : new Date(b.date);
        return dateB - dateA;
      });
      
      callback(expenses);
    }, (error) => {
      console.error('Error subscribing to expenses:', error);
      callback([]);
    });
  } catch (error) {
    console.error('Error subscribing to expenses:', error);
    return () => {};
  }
};

// Recalculate main cash register balance from all active invoices
export const recalculateMainCashRegister = async () => {
  try {
    const { ownerId } = getUserIds();
    
    // Get all active customer invoices
    const invoices = await getCustomerInvoices();
    const activeInvoices = invoices.filter(inv => inv.status === 'active');
    
    // Sum all paid amounts
    const totalPaid = activeInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
    
    // Get or create main cash register
    const mainRegister = await getOrCreateMainCashRegister();
    if (!mainRegister) {
      return { success: false, error: 'فشل في الحصول على العهدة الرئيسية' };
    }
    
    // Update balance to match total paid from invoices
    const cashRegisterRef = doc(db, 'cashRegisters', mainRegister.id);
    await updateDoc(cashRegisterRef, {
      balance: totalPaid,
      updatedAt: new Date(),
    });
    
    return { success: true, balance: totalPaid };
  } catch (error) {
    console.error('Error recalculating main cash register:', error);
    return { success: false, error: error.message };
  }
};

// Ensure all users have cash registers (excluding owner - owner doesn't have a personal register)
export const ensureAllUsersHaveCashRegisters = async () => {
  try {
    const { ownerId } = getUserIds();
    
    // Get all users (excluding owner)
    const allUsers = await getUsersByOwner(ownerId);
    
    // Ensure main cash register exists (userId = null)
    await getOrCreateMainCashRegister();
    
    // Ensure each user (not owner) has a cash register
    for (const user of allUsers) {
      if (user.uid && user.uid !== ownerId) {
        await getOrCreateUserCashRegister(user.uid);
      }
    }
    
    return { success: true };
  } catch (error) {
    console.error('Error ensuring all users have cash registers:', error);
    return { success: false, error: error.message };
  }
};

// Delete cash transfer and reverse the amounts
export const deleteCashTransfer = async (transferId) => {
  try {
    const transferRef = doc(db, 'cashTransfers', transferId);
    const transferSnap = await getDoc(transferRef);
    
    if (!transferSnap.exists()) {
      return { success: false, error: 'التحويل غير موجود' };
    }
    
    const transferData = transferSnap.data();
    const { fromCashRegisterId, toCashRegisterId, amount } = transferData;
    
    // Reverse the transfer: add back to from, subtract from to
    const fromRef = doc(db, 'cashRegisters', fromCashRegisterId);
    const fromSnap = await getDoc(fromRef);
    
    if (fromSnap.exists()) {
      const fromBalance = fromSnap.data().balance || 0;
      await updateDoc(fromRef, {
        balance: fromBalance + amount,
        updatedAt: new Date(),
      });
    }
    
    const toRef = doc(db, 'cashRegisters', toCashRegisterId);
    const toSnap = await getDoc(toRef);
    
    if (toSnap.exists()) {
      const toBalance = toSnap.data().balance || 0;
      const newToBalance = Math.max(0, toBalance - amount); // Prevent negative balance
      await updateDoc(toRef, {
        balance: newToBalance,
        updatedAt: new Date(),
      });
    }
    
    // Delete the transfer record
    await deleteDoc(transferRef);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting cash transfer:', error);
    return { success: false, error: error.message };
  }
};

// Update cash transfer
export const updateCashTransfer = async (transferId, transferData) => {
  try {
    const { userId, ownerId } = getUserIds();
    
    const transferRef = doc(db, 'cashTransfers', transferId);
    const transferSnap = await getDoc(transferRef);
    
    if (!transferSnap.exists()) {
      return { success: false, error: 'التحويل غير موجود' };
    }
    
    const oldTransferData = transferSnap.data();
    const { fromCashRegisterId: oldFrom, toCashRegisterId: oldTo, amount: oldAmount } = oldTransferData;
    const { fromCashRegisterId: newFrom, toCashRegisterId: newTo, amount: newAmount, description } = transferData;
    
    // Validate amount
    if (!newAmount || newAmount <= 0) {
      return { success: false, error: 'المبلغ يجب أن يكون أكبر من صفر' };
    }
    
    // Reverse old transfer
    const oldFromRef = doc(db, 'cashRegisters', oldFrom);
    const oldFromSnap = await getDoc(oldFromRef);
    if (oldFromSnap.exists()) {
      const oldFromBalance = oldFromSnap.data().balance || 0;
      await updateDoc(oldFromRef, {
        balance: oldFromBalance + oldAmount,
        updatedAt: new Date(),
      });
    }
    
    const oldToRef = doc(db, 'cashRegisters', oldTo);
    const oldToSnap = await getDoc(oldToRef);
    if (oldToSnap.exists()) {
      const oldToBalance = oldToSnap.data().balance || 0;
      const newOldToBalance = Math.max(0, oldToBalance - oldAmount);
      await updateDoc(oldToRef, {
        balance: newOldToBalance,
        updatedAt: new Date(),
      });
    }
    
    // Check if new from register has sufficient balance
    const newFromRef = doc(db, 'cashRegisters', newFrom);
    const newFromSnap = await getDoc(newFromRef);
    
    if (!newFromSnap.exists()) {
      return { success: false, error: 'العهدة المصدر غير موجودة' };
    }
    
    const newFromBalance = newFromSnap.data().balance || 0;
    
    if (newFromBalance < newAmount) {
      return { success: false, error: 'الرصيد غير كافي' };
    }
    
    // Apply new transfer
    const newToRef = doc(db, 'cashRegisters', newTo);
    const newToSnap = await getDoc(newToRef);
    
    if (!newToSnap.exists()) {
      return { success: false, error: 'العهدة الهدف غير موجودة' };
    }
    
    // Update balances
    const newFromNewBalance = newFromBalance - newAmount;
    const newToBalance = newToSnap.data().balance || 0;
    const newToNewBalance = newToBalance + newAmount;
    
    await updateDoc(newFromRef, {
      balance: newFromNewBalance,
      updatedAt: new Date(),
    });
    
    await updateDoc(newToRef, {
      balance: newToNewBalance,
      updatedAt: new Date(),
    });
    
    // Update transfer record
    await updateDoc(transferRef, {
      fromCashRegisterId: newFrom,
      toCashRegisterId: newTo,
      amount: newAmount,
      description: description || '',
      updatedAt: new Date(),
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error updating cash transfer:', error);
    return { success: false, error: error.message };
  }
};

// Delete expense and return the amount to cash register
export const deleteExpense = async (expenseId) => {
  try {
    const expenseRef = doc(db, 'expenses', expenseId);
    const expenseSnap = await getDoc(expenseRef);
    
    if (!expenseSnap.exists()) {
      return { success: false, error: 'المصروف غير موجود' };
    }
    
    const expenseData = expenseSnap.data();
    const { cashRegisterId, amount } = expenseData;
    
    // Return the amount to cash register
    const cashRegisterRef = doc(db, 'cashRegisters', cashRegisterId);
    const cashRegisterSnap = await getDoc(cashRegisterRef);
    
    if (cashRegisterSnap.exists()) {
      const currentBalance = cashRegisterSnap.data().balance || 0;
      await updateDoc(cashRegisterRef, {
        balance: currentBalance + amount,
        updatedAt: new Date(),
      });
    }
    
    // Delete the expense record
    await deleteDoc(expenseRef);
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting expense:', error);
    return { success: false, error: error.message };
  }
};

// Update expense
export const updateExpense = async (expenseId, expenseData) => {
  try {
    const { userId, ownerId } = getUserIds();
    
    const expenseRef = doc(db, 'expenses', expenseId);
    const expenseSnap = await getDoc(expenseRef);
    
    if (!expenseSnap.exists()) {
      return { success: false, error: 'المصروف غير موجود' };
    }
    
    const oldExpenseData = expenseSnap.data();
    const { cashRegisterId: oldCashRegisterId, amount: oldAmount } = oldExpenseData;
    const { cashRegisterId: newCashRegisterId, amount: newAmount, description } = expenseData;
    
    // Validate amount
    if (!newAmount || newAmount <= 0) {
      return { success: false, error: 'المبلغ يجب أن يكون أكبر من صفر' };
    }
    
    // Return old amount to old cash register
    if (oldCashRegisterId) {
      const oldCashRegisterRef = doc(db, 'cashRegisters', oldCashRegisterId);
      const oldCashRegisterSnap = await getDoc(oldCashRegisterRef);
      
      if (oldCashRegisterSnap.exists()) {
        const oldBalance = oldCashRegisterSnap.data().balance || 0;
        await updateDoc(oldCashRegisterRef, {
          balance: oldBalance + oldAmount,
          updatedAt: new Date(),
        });
      }
    }
    
    // Check if new cash register has sufficient balance
    const newCashRegisterRef = doc(db, 'cashRegisters', newCashRegisterId);
    const newCashRegisterSnap = await getDoc(newCashRegisterRef);
    
    if (!newCashRegisterSnap.exists()) {
      return { success: false, error: 'العهدة غير موجودة' };
    }
    
    const newBalance = newCashRegisterSnap.data().balance || 0;
    
    if (newBalance < newAmount) {
      return { success: false, error: 'الرصيد غير كافي' };
    }
    
    // Deduct new amount from new cash register
    const newNewBalance = newBalance - newAmount;
    await updateDoc(newCashRegisterRef, {
      balance: newNewBalance,
      updatedAt: new Date(),
    });
    
    // Update expense record
    await updateDoc(expenseRef, {
      cashRegisterId: newCashRegisterId,
      amount: newAmount,
      description: description || '',
      updatedAt: new Date(),
    });
    
    return { success: true };
  } catch (error) {
    console.error('Error updating expense:', error);
    return { success: false, error: error.message };
  }
};

