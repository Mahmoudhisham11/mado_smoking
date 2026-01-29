'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { loginWithEmail, registerWithEmail, loginWithGoogle } from '../../lib/firebase/auth';
import { saveUserToLocalStorage } from '../../lib/auth';
import Input from '../../components/ui/Input';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { HiMail, HiLockClosed } from 'react-icons/hi';
import { FcGoogle } from 'react-icons/fc';
import styles from './page.module.css';

export default function LoginPage() {
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [accountDisabled, setAccountDisabled] = useState(false);
  const [showDisabledModal, setShowDisabledModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { user, userData } = useAuth();

  useEffect(() => {
    // Check for error parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    if (errorParam === 'account_disabled') {
      setAccountDisabled(true);
      setShowDisabledModal(true);
    }
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let result;
      if (mode === 'login') {
        result = await loginWithEmail(formData.email, formData.password);
      } else {
        result = await registerWithEmail(formData.name, formData.email, formData.password);
      }

      if (result.success) {
        // Login was successful and account is subscribed
        const { getUser } = await import('../../lib/firebase/firestore');
        const userData = await getUser(result.user.uid);
        
        // Only save to localStorage if account is subscribed
        if (userData?.isSubscribe) {
          saveUserToLocalStorage({
            uid: result.user.uid,
            name: result.user.displayName || formData.name,
            email: result.user.email,
            role: userData?.role || 'user',
            isSubscribe: true,
            ownerId: userData?.ownerId || null,
          });
          
          // Redirect to home immediately
          router.push('/home');
        } else {
          // This shouldn't happen if auth logic is correct, but handle it anyway
          setAccountDisabled(true);
          setShowDisabledModal(true);
        }
      } else {
        // Check if error is about account being disabled
        if (result.accountDisabled || (result.error && result.error.includes('غير مفعل'))) {
          setAccountDisabled(true);
          setShowDisabledModal(true);
          
          // Do NOT save to localStorage if account is disabled
          // User stays on login page
        } else {
          setError(result.error);
        }
      }
    } catch (err) {
        setError('حدث خطأ. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await loginWithGoogle();
      if (result.success) {
        // Login was successful and account is subscribed
        const { getUser } = await import('../../lib/firebase/firestore');
        const userData = await getUser(result.user.uid);
        
        // Only save to localStorage if account is subscribed
        if (userData?.isSubscribe) {
          saveUserToLocalStorage({
            uid: result.user.uid,
            name: result.user.displayName,
            email: result.user.email,
            role: userData?.role || 'user',
            isSubscribe: true,
          });
          
          // Redirect to home immediately
          router.push('/home');
        } else {
          // This shouldn't happen if auth logic is correct, but handle it anyway
          setAccountDisabled(true);
          setShowDisabledModal(true);
        }
      } else {
        // Check if error is about account being disabled
        if (result.accountDisabled || (result.error && result.error.includes('غير مفعل'))) {
          setAccountDisabled(true);
          setShowDisabledModal(true);
          
          // Do NOT save to localStorage if account is disabled
          // User stays on login page
        } else {
          setError(result.error);
        }
      }
    } catch (err) {
        setError('حدث خطأ. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h1 className={styles.title}>ابدأ الآن</h1>
          <p className={styles.description}>
            سجل حساب جديد أو سجل الدخول إلى حسابك الحالي لإدارة نظام نقاط البيع والمتاجر والمنتجات والفواتير.
          </p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          {mode === 'register' && (
            <Input
              label="الاسم"
              type="text"
              name="name"
              placeholder="أدخل اسمك"
              value={formData.name}
              onChange={handleChange}
              required
            />
          )}
          <Input
            label="البريد الإلكتروني"
            type="email"
            name="email"
            placeholder="jahidhassan@gaall.com"
            value={formData.email}
            onChange={handleChange}
            icon={HiMail}
            required
          />
          <Input
            label="كلمة المرور"
            type="password"
            name="password"
            placeholder="أدخل كلمة المرور"
            value={formData.password}
            onChange={handleChange}
            icon={HiLockClosed}
            required
          />

          {error && (
            <div className={styles.error}>
              {error}
            </div>
          )}

          <a href="#" className={styles.forgotPassword}>
            نسيت كلمة المرور؟
          </a>

          <Button 
            type="submit" 
            variant="primary" 
            disabled={loading} 
            className={styles.submitButton}
          >
            {mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب'}
          </Button>
        </form>

        <div className={styles.divider}>
          <div className={styles.dividerLine}></div>
          <span className={styles.dividerText}>أو سجل الدخول باستخدام</span>
          <div className={styles.dividerLine}></div>
        </div>

        <button
          type="button"
          className={styles.socialButton}
          onClick={handleGoogleLogin}
          disabled={loading}
        >
          <FcGoogle size={22} />
          Google
        </button>

        <div className={styles.signupLink}>
          {mode === 'login' ? (
            <>
              ليس لديك حساب؟{' '}
              <span className={styles.signupLinkText} onClick={() => setMode('register')}>
                سجل الآن
              </span>
            </>
          ) : (
            <>
              لديك حساب بالفعل؟{' '}
              <span className={styles.signupLinkText} onClick={() => setMode('login')}>
                سجل الدخول
              </span>
            </>
          )}
        </div>
      </div>

      <Modal
        isOpen={showDisabledModal}
        onClose={() => {
          setShowDisabledModal(false);
          setAccountDisabled(false);
        }}
        title="الحساب غير مفعل"
        footer={
          <Button
            variant="primary"
            onClick={() => {
              setShowDisabledModal(false);
              setAccountDisabled(false);
            }}
          >
            موافق
          </Button>
        }
      >
        <div style={{ padding: '20px 0', textAlign: 'center' }}>
          <p style={{ fontSize: '16px', marginBottom: '10px' }}>
            عذراً، حسابك غير مفعل حالياً.
          </p>
          <p style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
            يرجى الانتظار حتى يتم تفعيل حسابك من قبل المسؤول.
          </p>
        </div>
      </Modal>
    </div>
  );
}

