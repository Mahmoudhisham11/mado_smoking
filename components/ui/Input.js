'use client';

import { useState } from 'react';
import { HiEye, HiEyeOff } from 'react-icons/hi';
import styles from './Input.module.css';

export default function Input({
  label,
  type = 'text',
  placeholder,
  value,
  onChange,
  icon: Icon,
  error,
  className = '',
  ...props
}) {
  const [showPassword, setShowPassword] = useState(false);

  const inputType = type === 'password' && showPassword ? 'text' : type;
  
  const hasIcon = !!Icon;
  const hasPassword = type === 'password';
  
  const inputClasses = [
    styles.input,
    hasIcon && hasPassword ? styles.inputWithIconAndPassword : 
    hasIcon ? styles.inputWithIcon :
    hasPassword ? styles.inputWithPassword : '',
  ].filter(Boolean).join(' ');
  
  const containerClasses = [styles.container, className].filter(Boolean).join(' ');

  return (
    <div className={containerClasses}>
      {label && <label className={styles.label}>{label}</label>}
      <div className={styles.inputWrapper}>
        {Icon && <Icon className={styles.icon} />}
        <input
          type={inputType}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className={inputClasses}
          {...props}
        />
        {type === 'password' && (
          <span
            className={styles.eyeIcon}
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <HiEyeOff /> : <HiEye />}
          </span>
        )}
      </div>
      {error && <span className={styles.error}>{error}</span>}
    </div>
  );
}

