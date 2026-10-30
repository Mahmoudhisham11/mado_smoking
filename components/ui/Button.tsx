import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'danger-outline' | 'whatsapp' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  block?: boolean;
  icon?: boolean;
  loading?: boolean;
  iconLeft?: React.ReactNode;
  iconRight?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    block = false,
    icon = false,
    loading = false,
    disabled = false,
    className = '',
    children,
    iconLeft,
    iconRight,
    ...props
  },
  ref
) {
  const classes = [
    'm-btn',
    `m-btn--${variant}`,
    size === 'lg' ? 'm-btn--lg' : size === 'sm' ? 'm-btn--sm' : '',
    block ? 'm-btn--block' : '',
    icon ? 'm-btn--icon' : '',
    loading ? 'm-btn--loading' : '',
    disabled ? 'm-btn--disabled' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button ref={ref} className={classes} disabled={disabled || loading} {...props}>
      {loading && <span className="m-spin" aria-hidden="true" />}
      {!loading && iconLeft}
      {children}
      {!loading && iconRight}
    </button>
  );
});

export default Button;
