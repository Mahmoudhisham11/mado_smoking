'use client';

import Card from '../ui/Card';
import styles from './SummaryCard.module.css';

export default function SummaryCard({ title, value, icon: Icon, trend }) {
  const trendClasses = [
    styles.trend,
    trend !== undefined && trend > 0 ? styles.trendPositive : styles.trendNegative,
  ].filter(Boolean).join(' ');

  return (
    <Card>
      <div className={styles.cardContent}>
        <div className={styles.textSection}>
          <div className={styles.title}>{title}</div>
          <div className={styles.value}>{value}</div>
          {trend !== undefined && (
            <div className={trendClasses}>
              {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}%
            </div>
          )}
        </div>
        {Icon && <Icon className={styles.icon} />}
      </div>
    </Card>
  );
}

