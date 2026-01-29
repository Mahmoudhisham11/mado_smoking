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
import StoreForm from '../../components/stores/StoreForm';
import { subscribeToStores, addStore, updateStore, deleteStore, getProducts, deleteZeroQuantityProducts, getUsersByOwner } from '../../lib/firebase/firestore';
import { useAuth } from '../../contexts/AuthContext';
import { getUserFromLocalStorage } from '../../lib/auth';
import { useToast } from '../../contexts/ToastContext';
import { HiOfficeBuilding, HiCube, HiCurrencyDollar } from 'react-icons/hi';
import styles from './page.module.css';

export default function StoresPage() {
  const { user, userData } = useAuth();
  const localUserData = getUserFromLocalStorage();
  const { showSuccess, showError } = useToast();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [storeToDelete, setStoreToDelete] = useState(null);
  const [deleteError, setDeleteError] = useState('');
  const [addingStore, setAddingStore] = useState(false);
  const [updatingStore, setUpdatingStore] = useState(false);
  const [deletingStore, setDeletingStore] = useState(false);
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const router = useRouter();

  const userRole = localUserData?.role || userData?.role || 'user';
  const isOwner = userRole === 'owner';
  const ownerId = localUserData?.ownerId || localUserData?.uid || user?.uid;

  useEffect(() => {
    // Load users for owner
    if (isOwner && ownerId) {
      loadUsers();
    }
    
    // Delete products with zero quantity on initial load
    deleteZeroQuantityProducts();
    
    // Subscribe to stores with real-time updates
    setLoading(true);
    const unsubscribe = subscribeToStores((storesData) => {
      updateStoresData(storesData);
      setLoading(false);
    });
    
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [isOwner, ownerId]);

  const loadUsers = async () => {
    try {
      if (ownerId) {
        const usersList = await getUsersByOwner(ownerId);
        setUsers(usersList);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const updateStoresData = async (storesData) => {
    try {
      // Get all products to calculate counts and values
      const allProducts = await getProducts();
      
      // Calculate products count and total value for each store
      const transformedData = storesData.map((store) => {
        // Get products for this store
        const storeProducts = allProducts.filter(
          (product) => product.storeId === store.id
        );
        
        // Calculate products count
        const productsCount = storeProducts.length;
        
        // Calculate total value (using wholesalePrice * quantity)
        const totalValue = storeProducts.reduce((sum, product) => {
          const quantity = product.quantity || 0;
          const price = product.wholesalePrice || product.finalPrice || 0;
          return sum + (price * quantity);
        }, 0);
        
        return {
          id: store.id,
          storeName: store.storeName || store.name || 'Unnamed Store',
          productsCount,
          totalValue,
          totalValueFormatted: `$${totalValue.toLocaleString()}`,
          originalStore: store, // Keep original store data for editing
        };
      });
      
      setStores(transformedData);
    } catch (error) {
      console.error('Error updating stores data:', error);
    }
  };

  // Calculate statistics
  const totalStores = stores.length;
  const totalProducts = stores.reduce((sum, store) => sum + (store.productsCount || 0), 0);
  const totalValue = stores.reduce((sum, store) => sum + (store.totalValue || 0), 0);

  // Filter stores based on search query
  const filteredStores = stores.filter((store) =>
    store.storeName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Transform filtered data for table
  const tableData = filteredStores.map((store) => ({
    id: store.id,
    storeName: store.storeName,
    productsCount: store.productsCount,
    totalValue: store.totalValueFormatted,
    originalStore: store.originalStore, // Keep for editing/deleting
  }));

  const handleAddStore = async (formData) => {
    setAddingStore(true);
    try {
      const result = await addStore(formData);
      if (result.success) {
        setIsModalOpen(false);
        showSuccess('تم إضافة المخزن بنجاح');
      } else {
        showError(result.error || 'فشل في إضافة المخزن');
      }
    } catch (error) {
      console.error('Error adding store:', error);
      showError('حدث خطأ أثناء إضافة المخزن');
    } finally {
      setAddingStore(false);
    }
  };

  const handleUpdateStore = async (formData) => {
    if (!editingStore) return;
    
    setUpdatingStore(true);
    try {
      const result = await updateStore(editingStore.id, formData);
      if (result.success) {
        setIsEditModalOpen(false);
        setEditingStore(null);
        showSuccess('تم تحديث المخزن بنجاح');
      } else {
        showError(result.error || 'فشل في تحديث المخزن');
      }
    } catch (error) {
      console.error('Error updating store:', error);
      showError('حدث خطأ أثناء تحديث المخزن');
    } finally {
      setUpdatingStore(false);
    }
  };

  const handleAction = (action, row) => {
    if (action === 'حذف' && isOwner) {
      setStoreToDelete(row.originalStore || row);
      setIsDeleteModalOpen(true);
      setDeleteError('');
    } else if (action === 'تعديل' && isOwner) {
      setEditingStore(row.originalStore || row);
      setIsEditModalOpen(true);
    } else if (action === 'التقارير') {
      router.push(`/stores/${row.id}?tab=reports`);
    }
  };

  const handleDelete = async () => {
    if (!storeToDelete) return;

    setDeletingStore(true);
    setDeleteError('');
    try {
      const result = await deleteStore(storeToDelete.id);
      if (result.success) {
        setIsDeleteModalOpen(false);
        setStoreToDelete(null);
        showSuccess('تم حذف المخزن بنجاح');
      } else {
        setDeleteError(result.error || 'حدث خطأ أثناء حذف المخزن');
      }
    } catch (error) {
      console.error('Error deleting store:', error);
      setDeleteError('حدث خطأ أثناء حذف المخزن');
    } finally {
      setDeletingStore(false);
    }
  };

  const columns = [
    { key: 'storeName', label: 'اسم المخزن' },
    { key: 'productsCount', label: 'عدد المنتجات' },
    { key: 'totalValue', label: 'القيمة الإجمالية' },
  ];

  const actions = isOwner ? ['حذف', 'تعديل', 'التقارير'] : ['التقارير'];

  return (
    <AuthGuard>
      <MainLayout>
        <div className={styles.container}>
          <PageHeader
            title="المخازن"
            action={isOwner ? "addStore" : undefined}
            actionLabel={isOwner ? "+ إضافة مخزن" : undefined}
            onAction={isOwner ? () => setIsModalOpen(true) : undefined}
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
                  title="إجمالي عدد المخازن"
                  value={totalStores}
                  icon={HiOfficeBuilding}
                />
                <SummaryCard
                  title="إجمالي عدد المنتجات"
                  value={totalProducts}
                  icon={HiCube}
                />
                <SummaryCard
                  title="إجمالي القيمة الإجمالية"
                  value={totalValue > 0 ? `$${totalValue.toLocaleString()}` : '$0'}
                  icon={HiCurrencyDollar}
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

          {/* Add Store Modal */}
          <Modal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title="إضافة مخزن جديد"
            footer={null}
          >
            <StoreForm
              users={users}
              onSave={handleAddStore}
              onCancel={() => setIsModalOpen(false)}
              loading={addingStore}
            />
          </Modal>

          {/* Edit Store Modal */}
          <Modal
            isOpen={isEditModalOpen}
            onClose={() => {
              setIsEditModalOpen(false);
              setEditingStore(null);
            }}
            title="تعديل المخزن"
            footer={null}
          >
            <StoreForm
              store={editingStore}
              users={users}
              onSave={handleUpdateStore}
              onCancel={() => {
                setIsEditModalOpen(false);
                setEditingStore(null);
              }}
              loading={updatingStore}
            />
          </Modal>

          <Modal
            isOpen={isDeleteModalOpen}
            onClose={() => {
              setIsDeleteModalOpen(false);
              setStoreToDelete(null);
              setDeleteError('');
            }}
            title="تأكيد الحذف"
            footer={
              <div className={styles.modalFooter}>
                <Button variant="secondary" onClick={() => {
                  setIsDeleteModalOpen(false);
                  setStoreToDelete(null);
                  setDeleteError('');
                }}>
                  إلغاء
                </Button>
                <Button variant="primary" onClick={handleDelete} loading={deletingStore}>
                  حذف
                </Button>
              </div>
            }
          >
            <div className={styles.deleteModalContent}>
              هل أنت متأكد من حذف المخزن "{storeToDelete?.storeName}"؟
              <br />
              <span className={styles.deleteModalWarning}>
                سيتم حذف جميع الفواتير والمنتجات المرتبطة بهذا المخزن أيضاً.
              </span>
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

