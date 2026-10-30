// منطق المحاسبة والمخزون الصافي (بدون Firebase) عشان يبقى قابل للاختبار.
// أي حساب فلوس أو كميات في التطبيق لازم يعدي من هنا.

// السماح للعهدة إنها تبقى بالسالب. القيمة الافتراضية: ممنوع.
export const ALLOW_NEGATIVE_CUSTODY = false;

const EPSILON = 0.000001;

export class AppError extends Error {
  constructor(message) {
    super(message);
    this.name = 'AppError';
  }
}

// تقريب المبلغ لقرشين ورفض أي قيمة مش رقم
export const toMoney = (value) => {
  const num = typeof value === 'string' ? Number(value.trim()) : Number(value);
  if (value === '' || value === null || value === undefined || !Number.isFinite(num)) {
    throw new AppError('قيمة المبلغ غير صحيحة');
  }
  const rounded = Math.round((num + Math.sign(num) * EPSILON) * 100) / 100;
  return Object.is(rounded, -0) ? 0 : rounded;
};

// نفس toMoney بس بترجع 0 للقيم الفاضية أو الغلط (للعرض والبيانات القديمة)
export const safeMoney = (value) => {
  try {
    return toMoney(value);
  } catch {
    return 0;
  }
};

export const toQty = (value) => {
  const num = Number(value);
  if (value === '' || value === null || value === undefined || !Number.isFinite(num)) {
    throw new AppError('الكمية غير صحيحة');
  }
  const rounded = Math.round(num * 1000) / 1000;
  return Object.is(rounded, -0) ? 0 : rounded;
};

export const safeQty = (value) => {
  try {
    return toQty(value);
  } catch {
    return 0;
  }
};

export const sumMoney = (items, pick = (x) => x) =>
  safeMoney(items.reduce((sum, item) => sum + safeMoney(pick(item)), 0));

export const stockKey = (storeId, productId) => `${storeId}_${productId}`;

export const custodyDocId = (ownerId, userId) => `${ownerId}_${userId}`;

// تجهيز سطور الفاتورة: تحقق + تقريب + إجمالي السطر
export const normalizeLines = (lines, priceField) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    throw new AppError('الفاتورة لازم يكون فيها صنف واحد على الأقل');
  }
  return lines.map((line, i) => {
    const n = i + 1;
    if (!line.storeId) throw new AppError(`المخزن للصنف رقم ${n} لم يتم اختياره`);
    if (!line.productId) throw new AppError(`الصنف رقم ${n} لم يتم اختياره`);
    const quantity = toQty(line.quantity);
    if (quantity <= 0) throw new AppError(`الكمية للصنف رقم ${n} غير صحيحة`);
    const price = toMoney(line[priceField] === '' || line[priceField] === undefined ? 0 : line[priceField]);
    if (price < 0) throw new AppError(`السعر للصنف رقم ${n} لا يمكن أن يكون بالسالب`);
    return { ...line, quantity, [priceField]: price, lineTotal: toMoney(price * quantity) };
  });
};

export const invoiceTotals = (lines) => ({
  totalCost: sumMoney(lines, (l) => l.lineTotal),
  totalItems: safeQty(lines.reduce((s, l) => s + safeQty(l.quantity), 0)),
});

// تجميع الكميات حسب (مخزن، صنف) — عشان نفس الصنف في سطرين يتحسب صح
export const aggregateQuantities = (lines) => {
  const map = new Map();
  for (const line of lines || []) {
    const key = stockKey(line.storeId, line.productId);
    const prev = map.get(key);
    map.set(key, {
      storeId: line.storeId,
      storeName: line.storeName || prev?.storeName || '',
      productId: line.productId,
      productName: line.productName || prev?.productName || '',
      quantity: safeQty((prev?.quantity || 0) + safeQty(line.quantity)),
    });
  }
  return map;
};

// فرق المخزون بين الفاتورة القديمة والجديدة.
// direction = +1 للشراء (بيزود المخزن)، -1 للبيع (بيخصم من المخزن)
export const inventoryDeltas = (oldLines, newLines, direction) => {
  const oldMap = aggregateQuantities(oldLines);
  const newMap = aggregateQuantities(newLines);
  const keys = new Set([...oldMap.keys(), ...newMap.keys()]);
  const result = [];
  for (const key of keys) {
    const o = oldMap.get(key);
    const n = newMap.get(key);
    const delta = safeQty(direction * ((n?.quantity || 0) - (o?.quantity || 0)));
    if (delta === 0) continue;
    const base = n || o;
    result.push({ key, storeId: base.storeId, storeName: base.storeName, productId: base.productId, productName: base.productName, delta });
  }
  return result;
};

// تحويل بين مخزنين = خصم من المصدر + إضافة للهدف
export const transferDeltas = (transfer) => {
  const out = [];
  for (const line of transfer?.products || []) {
    out.push({ storeId: transfer.fromStoreId, storeName: transfer.fromStoreName, productId: line.productId, productName: line.productName, delta: -safeQty(line.quantity) });
    out.push({ storeId: transfer.toStoreId, storeName: transfer.toStoreName, productId: line.productId, productName: line.productName, delta: safeQty(line.quantity) });
  }
  return out;
};

export const mergeDeltas = (...lists) => {
  const map = new Map();
  for (const d of lists.flat()) {
    const key = stockKey(d.storeId, d.productId);
    const prev = map.get(key);
    map.set(key, { ...(prev || d), key, delta: safeQty((prev?.delta || 0) + d.delta) });
  }
  return [...map.values()].filter((d) => d.delta !== 0);
};

export const shortageMessage = ({ productName, storeName, available, required }) =>
  `الكمية غير كافية للصنف "${productName || 'غير معروف'}"${storeName ? ` في مخزن "${storeName}"` : ''} (المتاح ${available}، المطلوب ${required})`;

// التحقق إن الخصم من العهدة مايخليهاش بالسالب
export const checkCustody = (currentAmount, delta, custodyName, allowNegative = ALLOW_NEGATIVE_CUSTODY) => {
  const next = safeMoney(safeMoney(currentAmount) + delta);
  if (!allowNegative && delta < 0 && next < 0) {
    throw new AppError(
      `رصيد العهدة "${custodyName || ''}" لا يكفي (المتاح ${safeMoney(currentAmount)}، المطلوب ${safeMoney(-delta)})`
    );
  }
  return next;
};

// حد الائتمان: بيمنع بس لو المديونية بتزيد وتعدّت الحد
export const checkCreditLimit = (balanceBefore, balanceAfter, creditLimit) => {
  const limit = safeMoney(creditLimit);
  if (limit > 0 && balanceAfter > limit && balanceAfter > balanceBefore) {
    throw new AppError(
      `إجمالي المديونية (${balanceAfter.toLocaleString()} ج.م) سيتجاوز حد الائتمان (${limit.toLocaleString()} ج.م). المديونية الحالية: ${safeMoney(balanceBefore).toLocaleString()} ج.م. يرجى سداد ${safeMoney(balanceAfter - limit).toLocaleString()} ج.م على الأقل.`
    );
  }
};

// أثر سداد العميل. المبلغ بإشارته: موجب = تحصيل من العميل، سالب = صرف للعميل (مرتجع)
export const customerPaymentEffect = (amount) => {
  const a = toMoney(amount);
  return { custodyDelta: a, totalPaidDelta: a, balanceDelta: safeMoney(-a), type: a < 0 ? 'refund' : 'payment' };
};

// أثر سداد المورد. موجب = دفعنا للمورد، سالب = المورد رجّع فلوس
export const sourcePaymentEffect = (amount) => {
  const a = toMoney(amount);
  return { custodyDelta: safeMoney(-a), totalPaidDelta: a, balanceDelta: safeMoney(-a), type: a < 0 ? 'refund' : 'payment' };
};

// ملخص المدفوعات للعرض: المحصّل، المصروف للعميل، والصافي
export const summarizePayments = (payments) => {
  let received = 0;
  let refunded = 0;
  for (const p of payments || []) {
    const a = safeMoney(p.amount);
    if (a >= 0) received += a;
    else refunded += -a;
  }
  received = safeMoney(received);
  refunded = safeMoney(refunded);
  return { received, refunded, net: safeMoney(received - refunded) };
};

// الربح من تكلفة السطر المحفوظة وقت البيع (أو تكلفة بديلة للبيانات القديمة)
export const invoiceProfit = (lines, fallbackCost = () => 0) =>
  safeMoney(
    (lines || []).reduce((sum, line) => {
      const cost = line.unitCost !== undefined && line.unitCost !== null ? safeMoney(line.unitCost) : safeMoney(fallbackCost(line.productId));
      return sum + (safeMoney(line.sellingPrice) - cost) * safeQty(line.quantity);
    }, 0)
  );

export const normalizeName = (name) =>
  String(name || '')
    .trim()
    .replace(/[إأآا]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .toLowerCase();
