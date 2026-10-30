'use client';

import { useEffect, useState } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { HiDownload } from 'react-icons/hi';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import StatementDocument from '../pdf/StatementDocument';
import SharePdfDialog from '../pdf/SharePdfDialog';
import usePdfShare from '../pdf/usePdfShare';
import { fetchCustomerLedger, fetchSourceLedger } from '../../lib/firebase/firestore';
import { buildStatement } from '../../lib/domain/reports';
import { parseDateInput } from '../../lib/dates';
import { fmtCurrency, fmtDate, fmtMoney, fmtShortDate, fmtTime } from '../../lib/format';
import styles from './PartyStatement.module.css';

const LABELS = {
  sale: {
    party: 'العميل',
    invoice: 'فاتورة بيع',
    payment: 'سداد',
    refund: 'صرف للعميل',
    paid: 'إجمالي المحصّل',
    balance: 'المتبقي على العميل',
    credit: 'رصيد دائن للعميل',
  },
  purchase: {
    party: 'المورد',
    invoice: 'فاتورة شراء',
    payment: 'دفع للمورد',
    refund: 'استرداد',
    paid: 'إجمالي المدفوع',
    balance: 'المستحق للمورد',
    credit: 'رصيد لنا عند المورد',
  },
};

// كشف حساب مفصل لعميل أو مورد: الرصيد، المدفوع والمتبقي، ومواعيد السداد، وكل التعاملات بالرصيد التراكمي
export default function PartyStatement({ kind, party, isOpen, onClose }) {
  const labels = LABELS[kind];
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [view, setView] = useState('all');
  const [result, setResult] = useState({ key: null, ledger: null, error: '' });
  const share = usePdfShare();

  const partyId = party?.id;
  const key = isOpen && partyId ? partyId : null;
  const loading = key !== null && result.key !== key;

  useEffect(() => {
    if (!key) return;
    let active = true;
    const fetcher = kind === 'sale' ? fetchCustomerLedger : fetchSourceLedger;
    fetcher(key).then((res) => {
      if (!active) return;
      setResult({ key, ledger: res.success ? { invoices: res.invoices, payments: res.payments } : null, error: res.success ? '' : res.error });
    });
    return () => { active = false; };
    // party.balance بيتغير مع كل عملية فبنعيد التحميل عشان الكشف يفضل مطابق
  }, [key, kind, party?.balance]);

  if (!isOpen) return null;

  const fromDate = parseDateInput(filterFrom);
  const toDateRaw = parseDateInput(filterTo);
  const toDate = toDateRaw ? new Date(toDateRaw.getFullYear(), toDateRaw.getMonth(), toDateRaw.getDate(), 23, 59, 59, 999) : null;
  const ledger = result.key === key ? result.ledger : null;
  const statement = ledger ? buildStatement(ledger.invoices, ledger.payments, { from: fromDate, to: toDate }) : null;
  const rows = statement ? statement.rows.filter((r) => view === 'all' || (view === 'payments' ? r.kind !== 'invoice' : r.kind === 'invoice')) : [];
  const closing = statement?.closing ?? 0;
  const safeName = (party?.name || '').replace(/[\\/:*?"<>|]/g, '').trim();

  const exportPdf = (mode) =>
    share.generate(mode, <StatementDocument kind={kind} party={party} statement={statement} from={fromDate} to={toDate} />, {
      filename: `كشف-حساب-${safeName}.pdf`,
      phone: party?.phone,
      recipient: party?.name,
      message: [
        `مرحباً ${party?.name || ''}`,
        `مرفق كشف الحساب${fromDate || toDate ? ` للفترة ${fromDate ? fmtDate(fromDate) : 'من البداية'} - ${toDate ? fmtDate(toDate) : 'حتى اليوم'}` : ''}.`,
        `إجمالي الفواتير: ${fmtCurrency(statement.totals.invoiced)}`,
        `${labels.paid}: ${fmtCurrency(statement.totals.netPaid)}`,
        `${closing < 0 ? labels.credit : labels.balance}: ${fmtCurrency(Math.abs(closing))}`,
        'Mado Smoking',
      ].join('\n'),
    }, mode);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={`كشف حساب: ${party?.name || ''}`}
        size="large"
        footer={
          <div className={styles.footer}>
            <Button variant="secondary" onClick={onClose}>إغلاق</Button>
            <Button variant="secondary" onClick={() => exportPdf('download')} loading={share.generating === 'download'} disabled={!statement || !!share.generating}>
              <HiDownload size={16} style={{ marginLeft: '4px' }} /> تحميل PDF
            </Button>
            <Button variant="primary" onClick={() => exportPdf('share')} loading={share.generating === 'share'} disabled={!statement || !!share.generating} style={{ background: '#25D366', borderColor: '#25D366' }}>
              <FaWhatsapp size={16} style={{ marginLeft: '4px' }} /> إرسال واتساب
            </Button>
          </div>
        }
      >
        {(result.error || share.error) && <div className={styles.error}>{result.error || share.error}</div>}
        {loading || !statement ? (
          <div className={styles.loading}>{loading ? 'جاري تحميل كشف الحساب...' : ''}</div>
        ) : (
          <div className={styles.wrap}>
            <div className={styles.filters}>
              <label>
                من
                <input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} />
              </label>
              <label>
                إلى
                <input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} />
              </label>
              {(filterFrom || filterTo) && (
                <button className={styles.clear} onClick={() => { setFilterFrom(''); setFilterTo(''); }}>كل الفترات</button>
              )}
            </div>

            <div className={styles.cards}>
              <div className={styles.card}>
                <span>إجمالي الفواتير</span>
                <strong>{fmtCurrency(statement.totals.invoiced)}</strong>
                <small>{statement.totals.invoiceCount} فاتورة</small>
              </div>
              <div className={`${styles.card} ${styles.cardGreen}`}>
                <span>{labels.paid}</span>
                <strong>{fmtCurrency(statement.totals.netPaid)}</strong>
                <small>{statement.totals.refunded ? `${labels.refund}: ${fmtMoney(statement.totals.refunded)}` : `${statement.totals.paymentCount} عملية`}</small>
              </div>
              <div className={`${styles.card} ${closing > 0 ? styles.cardRed : styles.cardGreen}`}>
                <span>{closing < 0 ? labels.credit : labels.balance}</span>
                <strong>{fmtCurrency(Math.abs(closing))}</strong>
                <small>{fromDate ? `افتتاحي ${fmtMoney(statement.opening)}` : 'الرصيد الحالي'}</small>
              </div>
              <div className={styles.card}>
                <span>آخر سداد</span>
                <strong>{statement.lastPayment ? fmtCurrency(statement.lastPayment.amount) : '—'}</strong>
                <small>{statement.lastPayment ? `${fmtShortDate(statement.lastPayment.date)} ${fmtTime(statement.lastPayment.date)}` : 'لا يوجد سداد'}</small>
              </div>
            </div>

            <div className={styles.segment}>
              {[['all', 'كل الحركات'], ['invoices', 'الفواتير'], ['payments', 'المدفوعات']].map(([v, l]) => (
                <button key={v} className={view === v ? styles.segmentActive : ''} onClick={() => setView(v)}>{l}</button>
              ))}
            </div>

            <div className={styles.tableWrap}>
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
                  {fromDate && view === 'all' && (
                    <tr className={styles.opening}>
                      <td>{fmtShortDate(fromDate)}</td>
                      <td colSpan={4}>رصيد افتتاحي</td>
                      <td className={styles.num}>{fmtMoney(statement.opening)}</td>
                    </tr>
                  )}
                  {rows.length === 0 && (
                    <tr><td colSpan={6} className={styles.empty}>لا توجد حركات</td></tr>
                  )}
                  {rows.map((r) => (
                    <tr key={`${r.kind}-${r.id}`}>
                      <td>
                        <div>{fmtShortDate(r.date)}</div>
                        <div className={styles.time}>{fmtTime(r.date)}</div>
                      </td>
                      <td>
                        <span className={`${styles.badge} ${styles[`badge_${r.kind}`]}`}>{labels[r.kind]}</span>
                        {(r.custodyName || r.notes) && <div className={styles.time}>{[r.custodyName, r.notes].filter(Boolean).join(' • ')}</div>}
                      </td>
                      <td className={styles.ref}>{r.ref}</td>
                      <td className={styles.num}>{r.invoiceAmount ? fmtMoney(r.invoiceAmount) : ''}</td>
                      <td className={`${styles.num} ${r.paymentAmount < 0 ? styles.neg : r.paymentAmount > 0 ? styles.pos : ''}`}>{r.paymentAmount ? fmtMoney(r.paymentAmount) : ''}</td>
                      <td className={`${styles.num} ${styles.balance}`}>{fmtMoney(r.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
      <SharePdfDialog pdf={share.pdf} onClose={share.close} />
    </>
  );
}
