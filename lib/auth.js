// LocalStorage utilities for user data

export const saveUserToLocalStorage = (userData) => {
  if (typeof window === 'undefined') return;
  
  const dataToSave = {
    uid: userData.uid || null,
    name: userData.name || userData.displayName || null,
    email: userData.email || null,
    role: userData.role || 'user',
    isSubscribe: userData.isSubscribe || false,
    ownerId: userData.ownerId || null,
  };

  Object.keys(dataToSave).forEach((key) => {
    if (dataToSave[key] !== null) {
      localStorage.setItem(key, JSON.stringify(dataToSave[key]));
    }
  });
  
  // If user is owner, set ownerId to their own uid
  if (dataToSave.role === 'owner' && !dataToSave.ownerId && dataToSave.uid) {
    localStorage.setItem('ownerId', JSON.stringify(dataToSave.uid));
  }
};

export const getUserFromLocalStorage = () => {
  if (typeof window === 'undefined') return null;

  const uid = JSON.parse(localStorage.getItem('uid') || 'null');
  const role = JSON.parse(localStorage.getItem('role') || '"user"');
  let ownerId = JSON.parse(localStorage.getItem('ownerId') || 'null');
  
  // If user is owner and no ownerId set, use their own uid
  if (role === 'owner' && !ownerId && uid) {
    ownerId = uid;
  }

  return {
    uid,
    name: JSON.parse(localStorage.getItem('name') || 'null'),
    email: JSON.parse(localStorage.getItem('email') || 'null'),
    role,
    isSubscribe: JSON.parse(localStorage.getItem('isSubscribe') || 'false'),
    ownerId,
  };
};

export const clearUserFromLocalStorage = () => {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem('uid');
  localStorage.removeItem('name');
  localStorage.removeItem('email');
  localStorage.removeItem('role');
  localStorage.removeItem('isSubscribe');
  localStorage.removeItem('ownerId');
};

