'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '../../components/auth/AuthGuard';
import MainLayout from '../../components/layout/MainLayout';
import PageHeader from '../../components/layout/PageHeader';
import SummaryCard from '../../components/dashboard/SummaryCard';
import Card from '../../components/ui/Card';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import Table from '../../components/ui/Table';
import OwnerOnly from '../../components/auth/OwnerOnly';
import { subscribeToExpenses, addExpense, updateExpense, deleteExpense, subscribeToCustodies } from '../../lib/firebase/firestore';
import { sumMoney } from '../../lib/domain/accounting';
import { parseDateInput } from '../../lib/dates';
import { HiCash, HiClipboardList, HiPencil, HiTrash } from 'react-icons/hi';
import styles from './page.module.css';

const PAGE_SIZE = 100;

export default function ExpensesPage() {
  return (
    <AuthGuard>
      <MainLayout>
        <OwnerOnly>
          <Expenses />
        </OwnerOnly>
      </MainLayout>
    </AuthGuard>
  );
}

function Expenses() {
  const [expenses, setExpenses] = useState([]);
  const [custodies, setCustodies] = useState([]);
  const [loading, setLoading] = useState(true);

  // Add modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');
  const [expenseCustodyId, setExpenseCustodyId] = useState('');
  const [expenseError, setExpenseError] = useState('');
  const [saving, setSaving] = useState(false);

  // Edit modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editAmount, setEditAmount] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editCustodyId, setEditCustodyId] = useState('');
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // Delete confirmation
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Date filter
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');

  const isOwner = true;
  const [pageSize, setPageSize] = useState(PAGE_SIZE);
  const [loadError, setLoadError] = useState('');
  const fromDate = parseDateInput(filterDateFrom);
  const toDate = parseDateInput(filterDateTo);
  const isFiltered = Boolean(fromDate || toDate);
  const fromKey = fromDate?.getTime();
  const toKey = toDate?.getTime();

  useEffect(() => {
    const range = { from: fromKey ? new Date(fromKey) : null, to: toKey ? new Date(toKey) : null, pageSize };
    const unsub = subscribeToExpenses(range, (data) => {
      setExpenses(data);
      setLoading(false);
    }, (msg) => {
      setLoadError(msg);
      setLoading(false);
    });
    return () => unsub();
  }, [fromKey, toKey, pageSize]);

  useEffect(() => {
    const unsub = subscribeToCustodies(setCustodies, setLoadError);
    return () => unsub();
  }, []);

  const formatDate = (date) => {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('ar-EG') + ' ' + d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
  };

  // الفلترة بالتاريخ بتحصل في الاستعلام نفسه
  const filteredExpenses = expenses;
  const totalExpenses = sumMoney(expenses, (e) => e.amount);

  const openAddModal = () => {
    setExpenseAmount('');
    setExpenseNotes('');
    setExpenseCustodyId(custodies.length > 0 ? custodies[0].id : '');
    setExpenseError('');
    setIsAddModalOpen(true);
  };

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    setExpenseError('');
  };

  const handleAddExpense = async () => {
    if (!expenseAmount || Number(expenseAmount) <= 0) {
      setExpenseError('يرجى إدخال مبلغ صحيح');
      return;
    }
    if (isOwner && !expenseCustodyId) {
      setExpenseError('يرجى اختيار العهدة');
      return;
    }

    setSaving(true);
    setExpenseError('');
    try {
      const data = {
        amount: Number(expenseAmount),
        notes: expenseNotes,
        date: new Date(),
      };
      if (isOwner && expenseCustodyId) {
        const custody = custodies.find((c) => c.id === expenseCustodyId);
        data.custodyId = expenseCustodyId;
        data.custodyName = custody?.name || '';
      }
      const result = await addExpense(data);
      if (!result.success) {
        setExpenseError(result.error || 'فشل في إضافة المصروف');
        setSaving(false);
        return;
      }
      closeAddModal();
    } catch (err) {
      setExpenseError('حدث خطأ. يرجى المحاولة مرة أخرى.');
    } finally {
      setSaving(false);
    }
  };

  const openEditModal = (row) => {
    const e = row._raw;
    setEditingExpense(e);
    setEditAmount(String(e.amount || ''));
    setEditNotes(e.notes || '');
    setEditCustodyId(e.custodyId || (custodies.length > 0 ? custodies[0].id : ''));
    setEditError('');
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingExpense(null);
    setEditError('');
  };

  const handleEditExpense = async () => {
    if (!editingExpense) return;
    if (!editAmount || Number(editAmount) <= 0) {
      setEditError('يرجى إدخال مبلغ صحيح');
      return;
    }
    if (isOwner && !editCustodyId) {
      setEditError('يرجى اختيار العهدة');
      return;
    }

    setSavingEdit(true);
    setEditError('');
    try {
      const data = {
        amount: Number(editAmount),
        notes: editNotes,
      };
      if (isOwner && editCustodyId) {
        const custody = custodies.find((c) => c.id === editCustodyId);
        data.custodyId = editCustodyId;
        data.custodyName = custody?.name || '';
      }
      const result = await updateExpense(editingExpense.id, data);
      if (!result.success) {
        setEditError(result.error || 'فشل في تعديل المصروف');
        setSavingEdit(false);
        return;
      }
      closeEditModal();
    } catch (err) {
      setEditError('حدث خطأ. يرجى المحاولة مرة أخرى.');
    } finally {
      setSavingEdit(false);
    }
  };

  const confirmDeleteExpense = (row) => {
    if (!isOwner) return;
    setExpenseToDelete(row._raw);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteExpense = async () => {
    if (!expenseToDelete) return;
    setDeleting(true);
    const result = await deleteExpense(expenseToDelete.id);
    setDeleting(false);
    if (!result.success) {
      alert(result.error);
      return;
    }
    setIsDeleteModalOpen(false);
    setExpenseToDelete(null);
  };

  const handleTableAction = (action, row) => {
    if (action === 'تعديل' && isOwner) openEditModal(row);
    if (action === 'حذف' && isOwner) confirmDeleteExpense(row);
  };

  const columns = [
    { key: 'date', label: 'التاريخ' },
    { key: 'amount', label: 'المبلغ' },
    { key: 'notes', label: 'الملاحظة' },
    { key: 'user', label: 'المستخدم' },
    { key: 'custody', label: 'العهدة' },
  ];

  const tableData = filteredExpenses.map((e) => ({
    id: e.id,
    date: formatDate(e.date),
    amount: `${Number(e.amount).toLocaleString()} ج.م`,
    notes: e.notes || '—',
    user: e.userName || '—',
    custody: e.custodyName || '—',
    _raw: e,
  }));

  return (
    <>
        <div className={styles.container}>
          <PageHeader
            title="المصاريف"
            action="addExpense"
            actionLabel="+ إضافة مصروف"
            onAction={openAddModal}
            showSearch={false}
          />

          <div className={styles.dateFilterRow}>
            <div className={styles.dateFilterGroup}>
              <label className={styles.formLabel}>من تاريخ</label>
              <input type="date" className={styles.formInput} value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
            </div>
            <div className={styles.dateFilterGroup}>
              <label className={styles.formLabel}>إلى تاريخ</label>
              <input type="date" className={styles.formInput} value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
            </div>
            {(filterDateFrom || filterDateTo) && (
              <button className={styles.clearFilterBtn} onClick={() => { setFilterDateFrom(''); setFilterDateTo(''); }}>
                إلغاء الفلتر
              </button>
            )}
          </div>

          {loadError && <div className={styles.errorMessage}>{loadError}</div>}

          {loading ? (
            <div className={styles.loading}>جاري التحميل...</div>
          ) : (
            <div className={styles.summaryCards}>
              <SummaryCard title={isFiltered ? 'إجمالي مصاريف الفترة' : 'إجمالي المصاريف المعروضة'} value={`${totalExpenses.toLocaleString()} ج.م`} icon={HiCash} />
            </div>
          )}

          {!loading && filteredExpenses.length === 0 && (
            <Card>
              <div className={styles.emptyState}>
                <p>{filterDateFrom || filterDateTo ? 'لا توجد مصاريف في هذا النطاق.' : 'لا توجد مصاريف. أضف مصروف جديد باستخدام الزر أعلاه.'}</p>
              </div>
            </Card>
          )}

          {!loading && filteredExpenses.length > 0 && (
            <Table
              columns={columns}
              data={tableData}
              actions={isOwner ? ['تعديل', 'حذف'] : []}
              onAction={handleTableAction}
            />
          )}
          {!loading && !isFiltered && expenses.length >= pageSize && (
            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <button className={styles.clearFilterBtn} onClick={() => setPageSize((n) => n + PAGE_SIZE)}>تحميل المزيد</button>
            </div>
          )}
        </div>

        {/* Add Expense Modal */}
        <Modal
          isOpen={isAddModalOpen}
          onClose={closeAddModal}
          title="إضافة مصروف"
          footer={
            <div className={styles.formActions}>
              <Button variant="secondary" onClick={closeAddModal} disabled={saving}>إلغاء</Button>
              <Button variant="primary" onClick={handleAddExpense} loading={saving}>إضافة</Button>
            </div>
          }
        >
          {expenseError && <div className={styles.errorMessage}>{expenseError}</div>}
          <div className={styles.form}>
            <div>
              <label className={styles.formLabel}>المبلغ</label>
              <input type="number" className={styles.formInput} placeholder="أدخل المبلغ" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} />
            </div>
            <div>
              <label className={styles.formLabel}>ملاحظة</label>
              <textarea className={styles.formTextarea} placeholder="ملاحظة (اختياري)" value={expenseNotes} onChange={(e) => setExpenseNotes(e.target.value)} rows={3} />
            </div>
            {isOwner && custodies.length > 0 && (
              <div>
                <label className={styles.formLabel}>
                  <HiClipboardList size={14} style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
                  الصرف من العهدة
                </label>
                <select className={styles.formSelect} value={expenseCustodyId} onChange={(e) => setExpenseCustodyId(e.target.value)}>
                  {custodies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({Number(c.amount).toLocaleString()} ج.م)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </Modal>

        {/* Edit Expense Modal */}
        <Modal
          isOpen={isEditModalOpen}
          onClose={closeEditModal}
          title="تعديل المصروف"
          footer={
            <div className={styles.formActions}>
              <Button variant="secondary" onClick={closeEditModal} disabled={savingEdit}>إلغاء</Button>
              <Button variant="primary" onClick={handleEditExpense} loading={savingEdit}>حفظ التعديلات</Button>
            </div>
          }
        >
          {editError && <div className={styles.errorMessage}>{editError}</div>}
          <div className={styles.form}>
            <div>
              <label className={styles.formLabel}>المبلغ</label>
              <input type="number" className={styles.formInput} placeholder="أدخل المبلغ" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} />
            </div>
            <div>
              <label className={styles.formLabel}>ملاحظة</label>
              <textarea className={styles.formTextarea} placeholder="ملاحظة (اختياري)" value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={3} />
            </div>
            {isOwner && custodies.length > 0 && (
              <div>
                <label className={styles.formLabel}>
                  <HiClipboardList size={14} style={{ marginLeft: '4px', verticalAlign: 'middle' }} />
                  الصرف من العهدة
                </label>
                <select className={styles.formSelect} value={editCustodyId} onChange={(e) => setEditCustodyId(e.target.value)}>
                  {custodies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({Number(c.amount).toLocaleString()} ج.م)
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </Modal>

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => { setIsDeleteModalOpen(false); setExpenseToDelete(null); }}
          title="تأكيد حذف المصروف"
          footer={
            <div className={styles.formActions}>
              <Button variant="secondary" onClick={() => { setIsDeleteModalOpen(false); setExpenseToDelete(null); }} disabled={deleting}>إلغاء</Button>
              <Button variant="danger" onClick={handleDeleteExpense} loading={deleting}>حذف</Button>
            </div>
          }
        >
          <p>هل أنت متأكد أنك تريد حذف هذا المصروف؟</p>
          {expenseToDelete && (
            <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(var(--text-secondary-rgb), 0.06)', borderRadius: '8px' }}>
              <div style={{ fontWeight: 700, color: '#ef4444', fontSize: '16px' }}>{Number(expenseToDelete.amount).toLocaleString()} ج.م</div>
              {expenseToDelete.notes && <div style={{ marginTop: '4px', color: 'var(--text-secondary)', fontSize: '13px' }}>{expenseToDelete.notes}</div>}
            </div>
          )}
          <p style={{ color: '#ef4444', marginTop: '12px' }}>سيتم إرجاع المبلغ للعهدة إذا كان مسجلاً على عهدة.</p>
        </Modal>
    </>
  );
}
