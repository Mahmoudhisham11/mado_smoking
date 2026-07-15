'use client';

import styles from './Checkbox.module.css';

export default function Checkbox({ label, checked, onChange, className = '' }) {
  const classNames = [styles.container, className].filter(Boolean).join(' ');
  
  return (
    <label className={classNames}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className={styles.checkbox}
      />
      {label && <span className={styles.label}>{label}</span>}
    </label>
  );
}

