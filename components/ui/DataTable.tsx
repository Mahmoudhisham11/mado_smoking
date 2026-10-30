import React from 'react';

export interface Column<T> {
  key: string;
  label: string;
  isMain?: boolean;
  align?: 'start' | 'center' | 'end' | 'num';
  isAction?: boolean;
  isCheckbox?: boolean;
  render?: (row: T, index: number) => React.ReactNode;
}

export interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyField?: keyof T | ((row: T) => string | number);
  emptyMessage?: string;
  className?: string;
  selectedIds?: (string | number)[];
  onRowClick?: (row: T) => void;
  footer?: React.ReactNode;
}

export function DataTable<T extends Record<string, any>>({
  columns,
  data,
  keyField = 'id',
  emptyMessage = 'لا توجد بيانات',
  className = '',
  selectedIds = [],
  onRowClick,
  footer,
}: DataTableProps<T>) {
  const getRowKey = (row: T, index: number): string | number => {
    if (typeof keyField === 'function') return keyField(row);
    return row[keyField] ?? index;
  };

  return (
    <div className={`m-table-wrap ${className}`}>
      <table className="m-table m-table--stack">
        <thead>
          <tr>
            {columns.map((col) => {
              const thClasses = [
                col.align === 'num' ? 'c-num' : '',
                col.isCheckbox ? 'c-chk' : '',
                col.isAction ? 'c-act' : '',
              ]
                .filter(Boolean)
                .join(' ');

              return (
                <th key={col.key} className={thClasses}>
                  {col.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ textAlign: 'center', padding: '32px 16px' }}>
                <span className="t-muted">{emptyMessage}</span>
              </td>
            </tr>
          ) : (
            data.map((row, index) => {
              const rowKey = getRowKey(row, index);
              const isSelected = selectedIds.includes(rowKey);

              return (
                <tr
                  key={rowKey}
                  className={isSelected ? 'is-sel' : ''}
                  onClick={() => onRowClick && onRowClick(row)}
                  style={onRowClick ? { cursor: 'pointer' } : undefined}
                >
                  {columns.map((col) => {
                    const tdClasses = [
                      col.isMain ? 'c-main' : '',
                      col.align === 'num' ? 'c-num' : '',
                      col.isAction ? 'c-act' : '',
                      col.isCheckbox ? 'c-chk' : '',
                    ]
                      .filter(Boolean)
                      .join(' ');

                    const cellContent = col.render ? col.render(row, index) : row[col.key];

                    return (
                      <td key={col.key} data-l={col.label} className={tdClasses}>
                        {cellContent}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
        {footer && <tfoot>{footer}</tfoot>}
      </table>
    </div>
  );
}

export default DataTable;
