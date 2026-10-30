'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';
import { loginWithEmail, registerWithEmail, loginWithGoogle } from '../../lib/firebase/auth';

export default function LoginPage() {
  const [mode, setMode] = useState('login'); // 'login' or 'register'
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [accountDisabled, setAccountDisabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { user, userData } = useAuth();

  useEffect(() => {
    // Check for error parameter in URL
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    if (errorParam === 'account_disabled') {
      setAccountDisabled(true);
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
        const { getUser } = await import('../../lib/firebase/firestore');
        const userData = await getUser(result.user.uid);

        if (userData?.isSubscribe) {
          router.push('/home');
        } else {
          setAccountDisabled(true);
        }
      } else {
        if (result.accountDisabled || (result.error && result.error.includes('غير مفعل'))) {
          setAccountDisabled(true);
        } else {
          setError(result.error || 'حدث خطأ. يرجى المحاولة مرة أخرى.');
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
        const { getUser } = await import('../../lib/firebase/firestore');
        const userData = await getUser(result.user.uid);

        if (userData?.isSubscribe) {
          router.push('/home');
        } else {
          setAccountDisabled(true);
        }
      } else {
        if (result.accountDisabled || (result.error && result.error.includes('غير مفعل'))) {
          setAccountDisabled(true);
        } else {
          setError(result.error || 'حدث خطأ. يرجى المحاولة مرة أخرى.');
        }
      }
    } catch (err) {
      setError('حدث خطأ. يرجى المحاولة مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        padding: '24px',
        background: 'var(--bg)',
      }}
    >
      <div style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <img
            src="/assets/Logo/mado-logo.png"
            alt="Mado Smoking"
            style={{ width: '96px', height: '96px', borderRadius: '50%' }}
          />
          <div>
            <h1 className="t-display" style={{ fontSize: '28px', lineHeight: '36px' }}>
              أهلاً بيك في مادو
            </h1>
            <p className="t-muted">
              {mode === 'login' ? 'سجّل دخولك لإدارة المبيعات والمخازن' : 'سجل حسابك الجديد لإدارة المبيعات والمخازن'}
            </p>
          </div>
        </div>

        <div className="m-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '24px' }}>
          {accountDisabled && (
            <div className="m-alert">
              <svg className="m-ico" viewBox="0 0 24 24" aria-hidden="true">
                <rect x="5" y="11" width="14" height="9" rx="2" />
                <path d="M8 11V8a4 4 0 018 0v3" />
              </svg>
              <div>
                <b>الحساب غير مفعل</b>
                <div className="t-small t-muted">
                  حسابك لسه مستني تفعيل من المالك. كلّمه علشان يفعّله وبعدين ادخل تاني.
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="m-alert">
              <svg className="m-ico" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <div>
                <b>تعذر تسجيل الدخول</b>
                <div className="t-small t-muted">{error}</div>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {mode === 'register' && (
              <div className="m-field">
                <label>الاسم الكامل</label>
                <input
                  className="m-input"
                  type="text"
                  name="name"
                  placeholder="أدخل اسمك"
                  value={formData.name}
                  onChange={handleChange}
                  required
                />
              </div>
            )}

            <div className="m-field">
              <label>البريد الإلكتروني</label>
              <input
                className="m-input m-input--num"
                type="email"
                name="email"
                placeholder="ahmed@mado-smoking.com"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>

            <div className="m-field">
              <label>كلمة المرور</label>
              <div className="m-search" style={{ position: 'relative' }}>
                <input
                  className="m-input m-input--num"
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={handleChange}
                  style={{ paddingInlineEnd: '44px' }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    insetInlineEnd: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 0,
                    color: 'var(--ink-subtle)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}
                  aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                >
                  {showPassword ? (
                    <svg className="m-ico" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg className="m-ico" viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="m-btn m-btn--primary m-btn--lg m-btn--block"
              disabled={loading}
              style={{ marginTop: '8px' }}
            >
              {loading && <span className="m-spin" aria-hidden="true" />}
              {mode === 'login' ? 'تسجيل الدخول' : 'إنشاء حساب جديد'}
            </button>
          </form>

          <div className="m-row t-small t-subtle" style={{ gap: '12px' }}>
            <hr className="m-divider" style={{ flex: 1 }} />
            <span>أو</span>
            <hr className="m-divider" style={{ flex: 1 }} />
          </div>

          <button
            type="button"
            className="m-btn m-btn--secondary m-btn--lg m-btn--block"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <b style={{ fontSize: '18px', color: 'var(--gold-text)', marginInlineEnd: '6px' }}>G</b>
            الدخول بحساب Google
          </button>

          <div className="t-small" style={{ textAlign: 'center', marginTop: '4px' }}>
            {mode === 'login' ? (
              <>
                <span className="t-muted">ليس لديك حساب؟ </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                  }}
                  style={{
                    background: 'none',
                    border: 0,
                    color: 'var(--gold-text)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    font: 'inherit',
                  }}
                >
                  سجل الآن
                </button>
              </>
            ) : (
              <>
                <span className="t-muted">لديك حساب بالفعل؟ </span>
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                  }}
                  style={{
                    background: 'none',
                    border: 0,
                    color: 'var(--gold-text)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    font: 'inherit',
                  }}
                >
                  تسجيل الدخول
                </button>
              </>
            )}
          </div>
        </div>

        <p className="t-small t-subtle" style={{ textAlign: 'center' }}>
          Mado Smoking · مادو للتدخين
        </p>
      </div>
    </div>
  );
}
