
'use client';

import styles from './Select.module.css';

export default function Select({
  label,
  placeholder,
  value,
  onChange,
  options = [],
  error,
  className = '',
  ...props
}) {
  const containerClasses = [styles.container, className].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.selectWrapper}>
        <select
          value={value}
          onChange={onChange}
          className={styles.select}
          {...props}
        >
          <option value="" disabled>
            {placeholder || 'اختر...'}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}





