import React from 'react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  action,
  className = '',
}) => {
  return (
    <div className={`m-empty ${className}`}>
      {icon && <span className="m-empty__ico">{icon}</span>}
      <h3 className="t-sub">{title}</h3>
      {description && <p>{description}</p>}
      {action}
    </div>
  );
};

export default EmptyState;
