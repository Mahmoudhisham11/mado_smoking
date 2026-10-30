'use client';

import Sidebar from './Sidebar';
import BottomNav from './BottomNav';
import { useSession } from '../../contexts/AuthContext';

export default function MainLayout({ children }) {
  const session = useSession();
  const { isOwner, role = 'staff' } = session;
  const roleTitle = isOwner ? 'مالك' : role === 'admin' ? 'مدير' : 'موظف';

  return (
    <div className="m-app">
      <Sidebar />
      <div className="m-col">
        <header className="m-topbar">
          <div className="m-row" style={{ justifyContent: 'flex-start', gap: '10px' }}>
            <img src="/assets/Logo/mado-logo.png" alt="مادو للتدخين" />
            <b className="t-sub">مادو للتدخين</b>
          </div>
          <span className="m-badge m-badge--gold">{roleTitle}</span>
        </header>
        <main className="m-main">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
