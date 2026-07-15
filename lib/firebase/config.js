import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase Configuration - القيم مباشرة في الكود
const firebaseConfig = {
  apiKey: 'AIzaSyDqMxeFdns0hikFfyCoUfgxf4zqgBS75U0',
  authDomain: 'smartbarbar-b28f2.firebaseapp.com',
  projectId: 'smartbarbar-b28f2',
  storageBucket: 'smartbarbar-b28f2.firebasestorage.app',
  messagingSenderId: '269036618921',
  appId: '1:269036618921:web:6b0088e1dc00d14d6115b8',
};

// Initialize Firebase
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (error) {
  console.error('❌ خطأ في تهيئة Firebase:', error);
  throw new Error(
    'فشل في تهيئة Firebase. يرجى التحقق من إعدادات Firebase في ملف config.js.'
  );
}

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;

