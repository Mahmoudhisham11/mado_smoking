import styles from './Pdf.module.css';
import { fmtDateTime } from '../../lib/format';

export const BRAND = {
  name: 'Mado Smoking',
  arabicName: 'مادو للتدخين',
  logo: '/web-app-manifest-192x192.png',
};

// الإطار المشترك لكل المستندات: هيدر بالهوية + محتوى + فوتر
export default function PdfShell({ title, subtitle, children, thanks = 'شكراً لتعاملكم معنا' }) {
  return (
    <div className={styles.page}>
      <header className={styles.header} data-pdf-row>
        <div className={styles.headerGlow} />
        <div className={styles.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={styles.logo} src={BRAND.logo} alt="" />
          <div>
            <div className={styles.brandName}>{BRAND.name}</div>
            <div className={styles.brandTag}>{BRAND.arabicName}</div>
          </div>
        </div>
        <div className={styles.docTitleBox}>
          <div className={styles.docTitle}>{title}</div>
          {subtitle && <div className={styles.docSubtitle}>{subtitle}</div>}
        </div>
      </header>
      <main className={styles.body}>{children}</main>
      <footer className={styles.footer} data-pdf-row>
        <span className={styles.footerThanks}>{thanks}</span>
        <span>تم الإصدار: {fmtDateTime(new Date())}</span>
      </footer>
    </div>
  );
}

export const MetaCard = ({ label, value, sub, wide }) => (
  <div className={`${styles.metaCard} ${wide ? styles.metaCardWide : ''}`}>
    <div className={styles.metaLabel}>{label}</div>
    <div className={styles.metaValue}>{value || '—'}</div>
    {sub && <div className={styles.metaSub}>{sub}</div>}
  </div>
);

export const SummaryCard = ({ label, value, hint, tone }) => {
  const toneClass = { dark: styles.cardDark, green: styles.cardGreen, red: styles.cardRed, gold: styles.cardGold }[tone] || '';
  return (
    <div className={`${styles.card} ${toneClass}`}>
      <div className={styles.cardLabel}>{label}</div>
      <div className={styles.cardValue}>{value}</div>
      {hint && <div className={styles.cardHint}>{hint}</div>}
    </div>
  );
};

export const SectionTitle = ({ children, hint }) => (
  // مفيش نقطة قطع بعد العنوان عشان العنوان مايفضلش لوحده آخر الصفحة
  <div className={styles.sectionTitle}>
    {children}
    {hint && <span className={styles.sectionHint}>{hint}</span>}
  </div>
);
