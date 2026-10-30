import React from 'react';

export interface StepperProps {
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
}

export const Stepper: React.FC<StepperProps> = ({
  value,
  min = 0,
  max,
  step = 1,
  onChange,
  disabled = false,
  className = '',
}) => {
  const handleIncrement = () => {
    if (disabled) return;
    const nextVal = (Number(value) || 0) + step;
    if (max !== undefined && nextVal > max) return;
    onChange(nextVal);
  };

  const handleDecrement = () => {
    if (disabled) return;
    const nextVal = (Number(value) || 0) - step;
    if (min !== undefined && nextVal < min) return;
    onChange(nextVal);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (raw === '') {
      onChange(0);
      return;
    }
    const parsed = parseInt(raw, 10);
    if (!isNaN(parsed)) {
      if (min !== undefined && parsed < min) {
        onChange(min);
      } else if (max !== undefined && parsed > max) {
        onChange(max);
      } else {
        onChange(parsed);
      }
    }
  };

  return (
    <div className={`m-stepper ${className}`}>
      <button
        type="button"
        onClick={handleIncrement}
        disabled={disabled || (max !== undefined && value >= max)}
        aria-label="زيادة"
      >
        +
      </button>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        disabled={disabled}
      />
      <button
        type="button"
        onClick={handleDecrement}
        disabled={disabled || (min !== undefined && value <= min)}
        aria-label="نقصان"
      >
        −
      </button>
    </div>
  );
};

export default Stepper;
