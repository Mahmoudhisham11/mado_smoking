'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '../../components/auth/AuthGuard';
import MainLayout from '../../components/layout/MainLayout';
import PageHeader from '../../components/layout/PageHeader';
import SummaryCard from '../../components/dashboard/SummaryCard';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import TransferForm from '../../components/cash/TransferForm';
import ExpenseForm from '../../components/cash/ExpenseForm';
import { 
  subscribeToCashRegisters,
  subscribeToCashTransfers,
  subscribeToExpenses,
  addCashTransfer,
  updateCashTransfer,
  deleteCashTransfer,
  addExpense,
  updateExpense,
  deleteExpense,
  getUsersByOwner,
  recalculateMainCashRegister,
  ensureAllUsersHaveCashRegisters
} from '../../lib/firebase/firestore';
import { getUserFromLocalStorage } from '../../lib/auth';
import { useAuth } from '../../contexts/AuthContext';
import { HiCurrencyDollar, HiArrowRight, HiMinusCircle, HiArrowLeftRight } from 'react-icons/hi';
import styles from './page.module.css';

export default function CashPage() {
  const { user, userData } = useAuth();
  const localUserData = getUserFromLocalStorage();
  const userRole = localUserData?.role || userData?.role || 'user';
  const isOwner = userRole === 'owner';
  const currentUserId = localUserData?.uid || user?.uid;
  
  const [cashRegisters, setCashRegisters] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isDeleteTransferModalOpen, setIsDeleteTransferModalOpen] = useState(false);
  const [isDeleteExpenseModalOpen, setIsDeleteExpenseModalOpen] = useState(false);
  const [transferError, setTransferError] = useState('');
  const [expenseError, setExpenseError] = useState('');
  const [addingTransfer, setAddingTransfer] = useState(false);
  const [addingExpense, setAddingExpense] = useState(false);
  const [editingTransfer, setEditingTransfer] = useState(null);
  const [editingExpense, setEditingExpense] = useState(null);
  const [transferToDelete, setTransferToDelete] = useState(null);
  const [expenseToDelete, setExpenseToDelete] = useState(null);
  const [deletingTransfer, setDeletingTransfer] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('registers'); // registers, transfers, expenses

  useEffect(() => {
    const initializeData = async () => {
      setLoading(true);
      // Ensure all users have cash registers first
      await ensureAllUsersHaveCashRegisters();
      // Recalculate main cash register (for owner)
      if (isOwner) {
        await recalculateMainCashRegister();
      }
      // Load users for all users (to display register names)
      await loadUsers();
      setLoading(false);
    };
    
    initializeData();
  }, [isOwner]);

  // Subscribe to cash registers with real-time updates
  useEffect(() => {
    const unsubscribeRegisters = subscribeToCashRegisters((registersData) => {
      // Filter out owner's personal register (userId === ownerId)
      const ownerId = localUserData?.ownerId || localUserData?.uid || user?.uid;
      const filteredRegisters = registersData.filter(reg => reg.userId !== ownerId);
      setCashRegisters(filteredRegisters);
    });

    return () => {
      if (unsubscribeRegisters) unsubscribeRegisters();
    };
  }, [localUserData, user]);

  // Subscribe to cash transfers with real-time updates
  useEffect(() => {
    const unsubscribeTransfers = subscribeToCashTransfers((transfersData) => {
      setTransfers(transfersData);
    });

    return () => {
      if (unsubscribeTransfers) unsubscribeTransfers();
    };
  }, []);

  // Subscribe to expenses with real-time updates
  useEffect(() => {
    const unsubscribeExpenses = subscribeToExpenses((expensesData) => {
      setExpenses(expensesData);
    });

    return () => {
      if (unsubscribeExpenses) unsubscribeExpenses();
    };
  }, []);

  const loadUsers = async () => {
    try {
      const ownerId = localUserData?.ownerId || localUserData?.uid || user?.uid;
      if (ownerId) {
        const usersList = await getUsersByOwner(ownerId);
        // Add owner to the list if not already included
        const ownerInList = usersList.find(u => u.uid === ownerId);
        if (!ownerInList && (localUserData?.uid || user?.uid)) {
          const ownerData = {
            uid: ownerId,
            name: localUserData?.name || userData?.name || user?.displayName || 'مالك',
            email: localUserData?.email || userData?.email || user?.email || '',
            role: 'owner'
          };
          setUsers([ownerData, ...usersList]);
        } else {
          setUsers(usersList);
        }
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };


  // Get register name
  const getRegisterName = (register) => {
    if (register.userId === null) {
      return 'العهدة الرئيسية';
    }
    const user = users.find(u => u.uid === register.userId);
    return user ? `${user.name || user.email} - عهدة` : `عهدة المستخدم`;
  };

  // Calculate statistics
  const mainCashRegister = cashRegisters.find(cr => cr.userId === null);
  const mainBalance = mainCashRegister?.balance || 0;
  const usersBalance = cashRegisters
    .filter(cr => cr.userId !== null)
    .reduce((sum, cr) => sum + (cr.balance || 0), 0);
  
  // Only count money-out movements as expenses
  const totalExpenses = expenses
    .filter(exp => (exp.flow || 'out') === 'out')
    .reduce((sum, exp) => sum + (exp.amount || 0), 0);


  const handleTransfer = async (transferData) => {
    if (!isOwner) {
      setTransferError('غير مسموح لك بإجراء التحويلات');
      return;
    }

    setTransferError('');
    setAddingTransfer(true);
    try {
      let result;
      if (editingTransfer) {
        // Update existing transfer
        result = await updateCashTransfer(editingTransfer.id, transferData);
      } else {
        // Add new transfer
        result = await addCashTransfer(
          transferData.fromCashRegisterId,
          transferData.toCashRegisterId,
          transferData.amount,
          transferData.description
        );
      }
      
      if (result.success) {
        setIsTransferModalOpen(false);
        setEditingTransfer(null);
      } else {
        setTransferError(result.error || 'فشل في إجراء التحويل');
      }
    } catch (error) {
      console.error('Error adding/updating transfer:', error);
      setTransferError('حدث خطأ أثناء إجراء التحويل');
    } finally {
      setAddingTransfer(false);
    }
  };

  const handleExpense = async (expenseData) => {
    if (!isOwner) {
      setExpenseError('غير مسموح لك بتسجيل المصاريف');
      return;
    }

    setExpenseError('');
    setAddingExpense(true);
    try {
      let result;
      if (editingExpense) {
        // Update existing expense
        result = await updateExpense(editingExpense.id, expenseData);
      } else {
        // Add new expense
        result = await addExpense(
          expenseData.cashRegisterId,
          expenseData.amount,
          expenseData.description
        );
      }
      
      if (result.success) {
        setIsExpenseModalOpen(false);
        setEditingExpense(null);
      } else {
        setExpenseError(result.error || 'فشل في تسجيل المصروف');
      }
    } catch (error) {
      console.error('Error adding/updating expense:', error);
      setExpenseError('حدث خطأ أثناء تسجيل المصروف');
    } finally {
      setAddingExpense(false);
    }
  };

  const handleDeleteTransfer = async () => {
    if (!transferToDelete || !isOwner) {
      setTransferError('غير مسموح لك بحذف التحويلات');
      return;
    }
    
    setDeletingTransfer(true);
    try {
      const result = await deleteCashTransfer(transferToDelete.id);
      
      if (result.success) {
        setIsDeleteTransferModalOpen(false);
        setTransferToDelete(null);
      } else {
        setTransferError(result.error || 'فشل في حذف التحويل');
      }
    } catch (error) {
      console.error('Error deleting transfer:', error);
      setTransferError('حدث خطأ أثناء حذف التحويل');
    } finally {
      setDeletingTransfer(false);
    }
  };

  const handleDeleteExpense = async () => {
    if (!expenseToDelete || !isOwner) {
      setExpenseError('غير مسموح لك بحذف المصاريف');
      return;
    }
    
    setDeletingExpense(true);
    try {
      const result = await deleteExpense(expenseToDelete.id);
      
      if (result.success) {
        setIsDeleteExpenseModalOpen(false);
        setExpenseToDelete(null);
      } else {
        setExpenseError(result.error || 'فشل في حذف المصروف');
      }
    } catch (error) {
      console.error('Error deleting expense:', error);
      setExpenseError('حدث خطأ أثناء حذف المصروف');
    } finally {
      setDeletingExpense(false);
    }
  };

  const handleEditTransfer = (transfer) => {
    setEditingTransfer(transfer);
    setIsTransferModalOpen(true);
  };

  const handleEditExpense = (expense) => {
    setEditingExpense(expense);
    setIsExpenseModalOpen(true);
  };

  // Prepare table data for cash registers
  const registersTableData = cashRegisters.map((register) => ({
    id: register.id,
    name: getRegisterName(register),
    balance: (register.balance || 0).toFixed(2),
    updatedAt: register.updatedAt ? new Date(register.updatedAt).toLocaleDateString('ar-EG') : '-',
    originalRegister: register,
  }));

  // Prepare table data for transfers
  const transfersTableData = transfers.map((transfer) => {
    const fromRegister = cashRegisters.find(cr => cr.id === transfer.fromCashRegisterId);
    const toRegister = cashRegisters.find(cr => cr.id === transfer.toCashRegisterId);
    return {
      id: transfer.id,
      from: fromRegister ? getRegisterName(fromRegister) : 'غير معروف',
      to: toRegister ? getRegisterName(toRegister) : 'غير معروف',
      amount: (transfer.amount || 0).toFixed(2),
      date: transfer.date ? new Date(transfer.date).toLocaleDateString('ar-EG') : '-',
      description: transfer.description || '-',
      originalTransfer: transfer,
    };
  });

  // Prepare table data for expenses
  const expensesTableData = expenses.map((expense) => {
    const register = cashRegisters.find(cr => cr.id === expense.cashRegisterId);
    const user = users.find(u => u.uid === expense.userId);
    const flow = expense.flow || 'out';
    const kind = expense.kind || 'expense';
    const typeLabel = flow === 'in' ? 'تحصيل' : 'مصروف';
    const kindLabel =
      kind === 'customer_payment' ? 'تحصيل عميل' :
      kind === 'source_payment' ? 'سداد مصدر' :
      'مصروف';
    return {
      id: expense.id,
      register: register ? getRegisterName(register) : 'غير معروف',
      type: `${typeLabel}${kindLabel ? ` - ${kindLabel}` : ''}`,
      amount: (expense.amount || 0).toFixed(2),
      description: expense.description || '-',
      date: expense.date ? new Date(expense.date).toLocaleDateString('ar-EG') : '-',
      user: user ? (user.name || user.email) : 'غير معروف',
      originalExpense: expense,
    };
  });


  if (loading) {
    return (
      <AuthGuard>
        <MainLayout>
          <div className={styles.loading}>جاري التحميل...</div>
        </MainLayout>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <MainLayout>
        <div className={styles.container}>
          <PageHeader
            title="العهدة والمصاريف"
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            showSearch={true}
            customActions={
              isOwner ? (
                <div className={styles.headerActions}>
                  <button
                    onClick={() => setIsExpenseModalOpen(true)}
                    className={styles.tableActionButton}
                  >
                    + مصروف جديد
                  </button>
                  <button
                    onClick={() => setIsTransferModalOpen(true)}
                    className={styles.tableActionButton}
                  >
                    تحويل
                  </button>
                </div>
              ) : null
            }
          />

          <div className={styles.statsGrid}>
            <SummaryCard
              title="العهدة الرئيسية"
              value={`${mainBalance.toFixed(2)} $`}
              icon={HiCurrencyDollar}
            />
            <SummaryCard
              title="عهدة المستخدمين"
              value={`${usersBalance.toFixed(2)} $`}
              icon={HiCurrencyDollar}
            />
            <SummaryCard
              title="إجمالي المصاريف"
              value={`${totalExpenses.toFixed(2)} $`}
              icon={HiMinusCircle}
            />
          </div>

          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'registers' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('registers')}
            >
              العهدة
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'transfers' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('transfers')}
            >
              التحويلات
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'expenses' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('expenses')}
            >
              المصاريف
            </button>
          </div>

          {activeTab === 'registers' && (
            <Table
              columns={[
                { key: 'name', label: 'اسم العهدة' },
                { key: 'balance', label: 'الرصيد' },
                { key: 'updatedAt', label: 'آخر تحديث' },
              ]}
              data={registersTableData.filter(row => 
                !searchQuery || row.name.toLowerCase().includes(searchQuery.toLowerCase())
              )}
            />
          )}

          {activeTab === 'transfers' && (
            <Table
              columns={[
                { key: 'from', label: 'من' },
                { key: 'to', label: 'إلى' },
                { key: 'amount', label: 'المبلغ' },
                { key: 'date', label: 'التاريخ' },
                { key: 'description', label: 'الوصف' },
              ]}
              data={transfersTableData.filter(row => 
                !searchQuery || 
                row.from.toLowerCase().includes(searchQuery.toLowerCase()) ||
                row.to.toLowerCase().includes(searchQuery.toLowerCase()) ||
                row.description.toLowerCase().includes(searchQuery.toLowerCase())
              )}
              actions={isOwner ? ['تعديل', 'حذف'] : []}
              onAction={(action, row) => {
                if (action === 'تعديل') {
                  handleEditTransfer(row.originalTransfer);
                } else if (action === 'حذف') {
                  setTransferToDelete(row.originalTransfer);
                  setIsDeleteTransferModalOpen(true);
                }
              }}
            />
          )}

          {activeTab === 'expenses' && (
            <Table
              columns={[
                { key: 'register', label: 'العهدة' },
                { key: 'type', label: 'النوع' },
                { key: 'amount', label: 'المبلغ' },
                { key: 'description', label: 'الوصف' },
                { key: 'date', label: 'التاريخ' },
                { key: 'user', label: 'من قام بالتسجيل' },
              ]}
              data={expensesTableData.filter(row => 
                !searchQuery || 
                row.register.toLowerCase().includes(searchQuery.toLowerCase()) ||
                row.description.toLowerCase().includes(searchQuery.toLowerCase())
              )}
              actions={isOwner ? ['تعديل', 'حذف'] : []}
              onAction={(action, row) => {
                if (action === 'تعديل') {
                  handleEditExpense(row.originalExpense);
                } else if (action === 'حذف') {
                  setExpenseToDelete(row.originalExpense);
                  setIsDeleteExpenseModalOpen(true);
                }
              }}
            />
          )}

          {/* Transfer Modal */}
          <Modal
            isOpen={isTransferModalOpen}
            onClose={() => {
              setIsTransferModalOpen(false);
              setTransferError('');
            }}
            title="تحويل بين العهدة"
            footer={null}
          >
            {transferError && (
              <div className={styles.errorMessage}>
                {transferError}
              </div>
            )}
            <TransferForm
              cashRegisters={cashRegisters}
              users={users}
              transfer={editingTransfer}
              onSave={handleTransfer}
              onCancel={() => {
                setIsTransferModalOpen(false);
                setTransferError('');
                setEditingTransfer(null);
              }}
              loading={addingTransfer}
            />
          </Modal>

          {/* Expense Modal */}
          <Modal
            isOpen={isExpenseModalOpen}
            onClose={() => {
              setIsExpenseModalOpen(false);
              setExpenseError('');
            }}
            title="تسجيل مصروف"
            footer={null}
          >
            {expenseError && (
              <div className={styles.errorMessage}>
                {expenseError}
              </div>
            )}
            <ExpenseForm
              cashRegisters={cashRegisters}
              users={users}
              expense={editingExpense}
              onSave={handleExpense}
              onCancel={() => {
                setIsExpenseModalOpen(false);
                setExpenseError('');
                setEditingExpense(null);
              }}
              loading={addingExpense}
            />
          </Modal>

          {/* Delete Transfer Modal */}
          <Modal
            isOpen={isDeleteTransferModalOpen}
            onClose={() => {
              setIsDeleteTransferModalOpen(false);
              setTransferToDelete(null);
            }}
            title="حذف التحويل"
            footer={
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsDeleteTransferModalOpen(false);
                    setTransferToDelete(null);
                  }}
                  disabled={deletingTransfer}
                >
                  إلغاء
                </Button>
                <Button
                  variant="primary"
                  onClick={handleDeleteTransfer}
                  loading={deletingTransfer}
                >
                  حذف
                </Button>
              </div>
            }
          >
            <p>هل أنت متأكد من حذف هذا التحويل؟ سيتم إعادة المبالغ للعهدة الأصلية.</p>
          </Modal>

          {/* Delete Expense Modal */}
          <Modal
            isOpen={isDeleteExpenseModalOpen}
            onClose={() => {
              setIsDeleteExpenseModalOpen(false);
              setExpenseToDelete(null);
            }}
            title="حذف المصروف"
            footer={
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setIsDeleteExpenseModalOpen(false);
                    setExpenseToDelete(null);
                  }}
                  disabled={deletingExpense}
                >
                  إلغاء
                </Button>
                <Button
                  variant="primary"
                  onClick={handleDeleteExpense}
                  loading={deletingExpense}
                >
                  حذف
                </Button>
              </div>
            }
          >
            <p>هل أنت متأكد من حذف هذا المصروف؟ سيتم إعادة المبلغ للعهدة.</p>
          </Modal>
        </div>
      </MainLayout>
    </AuthGuard>
  );
}

