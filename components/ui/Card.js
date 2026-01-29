'use client';

import styles from './Card.module.css';

export default function Card({ children, className = '', style, ...props }) {
  const classNames = [styles.card, className].filter(Boolean).join(' ');
  
  return (
    <div className={classNames} style={style} {...props}>
      {children}
    </div>
  );
}

