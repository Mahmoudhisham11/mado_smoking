import React from 'react';

export interface FieldProps {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export const Field: React.FC<FieldProps> = ({ label, hint, error, className = '', children }) => {
  const isError = Boolean(error);
  return (
    <div className={`m-field ${isError ? 'm-field--error' : ''} ${className}`}>
      {label && <label>{label}</label>}
      {children}
      {error && <span className="m-hint">{error}</span>}
      {!error && hint && <span className="m-hint">{hint}</span>}
    </div>
  );
};

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  numeric?: boolean;
  inputSize?: 'normal' | 'xl';
  isReadOnly?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(function Input(
  { numeric, inputSize, isReadOnly, className = '', ...props },
  ref
) {
  const classes = [
    'm-input',
    numeric ? 'm-input--num' : '',
    inputSize === 'xl' ? 'm-input--xl' : '',
    isReadOnly ? 'm-input--ro' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return <input ref={ref} className={classes} readOnly={isReadOnly} {...props} />;
});

export interface SearchInputProps extends InputProps {
  icon?: React.ReactNode;
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(function SearchInput(
  { icon, className = '', ...props },
  ref
) {
  return (
    <div className="m-search">
      {icon || (
        <svg className="m-ico" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
      )}
      <Input ref={ref} className={className} {...props} />
    </div>
  );
});

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className = '', children, ...props },
  ref
) {
  return (
    <select ref={ref} className={`m-select ${className}`} {...props}>
      {children}
    </select>
  );
});

export default Field;
