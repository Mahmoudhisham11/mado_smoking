import PdfShell, { MetaCard, SummaryCard, SectionTitle } from './PdfShell';
import styles from './Pdf.module.css';
import { fmtCurrency, fmtDate, fmtMoney, fmtQty, fmtTime, fmtShortDate } from '../../lib/format';
import { invoiceLabel } from '../../lib/domain/reports';
import { safeMoney } from '../../lib/domain/accounting';

// فاتورة بيع (عميل) أو شراء (مورد)
// payments: المدفوعات المرتبطة بالفاتورة — partyBalance: رصيد الحساب الإجمالي الحالي
export default function InvoiceDocument({ kind, invoice, party, payments = [], partyBalance }) {
  const isSale = kind === 'sale';
  const priceField = isSale ? 'sellingPrice' : 'wholesalePrice';
  const lines = invoice.products || [];
  const total = safeMoney(invoice.totalCost);
  const paid = safeMoney(payments.reduce((s, p) => s + safeMoney(p.amount), 0));
  const remaining = safeMoney(total - paid);
  const balance = safeMoney(partyBalance);

  return (
    <PdfShell
      title={isSale ? 'فاتورة بيع' : 'فاتورة شراء'}
      subtitle={`رقم ${invoiceLabel(invoice)}  •  ${fmtDate(invoice.date)}`}
    >
      <div className={styles.metaGrid} data-pdf-row>
        <MetaCard wide label={isSale ? 'فاتورة إلى' : 'المورد'} value={party?.name} sub={party?.phone} />
        <MetaCard label="رقم الفاتورة" value={invoiceLabel(invoice)} />
        <MetaCard label="التاريخ والوقت" value={fmtShortDate(invoice.date)} sub={fmtTime(invoice.date)} />
      </div>

      <SectionTitle hint={`${lines.length} صنف • ${fmtQty(invoice.totalItems)} قطعة`}>تفاصيل الأصناف</SectionTitle>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.idx}>#</th>
            <th>الصنف</th>
            <th>المخزن</th>
            <th className={styles.num}>الكمية</th>
            <th className={styles.num}>سعر الوحدة</th>
            <th className={styles.num}>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} data-pdf-row>
              <td className={styles.idx}>{i + 1}</td>
              <td className={styles.strong}>{line.productName}</td>
              <td className={styles.muted}>{line.storeName}</td>
              <td className={styles.num}>{fmtQty(line.quantity)}</td>
              <td className={styles.num}>{fmtMoney(line[priceField])}</td>
              <td className={`${styles.num} ${styles.strong}`}>{fmtMoney(line.lineTotal ?? safeMoney(line[priceField]) * Number(line.quantity || 0))}</td>
            </tr>
          ))}
          <tr className={styles.tfoot} data-pdf-row>
            <td colSpan={3}>الإجمالي</td>
            <td className={styles.num}>{fmtQty(invoice.totalItems)}</td>
            <td />
            <td className={styles.num}>{fmtCurrency(total)}</td>
          </tr>
        </tbody>
      </table>

      <div className={styles.summaryGrid} data-pdf-row>
        <SummaryCard tone="dark" label="إجمالي الفاتورة" value={fmtCurrency(total)} />
        <SummaryCard tone="green" label="المدفوع" value={fmtCurrency(paid)} hint={payments.length ? `${payments.length} عملية سداد` : 'لم يتم السداد'} />
        <SummaryCard tone={remaining > 0 ? 'red' : 'green'} label="المتبقي من الفاتورة" value={fmtCurrency(Math.max(remaining, 0))} hint={remaining < 0 ? `مدفوع زيادة ${fmtCurrency(-remaining)}` : ''} />
        {partyBalance !== undefined && (
          <SummaryCard
            tone="gold"
            label={isSale ? 'إجمالي مديونية الحساب' : 'إجمالي المستحق للمورد'}
            value={fmtCurrency(Math.abs(balance))}
            hint={balance < 0 ? (isSale ? 'رصيد دائن للعميل' : 'رصيد لنا عند المورد') : 'شامل كل الفواتير'}
          />
        )}
      </div>

      {payments.length > 0 && (
        <>
          <SectionTitle>المدفوعات على الفاتورة</SectionTitle>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>التاريخ</th>
                <th>الوقت</th>
                <th className={styles.num}>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} data-pdf-row>
                  <td>{fmtShortDate(p.date)}</td>
                  <td className={styles.muted}>{fmtTime(p.date)}</td>
                  <td className={`${styles.num} ${safeMoney(p.amount) < 0 ? styles.neg : styles.pos}`}>{fmtCurrency(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {invoice.notes && <div className={styles.notes} data-pdf-row>ملاحظات: {invoice.notes}</div>}
    </PdfShell>
  );
}
