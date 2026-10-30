import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../config';
import { getUserIds, requireSession, run, onSubscribeError, toDate } from './helpers';
import { AppError, safeQty, toMoney } from '../../domain/accounting';

const mapProduct = (d) => {
  const data = d.data();
  return { id: d.id, ...data, createdAt: toDate(data.createdAt) || new Date(0) };
};

const sortNewest = (items) => items.sort((a, b) => b.createdAt - a.createdAt);

// Get all products (one-time fetch)
export const getProducts = async () => {
  try {
    const { ownerId } = requireSession();
    const snapshot = await getDocs(query(collection(db, 'smokingProducts'), where('ownerId', '==', ownerId)));
    return sortNewest(snapshot.docs.map(mapProduct).filter((p) => !p.archived));
  } catch (error) {
    console.error('Error getting products:', error);
    return [];
  }
};

// Real-time subscribe to products (المؤرشف مش بيظهر)
export const subscribeToProducts = (callback, onError) => {
  const { ownerId } = getUserIds();
  if (!ownerId) {
    callback([]);
    return () => {};
  }
  const q = query(collection(db, 'smokingProducts'), where('ownerId', '==', ownerId));
  return onSnapshot(q, (snapshot) => {
    callback(sortNewest(snapshot.docs.map(mapProduct).filter((p) => !p.archived)));
  }, onSubscribeError('products', onError));
};

// Get single product
export const getProduct = async (productId) => {
  try {
    const snap = await getDoc(doc(db, 'smokingProducts', productId));
    return snap.exists() ? { id: snap.id, ...snap.data() } : null;
  } catch (error) {
    console.error('Error getting product:', error);
    return null;
  }
};

export const addProduct = (productData) => run('adding product', async () => {
  const { uid, ownerId } = requireSession();
  const name = String(productData.name || '').trim();
  if (!name) throw new AppError('يرجى إدخال اسم الصنف');
  const price = toMoney(productData.price || 0);
  if (price < 0) throw new AppError('سعر البيع لا يمكن أن يكون بالسالب');
  const docRef = await addDoc(collection(db, 'smokingProducts'), {
    name,
    price,
    lastCost: 0,
    storeId: productData.storeId || null,
    userId: uid,
    ownerId,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  return { id: docRef.id };
});

export const updateProduct = (productId, productData) => run('updating product', async () => {
  requireSession();
  const name = String(productData.name || '').trim();
  if (!name) throw new AppError('يرجى إدخال اسم الصنف');
  const price = toMoney(productData.price || 0);
  if (price < 0) throw new AppError('سعر البيع لا يمكن أن يكون بالسالب');
  const updates = { name, price, updatedAt: new Date() };
  if (productData.storeId !== undefined) updates.storeId = productData.storeId;
  await updateDoc(doc(db, 'smokingProducts', productId), updates);
});

// الصنف مايتحذفش لو له رصيد في أي مخزن؛ ولو مالوش بيتأرشف
export const deleteProduct = (productId) => run('deleting product', async () => {
  const { ownerId } = requireSession();
  const stock = await getDocs(query(collection(db, 'storeProducts'), where('ownerId', '==', ownerId), where('productId', '==', productId)));
  const total = stock.docs.reduce((s, d) => s + safeQty(d.data().totalQuantity), 0);
  if (total > 0) {
    throw new AppError(`لا يمكن حذف الصنف لأن له رصيد ${safeQty(total)} في المخازن`);
  }
  await updateDoc(doc(db, 'smokingProducts', productId), { archived: true, archivedAt: new Date(), updatedAt: new Date() });
});
