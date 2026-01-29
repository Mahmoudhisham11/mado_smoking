'use client';

import { useState, useEffect } from 'react';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Select from '../ui/Select';
import { getUserFromLocalStorage } from '../../lib/auth';
import { HiCube, HiPlus, HiTrash, HiCurrencyDollar } from 'react-icons/hi';
import styles from './CustomerInvoiceForm.module.css';

export default function CustomerInvoiceForm({ 
  customer, 
  stores = [], 
  products = [], 
  invoice = null, // For editing existing invoice
  onSave, 
  onCancel, 
  loading 
}) {
  const [currentProduct, setCurrentProduct] = useState({
    productId: '',
    productName: '', // نص المنتج الذي يكتبه المستخدم
    quantity: '',
    price: '',
  });
  const [productsList, setProductsList] = useState([]);
  const [paidAmount, setPaidAmount] = useState('');
  const [errors, setErrors] = useState({});
  const [priceErrors, setPriceErrors] = useState({});

  // Load invoice data when editing
  useEffect(() => {
    if (invoice) {
      // Convert invoice products to form format
      const formattedProducts = (invoice.products || []).map(p => ({
        id: p.id,
        code: p.code,
        name: p.name,
        quantity: p.quantity?.toString() || '0',
        price: (p.price || p.finalPrice || 0).toString(),
        storeId: p.storeId,
        wholesalePrice: p.wholesalePrice,
        sellPrice: p.sellPrice,
        finalPrice: p.finalPrice,
        category: p.category,
      }));
      setProductsList(formattedProducts);
      setPaidAmount((invoice.paidAmount || 0).toString());
    } else {
      // Reset form for new invoice
      setProductsList([]);
      setPaidAmount('');
    }
  }, [invoice]);

  // Get user role
  const userData = getUserFromLocalStorage();
  const userRole = userData?.role || 'user';
  const isOwner = userRole === 'owner';

  // Calculate totals using the price set by user
  const totalItems = productsList.reduce((sum, p) => sum + (parseInt(p.quantity) || 0), 0);
  const totalCost = productsList.reduce((sum, p) => sum + ((parseFloat(p.price) || 0) * (parseInt(p.quantity) || 0)), 0);
  const paid = parseFloat(paidAmount) || 0;
  const remaining = totalCost - paid;
  const creditLimit = customer?.creditLimit || 0;
  const exceedsCreditLimit = remaining > creditLimit;

  // Get available products for selected store
  const availableProducts = products.filter(p => {
    if (!currentProduct.storeId) return false;
    return p.storeId === currentProduct.storeId && (p.quantity || 0) > 0;
  });

  const handleStoreChange = (e) => {
    const storeId = e.target.value;
    setCurrentProduct({
      ...currentProduct,
      storeId,
      productId: '',
      productName: '',
      quantity: '',
      price: '',
    });
  };

  const handleProductChange = (e) => {
    const productName = e.target.value;
    
    // Always update the productName to allow typing
    setCurrentProduct({
      ...currentProduct,
      productName: productName,
    });
    
    // Try to find matching product
    const trimmedName = productName.trim();
    if (!trimmedName) {
      // If input is empty, clear productId
      setCurrentProduct(prev => ({
        ...prev,
        productId: '',
        quantity: '',
        price: '',
      }));
      return;
    }
    
    // Find product by exact name match first
    let product = availableProducts.find(p => 
      (p.productName || p.name) === trimmedName
    );
    
    // If exact match found, set productId and price
    if (product) {
      setCurrentProduct(prev => ({
        ...prev,
        productId: product.id,
        quantity: prev.quantity || '',
        price: product?.sellPrice?.toString() || '', // القيمة الأولية = sellPrice
      }));
      // Clear price error for this product
      if (priceErrors[product.id]) {
        setPriceErrors({ ...priceErrors, [product.id]: '' });
      }
    } else {
      // If product not found, keep the name but clear productId
      // This allows user to continue typing
      setCurrentProduct(prev => ({
        ...prev,
        productId: '',
        quantity: prev.quantity || '',
        price: prev.price || '',
      }));
    }
  };

  const handlePriceChange = (e) => {
    const price = e.target.value;
    setCurrentProduct({
      ...currentProduct,
      price,
    });
    // Clear price error
    if (priceErrors[currentProduct.productId]) {
      setPriceErrors({ ...priceErrors, [currentProduct.productId]: '' });
    }
  };

  const handleAddProduct = () => {
    if (!currentProduct.productId || !currentProduct.quantity) {
      setErrors({ general: 'يجب اختيار منتج وإدخال الكمية' });
      return;
    }

    if (!currentProduct.price || currentProduct.price.trim() === '') {
      setErrors({ general: 'يجب إدخال السعر' });
      return;
    }

    // Find product - يجب أن يكون من availableProducts أولاً (المنتجات في المخزن المحدد)
    const product = availableProducts.find(p => p.id === currentProduct.productId);
    if (!product) {
      // إذا لم يوجد في availableProducts، ابحث في جميع المنتجات
      const allProduct = products.find(p => p.id === currentProduct.productId);
      if (!allProduct) {
        setErrors({ general: 'المنتج غير موجود. يرجى اختيار منتج من القائمة' });
        return;
      }
      // إذا المنتج موجود لكن ليس في المخزن المحدد أو الكمية = 0
      setErrors({ general: 'المنتج غير متوفر في المخزن المحدد أو الكمية غير كافية' });
      return;
    }

    const quantity = parseInt(currentProduct.quantity);
    if (isNaN(quantity) || quantity <= 0) {
      setErrors({ general: 'الكمية يجب أن تكون رقماً أكبر من صفر' });
      return;
    }

    // Calculate available quantity (product quantity - already added quantities in the list)
    // حساب الكمية المضافة مسبقاً من نفس المنتج في نفس المخزن
    const alreadyAddedQuantity = productsList
      .filter(p => p.id === product.id && p.storeId === product.storeId)
      .reduce((sum, p) => sum + (parseInt(p.quantity) || 0), 0);
    
    // الكمية المتاحة = الكمية في المخزن - الكمية المضافة مسبقاً
    const availableQuantity = (product.quantity || 0) - alreadyAddedQuantity;

    // التحقق من الكمية
    if (quantity > availableQuantity) {
      setErrors({ 
        general: `⚠️ تحذير: الكمية المطلوبة (${quantity}) أكبر من الكمية المتاحة (${availableQuantity}). الكمية الإجمالية في المخزن: ${product.quantity || 0}` 
      });
      return; // لا يتم إضافة المنتج
    }

    const selectedPrice = parseFloat(currentProduct.price);
    if (isNaN(selectedPrice) || selectedPrice <= 0) {
      setErrors({ general: 'السعر يجب أن يكون رقماً موجباً' });
      return;
    }

    const finalPrice = product.finalPrice || 0;
    
    // Check price permission: owner can set any price, regular users cannot go below finalPrice
    if (!isOwner && selectedPrice < finalPrice) {
      setPriceErrors({ [currentProduct.productId]: 'غير مسموح لك البيع بهذا السعر' });
      setErrors({ general: 'غير مسموح لك البيع بهذا السعر' });
      return;
    }

    // Check if product already exists in list (نفس المنتج في نفس المخزن)
    const existingIndex = productsList.findIndex(p => p.id === product.id && p.storeId === product.storeId);
    if (existingIndex >= 0) {
      // Update quantity and price
      const updated = [...productsList];
      const currentQuantityInList = parseInt(updated[existingIndex].quantity) || 0;
      const newQuantity = currentQuantityInList + quantity;
      
      // Calculate available quantity - الكمية المضافة في العناصر الأخرى (غير العنصر الحالي)
      const alreadyAddedInOtherItems = productsList
        .filter((p, idx) => p.id === product.id && p.storeId === product.storeId && idx !== existingIndex)
        .reduce((sum, p) => sum + (parseInt(p.quantity) || 0), 0);
      
      // الكمية المتاحة = الكمية في المخزن - الكمية المضافة في العناصر الأخرى
      const availableQuantityForUpdate = (product.quantity || 0) - alreadyAddedInOtherItems;
      
      if (newQuantity > availableQuantityForUpdate) {
        setErrors({ 
          general: `⚠️ تحذير: الكمية المطلوبة (${newQuantity}) أكبر من الكمية المتاحة (${availableQuantityForUpdate}). الكمية الإجمالية في المخزن: ${product.quantity || 0}` 
        });
        return; // لا يتم تحديث المنتج
      }
      
      // Update with new price (average or replace based on business logic - using replace for simplicity)
      updated[existingIndex].quantity = newQuantity.toString();
      updated[existingIndex].price = selectedPrice.toString();
      setProductsList(updated);
    } else {
      // Add new product with user-selected price
      setProductsList([
        ...productsList,
        {
          id: product.id,
          code: product.code,
          name: product.productName || product.name,
          wholesalePrice: product.wholesalePrice || 0,
          sellPrice: product.sellPrice || 0,
          finalPrice: product.finalPrice || 0,
          price: selectedPrice.toString(), // السعر المحدد من المستخدم
          quantity: quantity.toString(),
          category: product.category || '',
          storeId: product.storeId,
        },
      ]);
    }

    setCurrentProduct({
      storeId: currentProduct.storeId,
      productId: '',
      productName: '', // مسح اسم المنتج بعد الإضافة
      quantity: '',
      price: '',
    });
    setErrors({});
    setPriceErrors({});
  };

  const handleRemoveProduct = (index) => {
    setProductsList(productsList.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (productsList.length === 0) {
      setErrors({ general: 'يجب إضافة منتج واحد على الأقل' });
      return;
    }

    // Paid amount is optional - default to 0 if not provided
    let paid = 0;
    if (paidAmount.trim()) {
      paid = parseFloat(paidAmount);
      if (isNaN(paid) || paid < 0) {
        setErrors({ general: 'المبلغ المدفوع غير صحيح' });
        return;
      }

      if (paid > totalCost) {
        setErrors({ general: 'المبلغ المدفوع لا يمكن أن يكون أكبر من الإجمالي' });
        return;
      }
    }

    onSave({
      products: productsList.map(p => ({
        code: p.code,
        name: p.name,
        wholesalePrice: parseFloat(p.wholesalePrice),
        sellPrice: parseFloat(p.sellPrice),
        finalPrice: parseFloat(p.finalPrice),
        price: parseFloat(p.price), // السعر المحدد من المستخدم
        quantity: parseInt(p.quantity),
        category: p.category,
        storeId: p.storeId,
      })),
      totalItems,
      totalCost,
      paidAmount: paid,
    });
  };

  const storeOptions = stores.map(store => ({
    value: store.id,
    label: store.storeName || store.name,
  }));

  const productOptions = availableProducts.map(product => ({
    value: product.id,
    label: `${product.productName || product.name} - الكمية: ${product.quantity || 0} - السعر: ${product.finalPrice || 0}`,
  }));

  return (
    <form onSubmit={handleSubmit} className={styles.form} noValidate>
      <div className={styles.productSelection}>
        <Select
          label="المخزن"
          name="storeId"
          value={currentProduct.storeId || ''}
          onChange={handleStoreChange}
          options={storeOptions}
          placeholder="اختر المخزن"
          required
        />

        {currentProduct.storeId && (
          <>
            <div className={styles.formGroup}>
              <label className={styles.label}>المنتج</label>
              <div className={styles.inputWrapper}>
                <input
                  type="text"
                  list="products-list"
                  name="productName"
                  value={currentProduct.productName || ''}
                  onChange={handleProductChange}
                  placeholder="اكتب اسم المنتج أو اختر من القائمة"
                  className={styles.input}
                  required={productsList.length === 0}
                />
                <datalist id="products-list">
                  {availableProducts.map((product) => (
                    <option 
                      key={product.id} 
                      value={product.productName || product.name}
                      data-product-id={product.id}
                    >
                      {product.productName || product.name} - الكمية: {product.quantity || 0} - السعر: {product.finalPrice || 0}
                    </option>
                  ))}
                </datalist>
              </div>
            </div>

            <Input
              label="الكمية"
              type="number"
              name="quantity"
              placeholder="أدخل الكمية"
              value={currentProduct.quantity}
              onChange={(e) => setCurrentProduct({ ...currentProduct, quantity: e.target.value })}
              min="1"
              required
            />

            <Input
              label="السعر"
              type="number"
              name="price"
              placeholder="أدخل السعر"
              value={currentProduct.price}
              onChange={handlePriceChange}
              icon={HiCurrencyDollar}
              min={isOwner ? "0" : (products.find(p => p.id === currentProduct.productId)?.finalPrice || 0).toString()}
              step="0.01"
              required
              error={priceErrors[currentProduct.productId]}
            />

            <Button
              type="button"
              variant="primary"
              onClick={handleAddProduct}
              className={styles.addButton}
            >
              <HiPlus />
              إضافة منتج
            </Button>
          </>
        )}
      </div>

      {productsList.length > 0 && (
        <div className={styles.productsList}>
          <h3 className={styles.productsListTitle}>المنتجات المضافة</h3>
          <div className={styles.productsTable}>
            <div className={styles.productsHeader}>
              <span>المنتج</span>
              <span>الكمية</span>
              <span>السعر</span>
              <span>الإجمالي</span>
              <span>الإجراءات</span>
            </div>
            {productsList.map((product, index) => {
              const productPrice = parseFloat(product.price) || parseFloat(product.finalPrice) || 0;
              const productTotal = productPrice * (parseInt(product.quantity) || 0);
              return (
                <div key={index} className={styles.productRow}>
                  <span>{product.name}</span>
                  <span>{product.quantity}</span>
                  <span>{productPrice.toFixed(2)}</span>
                  <span>{productTotal.toFixed(2)}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveProduct(index)}
                    className={styles.removeButton}
                  >
                    <HiTrash />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {productsList.length > 0 && (
        <div className={styles.summary}>
          <div className={styles.summaryRow}>
            <span>إجمالي القطع:</span>
            <span>{totalItems}</span>
          </div>
          <div className={styles.summaryRow}>
            <span>إجمالي الفاتورة:</span>
            <span>{totalCost.toFixed(2)}</span>
          </div>
          <Input
            label="المبلغ المدفوع"
            type="number"
            name="paidAmount"
            placeholder="أدخل المبلغ المدفوع (اختياري)"
            value={paidAmount}
            onChange={(e) => setPaidAmount(e.target.value)}
            icon={HiCurrencyDollar}
            min="0"
            step="0.01"
          />
          <div className={styles.summaryRow}>
            <span>المتبقي:</span>
            <span className={exceedsCreditLimit ? styles.exceedsLimit : ''}>
              {remaining.toFixed(2)}
            </span>
          </div>
          {exceedsCreditLimit && (
            <div className={styles.warning}>
              ⚠️ المتبقي ({remaining.toFixed(2)}) يتجاوز حد الائتمان ({creditLimit.toFixed(2)})
              <br />
              الفاتورة سيتم حفظها كمعلقة ولن يتم خصم المنتجات من المخزن
            </div>
          )}
        </div>
      )}

      {errors.general && (
        <div className={styles.error}>{errors.general}</div>
      )}

      <div className={styles.formActions}>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={loading}
        >
          إلغاء
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={loading}
          disabled={productsList.length === 0}
        >
          إضافة فاتورة
        </Button>
      </div>
    </form>
  );
}

