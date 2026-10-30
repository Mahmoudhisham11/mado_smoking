'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useSession } from '../../contexts/AuthContext';
import { logout } from '../../lib/firebase/auth';

export default function Sidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const { isOwner, name: userName = 'مستخدم', role = 'staff' } = session;

  const roleTitle = isOwner ? 'المالك' : role === 'admin' ? 'مدير' : 'موظف';
  const userInitial = (userName.trim()[0] || 'م').toUpperCase();

  const handleLogout = async () => {
    try {
      await logout();
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  const navItems = [
    {
      path: '/home',
      label: 'الرئيسية',
      icon: (
        <svg className="m-ico" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 11l9-8 9 8" />
          <path d="M5 10v10h14V10" />
          <path d="M10 20v-6h4v6" />
        </svg>
      ),
    },
    ...(isOwner
      ? [
          {
            path: '/reports',
            label: 'التقارير',
            icon: (
              <svg className="m-ico" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 20V10" />
                <path d="M10 20V4" />
                <path d="M16 20v-7" />
                <path d="M22 20H2" />
              </svg>
            ),
          },
        ]
      : []),
    {
      path: '/items',
      label: 'الأصناف',
      icon: (
        <svg className="m-ico" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21 8l-9-5-9 5v8l9 5 9-5z" />
          <path d="M3 8l9 5 9-5" />
          <path d="M12 13v8" />
        </svg>
      ),
    },
    {
      path: '/stores',
      label: 'المخازن',
      icon: (
        <svg className="m-ico" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 21V9l9-6 9 6v12" />
          <path d="M7 21v-8h10v8" />
          <path d="M7 17h10" />
        </svg>
      ),
    },
    {
      path: '/customers',
      label: 'العملاء',
      icon: (
        <svg className="m-ico" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="9" cy="8" r="3.5" />
          <path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" />
          <path d="M16 4.5a3.5 3.5 0 010 7" />
          <path d="M18 14.5c2 .7 3.5 2.7 3.5 5.5" />
        </svg>
      ),
    },
    {
      path: '/custodies',
      label: 'العهد',
      icon: (
        <svg className="m-ico" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 7a2 2 0 012-2h13v4" />
          <path d="M3 7v11a2 2 0 002 2h15V9H5a2 2 0 01-2-2z" />
          <circle cx="16.5" cy="14.5" r="1" />
        </svg>
      ),
    },
    ...(isOwner
      ? [
          {
            path: '/expenses',
            label: 'المصاريف',
            icon: (
              <svg className="m-ico" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
                <path d="M9 8h6M9 12h6" />
              </svg>
            ),
          },
          {
            path: '/sources',
            label: 'الموردين',
            icon: (
              <svg className="m-ico" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M2 6h11v10H2z" />
                <path d="M13 9h4l4 4v3h-8z" />
                <circle cx="6.5" cy="18" r="2" />
                <circle cx="17.5" cy="18" r="2" />
              </svg>
            ),
          },
        ]
      : []),
    {
      path: '/settings',
      label: 'الإعدادات',
      isSettings: true,
      icon: (
        <svg className="m-ico" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
        </svg>
      ),
    },
  ];

  return (
    <aside className="m-sidebar">
      <div className="m-sidebar__brand">
        <img src="/assets/Logo/mado-logo.png" alt="Mado Smoking" />
        <div>
          <b>مادو للتدخين</b>
          <span className="t-cap t-muted">Mado Smoking</span>
        </div>
      </div>

      {navItems.map((item) => {
        const isActive =
          pathname === item.path || (item.path !== '/home' && pathname?.startsWith(item.path));
        return (
          <a
            key={item.path}
            className={`m-nav ${isActive ? 'on' : ''}`}
            style={item.isSettings ? { marginTop: '8px' } : undefined}
            onClick={(e) => {
              e.preventDefault();
              router.push(item.path);
            }}
            href={item.path}
            aria-current={isActive ? 'page' : undefined}
          >
            {item.icon}
            {item.label}
          </a>
        );
      })}

      <div className="m-sidebar__foot">
        <span className="m-avatar">{userInitial}</span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="t-label" style={{ fontSize: '14px' }}>
            {userName}
          </div>
          <div className="t-cap t-muted">{roleTitle}</div>
        </div>
        <button
          type="button"
          className="m-btn m-btn--ghost m-btn--icon m-btn--sm"
          onClick={handleLogout}
          title="تسجيل الخروج"
          aria-label="تسجيل الخروج"
        >
          <svg className="m-ico t-subtle" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M10 4H5v16h5" />
            <path d="M15 8l4 4-4 4" />
            <path d="M19 12H9" />
          </svg>
        </button>
      </div>
    </aside>
  );
}
