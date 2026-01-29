'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import AuthGuard from '../../../components/auth/AuthGuard';
import MainLayout from '../../../components/layout/MainLayout';
import PageHeader from '../../../components/layout/PageHeader';
import SummaryCard from '../../../components/dashboard/SummaryCard';
import Table from '../../../components/ui/Table';
import Card from '../../../components/ui/Card';
import Input from '../../../components/ui/Input';
import Button from '../../../components/ui/Button';
import Modal from '../../../components/ui/Modal';
import { getStore, getProducts, getStores, transferProducts, deleteZeroQuantityProducts, deleteProduct } from '../../../lib/firebase/firestore';
import { HiCube, HiCurrencyDollar, HiTrendingUp, HiPlus, HiTrash } from 'react-icons/hi';
import styles from './page.module.css';

export default function StoreDetailsPage() {
  const params = useParams();
  const storeId = params.storeId;
  const [store, setStore] = useState(null);
  const [products, setProducts] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [transferItems, setTransferItems] = useState([]);
  const [currentTransfer, setCurrentTransfer] = useState({
    product: '',
    quantity: '',
    targetStore: '',
  });
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isDeleteProductModalOpen, setIsDeleteProductModalOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [transferError, setTransferError] = useState('');
  const [quantityError, setQuantityError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    if (storeId) {
      loadStoreData();
      loadStores();
    }
  }, [storeId]);

  const loadStoreData = async () => {
    setLoading(true);
    try {
      // Delete products with zero quantity for this store
      await deleteZeroQuantityProducts(storeId);
      
      const storeData = await getStore(storeId);
      setStore(storeData);

      const productsData = await getProducts(storeId);
      setProducts(productsData);
    } catch (error) {
      console.error('Error loading store data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStores = async () => {
    try {
      const storesData = await getStores();
      setStores(storesData.filter(s => s.id !== storeId));
    } catch (error) {
      console.error('Error loading stores:', error);
    }
  };

  const handleAddProduct = () => {
    setQuantityError('');
    setTransferError('');
    
    if (!currentTransfer.product || !currentTransfer.quantity || !currentTransfer.targetStore) {
      setTransferError('يرجى ملء جميع الحقول');
      return;
    }

    const product = products.find(p => p.name === currentTransfer.product || p.id === currentTransfer.product);
    if (!product) {
      setTransferError('المنتج غير موجود');
      return;
    }

    const quantity = parseInt(currentTransfer.quantity);
    const availableQuantity = product.quantity || 0;

    if (quantity > availableQuantity) {
      setQuantityError(`الكمية المتاحة: ${availableQuantity}`);
      return;
    }

    if (quantity <= 0) {
      setQuantityError('الكمية يجب أن تكون أكبر من صفر');
      return;
    }

    // التحقق من أن المنتج لم يُضف من قبل
    const existingItem = transferItems.find(item => item.productId === product.id);
    if (existingItem) {
      setTransferError('هذا المنتج موجود بالفعل في القائمة');
      return;
    }

    setTransferItems([...transferItems, {
      productId: product.id,
      productName: product.name,
      quantity: quantity,
      availableQuantity: availableQuantity,
    }]);

    setCurrentTransfer({
      product: '',
      quantity: '',
      targetStore: currentTransfer.targetStore, // الاحتفاظ بالمخزن الهدف
    });
    setTransferError('');
  };

  const handleRemoveProduct = (productId) => {
    setTransferItems(transferItems.filter(item => item.productId !== productId));
  };

  const handleTransfer = () => {
    if (transferItems.length === 0) {
      setTransferError('يرجى إضافة منتج واحد على الأقل');
      return;
    }

    if (!currentTransfer.targetStore) {
      setTransferError('يرجى اختيار المخزن الهدف');
      return;
    }

    const targetStore = stores.find(s => s.storeName === currentTransfer.targetStore || s.id === currentTransfer.targetStore);
    if (!targetStore) {
      setTransferError('المخزن الهدف غير موجود');
      return;
    }

    setIsConfirmModalOpen(true);
    setTransferError('');
  };

  const confirmTransfer = async () => {
    setTransferError('');
    const targetStore = stores.find(s => s.storeName === currentTransfer.targetStore || s.id === currentTransfer.targetStore);
    
    if (!targetStore) {
      setTransferError('المخزن الهدف غير موجود');
      return;
    }

    const items = transferItems.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
    }));

    try {
      const result = await transferProducts(storeId, targetStore.id, items);
      if (result.success) {
        setIsConfirmModalOpen(false);
        setTransferItems([]);
        setCurrentTransfer({
          product: '',
          quantity: '',
          targetStore: '',
        });
        loadStoreData();
      } else {
        setTransferError(result.error || 'حدث خطأ أثناء النقل');
      }
    } catch (error) {
      console.error('Error transferring products:', error);
      setTransferError('حدث خطأ أثناء النقل');
    }
  };

  const handleDeleteProduct = (product) => {
    setProductToDelete(product);
    setIsDeleteProductModalOpen(true);
    setDeleteError('');
  };

  const confirmDeleteProduct = async () => {
    if (!productToDelete) return;

    setDeleteError('');
    try {
      const result = await deleteProduct(productToDelete.id);
      if (result.success) {
        setIsDeleteProductModalOpen(false);
        setProductToDelete(null);
        loadStoreData();
      } else {
        setDeleteError(result.error || 'حدث خطأ أثناء حذف المنتج');
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      setDeleteError('حدث خطأ أثناء حذف المنتج');
    }
  };


  const columns = [
    { key: 'code', label: 'الكود' },
    { key: 'name', label: 'الاسم' },
    { key: 'category', label: 'الفئة' },
    { key: 'quantity', label: 'الكمية' },
    { key: 'wholesalePrice', label: 'سعر الجملة' },
    { key: 'sellPrice', label: 'سعر البيع' },
  ];

  if (loading) {
    return (
      <AuthGuard>
        <MainLayout>
          <div className={styles.container}>
            <div className={styles.loading}>
              جاري التحميل...
            </div>
          </div>
        </MainLayout>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <MainLayout>
        <div className={styles.container}>
          <PageHeader 
            title={store?.storeName || 'تفاصيل المخزن'}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            showSearch={true}
          />

          <div className={styles.statsGrid}>
            <SummaryCard
              title="عدد المنتجات"
              value={products.length}
              icon={HiCube}
            />
            <SummaryCard
              title="إجمالي الجملة"
              value={`$${products.reduce((sum, p) => sum + (p.wholesalePrice || 0) * (p.quantity || 0), 0).toLocaleString()}`}
              icon={HiCurrencyDollar}
            />
            <SummaryCard
              title="إجمالي التجزئة"
              value={`$${products.reduce((sum, p) => sum + (p.sellPrice || 0) * (p.quantity || 0), 0).toLocaleString()}`}
              icon={HiCurrencyDollar}
            />
            <SummaryCard
              title="الربح المتوقع"
              value={`$${products.reduce((sum, p) => sum + ((p.sellPrice || 0) - (p.wholesalePrice || 0)) * (p.quantity || 0), 0).toLocaleString()}`}
              icon={HiTrendingUp}
            />
          </div>

          <Card className={styles.transferCard}>
            <h3 className={styles.sectionTitle}>
              نقل المنتجات
            </h3>
            <div className={styles.transferForm}>
              <div>
                <label className={styles.label}>
                  المنتج
                </label>
                <input
                  type="text"
                  list="products-list"
                  placeholder="اختر المنتج"
                  value={currentTransfer.product}
                  onChange={(e) => {
                    setCurrentTransfer({ ...currentTransfer, product: e.target.value });
                    setQuantityError('');
                    setTransferError('');
                  }}
                  className={styles.datalistInput}
                />
                <datalist id="products-list">
                  {products.map((product) => (
                    <option key={product.id} value={product.name}>
                      {product.name} - الكمية المتاحة: {product.quantity || 0}
                    </option>
                  ))}
                </datalist>
              </div>
              <Input
                label="الكمية"
                type="number"
                placeholder="أدخل الكمية"
                value={currentTransfer.quantity}
                onChange={(e) => {
                  setCurrentTransfer({ ...currentTransfer, quantity: e.target.value });
                  setQuantityError('');
                  const product = products.find(p => p.name === currentTransfer.product || p.id === currentTransfer.product);
                  if (product && parseInt(e.target.value) > (product.quantity || 0)) {
                    setQuantityError(`الكمية المتاحة: ${product.quantity || 0}`);
                  }
                }}
                error={quantityError}
              />
              <div>
                <label className={styles.label}>
                  المخزن الهدف
                </label>
                <input
                  type="text"
                  list="stores-list"
                  placeholder="اختر المخزن الهدف"
                  value={currentTransfer.targetStore}
                  onChange={(e) => {
                    setCurrentTransfer({ ...currentTransfer, targetStore: e.target.value });
                    setTransferError('');
                  }}
                  className={styles.datalistInput}
                />
                <datalist id="stores-list">
                  {stores.map((store) => (
                    <option key={store.id} value={store.storeName || store.name}>
                      {store.storeName || store.name}
                    </option>
                  ))}
                </datalist>
              </div>
            </div>
            {transferError && (
              <div className={styles.transferError}>
                {transferError}
              </div>
            )}
            <div className={styles.actionsContainer}>
              <button
                onClick={handleAddProduct}
                className={styles.actionButton}
              >
                <HiPlus size={16} />
                إضافة منتج
              </button>
              {transferItems.length > 0 && (
                <button
                  onClick={handleTransfer}
                  className={styles.actionButton}
                >
                  نقل ({transferItems.length})
                </button>
              )}
            </div>
            {transferItems.length > 0 && (
              <div className={styles.transferItemsContainer}>
                <h4 className={styles.transferItemsTitle}>
                  المنتجات المضافة للنقل:
                </h4>
                <div className={styles.transferItemsWrapper}>
                  <table className={styles.transferItemsTable}>
                    <thead>
                      <tr>
                        <th className={styles.transferItemsTableHeader}>اسم المنتج</th>
                        <th className={styles.transferItemsTableHeader}>الكمية</th>
                        <th className={styles.transferItemsTableHeader}>الإجراءات</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transferItems.map((item) => (
                        <tr key={item.productId}>
                          <td className={styles.transferItemsTableCell}>{item.productName}</td>
                          <td className={styles.transferItemsTableCell}>{item.quantity}</td>
                          <td className={styles.transferItemsTableCell}>
                            <button
                              onClick={() => handleRemoveProduct(item.productId)}
                              className={styles.deleteButton}
                            >
                              <HiTrash size={14} />
                              حذف
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </Card>

          <Modal
            isOpen={isConfirmModalOpen}
            onClose={() => {
              setIsConfirmModalOpen(false);
              setTransferError('');
            }}
            title="تأكيد النقل"
            footer={
              <div className={styles.modalFooter}>
                <Button variant="secondary" onClick={() => {
                  setIsConfirmModalOpen(false);
                  setTransferError('');
                }}>
                  إلغاء
                </Button>
                <Button variant="primary" onClick={confirmTransfer}>
                  تأكيد النقل
                </Button>
              </div>
            }
          >
            <div className={styles.confirmModalContent}>
              <p className={styles.confirmModalParagraph}>
                هل أنت متأكد من نقل المنتجات التالية إلى المخزن "{currentTransfer.targetStore}"؟
              </p>
              <div className={styles.confirmModalItemsWrapper}>
                {transferItems.map((item) => (
                  <div key={item.productId} className={styles.confirmModalItem}>
                    <span>{item.productName}</span>
                    <span className={styles.confirmModalItemQuantity}>الكمية: {item.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
            {transferError && (
              <div className={styles.transferError}>
                {transferError}
              </div>
            )}
          </Modal>

          <h2 className={styles.sectionTitle}>
            المنتجات
          </h2>
          <Table
            columns={columns}
            data={products.map((p) => ({
              id: p.id,
              code: p.code || 'N/A',
              name: p.name || 'Unnamed',
              category: p.category || 'N/A',
              quantity: p.quantity || 0,
              wholesalePrice: `$${p.wholesalePrice || 0}`,
              sellPrice: `$${p.sellPrice || 0}`,
            }))}
            actions={['حذف']}
            onAction={(action, row) => {
              if (action === 'حذف') {
                const product = products.find(p => p.id === row.id);
                if (product) {
                  handleDeleteProduct(product);
                }
              }
            }}
          />

          <Modal
            isOpen={isDeleteProductModalOpen}
            onClose={() => {
              setIsDeleteProductModalOpen(false);
              setProductToDelete(null);
              setDeleteError('');
            }}
            title="تأكيد الحذف"
            footer={
              <div className={styles.modalFooter}>
                <Button variant="secondary" onClick={() => {
                  setIsDeleteProductModalOpen(false);
                  setProductToDelete(null);
                  setDeleteError('');
                }}>
                  إلغاء
                </Button>
                <Button variant="primary" onClick={confirmDeleteProduct}>
                  حذف
                </Button>
              </div>
            }
          >
            <div className={styles.deleteModalContent}>
              هل أنت متأكد من حذف المنتج "{productToDelete?.name}"؟
              <br />
              <span className={styles.deleteModalWarning}>
                سيتم حذف المنتج نهائياً من المخزن.
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

