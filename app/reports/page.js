'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '../../components/auth/AuthGuard';
import MainLayout from '../../components/layout/MainLayout';
import OwnerOnly from '../../components/auth/OwnerOnly';
import Button from '../../components/ui/Button';
import ReportDocument from '../../components/pdf/ReportDocument';
import SharePdfDialog from '../../components/pdf/SharePdfDialog';
import usePdfShare from '../../components/pdf/usePdfShare';
import { fetchPeriodData, subscribeToCustomers, subscribeToSources, subscribeToProducts } from '../../lib/firebase/firestore';
import { buildPeriodReport } from '../../lib/domain/reports';
import { parseDateInput } from '../../lib/dates';
import { fmtCurrency, fmtDate, fmtMoney, fmtQty, fmtShortDate, fmtTime } from '../../lib/format';
import { FaWhatsapp } from 'react-icons/fa';
import { HiRefresh, HiDownload, HiChartBar, HiTrendingUp, HiCash, HiShoppingCart, HiReceiptTax, HiCube, HiUserGroup, HiTruck, HiClipboardList, HiClock } from 'react-icons/hi';
import styles from './page.module.css';

const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const toInput = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const PRESETS = [
  { key: 'today', label: 'اليوم' },
  { key: 'yesterday', label: 'أمس' },
  { key: 'week', label: 'آخر 7 أيام' },
  { key: 'month', label: 'هذا الشهر' },
  { key: 'custom', label: 'فترة مخصصة' },
];

const rangeFor = (preset, customFrom, customTo) => {
  const now = new Date();
  if (preset === 'yesterday') {
    const y = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
    return { from: startOfDay(y), to: endOfDay(y) };
  }
  if (preset === 'week') return { from: startOfDay(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6)), to: endOfDay(now) };
  if (preset === 'month') return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: endOfDay(now) };
  if (preset === 'custom') {
    const f = parseDateInput(customFrom) || now;
    const t = parseDateInput(customTo) || f;
    return f <= t ? { from: startOfDay(f), to: endOfDay(t) } : { from: startOfDay(t), to: endOfDay(f) };
  }
  return { from: startOfDay(now), to: endOfDay(now) };
};

const TABS = [
  { key: 'sales', label: 'المبيعات والأرباح', icon: HiTrendingUp },
  { key: 'customers', label: 'العملاء', icon: HiUserGroup },
  { key: 'suppliers', label: 'الموردين', icon: HiTruck },
  { key: 'stock', label: 'حركة المخازن', icon: HiCube },
  { key: 'cash', label: 'النقدية والمصاريف', icon: HiCash },
  { key: 'timeline', label: 'سجل العمليات', icon: HiClock },
];

export default function ReportsPage() {
  return (
    <AuthGuard>
      <MainLayout>
        <OwnerOnly>
          <Reports />
        </OwnerOnly>
      </MainLayout>
    </AuthGuard>
  );
}

function Reports() {
  const [preset, setPreset] = useState('today');
  const [customFrom, setCustomFrom] = useState(toInput(new Date()));
  const [customTo, setCustomTo] = useState(toInput(new Date()));
  const [tab, setTab] = useState('sales');
  const [refreshTick, setRefreshTick] = useState(0);
  const [result, setResult] = useState({ key: null, data: null, error: '' });
  const [customers, setCustomers] = useState([]);
  const [sources, setSources] = useState([]);
  const [products, setProducts] = useState([]);
  const share = usePdfShare();

  const { from, to } = rangeFor(preset, customFrom, customTo);
  const key = `${from.getTime()}-${to.getTime()}-${refreshTick}`;
  const loading = result.key !== key;

  useEffect(() => {
    const u1 = subscribeToCustomers(setCustomers);
    const u2 = subscribeToSources(setSources);
    const u3 = subscribeToProducts(setProducts);
    return () => { u1(); u2(); u3(); };
  }, []);

  useEffect(() => {
    let active = true;
    const [f, t] = key.split('-').map(Number);
    fetchPeriodData(new Date(f), new Date(t)).then((res) => {
      if (!active) return;
      setResult({ key, data: res.success ? res.data : null, error: res.success ? '' : res.error });
    });
    return () => { active = false; };
  }, [key]);

  const report = result.data
    ? buildPeriodReport({
      ...result.data,
      customerNames: new Map(customers.map((c) => [c.id, c.name])),
      sourceNames: new Map(sources.map((s) => [s.id, s.name])),
      productCost: new Map(products.map((p) => [p.id, p.lastCost || 0])),
    })
    : null;
  const k = report?.kpis;
  const sameDay = fmtShortDate(from) === fmtShortDate(to);
  const periodLabel = sameDay ? fmtDate(from) : `${fmtDate(from)} ← ${fmtDate(to)}`;
  const filename = `تقرير-${sameDay ? toInput(from) : `${toInput(from)}_${toInput(to)}`}.pdf`;

  // mode = 'download' ينزّل الملف، 'share' يفتح نافذة واتساب
  const exportPdf = (mode) => {
    if (!report) return;
    const { salesTotal, grossProfit } = report.kpis;
    share.generate(mode, <ReportDocument report={report} from={from} to={to} />, {
      filename,
      message: `التقرير ${sameDay ? 'اليومي' : 'للفترة'} - ${periodLabel}\nالمبيعات: ${fmtCurrency(salesTotal)} | الربح: ${fmtCurrency(grossProfit)}`,
    }, mode);
  };

  return (
    <>
      <div className={styles.container}>
        <div className={styles.header}>
          <div>
            <h1 className={styles.title}><HiChartBar /> التقارير</h1>
            <div className={styles.period}>{periodLabel}</div>
          </div>
          <div className={styles.headerActions}>
            <button className={styles.iconBtn} onClick={() => setRefreshTick((n) => n + 1)} title="تحديث" disabled={loading}>
              <HiRefresh size={18} className={loading ? styles.spin : ''} />
            </button>
            <Button variant="secondary" onClick={() => exportPdf('download')} loading={share.generating === 'download'} disabled={!report || !!share.generating}>
              <HiDownload size={16} style={{ marginLeft: '4px' }} /> PDF
            </Button>
            <Button variant="primary" onClick={() => exportPdf('share')} loading={share.generating === 'share'} disabled={!report || !!share.generating} style={{ background: '#25D366', borderColor: '#25D366' }}>
              <FaWhatsapp size={16} style={{ marginLeft: '4px' }} /> إرسال
            </Button>
          </div>
        </div>

        <div className={styles.presets}>
          {PRESETS.map((p) => (
            <button key={p.key} className={`${styles.preset} ${preset === p.key ? styles.presetActive : ''}`} onClick={() => setPreset(p.key)}>
              {p.label}
            </button>
          ))}
          {preset === 'custom' && (
            <div className={styles.customRange}>
              <input type="date" className={styles.dateInput} value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} />
              <span>إلى</span>
              <input type="date" className={styles.dateInput} value={customTo} onChange={(e) => setCustomTo(e.target.value)} />
            </div>
          )}
        </div>

        {(result.error || share.error) && <div className={styles.error}>{result.error || share.error}</div>}

        {!report ? (
          <div className={styles.loading}>{loading ? 'جاري تجهيز التقرير...' : ''}</div>
        ) : (
          <div className={loading ? styles.stale : ''}>
            <div className={styles.kpis}>
              <Kpi tone="primary" icon={HiShoppingCart} label="صافي المبيعات" value={fmtCurrency(k.salesTotal)} hint={`${k.salesCount} فاتورة • ${fmtQty(k.itemsSold)} قطعة`} />
              <Kpi tone="green" icon={HiTrendingUp} label="إجمالي الربح" value={fmtCurrency(k.grossProfit)} hint={`هامش ${k.margin}% • تكلفة ${fmtMoney(k.cogs)}`} />
              <Kpi tone={k.netProfit >= 0 ? 'green' : 'red'} icon={HiChartBar} label="صافي الربح بعد المصاريف" value={fmtCurrency(k.netProfit)} hint={`المصاريف ${fmtMoney(k.expensesTotal)}`} />
              <Kpi tone="gold" icon={HiReceiptTax} label="متوسط الفاتورة" value={fmtCurrency(k.averageInvoice)} />
              <Kpi icon={HiCash} label="التحصيل من العملاء" value={fmtCurrency(k.collected)} hint={k.refunded ? `صرف للعملاء ${fmtMoney(k.refunded)}` : 'بدون مرتجعات'} />
              <Kpi icon={HiTruck} label="المشتريات" value={fmtCurrency(k.purchasesTotal)} hint={`${k.purchasesCount} فاتورة • مدفوع ${fmtMoney(k.paidToSuppliers)}`} />
              <Kpi tone="red" icon={HiClipboardList} label="المصاريف" value={fmtCurrency(k.expensesTotal)} hint={`${report.expenses.length} مصروف`} />
              <Kpi tone={k.netCash >= 0 ? 'green' : 'red'} icon={HiCash} label="صافي حركة النقدية" value={fmtCurrency(k.netCash)} hint={`داخل ${fmtMoney(k.cashIn)} • خارج ${fmtMoney(k.cashOut)}`} />
            </div>

            <div className={styles.tabs}>
              {TABS.map((t) => {
                const Icon = t.icon;
                return (
                  <button key={t.key} className={`${styles.tab} ${tab === t.key ? styles.tabActive : ''}`} onClick={() => setTab(t.key)}>
                    <Icon size={16} /> {t.label}
                  </button>
                );
              })}
            </div>

            <div className={styles.panel}>
              {tab === 'sales' && (
                <DataTable
                  empty="لا توجد مبيعات في هذه الفترة"
                  columns={['#', 'الصنف', 'الكمية', 'المبيعات', 'التكلفة', 'الربح', 'الهامش']}
                  numeric={[2, 3, 4, 5, 6]}
                  rows={report.products.map((p, i) => [i + 1, p.name, fmtQty(p.qty), fmtMoney(p.revenue), fmtMoney(p.cost), <span key="p" className={p.profit < 0 ? styles.neg : styles.pos}>{fmtMoney(p.profit)}</span>, `${p.margin}%`])}
                  footer={report.products.length ? ['', 'الإجمالي', fmtQty(k.itemsSold), fmtMoney(k.salesTotal), fmtMoney(k.cogs), fmtMoney(k.grossProfit), `${k.margin}%`] : null}
                />
              )}
              {tab === 'customers' && (
                <DataTable
                  empty="لا توجد تعاملات مع العملاء في هذه الفترة"
                  columns={['العميل', 'الفواتير', 'قيمة المبيعات', 'المحصّل', 'صرف للعميل']}
                  numeric={[1, 2, 3, 4]}
                  rows={report.customers.map((c) => [c.name, c.invoices, fmtMoney(c.total), <span key="c" className={styles.pos}>{fmtMoney(c.collected)}</span>, c.refunded ? <span key="r" className={styles.neg}>{fmtMoney(c.refunded)}</span> : '—'])}
                />
              )}
              {tab === 'suppliers' && (
                <DataTable
                  empty="لا توجد تعاملات مع الموردين في هذه الفترة"
                  columns={['المورد', 'الفواتير', 'قيمة المشتريات', 'المدفوع (صافي)']}
                  numeric={[1, 2, 3]}
                  rows={report.suppliers.map((s) => [s.name, s.invoices, fmtMoney(s.total), fmtMoney(s.paid)])}
                />
              )}
              {tab === 'stock' && (
                <DataTable
                  empty="لا توجد حركة مخزون في هذه الفترة"
                  columns={['المخزن', 'الصنف', 'شراء', 'بيع', 'تحويل وارد', 'تحويل صادر', 'تسوية', 'الصافي']}
                  numeric={[2, 3, 4, 5, 6, 7]}
                  rows={report.stockMovements.map((m) => [
                    m.storeName, m.productName,
                    m.purchased || '—', m.sold || '—', m.transferIn || '—', m.transferOut || '—',
                    m.adjusted ? (m.adjusted > 0 ? `+${m.adjusted}` : m.adjusted) : '—',
                    <span key="n" className={m.net < 0 ? styles.neg : m.net > 0 ? styles.pos : ''}>{m.net > 0 ? `+${m.net}` : m.net}</span>,
                  ])}
                />
              )}
              {tab === 'cash' && (
                <>
                  <h3 className={styles.subTitle}>حركة العهد</h3>
                  <DataTable
                    empty="لا توجد حركة على العهد"
                    columns={['العهدة', 'داخل', 'خارج', 'الصافي']}
                    numeric={[1, 2, 3]}
                    rows={report.custodies.map((c) => [c.name, <span key="i" className={styles.pos}>{fmtMoney(c.in)}</span>, <span key="o" className={styles.neg}>{fmtMoney(c.out)}</span>, fmtMoney(c.net)])}
                  />
                  <h3 className={styles.subTitle}>المصاريف</h3>
                  <DataTable
                    empty="لا توجد مصاريف"
                    columns={[sameDay ? 'الوقت' : 'التاريخ', 'البيان', 'العهدة', 'المستخدم', 'المبلغ']}
                    numeric={[4]}
                    rows={report.expenses.map((e) => [sameDay ? fmtTime(e.date) : fmtShortDate(e.date), e.notes || 'مصروف', e.custodyName || '—', e.userName || '—', <span key="a" className={styles.neg}>{fmtMoney(e.amount)}</span>])}
                    footer={report.expenses.length ? ['', 'الإجمالي', '', '', fmtMoney(k.expensesTotal)] : null}
                  />
                </>
              )}
              {tab === 'timeline' && (
                <div className={styles.timeline}>
                  {report.timeline.length === 0 && <div className={styles.empty}>لا توجد عمليات في هذه الفترة</div>}
                  {report.timeline.map((t, i) => (
                    <div key={i} className={styles.timelineItem}>
                      <div className={styles.timelineTime}>
                        {!sameDay && <span>{fmtShortDate(t.date)}</span>}
                        <strong>{fmtTime(t.date)}</strong>
                      </div>
                      <div className={styles.timelineDot} />
                      <div className={styles.timelineBody}>
                        <div className={styles.timelineHead}>
                          <span className={styles.badge}>{t.type}</span>
                          {t.amount !== null && <span className={`${styles.timelineAmount} ${t.amount < 0 ? styles.neg : ''}`}>{fmtCurrency(t.amount)}</span>}
                        </div>
                        <div className={styles.timelineDesc}>{t.description}</div>
                        {t.user && <div className={styles.timelineUser}>بواسطة: {t.user}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <SharePdfDialog pdf={share.pdf} onClose={share.close} />
    </>
  );
}

function Kpi({ icon: Icon, label, value, hint, tone }) {
  return (
    <div className={`${styles.kpi} ${tone ? styles[`kpi_${tone}`] : ''}`}>
      <div className={styles.kpiTop}>
        <span className={styles.kpiLabel}>{label}</span>
        {Icon && <span className={styles.kpiIcon}><Icon size={18} /></span>}
      </div>
      <div className={styles.kpiValue}>{value}</div>
      {hint && <div className={styles.kpiHint}>{hint}</div>}
    </div>
  );
}

function DataTable({ columns, rows, numeric = [], footer, empty }) {
  if (!rows.length) return <div className={styles.empty}>{empty}</div>;
  const cls = (i) => (numeric.includes(i) ? styles.num : '');
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <thead>
          <tr>{columns.map((c, i) => <th key={i} className={cls(i)}>{c}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri}>{r.map((cell, i) => <td key={i} className={cls(i)}>{cell}</td>)}</tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr>{footer.map((c, i) => <td key={i} className={cls(i)}>{c}</td>)}</tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
