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
import { getUserIds } from './helpers';
import { getUsersByOwner } from './users.service';

// Real-time subscribe to custodies
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

// Update custody info
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

// Adjust custody amount by delta
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

// Transfer custody balance between accounts
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

// Auto-create missing custodies for existing users
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

    // Create custody for the owner if missing
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
