'use client';

import { useEffect, useState } from 'react';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Select from '../ui/Select';
import { HiCurrencyDollar } from 'react-icons/hi';
import styles from './ExpenseForm.module.css';

export default function ExpenseForm({ 
  cashRegisters = [], 
  users = [],
  expense = null, // For editing existing expense
  onSave, 
  onCancel, 
  loading,
  canTransferFrom
}) {
  const [formData, setFormData] = useState({
    cashRegisterId: '',
    amount: '',
    description: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (expense) {
      setFormData({
        cashRegisterId: expense.cashRegisterId || '',
        amount: (expense.amount || 0).toString(),
        description: expense.description || '',
      });
    } else {
      setFormData({
        cashRegisterId: '',
        amount: '',
        description: '',
      });
    }
  }, [expense]);

  // Filter available registers based on permissions
  const availableRegisters = cashRegisters.filter(cr => 
    canTransferFrom ? canTransferFrom(cr.id) : true
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    // Clear error for this field
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.cashRegisterId) {
      newErrors.cashRegisterId = 'يجب اختيار العهدة';
    }

    if (!formData.amount.trim()) {
      newErrors.amount = 'المبلغ مطلوب';
    } else {
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        newErrors.amount = 'المبلغ يجب أن يكون رقماً أكبر من صفر';
      } else {
        // Check if balance is sufficient
        const register = cashRegisters.find(cr => cr.id === formData.cashRegisterId);
        if (register && (register.balance || 0) < amount) {
          newErrors.amount = 'الرصيد غير كافي';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSave({
        ...formData,
        amount: parseFloat(formData.amount),
      });
    }
  };

  const getRegisterName = (register) => {
    if (register.userId === null) {
      return 'العهدة الرئيسية';
    }
    const user = users.find(u => u.uid === register.userId);
    return user ? `${user.name || user.email} - عهدة` : `عهدة المستخدم`;
  };

  const registerOptions = availableRegisters.map(register => ({
    value: register.id,
    label: getRegisterName(register),
  }));

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <Select
        label="العهدة"
        name="cashRegisterId"
        value={formData.cashRegisterId}
        onChange={handleChange}
        options={registerOptions}
        placeholder="اختر العهدة"
        required
        error={errors.cashRegisterId}
      />

      <Input
        label="المبلغ"
        type="number"
        name="amount"
        placeholder="أدخل المبلغ"
        value={formData.amount}
        onChange={handleChange}
        icon={HiCurrencyDollar}
        error={errors.amount}
        required
        min="0"
        step="0.01"
      />

      <Input
        label="الوصف"
        type="text"
        name="description"
        placeholder="أدخل وصف للمصروف"
        value={formData.description}
        onChange={handleChange}
      />

      <div className={styles.formActions}>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={loading}
        >
          إلغاء
        </Button>
        <Button
          type="submit"
          variant="primary"
          loading={loading}
        >
          تسجيل مصروف
        </Button>
      </div>
    </form>
  );
}


