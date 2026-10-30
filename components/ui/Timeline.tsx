import React from 'react';

export interface TimelineItem {
  id: string | number;
  type: 'in' | 'out' | 'gold' | 'default';
  icon?: React.ReactNode;
  title: React.ReactNode;
  amount?: React.ReactNode;
  amountDirection?: 'in' | 'out';
  date: string;
  balanceAfter?: string | number;
  badge?: React.ReactNode;
  badgeVariant?: 'in' | 'out' | 'gold' | 'plain';
}

export interface TimelineProps {
  items: TimelineItem[];
  className?: string;
  emptyMessage?: string;
}

export const Timeline: React.FC<TimelineProps> = ({
  items,
  className = '',
  emptyMessage = 'لا توجد حركات مسجلة',
}) => {
  if (items.length === 0) {
    return <p className="t-muted" style={{ textAlign: 'center', padding: '24px 0' }}>{emptyMessage}</p>;
  }

  return (
    <ul className={`m-tl ${className}`}>
      {items.map((item) => {
        const itemClass =
          item.type === 'in'
            ? 'in'
            : item.type === 'out'
            ? 'out'
            : item.type === 'gold'
            ? 'gold'
            : '';

        const amountClass =
          item.amountDirection === 'in'
            ? 'is-in'
            : item.amountDirection === 'out'
            ? 'is-out'
            : '';

        const badgeClass =
          item.badgeVariant === 'in'
            ? 'm-badge--in'
            : item.badgeVariant === 'out'
            ? 'm-badge--out'
            : item.badgeVariant === 'gold'
            ? 'm-badge--gold'
            : '';

        return (
          <li key={item.id} className={`m-tl__item ${itemClass}`}>
            <span className="m-tl__dot">
              {item.icon || (
                item.type === 'in' ? (
                  <svg className="m-ico m-ico--sm" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 4v14" />
                    <path d="M6 13l6 6 6-6" />
                  </svg>
                ) : item.type === 'out' ? (
                  <svg className="m-ico m-ico--sm" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 20V6" />
                    <path d="M6 11l6-6 6 6" />
                  </svg>
                ) : (
                  <svg className="m-ico m-ico--sm" viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M20 12a8 8 0 10-3 6.2" />
                    <path d="M20 5v7h-7" />
                  </svg>
                )
              )}
            </span>
            <div className="m-tl__main">
              <div className="m-tl__row">
                <b>{item.title}</b>
                {item.amount && (
                  <span className={`num ${amountClass}`}>
                    <bdi>{item.amount}</bdi>{' '}
                    <small className="t-muted" style={{ fontWeight: 500, fontSize: '.75em' }}>
                      ج.م
                    </small>
                  </span>
                )}
              </div>
              <div className="m-tl__row">
                <span className="t-small t-muted">{item.date}</span>
                {item.balanceAfter !== undefined && (
                  <span className="t-small t-muted">
                    الرصيد بعدها <b className="num">{item.balanceAfter}</b>
                  </span>
                )}
              </div>
              {item.badge && <span className={`m-badge ${badgeClass}`}>{item.badge}</span>}
            </div>
          </li>
        );
      })}
    </ul>
  );
};

export default Timeline;
