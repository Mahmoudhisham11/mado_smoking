'use client';

import { useState, useEffect } from 'react';
import Input from '../ui/Input';
import Button from '../ui/Button';
import Select from '../ui/Select';
import { HiArrowRight, HiCurrencyDollar } from 'react-icons/hi';
import styles from './TransferForm.module.css';

export default function TransferForm({ 
  cashRegisters = [], 
  users = [],
  transfer = null, // For editing existing transfer
  onSave, 
  onCancel, 
  loading,
  canTransferFrom
}) {
  const [formData, setFormData] = useState({
    fromCashRegisterId: '',
    toCashRegisterId: '',
    amount: '',
    description: '',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (transfer) {
      setFormData({
        fromCashRegisterId: transfer.fromCashRegisterId || '',
        toCashRegisterId: transfer.toCashRegisterId || '',
        amount: (transfer.amount || 0).toString(),
        description: transfer.description || '',
      });
    } else {
      setFormData({
        fromCashRegisterId: '',
        toCashRegisterId: '',
        amount: '',
        description: '',
      });
    }
  }, [transfer]);

  // Filter available registers based on permissions
  const availableFromRegisters = cashRegisters.filter(cr => 
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

    if (!formData.fromCashRegisterId) {
      newErrors.fromCashRegisterId = 'يجب اختيار العهدة المصدر';
    }

    if (!formData.toCashRegisterId) {
      newErrors.toCashRegisterId = 'يجب اختيار العهدة الهدف';
    }

    if (formData.fromCashRegisterId === formData.toCashRegisterId) {
      newErrors.toCashRegisterId = 'لا يمكن التحويل لنفس العهدة';
    }

    if (!formData.amount.trim()) {
      newErrors.amount = 'المبلغ مطلوب';
    } else {
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        newErrors.amount = 'المبلغ يجب أن يكون رقماً أكبر من صفر';
      } else {
        // Check if balance is sufficient
        const fromRegister = cashRegisters.find(cr => cr.id === formData.fromCashRegisterId);
        if (fromRegister && (fromRegister.balance || 0) < amount) {
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

  const fromOptions = availableFromRegisters.map(register => ({
    value: register.id,
    label: getRegisterName(register),
  }));

  const toOptions = cashRegisters
    .filter(cr => cr.id !== formData.fromCashRegisterId)
    .map(register => ({
      value: register.id,
      label: getRegisterName(register),
    }));

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <Select
        label="من العهدة"
        name="fromCashRegisterId"
        value={formData.fromCashRegisterId}
        onChange={handleChange}
        options={fromOptions}
        placeholder="اختر العهدة المصدر"
        required
        error={errors.fromCashRegisterId}
      />

      <Select
        label="إلى العهدة"
        name="toCashRegisterId"
        value={formData.toCashRegisterId}
        onChange={handleChange}
        options={toOptions}
        placeholder="اختر العهدة الهدف"
        required
        error={errors.toCashRegisterId}
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
        label="الوصف (اختياري)"
        type="text"
        name="description"
        placeholder="أدخل وصف للتحويل"
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
          تحويل
        </Button>
      </div>
    </form>
  );
}


