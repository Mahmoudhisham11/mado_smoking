import { db } from '../config';

// Helper function to get current user ID and owner ID from localStorage
export const getUserIds = () => {
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
