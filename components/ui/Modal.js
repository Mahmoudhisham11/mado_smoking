'use client';

import { useEffect } from 'react';
import Card from './Card';
import Button from './Button';
import { IoClose } from 'react-icons/io5';
import styles from './Modal.module.css';

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'medium',
}) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const modalClasses = [styles.modal, styles[`modal${size.charAt(0).toUpperCase() + size.slice(1)}`]].filter(Boolean).join(' ');

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={modalClasses} onClick={(e) => e.stopPropagation()}>
        <Card>
          <div className={styles.header}>
            <h2 className={styles.title}>{title}</h2>
            <button className={styles.closeButton} onClick={onClose}>
              <IoClose />
            </button>
          </div>
          <div>{children}</div>
          {footer && <div className={styles.footer}>{footer}</div>}
        </Card>
      </div>
    </div>
  );
}

