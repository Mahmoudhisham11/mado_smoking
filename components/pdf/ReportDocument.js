import PdfShell, { SummaryCard, SectionTitle } from './PdfShell';
import styles from './Pdf.module.css';
import { fmtCurrency, fmtDate, fmtMoney, fmtQty, fmtTime, fmtShortDate } from '../../lib/format';

const signed = (n) => (n > 0 ? `+${fmtQty(n)}` : fmtQty(n));

// تقرير فترة احترافي (يومي أو لفترة). report من buildPeriodReport
export default function ReportDocument({ report, from, to }) {
  const { kpis } = report;
  const sameDay = fmtShortDate(from) === fmtShortDate(to);
  const period = sameDay ? fmtDate(from) : `${fmtDate(from)} ← ${fmtDate(to)}`;
  const multiDay = !sameDay;

  return (
    <PdfShell title={sameDay ? 'التقرير اليومي' : 'تقرير الفترة'} subtitle={period} thanks="تقرير داخلي">
      <div className={styles.kpiGrid} data-pdf-row>
        <SummaryCard tone="dark" label="صافي المبيعات" value={fmtCurrency(kpis.salesTotal)} hint={`${kpis.salesCount} فاتورة • ${fmtQty(kpis.itemsSold)} قطعة`} />
        <SummaryCard tone="green" label="إجمالي الربح" value={fmtCurrency(kpis.grossProfit)} hint={`هامش ${kpis.margin}%`} />
        <SummaryCard tone={kpis.netProfit >= 0 ? 'green' : 'red'} label="صافي الربح بعد المصاريف" value={fmtCurrency(kpis.netProfit)} />
        <SummaryCard tone="gold" label="متوسط الفاتورة" value={fmtCurrency(kpis.averageInvoice)} />
      </div>
      <div className={styles.kpiGrid} style={{ marginTop: 10 }} data-pdf-row>
        <SummaryCard label="التحصيل من العملاء" value={fmtCurrency(kpis.collected)} hint={kpis.refunded ? `صرف للعملاء ${fmtCurrency(kpis.refunded)}` : ''} />
        <SummaryCard label="المشتريات" value={fmtCurrency(kpis.purchasesTotal)} hint={`${kpis.purchasesCount} فاتورة`} />
        <SummaryCard label="المدفوع للموردين" value={fmtCurrency(kpis.paidToSuppliers)} />
        <SummaryCard tone="red" label="المصاريف" value={fmtCurrency(kpis.expensesTotal)} />
      </div>
      <div className={`${styles.summaryGrid} ${styles.summaryGrid3}`} data-pdf-row>
        <SummaryCard tone="green" label="نقدية داخلة" value={fmtCurrency(kpis.cashIn)} />
        <SummaryCard tone="red" label="نقدية خارجة" value={fmtCurrency(kpis.cashOut)} />
        <SummaryCard tone="dark" label="صافي حركة النقدية" value={fmtCurrency(kpis.netCash)} />
      </div>

      <SectionTitle hint={`${report.products.length} صنف`}>المبيعات والأرباح حسب الصنف</SectionTitle>
      {report.products.length === 0 ? (
        <div className={styles.empty} data-pdf-row>لا توجد مبيعات في هذه الفترة</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.idx}>#</th>
              <th>الصنف</th>
              <th className={styles.num}>الكمية</th>
              <th className={styles.num}>المبيعات</th>
              <th className={styles.num}>التكلفة</th>
              <th className={styles.num}>الربح</th>
              <th className={styles.num}>الهامش</th>
            </tr>
          </thead>
          <tbody>
            {report.products.map((p, i) => (
              <tr key={p.productId} data-pdf-row>
                <td className={styles.idx}>{i + 1}</td>
                <td className={styles.strong}>{p.name}</td>
                <td className={styles.num}>{fmtQty(p.qty)}</td>
                <td className={styles.num}>{fmtMoney(p.revenue)}</td>
                <td className={`${styles.num} ${styles.muted}`}>{fmtMoney(p.cost)}</td>
                <td className={`${styles.num} ${p.profit < 0 ? styles.neg : styles.pos}`}>{fmtMoney(p.profit)}</td>
                <td className={styles.num}>{p.margin}%</td>
              </tr>
            ))}
            <tr className={styles.tfoot} data-pdf-row>
              <td colSpan={2}>الإجمالي</td>
              <td className={styles.num}>{fmtQty(kpis.itemsSold)}</td>
              <td className={styles.num}>{fmtMoney(kpis.salesTotal)}</td>
              <td className={styles.num}>{fmtMoney(kpis.cogs)}</td>
              <td className={styles.num}>{fmtMoney(kpis.grossProfit)}</td>
              <td className={styles.num}>{kpis.margin}%</td>
            </tr>
          </tbody>
        </table>
      )}

      {report.customers.length > 0 && (
        <>
          <SectionTitle>العملاء</SectionTitle>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>العميل</th>
                <th className={styles.num}>الفواتير</th>
                <th className={styles.num}>قيمة المبيعات</th>
                <th className={styles.num}>المحصّل</th>
                <th className={styles.num}>صرف للعميل</th>
              </tr>
            </thead>
            <tbody>
              {report.customers.map((c) => (
                <tr key={c.customerId} data-pdf-row>
                  <td className={styles.strong}>{c.name}</td>
                  <td className={styles.num}>{c.invoices}</td>
                  <td className={styles.num}>{fmtMoney(c.total)}</td>
                  <td className={`${styles.num} ${styles.pos}`}>{fmtMoney(c.collected)}</td>
                  <td className={`${styles.num} ${c.refunded ? styles.neg : styles.muted}`}>{fmtMoney(c.refunded)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {report.suppliers.length > 0 && (
        <>
          <SectionTitle>الموردين</SectionTitle>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>المورد</th>
                <th className={styles.num}>الفواتير</th>
                <th className={styles.num}>قيمة المشتريات</th>
                <th className={styles.num}>المدفوع (صافي)</th>
              </tr>
            </thead>
            <tbody>
              {report.suppliers.map((s) => (
                <tr key={s.sourceId} data-pdf-row>
                  <td className={styles.strong}>{s.name}</td>
                  <td className={styles.num}>{s.invoices}</td>
                  <td className={styles.num}>{fmtMoney(s.total)}</td>
                  <td className={styles.num}>{fmtMoney(s.paid)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <SectionTitle hint="بالقطعة">حركة المخازن</SectionTitle>
      {report.stockMovements.length === 0 ? (
        <div className={styles.empty} data-pdf-row>لا توجد حركة مخزون في هذه الفترة</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>المخزن</th>
              <th>الصنف</th>
              <th className={styles.num}>شراء</th>
              <th className={styles.num}>بيع</th>
              <th className={styles.num}>تحويل وارد</th>
              <th className={styles.num}>تحويل صادر</th>
              <th className={styles.num}>تسوية</th>
              <th className={styles.num}>الصافي</th>
            </tr>
          </thead>
          <tbody>
            {report.stockMovements.map((m, i) => (
              <tr key={i} data-pdf-row>
                <td className={styles.muted}>{m.storeName}</td>
                <td className={styles.strong}>{m.productName}</td>
                <td className={styles.num}>{m.purchased ? fmtQty(m.purchased) : '—'}</td>
                <td className={styles.num}>{m.sold ? fmtQty(m.sold) : '—'}</td>
                <td className={styles.num}>{m.transferIn ? fmtQty(m.transferIn) : '—'}</td>
                <td className={styles.num}>{m.transferOut ? fmtQty(m.transferOut) : '—'}</td>
                <td className={styles.num}>{m.adjusted ? signed(m.adjusted) : '—'}</td>
                <td className={`${styles.num} ${m.net < 0 ? styles.neg : m.net > 0 ? styles.pos : ''}`}>{signed(m.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {report.custodies.length > 0 && (
        <>
          <SectionTitle>حركة العهد</SectionTitle>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>العهدة</th>
                <th className={styles.num}>داخل</th>
                <th className={styles.num}>خارج</th>
                <th className={styles.num}>الصافي</th>
              </tr>
            </thead>
            <tbody>
              {report.custodies.map((c) => (
                <tr key={c.custodyId} data-pdf-row>
                  <td className={styles.strong}>{c.name}</td>
                  <td className={`${styles.num} ${styles.pos}`}>{fmtMoney(c.in)}</td>
                  <td className={`${styles.num} ${styles.neg}`}>{fmtMoney(c.out)}</td>
                  <td className={`${styles.num} ${styles.strong}`}>{fmtMoney(c.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {report.expenses.length > 0 && (
        <>
          <SectionTitle>المصاريف</SectionTitle>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>{multiDay ? 'التاريخ' : 'الوقت'}</th>
                <th>البيان</th>
                <th>العهدة</th>
                <th className={styles.num}>المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {report.expenses.map((e) => (
                <tr key={e.id} data-pdf-row>
                  <td className={styles.muted}>{multiDay ? fmtShortDate(e.date) : fmtTime(e.date)}</td>
                  <td>{e.notes || 'مصروف'}</td>
                  <td className={styles.muted}>{e.custodyName}</td>
                  <td className={`${styles.num} ${styles.neg}`}>{fmtMoney(e.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <SectionTitle hint={`${report.timeline.length} عملية`}>سجل كل العمليات</SectionTitle>
      {report.timeline.length === 0 ? (
        <div className={styles.empty} data-pdf-row>لا توجد عمليات في هذه الفترة</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>{multiDay ? 'التاريخ' : 'الوقت'}</th>
              <th>العملية</th>
              <th>التفاصيل</th>
              <th>المستخدم</th>
              <th className={styles.num}>المبلغ</th>
            </tr>
          </thead>
          <tbody>
            {report.timeline.map((t, i) => (
              <tr key={i} data-pdf-row>
                <td className={styles.muted}>{multiDay ? `${fmtShortDate(t.date)} ${fmtTime(t.date)}` : fmtTime(t.date)}</td>
                <td><span className={`${styles.pill} ${styles.pillGold}`}>{t.type}</span></td>
                <td>{t.description}</td>
                <td className={styles.muted}>{t.user}</td>
                <td className={styles.num}>{t.amount === null ? '—' : fmtMoney(t.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </PdfShell>
  );
}
