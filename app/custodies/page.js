'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '../../components/auth/AuthGuard';
import MainLayout from '../../components/layout/MainLayout';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { subscribeToCustodies, updateCustody, createMissingCustodies, transferCustodyAmount } from '../../lib/firebase/firestore';
import { getUserFromLocalStorage } from '../../lib/auth';
import { HiClipboardList, HiSwitchHorizontal } from 'react-icons/hi';
import styles from './page.module.css';

export default function CustodiesPage() {
  const [custodies, setCustodies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingCustody, setEditingCustody] = useState(null);
  const [formData, setFormData] = useState({ name: '', amount: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // Transfer modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferFrom, setTransferFrom] = useState('');
  const [transferTo, setTransferTo] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferError, setTransferError] = useState('');
  const [transferring, setTransferring] = useState(false);

  const userData = getUserFromLocalStorage();
  const userRole = userData?.role || 'user';
  const isOwner = userRole === 'owner';

  useEffect(() => {
    const unsub = subscribeToCustodies((data) => {
      setCustodies(data);
      if (data.length === 0) {
        createMissingCustodies();
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const filteredCustodies = custodies.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (c.name || '').toLowerCase().includes(q);
  });

  const openEditModal = (custody) => {
    if (!isOwner) return;
    setEditingCustody(custody);
    setFormData({ name: custody.name || '', amount: String(custody.amount || '') });
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

  return (
    <AuthGuard>
      <MainLayout>
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
                  {isOwner && (
                    <button
                      className={styles.editButton}
                      onClick={() => openEditModal(custody)}
                      title="تعديل"
                    >
                      تعديل العهدة
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
              <label className={styles.formLabel}>قيمة العهدة (ج.م)</label>
              <input
                type="number"
                placeholder="أدخل قيمة العهدة"
                value={formData.amount}
                onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                className={styles.formInput}
              />
            </div>
          </div>
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
      </MainLayout>
    </AuthGuard>
  );
}
