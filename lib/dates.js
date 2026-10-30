// تحويل قيمة input[type=date] (YYYY-MM-DD) لتاريخ محلي بدون مشاكل المنطقة الزمنية
export const parseDateInput = (value) => {
  if (!value) return null;
  const [y, m, d] = String(value).split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
};
