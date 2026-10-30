'use client';

import { HiPlus, HiX } from 'react-icons/hi';
import { safeQty, stockKey } from '../../lib/domain/accounting';

export const emptyLine = (priceField) => ({ storeId: '', productId: '', productSearchText: '', [priceField]: '', quantity: '' });

// محرر سطور الفاتورة.
// mode = 'sale': المخزن الأول وبعدين الصنف من رصيد المخزن (ويعرض المتاح)
// mode = 'purchase': الصنف من كل الأصناف وبعدين المخزن
export default function InvoiceLinesEditor({ mode, lines, onChange, stores, products, stock, priceField, priceLabel, styles, idPrefix }) {
  const productById = new Map(products.map((p) => [p.id, p]));
  const isSale = mode === 'sale';

  const productsForLine = (line) => {
    if (!isSale) return products;
    if (!line.storeId) return [];
    const available = [];
    for (const p of products) {
      const qty = safeQty(stock?.get(stockKey(line.storeId, p.id))?.totalQuantity);
      if (qty > 0 || p.id === line.productId) available.push(p);
    }
    return available;
  };

  const update = (index, patch) => {
    onChange(lines.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  };

  const handleStore = (index, storeId) => {
    if (isSale) update(index, { storeId, productId: '', productSearchText: '', [priceField]: '', quantity: '' });
    else update(index, { storeId });
  };

  const handleProductText = (index, text) => {
    const line = lines[index];
    const matched = productsForLine(line).find((p) => p.name === text);
    const patch = { productSearchText: text, productId: matched ? matched.id : '' };
    if (matched && isSale) patch[priceField] = String(matched.price ?? '');
    update(index, patch);
  };

  return (
    <>
      {lines.map((line, index) => {
        const product = productById.get(line.productId);
        const available = isSale && line.storeId && line.productId
          ? safeQty(stock?.get(stockKey(line.storeId, line.productId))?.totalQuantity)
          : null;
        const storeSelect = (
          <div key="store">
            <label className={styles.formLabel}>المخزن</label>
            <select className={styles.formSelect} value={line.storeId} onChange={(e) => handleStore(index, e.target.value)}>
              <option value="">اختر مخزن</option>
              {stores.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
        );
        const productInput = (
          <div key="product">
            <label className={styles.formLabel}>
              الصنف
              {available !== null && (
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginRight: '8px' }}>(المتاح: {available})</span>
              )}
            </label>
            <input
              type="text"
              className={styles.formInput}
              placeholder={isSale && !line.storeId ? 'اختر مخزن أولاً' : 'ابحث عن صنف...'}
              value={line.productSearchText ?? ''}
              onChange={(e) => handleProductText(index, e.target.value)}
              list={`${idPrefix}-products-${index}`}
              disabled={isSale && !line.storeId}
            />
            <datalist id={`${idPrefix}-products-${index}`}>
              {productsForLine(line).map((p) => (
                <option key={p.id} value={p.name} />
              ))}
            </datalist>
          </div>
        );
        return (
          <div key={index} className={styles.productLine}>
            {isSale ? [storeSelect, productInput] : [productInput]}
            <div>
              <label className={styles.formLabel}>
                {priceLabel}
                {!isSale && product && (
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', marginRight: '8px' }}>(سعر البيع: {Number(product.price || 0).toLocaleString()})</span>
                )}
              </label>
              <input type="number" className={styles.formInput} placeholder="0" value={line[priceField]} onChange={(e) => update(index, { [priceField]: e.target.value })} />
            </div>
            <div>
              <label className={styles.formLabel}>الكمية</label>
              <input type="number" className={styles.formInput} placeholder="0" value={line.quantity} onChange={(e) => update(index, { quantity: e.target.value })} />
            </div>
            {!isSale && storeSelect}
            <button
              type="button"
              className={styles.removeBtn}
              onClick={() => onChange(lines.filter((_, i) => i !== index))}
              title="حذف الصنف"
              disabled={lines.length === 1}
            >
              <HiX size={18} />
            </button>
          </div>
        );
      })}
      <button type="button" className={styles.addLineBtn} onClick={() => onChange([...lines, emptyLine(priceField)])}>
        <HiPlus size={16} /> إضافة صنف آخر
      </button>
    </>
  );
}

// إجمالي السطور للعرض (نفس طريقة الحساب في الـ service)
export const linesTotal = (lines, priceField) =>
  Math.round(lines.reduce((sum, l) => sum + Math.round((Number(l[priceField]) || 0) * (Number(l.quantity) || 0) * 100) / 100, 0) * 100) / 100;

export const linesFromInvoice = (invoice) =>
  (invoice?.products || []).map((p) => ({ ...p, productSearchText: p.productName || '' }));
