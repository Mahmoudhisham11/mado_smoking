'use client';

import { useState } from 'react';
import { useSession } from '../../contexts/AuthContext';
import { runMigration, exportBackup } from '../../lib/firebase/firestore';
import { downloadJson, backupFilename } from '../../lib/download';
import { logout } from '../../lib/firebase/auth';
import Button from '../ui/Button';
import styles from './MigrationGate.module.css';

// شاشة تحديث البيانات للشكل الجديد. بتظهر مرة واحدة قبل استخدام النسخة الجديدة.
export default function MigrationGate() {
  const { isOwner } = useSession();
  const [backupDone, setBackupDone] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [report, setReport] = useState(null);
  const [totalWrites, setTotalWrites] = useState(0);

  if (!isOwner) {
    return (
      <div className={styles.page}>
        <div className={styles.card}>
          <h1 className={styles.title}>جاري تحديث النظام</h1>
          <p className={styles.text}>المالك محتاج يعمل تحديث للبيانات قبل ما تقدر تستخدم النسخة الجديدة. برجاء المحاولة بعد شوية.</p>
          <Button variant="secondary" onClick={() => logout()}>تسجيل الخروج</Button>
        </div>
      </div>
    );
  }

  const handleBackup = async () => {
    setBusy('backup');
    setError('');
    const result = await exportBackup();
    setBusy('');
    if (!result.success) {
      setError(result.error);
      return;
    }
    downloadJson(result.backup, backupFilename());
    setBackupDone(true);
  };

  const handleCheck = async () => {
    setBusy('check');
    setError('');
    const result = await runMigration({ apply: false });
    setBusy('');
    if (!result.success) {
      setError(result.error);
      return;
    }
    setReport(result.report);
    setTotalWrites(result.totalWrites);
  };

  const handleApply = async () => {
    if (!confirm('هل أنت متأكد من تطبيق التحديث على البيانات؟')) return;
    setBusy('apply');
    setError('');
    const result = await runMigration({ apply: true });
    setBusy('');
    if (!result.success) setError(`${result.error} — يمكنك إعادة المحاولة بأمان.`);
    // عند النجاح، حالة الترحيل بتتحدث لحظياً والتطبيق بيفتح لوحده
  };

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>تحديث البيانات</h1>
        <p className={styles.text}>
          النسخة الجديدة بتصلح مشاكل الحسابات والمخزون، ومحتاجة تحديث شكل البيانات مرة واحدة.
          اتبع الخطوات بالترتيب:
        </p>

        {error && <div className={styles.error}>{error}</div>}

        <ol className={styles.steps}>
          <li className={backupDone ? styles.done : ''}>
            <div className={styles.stepTitle}>1. تحميل نسخة احتياطية كاملة</div>
            <Button variant={backupDone ? 'secondary' : 'primary'} onClick={handleBackup} loading={busy === 'backup'} disabled={!!busy}>
              {backupDone ? 'تم التحميل — تحميل مرة أخرى' : 'تحميل النسخة الاحتياطية'}
            </Button>
          </li>
          <li className={report ? styles.done : ''}>
            <div className={styles.stepTitle}>2. فحص البيانات (بدون أي تعديل)</div>
            <Button variant={report ? 'secondary' : 'primary'} onClick={handleCheck} loading={busy === 'check'} disabled={!!busy || !backupDone}>
              فحص البيانات
            </Button>
          </li>
          <li>
            <div className={styles.stepTitle}>3. مراجعة التقرير وتطبيق التحديث</div>
            <Button variant="primary" onClick={handleApply} loading={busy === 'apply'} disabled={!!busy || !report || !backupDone}>
              تطبيق التحديث ({totalWrites} تعديل)
            </Button>
          </li>
        </ol>

        {report && (
          <div className={styles.report}>
            {report.map((s) => (
              <details key={s.title} className={styles.reportStep} open={s.warnings.length > 0}>
                <summary>
                  {s.title}: <strong>{s.changes}</strong> تعديل
                  {s.warnings.length > 0 && <span className={styles.warnBadge}>{s.warnings.length} ملاحظة</span>}
                </summary>
                {s.warnings.length > 0 && (
                  <ul className={styles.warnings}>
                    {s.warnings.slice(0, 100).map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                )}
                {s.details.length > 0 && (
                  <ul className={styles.details}>
                    {s.details.map((d, i) => <li key={i}>{d}</li>)}
                  </ul>
                )}
              </details>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
