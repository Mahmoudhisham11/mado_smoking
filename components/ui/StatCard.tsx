import React from 'react';

export interface StatCardProps {
  title: string;
  value: React.ReactNode | string | number;
  unit?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  variant?: 'gold' | 'in' | 'out' | 'neutral';
  hidden?: boolean;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  unit,
  subtitle,
  icon,
  variant = 'gold',
  hidden = false,
  className = '',
}) => {
  const variantClass =
    variant === 'in'
      ? 'm-stat--in'
      : variant === 'out'
      ? 'm-stat--out'
      : variant === 'neutral'
      ? 'm-stat--neutral'
      : '';

  return (
    <div className={`m-stat ${variantClass} ${className}`}>
      <div className="m-stat__top">
        <span className="m-stat__title">{title}</span>
        {icon && <span className="m-stat__ico">{icon}</span>}
      </div>
      <div className="m-stat__val">
        {hidden ? (
          <span className="m-mask">••••</span>
        ) : (
          <>
            <bdi>{value}</bdi>
            {unit && <small>{unit}</small>}
          </>
        )}
      </div>
      {subtitle && <div className="m-stat__sub">{subtitle}</div>}
    </div>
  );
};

export default StatCard;
