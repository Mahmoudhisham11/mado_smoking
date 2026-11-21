'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '../../components/auth/AuthGuard';
import MainLayout from '../../components/layout/MainLayout';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { subscribeToCustodies, subscribeToCustodyMovements, updateCustody, deleteCustody, createMissingCustodies, transferCustodyAmount, getUsersByOwner } from '../../lib/firebase/firestore';
import { useSession } from '../../contexts/AuthContext';
import { HiClipboardList, HiSwitchHorizontal } from 'react-icons/hi';
import styles from './page.module.css';

const MOVEMENT_LABELS = {
  opening: 'رصيد افتتاحي',
  adjustment: 'تسوية يدوية',
  customer_payment: 'تحصيل من عميل',
  customer_refund: 'صرف لعميل',
  source_payment: 'دفع لمورد',
  source_refund: 'استرداد من مورد',
  expense: 'مصروف',
  transfer_in: 'تحويل وارد',
  transfer_out: 'تحويل صادر',
  reversal: 'إلغاء عملية',
};

export default function CustodiesPage() {
  return (
    <AuthGuard>
      <MainLayout>
        <Custodies />
      </MainLayout>
    </AuthGuard>
  );
}

function Custodies() {
  const [custodies, setCustodies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCustody, setEditingCustody] = useState(null);
  const [formData, setFormData] = useState({ name: '', amount: '', note: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Transfer modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferError, setTransferError] = useState('');
  const [transferring, setTransferring] = useState(false);

  const { isOwner, ownerId } = useSession();

  // حذف عهدة
  const [custodyToDelete, setCustodyToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const closeDeleteModal = () => {
    if (deleting) return;
    setCustodyToDelete(null);
    setDeleteError('');
  };

  const handleDelete = async () => {
    if (!custodyToDelete) return;
    setDeleting(true);
    setDeleteError('');
    const result = await deleteCustody(custodyToDelete.id);
    setDeleting(false);
    if (!result.success) {
      setDeleteError(result.error || 'فشل في حذف العهدة');
      return;
    }
    setCustodyToDelete(null);
  };
  const [loadError, setLoadError] = useState('');

  // سجل الحركات
  const [historyCustody, setHistoryCustody] = useState(null);
  const [movements, setMovements] = useState([]);
  const [historySize, setHistorySize] = useState(50);

  useEffect(() => {
    const unsub = subscribeToCustodies((data) => {
      setCustodies(data);
      setLoading(false);
    }, (msg) => {
      setLoadError(msg);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // إنشاء العهد الناقصة للمالك ومستخدميه (الـ ID ثابت فمفيش تكرار حتى لو اتنادت أكتر من مرة)
  useEffect(() => {
    if (!isOwner) return;
    getUsersByOwner(ownerId).then((users) => createMissingCustodies(users.map((u) => ({ uid: u.uid || u.id, name: u.name }))));
  }, [isOwner, ownerId]);

  const historyId = historyCustody?.id;
  useEffect(() => {
    if (!historyId) return;
    const unsub = subscribeToCustodyMovements(historyId, historySize, setMovements, setLoadError);
    return () => unsub();
  }, [historyId, historySize]);

  const filteredCustodies = custodies.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (c.name || '').toLowerCase().includes(q);
  });

  const openEditModal = (custody) => {
    if (!isOwner) return;
    setEditingCustody(custody);
    setFormData({ name: custody.name || '', amount: String(custody.amount ?? ''), note: '' });
    setFormError('');
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingCustody(null);
    setFormError('');
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setFormError('يرجى إدخال الاسم');
      return;
    }
    if (!formData.amount || isNaN(Number(formData.amount))) {
      setFormError('يرجى إدخال قيمة العهدة بشكل صحيح');
      return;
    }

    setSaving(true);
    setFormError('');

    const result = await updateCustody(editingCustody.id, {
      name: formData.name.trim(),
      amount: Number(formData.amount),
      note: formData.note.trim(),
    });

    if (!result.success) {
      setFormError(result.error || 'فشل في تعديل العهدة');
      setSaving(false);
      return;
    }

    closeEditModal();
    setSaving(false);
  };

  const openTransferModal = () => {
    if (!isOwner || custodies.length < 2) return;
    setTransferFrom(custodies[0].id);
    setTransferTo(custodies[1]?.id || custodies[0].id);
    setTransferAmount('');
    setTransferError('');
    setIsTransferModalOpen(true);
  };

  const closeTransferModal = () => {
    setIsTransferModalOpen(false);
    setTransferError('');
  };

  const handleTransfer = async () => {
    if (!transferFrom || !transferTo) {
      setTransferError('يرجى اختيار العهدتين');
      return;
    }
    if (transferFrom === transferTo) {
      setTransferError('لا يمكن التحويل من عهدة لنفسها');
      return;
    }
    if (!transferAmount || Number(transferAmount) <= 0) {
      setTransferError('يرجى إدخال مبلغ صحيح');
      return;
    }

    setTransferring(true);
    setTransferError('');

    const result = await transferCustodyAmount(transferFrom, transferTo, Number(transferAmount));
    if (!result.success) {
      setTransferError(result.error || 'فشل في التحويل');
      setTransferring(false);
      return;
    }

    closeTransferModal();
    setTransferring(false);
  };

  const formatDateTime = (d) => (d ? d.toLocaleDateString('ar-EG') + ' ' + d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '');

  return (
    <>
        <div className={styles.container}>
          <PageHeader
            title="العهد"
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            showSearch={custodies.length > 0}
            customActions={isOwner && custodies.length >= 2 ? (
              <button className={styles.transferBtn} onClick={openTransferModal}>
                <HiSwitchHorizontal size={16} />
                تحويل بين العهد
              </button>
            ) : null}
          />

          {loadError && <div className={styles.errorMessage}>{loadError}</div>}

          {loading ? (
            <div className={styles.loading}>جاري التحميل...</div>
          ) : custodies.length === 0 ? (
            <Card>
              <div className={styles.emptyState}>
                <p>لا توجد عهد حالياً. يتم إنشاء العهد تلقائياً عند إضافة مستخدم جديد.</p>
              </div>
            </Card>
          ) : filteredCustodies.length === 0 ? (
            <Card>
              <div className={styles.emptyState}>
                <p>لا توجد نتائج للبحث.</p>
              </div>
            </Card>
          ) : (
            <div className={styles.grid}>
              {filteredCustodies.map((custody) => (
                <div key={custody.id} className={styles.custodyCard}>
                  <div className={styles.custodyIcon}>
                    <HiClipboardList />
                  </div>
                  <div className={styles.custodyBody}>
                    <span className={styles.custodyName}>{custody.name}</span>
                    <span className={styles.custodyAmount}>
                      {Number(custody.amount).toLocaleString()}
                    </span>
                    <span className={styles.custodyAmountLabel}>ج.م</span>
                  </div>
                  <button
                    className={styles.editButton}
                    onClick={() => { setHistorySize(50); setMovements([]); setHistoryCustody(custody); }}
                    title="سجل الحركات"
                  >
                    سجل الحركات
                  </button>
                  {isOwner && (
                    <button
                      className={styles.editButton}
                      onClick={() => openEditModal(custody)}
                      title="تعديل"
                    >
                      تعديل العهدة
                    </button>
                  )}
                  {isOwner && (
                    <button
                      className={styles.deleteButton}
                      onClick={() => { setDeleteError(''); setCustodyToDelete(custody); }}
                      title="حذف"
                    >
                      حذف العهدة
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <Modal
          isOpen={isEditModalOpen}
          onClose={closeEditModal}
          title="تعديل العهدة"
          footer={
            <div className={styles.formActions}>
              <Button variant="secondary" onClick={closeEditModal} disabled={saving}>
                إلغاء
              </Button>
              <Button variant="primary" onClick={handleSave} loading={saving}>
                حفظ التعديلات
              </Button>
            </div>
          }
        >
          {formError && <div className={styles.errorMessage}>{formError}</div>}
          <div className={styles.form}>
            <div>
              <label className={styles.formLabel}>الاسم</label>
              <input
                type="text"
                placeholder="أدخل الاسم"
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                className={styles.formInput}
              />
            </div>
            <div>
              <label className={styles.formLabel}>رصيد العهدة الفعلي (ج.م)</label>
              <input
                type="number"
                placeholder="أدخل قيمة العهدة"
                value={formData.amount}
                onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                className={styles.formInput}
              />
            </div>
            <div>
              <label className={styles.formLabel}>سبب التسوية</label>
              <input
                type="text"
                placeholder="مثال: جرد النقدية"
                value={formData.note}
                onChange={(e) => setFormData((prev) => ({ ...prev, note: e.target.value }))}
                className={styles.formInput}
              />
            </div>
            {editingCustody && formData.amount !== '' && Number(formData.amount) !== Number(editingCustody.amount) && (
              <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                سيتم تسجيل تسوية بمبلغ {(Number(formData.amount) - Number(editingCustody.amount)).toLocaleString()} ج.م في سجل الحركات.
              </p>
            )}
          </div>
        </Modal>

        {/* Delete Modal */}
        <Modal
          isOpen={!!custodyToDelete}
          onClose={closeDeleteModal}
          title="حذف العهدة"
          footer={
            <div className={styles.formActions}>
              <Button variant="secondary" onClick={closeDeleteModal} disabled={deleting}>
                إلغاء
              </Button>
              <Button variant="danger" onClick={handleDelete} loading={deleting}>
                حذف
              </Button>
            </div>
          }
        >
          {deleteError && <div className={styles.errorMessage}>{deleteError}</div>}
          <p>هل أنت متأكد أنك تريد حذف عهدة <strong>{custodyToDelete?.name}</strong>؟</p>
          {Number(custodyToDelete?.amount) !== 0 && (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              رصيد العهدة الحالي {Number(custodyToDelete?.amount || 0).toLocaleString()} ج.م وسيتم حذفه معها.
            </p>
          )}
        </Modal>

        {/* Transfer Modal */}
        <Modal
          isOpen={isTransferModalOpen}
          onClose={closeTransferModal}
          title="تحويل بين العهد"
          footer={
            <div className={styles.formActions}>
              <Button variant="secondary" onClick={closeTransferModal} disabled={transferring}>
                إلغاء
              </Button>
              <Button variant="primary" onClick={handleTransfer} loading={transferring}>
                تحويل
              </Button>
            </div>
          }
        >
          {transferError && <div className={styles.errorMessage}>{transferError}</div>}
          <div className={styles.form}>
            <div>
              <label className={styles.formLabel}>من عهدة</label>
              <select className={styles.formInput} value={transferFrom} onChange={(e) => setTransferFrom(e.target.value)}>
                {custodies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({Number(c.amount).toLocaleString()} ج.م)</option>
                ))}
              </select>
            </div>
            <div>
              <label className={styles.formLabel}>إلى عهدة</label>
              <select className={styles.formInput} value={transferTo} onChange={(e) => setTransferTo(e.target.value)}>
                {custodies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({Number(c.amount).toLocaleString()} ج.م)</option>
                ))}
              </select>
            </div>
            <div>
              <label className={styles.formLabel}>المبلغ</label>
              <input
                type="number"
                className={styles.formInput}
                placeholder="أدخل المبلغ"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
              />
            </div>
          </div>
        </Modal>
      {/* Movements history */}
      <Modal
        isOpen={!!historyCustody}
        onClose={() => setHistoryCustody(null)}
        title={'سجل حركات: ' + (historyCustody?.name || '')}
        size="large"
        footer={null}
      >
        {movements.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>لا توجد حركات مسجلة.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {movements.map((m) => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '10px 0', borderBottom: '1px solid rgba(var(--text-secondary-rgb), 0.12)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{MOVEMENT_LABELS[m.type] || m.type}{m.note ? ' - ' + m.note : ''}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{formatDateTime(m.createdAt)}{m.userName ? ' | ' + m.userName : ''}</div>
                </div>
                <div style={{ textAlign: 'left', whiteSpace: 'nowrap' }}>
                  <div style={{ fontWeight: 700, color: m.amount < 0 ? '#ef4444' : '#10b981' }}>{m.amount > 0 ? '+' : ''}{Number(m.amount).toLocaleString()}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>الرصيد: {Number(m.balanceAfter).toLocaleString()}</div>
                </div>
              </div>
            ))}
            {movements.length >= historySize && (
              <div style={{ textAlign: 'center' }}>
                <Button variant="secondary" onClick={() => setHistorySize((n) => n + 50)}>تحميل المزيد</Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  );
}
