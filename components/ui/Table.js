'use client';

import { HiEye, HiDocumentReport, HiPencil, HiTrash, HiArrowLeft, HiCurrencyDollar } from 'react-icons/hi';
import styles from './Table.module.css';

// Icon mapping for common actions
const actionIcons = {
  'عرض': HiEye,
  'التقارير': HiDocumentReport,
  'تعديل': HiPencil,
  'حذف': HiTrash,
  'رجوع': HiArrowLeft,
  'سداد': HiCurrencyDollar,
};

export default function Table({ columns, data, actions, onAction, rowClassName }) {
  return (
    <div className={styles.tableContainer}>
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key || col} className={styles.header}>
                  {col.label || col}
                </th>
              ))}
              {actions && actions.length > 0 && (
                <th className={styles.header}>الإجراءات</th>
              )}
            </tr>
          </thead>
          <tbody>
            {data && data.length > 0 ? (
              data.map((row, rowIndex) => {
                const rowClass = rowClassName ? rowClassName(row) : '';
                return (
                  <tr key={row.id || rowIndex} className={`${styles.row} ${rowClass}`}>
                    {columns.map((col) => {
                      const key = col.key || col;
                      return (
                        <td key={key} className={styles.cell}>
                          {row[key]}
                        </td>
                      );
                    })}
                    {actions && actions.length > 0 && (
                      <td className={styles.cell}>
                        <div className={styles.actionsContainer}>
                          {actions.map((action) => {
                            const ActionIcon = actionIcons[action];
                            const isDelete = action === 'حذف';
                            const buttonClasses = [
                              styles.actionButton,
                              isDelete ? styles.actionButtonDelete : '',
                            ].filter(Boolean).join(' ');
                            return (
                              <button
                                key={action}
                                className={buttonClasses}
                                onClick={() => onAction && onAction(action, row)}
                              >
                                {ActionIcon && <ActionIcon size={16} />}
                                <span>{action}</span>
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={columns.length + (actions ? 1 : 0)}
                  className={`${styles.cell} ${styles.emptyCell}`}
                >
                  لا توجد بيانات
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

