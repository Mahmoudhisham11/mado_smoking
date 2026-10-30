'use client';

import { useRouter } from 'next/navigation';
import { useSession } from '../../contexts/AuthContext';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

// محتوى للمالك فقط. بيتحط جوه AuthGuard فالصلاحية جاية من الجلسة الحقيقية
export default function OwnerOnly({ children }) {
  const router = useRouter();
  const { isOwner } = useSession();
  if (isOwner) return children;
  return (
    <Modal isOpen={true} onClose={() => router.push('/')} title="تنبيه" size="small" footer={
      <Button variant="primary" onClick={() => router.push('/')}>العودة للرئيسية</Button>
    }>
      <p style={{ textAlign: 'center', padding: '16px 0' }}>ليس لديك الصلاحية للوصول الى هذه البيانات</p>
    </Modal>
  );
}
