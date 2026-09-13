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

// Get all products (one-time fetch)
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

// Real-time subscribe to products
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

// Get single product
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

// Add product
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

// Update product
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

// Delete product
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
