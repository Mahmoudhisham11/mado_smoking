import PdfShell, { MetaCard, SummaryCard, SectionTitle } from './PdfShell';
import styles from './Pdf.module.css';
import { fmtCurrency, fmtDate, fmtMoney, fmtShortDate } from '../../lib/format';

const KIND_LABELS = {
  sale: { invoice: 'فاتورة بيع', payment: 'سداد من العميل', refund: 'صرف للعميل' },
  purchase: { invoice: 'فاتورة شراء', payment: 'دفع للمورد', refund: 'استرداد من المورد' },
};

// كشف حساب عميل أو مورد. statement من buildStatement
export default function StatementDocument({ kind, party, statement, from, to }) {
  const isSale = kind === 'sale';
  const labels = KIND_LABELS[kind];
  const period = from || to ? `${from ? fmtDate(from) : 'البداية'} ← ${to ? fmtDate(to) : 'اليوم'}` : 'كل التعاملات';
  const { opening, closing, rows, totals, lastPayment } = statement;

  return (
    <PdfShell title="كشف حساب" subtitle={period} thanks="نشكركم على ثقتكم">
      <div className={styles.metaGrid} data-pdf-row>
        <MetaCard wide label={isSale ? 'العميل' : 'المورد'} value={party?.name} sub={party?.phone} />
        <MetaCard label="عدد الفواتير" value={`${totals.invoiceCount} فاتورة`} />
        <MetaCard label="آخر سداد" value={lastPayment ? fmtCurrency(lastPayment.amount) : 'لا يوجد'} sub={lastPayment ? fmtShortDate(lastPayment.date) : ''} />
      </div>

      <div className={styles.summaryGrid} data-pdf-row>
        <SummaryCard label="الرصيد الافتتاحي" value={fmtCurrency(opening)} hint={from ? 'قبل بداية الفترة' : ''} />
        <SummaryCard tone="gold" label="إجمالي الفواتير" value={fmtCurrency(totals.invoiced)} />
        <SummaryCard
          tone="green"
          label={isSale ? 'إجمالي المحصّل' : 'إجمالي المدفوع'}
          value={fmtCurrency(totals.netPaid)}
          hint={totals.refunded ? `${labels.refund}: ${fmtCurrency(totals.refunded)}` : ''}
        />
        <SummaryCard
          tone="dark"
          label={isSale ? 'الرصيد المتبقي على العميل' : 'الرصيد المستحق للمورد'}
          value={fmtCurrency(Math.abs(closing))}
          hint={closing < 0 ? (isSale ? 'رصيد دائن للعميل' : 'رصيد لنا عند المورد') : ''}
        />
      </div>

      <SectionTitle hint={`${rows.length} حركة`}>تفاصيل الحركات</SectionTitle>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>التاريخ</th>
            <th>البيان</th>
            <th>المرجع</th>
            <th className={styles.num}>فواتير</th>
            <th className={styles.num}>مدفوعات</th>
            <th className={styles.num}>الرصيد</th>
          </tr>
        </thead>
        <tbody>
          {from && (
            <tr className={styles.openingRow} data-pdf-row>
              <td>{fmtShortDate(from)}</td>
              <td colSpan={4}>رصيد افتتاحي</td>
              <td className={styles.num}>{fmtMoney(opening)}</td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={`${r.kind}-${r.id}`} data-pdf-row>
              <td>{fmtShortDate(r.date)}</td>
              <td>
                <span className={`${styles.pill} ${r.kind === 'invoice' ? styles.pillGold : r.kind === 'refund' ? styles.pillRed : styles.pillGreen}`}>
                  {labels[r.kind]}
                </span>
                {r.notes ? <span className={styles.muted}> {r.notes}</span> : null}
              </td>
              <td className={styles.muted}>{r.ref}</td>
              <td className={styles.num}>{r.invoiceAmount ? fmtMoney(r.invoiceAmount) : ''}</td>
              <td className={`${styles.num} ${r.paymentAmount < 0 ? styles.neg : ''}`}>{r.paymentAmount ? fmtMoney(r.paymentAmount) : ''}</td>
              <td className={`${styles.num} ${styles.strong}`}>{fmtMoney(r.balance)}</td>
            </tr>
          ))}
          <tr className={styles.tfoot} data-pdf-row>
            <td colSpan={3}>الإجمالي</td>
            <td className={styles.num}>{fmtMoney(totals.invoiced)}</td>
            <td className={styles.num}>{fmtMoney(totals.netPaid)}</td>
            <td className={styles.num}>{fmtCurrency(closing)}</td>
          </tr>
        </tbody>
      </table>
    </PdfShell>
  );
}
