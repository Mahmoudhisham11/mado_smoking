'use client';

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'small' | 'medium' | 'large';
  accent?: 'in' | 'out';
  className?: string;
}

// عدّاد للنوافذ المفتوحة: قفل الـ scroll بيتشال لما آخر نافذة تتقفل (مش أول واحدة)
let openCount = 0;
const lockScroll = () => {
  openCount += 1;
  document.documentElement.classList.add('m-scroll-lock');
};
const unlockScroll = () => {
  openCount = Math.max(0, openCount - 1);
  if (openCount === 0) document.documentElement.classList.remove('m-scroll-lock');
};

// true في المتصفح بس (document.body مش موجود وقت الرندر على السيرفر)
const noopSubscribe = () => () => {};
const useIsClient = () => useSyncExternalStore(noopSubscribe, () => true, () => false);

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// نافذة على الكمبيوتر، و bottom sheet على الموبايل (من bundle.css).
// بتترندر جوه <body> مباشرة (portal) عشان ماتتأثرش بأي عنصر أب فيه scroll أو position.
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  footer,
  size = 'medium',
  accent,
  className = '',
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  const isClient = useIsClient();

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const previousActive = document.activeElement as HTMLElement | null;
    lockScroll();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseRef.current();
        return;
      }
      if (e.key === 'Tab' && modalRef.current) {
        const focusable = modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    // التركيز على النافذة نفسها (مش أول input) عشان الكيبورد مايفتحش لوحده على الموبايل
    const timer = setTimeout(() => modalRef.current?.focus(), 30);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      unlockScroll();
      previousActive?.focus?.();
    };
  }, [isOpen]);

  if (!isOpen || !isClient) return null;

  const sizeClass = size === 'small' ? 'm-modal--sm' : size === 'large' ? 'm-modal--lg' : '';
  const accentClass = accent === 'in' ? 'm-modal--in' : accent === 'out' ? 'm-modal--out' : '';

  return createPortal(
    <div className="m-backdrop" onClick={onClose} role="presentation">
      <div
        ref={modalRef}
        className={`m-modal ${sizeClass} ${accentClass} ${className}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
      >
        <span className="m-modal__grab" aria-hidden="true" />
        <div className="m-modal__head">
          <h2 className="t-heading">{title}</h2>
          <button
            type="button"
            className="m-btn m-btn--ghost m-btn--icon m-btn--sm"
            onClick={onClose}
            aria-label="إغلاق"
          >
            <svg className="m-ico" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
        <div className="m-modal__body">{children}</div>
        {footer && <div className="m-modal__foot">{footer}</div>}
      </div>
    </div>,
    document.body
  );
};

export default Modal;
