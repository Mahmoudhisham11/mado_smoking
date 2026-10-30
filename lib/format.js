// تنسيق موحد للأرقام والتواريخ في التقارير والـ PDF (أرقام لاتينية وشهور عربي)
const moneyFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
const dateFmt = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { year: 'numeric', month: 'long', day: 'numeric' });
const shortDateFmt = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit' });

const asDate = (d) => (d instanceof Date ? d : d ? new Date(d) : null);

export const fmtMoney = (n) => moneyFmt.format(Number(n) || 0);
export const fmtCurrency = (n) => `${fmtMoney(n)} ج.م`;
export const fmtQty = (n) => moneyFmt.format(Number(n) || 0);
export const fmtDate = (d) => (asDate(d) ? dateFmt.format(asDate(d)) : '');
export const fmtShortDate = (d) => (asDate(d) ? shortDateFmt.format(asDate(d)) : '');
export const fmtTime = (d) => (asDate(d) ? timeFmt.format(asDate(d)) : '');
export const fmtDateTime = (d) => (asDate(d) ? `${shortDateFmt.format(asDate(d))} - ${timeFmt.format(asDate(d))}` : '');
