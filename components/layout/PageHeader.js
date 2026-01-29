'use client';

import { HiSearch } from 'react-icons/hi';
import styles from './PageHeader.module.css';

export default function PageHeader({ 
  title, 
  action, 
  onAction, 
  actionLabel,
  searchQuery = '',
  onSearchChange,
  showSearch = true,
  customActions
}) {
  return (
    <div className={styles.header}>
      <h1 className={styles.title}>{title}</h1>
      
      {showSearch && (
        <div className={styles.searchContainer}>
          <div className={styles.searchWrapper}>
            <HiSearch className={styles.searchIcon} />
            <input
              type="text"
              placeholder="ابحث..."
              value={searchQuery}
              onChange={(e) => onSearchChange && onSearchChange(e.target.value)}
              className={styles.searchInput}
            />
          </div>
        </div>
      )}

      {customActions && (
        <div className={styles.customActions}>
          {customActions}
        </div>
      )}

      {action && !customActions && (
        <button
          onClick={onAction}
          className={styles.actionButton}
        >
          {actionLabel || action}
        </button>
      )}
    </div>
  );
}

