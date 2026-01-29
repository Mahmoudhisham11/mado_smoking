'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AuthGuard from '../../components/auth/AuthGuard';
import MainLayout from '../../components/layout/MainLayout';
import PageHeader from '../../components/layout/PageHeader';
import SummaryCard from '../../components/dashboard/SummaryCard';
import Table from '../../components/ui/Table';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import CustomerForm from '../../components/customers/CustomerForm';
import { getCustomers, addCustomer, updateCustomer, deleteCustomer, getCustomerInvoices, subscribeToCustomers } from '../../lib/firebase/firestore';
import { getUsersByOwner } from '../../lib/firebase/firestore';
import { getUserFromLocalStorage } from '../../lib/auth';
import { useAuth } from '../../contexts/AuthContext';
import { HiUserGroup, HiDocumentText, HiPencil, HiTrash } from 'react-icons/hi';
import styles from './page.module.css';

export default function CustomersPage() {
  const { user, userData } = useAuth();
  const router = useRouter();
  const [customers, setCustomers] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [customerToDelete, setCustomerToDelete] = useState(null);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [formError, setFormError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [updatingCustomer, setUpdatingCustomer] = useState(false);
  const [deletingCustomer, setDeletingCustomer] = useState(false);
  const [stats, setStats] = useState({
    totalCustomers: 0,
    totalInvoices: 0,
  });

  const localUserData = getUserFromLocalStorage();
  const userRole = localUserData?.role || userData?.role || 'user';
  const isOwner = userRole === 'owner';

  useEffect(() => {
    if (isOwner) {
      loadUsers();
    }
    
    // Subscribe to customers with real-time updates
    setLoading(true);
    let isMounted = true;
    
    const unsubscribe = subscribeToCustomers(async (customersData) => {
      if (!isMounted) return;
      
      try {
        // Calculate remaining amount for each customer
        const customersWithRemaining = await Promise.all(
          customersData.map(async (customer) => {
            try {
              const invoices = await getCustomerInvoices(customer.id);
              const totalRemaining = invoices
                .filter(inv => inv.status !== 'returned')
                .reduce((sum, inv) => sum + (inv.remainingAmount || 0), 0);
              
              return {
                ...customer,
                remainingAmount: totalRemaining,
              };
            } catch (error) {
              console.error(`Error calculating remaining for customer ${customer.id}:`, error);
              return {
                ...customer,
                remainingAmount: 0,
              };
            }
          })
        );
        
        if (!isMounted) return;
        
        setCustomers(customersWithRemaining);
        
        // Calculate stats
        try {
          const allInvoices = await getCustomerInvoices();
          const totalInvoices = allInvoices
            .filter(inv => inv.status === 'active')
            .reduce((sum, inv) => sum + (inv.totalCost || 0), 0);
          
          if (isMounted) {
            setStats({
              totalCustomers: customersData.length,
              totalInvoices,
            });
          }
        } catch (error) {
          console.error('Error calculating stats:', error);
          if (isMounted) {
            setStats({
              totalCustomers: customersData.length,
              totalInvoices: 0,
            });
          }
        }
      } catch (error) {
        console.error('Error processing customers data:', error);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    });
    
    return () => {
      isMounted = false;
      if (unsubscribe) unsubscribe();
    };
  }, [isOwner]);

  const loadUsers = async () => {
    try {
      const ownerId = localUserData?.uid || user?.uid;
      if (ownerId) {
        const usersList = await getUsersByOwner(ownerId);
        setUsers(usersList.filter(u => u.uid !== ownerId)); // Exclude owner
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  // Filter customers based on search query
  const filteredCustomers = customers.filter((customer) =>
    customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    customer.phone.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddCustomer = () => {
    setEditingCustomer(null);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleEditCustomer = (customer) => {
    setEditingCustomer(customer);
    setFormError('');
    setIsModalOpen(true);
  };

  const handleSaveCustomer = async (formData) => {
    setFormError('');
    if (editingCustomer) {
      setUpdatingCustomer(true);
    } else {
      setSavingCustomer(true);
    }
    try {
      let result;
      if (editingCustomer) {
        result = await updateCustomer(editingCustomer.id, formData);
      } else {
        result = await addCustomer(formData);
      }
      
      if (result.success) {
        setIsModalOpen(false);
        setEditingCustomer(null);
        // Customers will be updated automatically via subscription
      } else {
        setFormError(result.error || 'فشل في حفظ العميل');
      }
    } catch (error) {
      setFormError('حدث خطأ. يرجى المحاولة مرة أخرى.');
      console.error('Error saving customer:', error);
    } finally {
      if (editingCustomer) {
        setUpdatingCustomer(false);
      } else {
        setSavingCustomer(false);
      }
    }
  };

  const handleDeleteClick = (customer) => {
    setCustomerToDelete(customer);
    setDeleteError('');
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!customerToDelete) return;

    setDeleteError('');
    setDeletingCustomer(true);
    try {
      const result = await deleteCustomer(customerToDelete.id);
      if (result.success) {
        setIsDeleteModalOpen(false);
        setCustomerToDelete(null);
        // Customers will be updated automatically via subscription
      } else {
        setDeleteError(result.error || 'حدث خطأ أثناء حذف العميل');
      }
    } catch (error) {
      console.error('Error deleting customer:', error);
      setDeleteError('حدث خطأ أثناء حذف العميل');
    } finally {
      setDeletingCustomer(false);
    }
  };

  const handleAction = (action, row) => {
    if (action === 'عرض') {
      router.push(`/customers/${row.id}`);
    } else if (action === 'تعديل' && isOwner) {
      handleEditCustomer(row);
    } else if (action === 'حذف' && isOwner) {
      handleDeleteClick(row);
    }
  };

  // Prepare table data
  const tableData = filteredCustomers.map((customer) => ({
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    creditLimit: customer.creditLimit?.toFixed(2) || '0.00',
    remainingAmount: customer.remainingAmount?.toFixed(2) || '0.00',
    originalCustomer: customer,
  }));

  const columns = [
    { key: 'name', label: 'اسم العميل' },
    { key: 'phone', label: 'رقم الموبايل' },
    { key: 'creditLimit', label: 'حد الائتمان' },
    { key: 'remainingAmount', label: 'المتبقي' },
  ];

  const actions = ['عرض'];
  if (isOwner) {
    actions.push('تعديل', 'حذف');
  }

  const modalFooter = (
    <div className={styles.modalFooter}>
      <Button variant="secondary" onClick={() => {
        setIsModalOpen(false);
        setEditingCustomer(null);
        setFormError('');
      }}>
        إلغاء
      </Button>
      <Button variant="primary" onClick={() => {}}>
        {editingCustomer ? 'حفظ التغييرات' : 'إضافة عميل'}
      </Button>
    </div>
  );

  return (
    <AuthGuard>
      <MainLayout>
        <div className={styles.container}>
          <PageHeader
            title="العملاء"
            action={isOwner ? "addCustomer" : null}
            actionLabel={isOwner ? "+ إضافة عميل جديد" : null}
            onAction={isOwner ? handleAddCustomer : null}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            showSearch={true}
          />

          {loading ? (
            <div className={styles.loading}>
              جاري التحميل...
            </div>
          ) : (
            <>
              <div className={styles.statsGrid}>
                <SummaryCard
                  title="إجمالي العملاء"
                  value={stats.totalCustomers}
                  icon={HiUserGroup}
                />
                <SummaryCard
                  title="إجمالي الفواتير"
                  value={stats.totalInvoices.toFixed(2)}
                  icon={HiDocumentText}
                />
              </div>

              <Table
                columns={columns}
                data={tableData}
                actions={actions}
                onAction={handleAction}
              />
            </>
          )}

          <Modal
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false);
              setEditingCustomer(null);
              setFormError('');
            }}
            title={editingCustomer ? 'تعديل عميل' : 'إضافة عميل جديد'}
            footer={null}
          >
            {formError && (
              <div className={styles.errorMessage}>
                {formError}
              </div>
            )}
            <CustomerForm
              customer={editingCustomer}
              users={users}
              onSave={handleSaveCustomer}
              onCancel={() => {
                setIsModalOpen(false);
                setEditingCustomer(null);
                setFormError('');
              }}
              loading={editingCustomer ? updatingCustomer : savingCustomer}
            />
          </Modal>

          <Modal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false);
              setCustomerToDelete(null);
              setDeleteError('');
            }}
            title="تأكيد الحذف"
            footer={
              <div className={styles.modalFooter}>
                <Button variant="secondary" onClick={() => {
                  setIsDeleteModalOpen(false);
                  setCustomerToDelete(null);
                  setDeleteError('');
                }}>
                  إلغاء
                </Button>
                <Button variant="danger" onClick={handleDelete} loading={deletingCustomer}>
                  حذف
                </Button>
              </div>
            }
          >
            <div className={styles.deleteModalContent}>
              <p>هل أنت متأكد من حذف العميل <strong>{customerToDelete?.name}</strong>؟</p>
              <p className={styles.deleteModalWarning}>
                سيتم حذف جميع الفواتير المرتبطة بهذا العميل أيضاً.
              </p>
            </div>
            {deleteError && (
              <div className={styles.deleteError}>
                {deleteError}
              </div>
            )}
          </Modal>
        </div>
      </MainLayout>
    </AuthGuard>
  );
}

