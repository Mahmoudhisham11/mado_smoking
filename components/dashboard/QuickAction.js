'use client';

import Card from '../ui/Card';
import styles from './QuickAction.module.css';

export default function QuickAction({ icon: Icon, label, onClick }) {
  return (
    <Card className={styles.card} onClick={onClick}>
      {Icon && <Icon className={styles.icon} />}
      <span className={styles.label}>{label}</span>
    </Card>
  );
}

