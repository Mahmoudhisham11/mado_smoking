'use client';

import { useState, useEffect } from 'react';
import Input from '../ui/Input';
import Button from '../ui/Button';
import { HiUser, HiPhone, HiCurrencyDollar, HiUserGroup } from 'react-icons/hi';
import styles from './CustomerForm.module.css';

export default function CustomerForm({ customer, users = [], onSave, onCancel, loading }) {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    creditLimit: '',
    userIds: null, // null = owner only, [] = all users, [userId1, userId2] = specific users
    visibilityOption: 'owner', // 'owner', 'all', 'specific'
  });
  const [errors, setErrors] = useState({});
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedUserIds, setSelectedUserIds] = useState([]);

  useEffect(() => {
    if (customer) {
      setIsEditMode(true);
      const userIds = customer.userIds;
      let visibilityOption = 'owner';
      if (Array.isArray(userIds) && userIds.length === 0) {
        visibilityOption = 'all';
      } else if (Array.isArray(userIds) && userIds.length > 0) {
        visibilityOption = 'specific';
        setSelectedUserIds(userIds);
      }
      
      setFormData({
        name: customer.name || '',
        phone: customer.phone || '',
        creditLimit: customer.creditLimit?.toString() || '',
        userIds: userIds,
        visibilityOption: visibilityOption,
      });
    } else {
      setIsEditMode(false);
      setFormData({
        name: '',
        phone: '',
        creditLimit: '',
        userIds: null,
        visibilityOption: 'owner',
      });
      setSelectedUserIds([]);
    }
  }, [customer, users]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Clear errors
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }));
    }
    
    // Update userIds based on visibility option
    if (name === 'visibilityOption') {
      if (value === 'owner') {
        setFormData(prev => ({ ...prev, userIds: null }));
        setSelectedUserIds([]);
      } else if (value === 'all') {
        setFormData(prev => ({ ...prev, userIds: [] }));
        setSelectedUserIds([]);
      } else if (value === 'specific') {
        // Keep current selectedUserIds
      }
    }
  };

  const handleUserToggle = (userId) => {
    setSelectedUserIds(prev => {
      const newSelected = prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId];
      
      // Update userIds
      setFormData(prev => ({
        ...prev,
        userIds: newSelected
      }));
      
      return newSelected;
    });
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'اسم العميل مطلوب';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'رقم الموبايل مطلوب';
    } else if (!/^[0-9+\-\s()]+$/.test(formData.phone)) {
      newErrors.phone = 'رقم الموبايل غير صحيح';
    }

    if (!formData.creditLimit.trim()) {
      newErrors.creditLimit = 'حد الائتمان مطلوب';
    } else {
      const creditLimit = parseFloat(formData.creditLimit);
      if (isNaN(creditLimit) || creditLimit < 0) {
        newErrors.creditLimit = 'حد الائتمان يجب أن يكون رقماً موجباً';
      }
    }

    if (formData.visibilityOption === 'specific' && selectedUserIds.length === 0) {
      newErrors.userIds = 'يجب اختيار مستخدم واحد على الأقل';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      // Prepare data
      let userIds = null;
      if (formData.visibilityOption === 'all') {
        userIds = [];
      } else if (formData.visibilityOption === 'specific') {
        userIds = selectedUserIds;
      }
      
      onSave({
        name: formData.name.trim(),
        phone: formData.phone.trim(),
        creditLimit: parseFloat(formData.creditLimit),
        userIds: userIds,
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <Input
        label="اسم العميل"
        type="text"
        name="name"
        placeholder="أدخل اسم العميل"
        value={formData.name}
        onChange={handleChange}
        icon={HiUser}
        error={errors.name}
        required
      />

      <Input
        label="رقم الموبايل"
        type="tel"
        name="phone"
        placeholder="أدخل رقم الموبايل"
        value={formData.phone}
        onChange={handleChange}
        icon={HiPhone}
        error={errors.phone}
        required
      />

      <Input
        label="حد الائتمان"
        type="number"
        name="creditLimit"
        placeholder="أدخل حد الائتمان"
        value={formData.creditLimit}
        onChange={handleChange}
        icon={HiCurrencyDollar}
        error={errors.creditLimit}
        required
        min="0"
        step="0.01"
      />

      <div className={styles.field}>
        <label className={styles.label}>
          <HiUserGroup className={styles.labelIcon} />
          الظهور للمستخدمين
        </label>
        <div className={styles.radioGroup}>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="visibilityOption"
              value="owner"
              checked={formData.visibilityOption === 'owner'}
              onChange={handleChange}
            />
            <span>خاص بالمالك فقط</span>
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="visibilityOption"
              value="all"
              checked={formData.visibilityOption === 'all'}
              onChange={handleChange}
            />
            <span>جميع المستخدمين</span>
          </label>
          <label className={styles.radioLabel}>
            <input
              type="radio"
              name="visibilityOption"
              value="specific"
              checked={formData.visibilityOption === 'specific'}
              onChange={handleChange}
            />
            <span>مستخدمين محددين</span>
          </label>
        </div>
        {errors.userIds && <span className={styles.error}>{errors.userIds}</span>}
      </div>

      {formData.visibilityOption === 'specific' && (
        <div className={styles.userSelection}>
          <label className={styles.label}>اختر المستخدمين</label>
          <div className={styles.userList}>
            {users.map((user) => (
              <label key={user.uid} className={styles.userCheckbox}>
                <input
                  type="checkbox"
                  checked={selectedUserIds.includes(user.uid)}
                  onChange={() => handleUserToggle(user.uid)}
                />
                <span>{user.name || user.email}</span>
              </label>
            ))}
          </div>
          {users.length === 0 && (
            <p className={styles.noUsers}>لا يوجد مستخدمين متاحين</p>
          )}
        </div>
      )}

      <div className={styles.actions}>
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
          {isEditMode ? 'حفظ التغييرات' : 'إضافة عميل'}
        </Button>
      </div>
    </form>
  );
}

