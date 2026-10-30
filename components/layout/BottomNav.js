'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useSession } from '../../contexts/AuthContext';
import Modal from '../ui/Modal';

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const session = useSession();
  const { isOwner } = session;
  const [sheetOpen, setSheetOpen] = useState(false);

  const isHomeActive = pathname === '/home';
  const isCustomersActive = pathname?.startsWith('/customers');
  const isSourcesActive = pathname?.startsWith('/sources');
  const isItemsActive = pathname?.startsWith('/items');
  const isCustodiesActive = pathname?.startsWith('/custodies');

  const handleNavigate = (path) => {
    setSheetOpen(false);
    router.push(path);
  };

  const moreTiles = [
    ...(isOwner
      ? [
          {
            path: '/reports',
            label: 'التقارير',
            icon: (
              <svg className="m-ico t-gold" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 20V10" />
                <path d="M10 20V4" />
                <path d="M16 20v-7" />
                <path d="M22 20H2" />
              </svg>
            ),
          },
        ]
      : []),
    // If owner, items is in the more sheet. If employee, items is in the main nav instead of sources.
    ...(isOwner
      ? [
          {
            path: '/items',
            label: 'الأصناف',
            icon: (
              <svg className="m-ico t-gold" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M21 8l-9-5-9 5v8l9 5 9-5z" />
                <path d="M3 8l9 5 9-5" />
                <path d="M12 13v8" />
              </svg>
            ),
          },
        ]
      : []),
    {
      path: '/stores',
      label: 'المخازن',
      icon: (
        <svg className="m-ico t-gold" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 21V9l9-6 9 6v12" />
          <path d="M7 21v-8h10v8" />
          <path d="M7 17h10" />
        </svg>
      ),
    },
    ...(isOwner
      ? [
          {
            path: '/expenses',
            label: 'المصاريف',
            icon: (
              <svg className="m-ico t-gold" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
                <path d="M9 8h6M9 12h6" />
              </svg>
            ),
          },
        ]
      : []),
    {
      path: '/settings',
      label: 'الإعدادات',
      icon: (
        <svg className="m-ico t-gold" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
        </svg>
      ),
    },
  ];

  return (
    <>
      <Modal isOpen={sheetOpen} onClose={() => setSheetOpen(false)} title="باقي الأقسام">
        <div className="m-sheetnav">
          {moreTiles.map((tile) => (
            <button
              key={tile.path}
              type="button"
              className="m-tile"
              style={{ cursor: 'pointer', textAlign: 'start' }}
              onClick={() => handleNavigate(tile.path)}
            >
              {tile.icon}
              <b>{tile.label}</b>
            </button>
          ))}
        </div>
      </Modal>

      <nav className="m-bottomnav" aria-label="التنقل السفلي">
        {/* 1. الرئيسية */}
        <Link
          href="/home"
          className={`m-bn ${isHomeActive ? 'on' : ''}`}
          aria-current={isHomeActive ? 'page' : undefined}
        >
          <svg className="m-ico m-ico--lg" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 11l9-8 9 8" />
            <path d="M5 10v10h14V10" />
            <path d="M10 20v-6h4v6" />
          </svg>
          الرئيسية
        </Link>

        {/* 2. العملاء */}
        <Link
          href="/customers"
          className={`m-bn ${isCustomersActive ? 'on' : ''}`}
          aria-current={isCustomersActive ? 'page' : undefined}
        >
          <svg className="m-ico m-ico--lg" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="9" cy="8" r="3.5" />
            <path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6" />
            <path d="M16 4.5a3.5 3.5 0 010 7" />
            <path d="M18 14.5c2 .7 3.5 2.7 3.5 5.5" />
          </svg>
          العملاء
        </Link>

        {/* 3. زرار (+) في المنتصف تماماً */}
        <button
          type="button"
          className="m-bn"
          onClick={() => setSheetOpen(!sheetOpen)}
          aria-label={sheetOpen ? 'إغلاق الأقسام' : 'فتح باقي الأقسام'}
          aria-expanded={sheetOpen}
          style={{ background: 'none', border: 0, padding: 0 }}
        >
          <span className="m-bn__plus">
            {sheetOpen ? (
              <svg className="m-ico" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg className="m-ico" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5v14M5 12h14" />
              </svg>
            )}
          </span>
        </button>

        {/* 4. المصادر بجانب زرار (+) [للمالك] أو الأصناف [للموظف] */}
        {isOwner ? (
          <Link
            href="/sources"
            className={`m-bn ${isSourcesActive ? 'on' : ''}`}
            aria-current={isSourcesActive ? 'page' : undefined}
          >
            <svg className="m-ico m-ico--lg" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M2 6h11v10H2z" />
              <path d="M13 9h4l4 4v3h-8z" />
              <circle cx="6.5" cy="18" r="2" />
              <circle cx="17.5" cy="18" r="2" />
            </svg>
            المصادر
          </Link>
        ) : (
          <Link
            href="/items"
            className={`m-bn ${isItemsActive ? 'on' : ''}`}
            aria-current={isItemsActive ? 'page' : undefined}
          >
            <svg className="m-ico m-ico--lg" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M21 8l-9-5-9 5v8l9 5 9-5z" />
              <path d="M3 8l9 5 9-5" />
              <path d="M12 13v8" />
            </svg>
            الأصناف
          </Link>
        )}

        {/* 5. العهد */}
        <Link
          href="/custodies"
          className={`m-bn ${isCustodiesActive ? 'on' : ''}`}
          aria-current={isCustodiesActive ? 'page' : undefined}
        >
          <svg className="m-ico m-ico--lg" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M3 7a2 2 0 012-2h13v4" />
            <path d="M3 7v11a2 2 0 002 2h15V9H5a2 2 0 01-2-2z" />
            <circle cx="16.5" cy="14.5" r="1" />
          </svg>
          العهد
        </Link>
      </nav>
    </>
  );
}
