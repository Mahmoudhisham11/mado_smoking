import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  updateProfile,
} from 'firebase/auth';
import { auth } from './config';
import { createUser, getUser } from './firestore';

const googleProvider = new GoogleAuthProvider();
// Force account selection every time
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export const loginWithEmail = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    
    // Check if user exists in Firestore and if account is subscribed
    const userData = await getUser(userCredential.user.uid);
    if (userData && !userData.isSubscribe) {
      // Don't sign out, just return error with accountDisabled flag
      return { 
        success: false, 
        error: 'الحساب غير مفعل. يرجى الانتظار حتى يتم تفعيل حسابك.',
        accountDisabled: true,
        user: userCredential.user
      };
    }
    
    // If user doesn't exist in Firestore, treat as not subscribed
    if (!userData) {
      return { 
        success: false, 
        error: 'الحساب غير مفعل. يرجى الانتظار حتى يتم تفعيل حسابك.',
        accountDisabled: true,
        user: userCredential.user
      };
    }
    
    return { success: true, user: userCredential.user };
  } catch (error) {
    // Handle specific Firebase errors with Arabic messages
    let errorMessage = error.message;
    
    if (error.code === 'auth/network-request-failed') {
      errorMessage = 'خطأ في الاتصال بالشبكة. يرجى التحقق من اتصالك بالإنترنت وإعدادات Firebase.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'البريد الإلكتروني غير صحيح.';
    } else if (error.code === 'auth/user-disabled') {
      errorMessage = 'تم تعطيل هذا الحساب.';
    } else if (error.code === 'auth/user-not-found') {
      errorMessage = 'لا يوجد حساب بهذا البريد الإلكتروني.';
    } else if (error.code === 'auth/wrong-password') {
      errorMessage = 'كلمة المرور غير صحيحة.';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'تم إجراء محاولات كثيرة. يرجى المحاولة لاحقاً.';
    } else if (error.message && error.message.includes('Firebase configuration')) {
      errorMessage = 'خطأ في إعدادات Firebase. يرجى التحقق من إعدادات Firebase.';
    }
    
    return { success: false, error: errorMessage };
  }
};

export const registerWithEmail = async (name, email, password) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    // Update user profile with name
    await updateProfile(userCredential.user, { displayName: name });
    
    // Create user in Firestore
    const createResult = await createUser({
      uid: userCredential.user.uid,
      name: name,
      email: email,
    });
    
    if (!createResult.success) {
      // If user creation failed, sign out
      await signOut(auth);
      return { success: false, error: 'فشل في إنشاء الحساب. يرجى المحاولة مرة أخرى.' };
    }
    
    // Wait a moment to ensure data is saved in Firestore
    // This helps prevent race condition with onAuthStateChanged
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verify user was created in Firestore
    const { getUser } = await import('./firestore');
    const verifyUserData = await getUser(userCredential.user.uid);
    
    if (!verifyUserData) {
      // If user data still doesn't exist, sign out
      await signOut(auth);
      return { success: false, error: 'فشل في إنشاء الحساب. يرجى المحاولة مرة أخرى.' };
    }
    
    // For new accounts, isSubscribe will be false, so return error message
    // Don't sign out, let user stay logged in and show popup
    return { 
      success: false, 
      error: 'الحساب غير مفعل. يرجى الانتظار حتى يتم تفعيل حسابك.', 
      accountDisabled: true,
      user: userCredential.user 
    };
  } catch (error) {
    // Handle specific Firebase errors with Arabic messages
    let errorMessage = error.message;
    
    if (error.code === 'auth/network-request-failed') {
      errorMessage = 'خطأ في الاتصال بالشبكة. يرجى التحقق من اتصالك بالإنترنت وإعدادات Firebase.';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'البريد الإلكتروني غير صحيح.';
    } else if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'هذا البريد الإلكتروني مستخدم بالفعل.';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'كلمة المرور ضعيفة. يرجى استخدام كلمة مرور أقوى.';
    } else if (error.code === 'auth/too-many-requests') {
      errorMessage = 'تم إجراء محاولات كثيرة. يرجى المحاولة لاحقاً.';
    } else if (error.message && error.message.includes('Firebase configuration')) {
      errorMessage = 'خطأ في إعدادات Firebase. يرجى التحقق من إعدادات Firebase.';
    }
    
    return { success: false, error: errorMessage };
  }
};

export const loginWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    
    // Check if user exists in Firestore, create if not
    let userData = await getUser(result.user.uid);
    if (!userData) {
      // Create user in Firestore if doesn't exist
      const createResult = await createUser({
        uid: result.user.uid,
        name: result.user.displayName || '',
        email: result.user.email || '',
      });
      
      if (!createResult.success) {
        // If user creation failed, sign out
        await signOut(auth);
        return { success: false, error: 'فشل في إنشاء الحساب. يرجى المحاولة مرة أخرى.' };
      }
      
      // Wait a moment to ensure data is saved in Firestore
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Fetch the newly created user data (should be available after setDoc)
      userData = await getUser(result.user.uid);
      
      // Verify user was created
      if (!userData) {
        // If user data still doesn't exist, sign out
        await signOut(auth);
        return { success: false, error: 'فشل في إنشاء الحساب. يرجى المحاولة مرة أخرى.' };
      }
      
      // For new accounts, isSubscribe will be false, so return error message
      // Don't sign out, let user stay logged in and show popup
      if (!userData.isSubscribe) {
        return { 
          success: false, 
          error: 'الحساب غير مفعل. يرجى الانتظار حتى يتم تفعيل حسابك.', 
          accountDisabled: true,
          user: result.user 
        };
      }
    }
    
    // Check if account is subscribed
    if (userData && !userData.isSubscribe) {
      // Don't sign out, just return error with accountDisabled flag
      return { 
        success: false, 
        error: 'الحساب غير مفعل. يرجى الانتظار حتى يتم تفعيل حسابك.',
        accountDisabled: true,
        user: result.user 
      };
    }
    
    // If user doesn't exist in Firestore, treat as not subscribed
    if (!userData) {
      return { 
        success: false, 
        error: 'الحساب غير مفعل. يرجى الانتظار حتى يتم تفعيل حسابك.',
        accountDisabled: true,
        user: result.user 
      };
    }
    
    return { success: true, user: result.user };
  } catch (error) {
    // Handle specific Firebase errors with Arabic messages
    let errorMessage = error.message;
    
    if (error.code === 'auth/network-request-failed') {
      errorMessage = 'خطأ في الاتصال بالشبكة. يرجى التحقق من اتصالك بالإنترنت وإعدادات Firebase.';
    } else if (error.code === 'auth/popup-closed-by-user') {
      errorMessage = 'تم إغلاق نافذة تسجيل الدخول.';
    } else if (error.code === 'auth/popup-blocked') {
      errorMessage = 'تم حظر النافذة المنبثقة. يرجى السماح للنوافذ المنبثقة في المتصفح.';
    } else if (error.code === 'auth/cancelled-popup-request') {
      errorMessage = 'تم إلغاء طلب تسجيل الدخول.';
    } else if (error.message && error.message.includes('Firebase configuration')) {
      errorMessage = 'خطأ في إعدادات Firebase. يرجى التحقق من إعدادات Firebase.';
    }
    
    return { success: false, error: errorMessage };
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

// Create user by owner (owner creates account for another user)
// Uses Client SDK only (will log out the current owner)
export const createUserByOwner = async (ownerId, name, email, password, role = 'user', isSubscribe = true) => {
  try {
    // Use client-side method
    // Note: This will log out the current user, but we'll handle it gracefully
    const currentUser = auth.currentUser;
    if (!currentUser) {
      return { success: false, error: 'يجب أن تكون مسجل دخول لإنشاء مستخدم جديد' };
    }

    // Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update user profile with name
    await updateProfile(userCredential.user, { displayName: name });
    
    // Create user in Firestore with ownerId (before signing out)
    const { createUserByOwner: createUserInFirestore } = await import('./firestore');
    const createResult = await createUserInFirestore(ownerId, {
      uid: userCredential.user.uid,
      name: name,
      email: email,
      role: role,
      isSubscribe: isSubscribe,
    });
    
    if (!createResult.success) {
      // If Firestore creation failed, delete the Auth user
      await signOut(auth);
      console.warn('User created but Firestore failed. Owner will need to log in again.');
      return { success: false, error: createResult.error || 'فشل في إنشاء الحساب في Firestore.' };
    }
    
    // Sign out the newly created user
    await signOut(auth);
    
    // Note: Owner will be logged out. They need to log in again.
    // This is a limitation of client-side Firebase Auth
    return { 
      success: true, 
      user: {
        uid: userCredential.user.uid,
        email: userCredential.user.email,
        displayName: name,
      },
      requiresReauth: true, // Signal that owner needs to log in again
    };
  } catch (error) {
    console.error('Error creating user by owner:', error);
    
    // Handle specific Firebase errors
    let errorMessage = 'حدث خطأ أثناء إنشاء المستخدم';
    if (error.code === 'auth/email-already-in-use') {
      errorMessage = 'هذا البريد الإلكتروني مستخدم بالفعل';
    } else if (error.code === 'auth/invalid-email') {
      errorMessage = 'البريد الإلكتروني غير صحيح';
    } else if (error.code === 'auth/weak-password') {
      errorMessage = 'كلمة المرور ضعيفة. يرجى استخدام كلمة مرور أقوى';
    }
    
    return { success: false, error: errorMessage };
  }
};

// Delete user by owner (owner deletes a user account)
// Note: Client SDK can only delete from Firestore, not from Firebase Auth
// The user will be deleted from database but may still exist in Auth
// (but won't be able to login since they don't exist in Firestore)
export const deleteUserByOwner = async (userId) => {
  try {
    // Delete from Firestore only
    // Client SDK cannot delete other users from Firebase Auth
    const { deleteUser } = await import('./firestore');
    const firestoreResult = await deleteUser(userId);
    
    if (!firestoreResult.success) {
      return { success: false, error: firestoreResult.error || 'فشل في حذف المستخدم من قاعدة البيانات' };
    }
    
    // Return success with warning that user may still exist in Auth
    return { 
      success: true, 
      warning: 'تم حذف المستخدم من قاعدة البيانات. ملاحظة: المستخدم قد يبقى موجوداً في نظام المصادقة، لكن لن يتمكن من تسجيل الدخول لأنه غير موجود في قاعدة البيانات.' 
    };
  } catch (error) {
    console.error('Error deleting user by owner:', error);
    return { success: false, error: 'حدث خطأ أثناء حذف المستخدم. يرجى المحاولة مرة أخرى.' };
  }
};

export const getCurrentUser = () => {
  return auth.currentUser;
};

export const onAuthChange = (callback) => {
  return onAuthStateChanged(auth, callback);
};

