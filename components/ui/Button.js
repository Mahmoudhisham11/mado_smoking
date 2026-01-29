'use client';

import styles from './Button.module.css';

export default function Button({
  children,
  onClick,
  variant = 'primary',
  type = 'button',
  disabled = false,
  loading = false,
  className = '',
  style,
  ...props
}) {
  const classNames = [styles.button, styles[variant], className].filter(Boolean).join(' ');
  const isDisabled = disabled || loading;
  
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      className={classNames}
      style={style}
      {...props}
    >
      {loading ? (
        <>
          <span className={styles.spinner}></span>
          <span>جاري...</span>
        </>
      ) : (
        children
      )}
    </button>
  );
}

