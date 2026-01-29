'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthChange, logout } from '../lib/firebase/auth';
import { saveUserToLocalStorage, clearUserFromLocalStorage } from '../lib/auth';
import { getUser, subscribeToUser } from '../lib/firebase/firestore';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthChange(async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Fetch user data from Firestore
        const userDataFromFirestore = await getUser(firebaseUser.uid);
        setUserData(userDataFromFirestore);
        
        // Only save to localStorage if account is subscribed
        if (userDataFromFirestore?.isSubscribe) {
          saveUserToLocalStorage({
            uid: firebaseUser.uid,
            name: firebaseUser.displayName,
            email: firebaseUser.email,
            role: userDataFromFirestore?.role || 'user',
            isSubscribe: true,
            ownerId: userDataFromFirestore?.ownerId || null,
          });
        } else {
          // Clear localStorage if account is not subscribed
          clearUserFromLocalStorage();
        }
      } else {
        setUser(null);
        setUserData(null);
        clearUserFromLocalStorage();
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Monitor isSubscribe changes in real-time
  useEffect(() => {
    if (user && user.uid) {
      const unsubscribe = subscribeToUser(user.uid, (userDataFromFirestore) => {
        if (userDataFromFirestore) {
          setUserData(userDataFromFirestore);
          
          // Only update localStorage if account is subscribed
          if (userDataFromFirestore.isSubscribe) {
            saveUserToLocalStorage({
              uid: user.uid,
              name: user.displayName,
              email: user.email,
              role: userDataFromFirestore.role || 'user',
              isSubscribe: true,
              ownerId: userDataFromFirestore.ownerId || null,
            });
          } else {
            // If isSubscribe becomes false, clear localStorage
            // Don't logout automatically - let the user stay on login page
            clearUserFromLocalStorage();
          }
        } else {
          // If user data doesn't exist in Firestore, set to null
          // Don't clear localStorage or logout - user might be in registration process
          setUserData(null);
        }
      });
      
      return () => unsubscribe();
    }
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, userData, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

