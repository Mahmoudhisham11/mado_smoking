'use client';

import React, { useEffect, useRef } from 'react';

export interface ToastProps {
  message: string;
  subtitle?: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  onClose: () => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  message,
  subtitle,
  type = 'info',
  onClose,
  duration = 4000,
}) => {
  // onClose بيتبعت كدالة جديدة مع كل رندر للقائمة، فبنحفظه في ref عشان المؤقت مايتعادش من الأول
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => onCloseRef.current(), duration);
      return () => clearTimeout(timer);
    }
  }, [duration]);

  const typeClass =
    type === 'success'
      ? 'm-toast--in'
      : type === 'error' || type === 'warning'
      ? 'm-toast--out'
      : 'm-toast--info';

  const renderIcon = () => {
    if (type === 'success') {
      return (
        <svg className="m-ico" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 12l5 5 9-10" />
        </svg>
      );
    }
    if (type === 'error' || type === 'warning') {
      return (
        <svg className="m-ico" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 3l10 18H2z" />
          <path d="M12 10v5M12 18v.01" />
        </svg>
      );
    }
    return (
      <svg className="m-ico" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7.5v.01" />
      </svg>
    );
  };

  return (
    <div className={`m-toast ${typeClass}`} role="status" onClick={onClose} style={{ cursor: 'pointer' }}>
      <span className="m-toast__ico">{renderIcon()}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <b>{message}</b>
        {subtitle && <div className="t-small t-muted">{subtitle}</div>}
      </div>
    </div>
  );
};

export default Toast;
