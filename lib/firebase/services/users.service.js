import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../config';
import { ensureCustody } from './custodies.service';
import { custodyDocId } from '../../domain/accounting';

// Create new user
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

      // Verify document was created
      const verifySnap = await getDoc(userRef);
      if (!verifySnap.exists()) {
        return { success: false, error: 'Failed to create user document' };
      }

      // Auto-create a custody record for the new user (هيفشل لحد ما الحساب يتفعّل، والمالك بينشئها بعدين)
      try {
        await ensureCustody(userData.ownerId || userData.uid, userData.uid, userData.name);
      } catch (custodyError) {
        console.warn('Custody will be created after activation:', custodyError?.code || custodyError);
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

      // Auto-create custody record (ID ثابت فمستحيل تتكرر)
      await ensureCustody(ownerId, userData.uid, userData.name);

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

// Get single user
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

// Update user
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

    // حذف عهدة المستخدم معاه (لو موجودة)، وسجل حركاتها بيفضل محفوظ
    const data = userSnap.data();
    if (data.ownerId) {
      const custodyRef = doc(db, 'custodies', custodyDocId(data.ownerId, userId));
      const custodySnap = await getDoc(custodyRef);
      if (custodySnap.exists()) await deleteDoc(custodyRef);
    }

    await deleteDoc(userRef);
    return { success: true };
  } catch (error) {
    console.error('Error deleting user from Firestore:', error);
    return { success: false, error: error.message };
  }
};

// Real-time subscribe to user
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
