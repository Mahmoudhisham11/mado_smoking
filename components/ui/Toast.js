'use client';

import { useEffect } from 'react';
import { HiCheckCircle, HiXCircle, HiExclamationCircle, HiInformationCircle, HiX } from 'react-icons/hi';
import styles from './Toast.module.css';

export default function Toast({ message, type = 'info', onClose, duration = 4000 }) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onClose();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <HiCheckCircle className={styles.icon} />;
      case 'error':
        return <HiXCircle className={styles.icon} />;
      case 'warning':
        return <HiExclamationCircle className={styles.icon} />;
      case 'info':
      default:
        return <HiInformationCircle className={styles.icon} />;
    }
  };

  const toastClasses = [
    styles.toast,
    styles[`toast${type.charAt(0).toUpperCase() + type.slice(1)}`]
  ].filter(Boolean).join(' ');

  return (
    <div className={toastClasses}>
      <div className={styles.content}>
        {getIcon()}
        <span className={styles.message}>{message}</span>
      </div>
      <button className={styles.closeButton} onClick={onClose} aria-label="إغلاق">
        <HiX />
      </button>
    </div>
  );
}

