'use client';

import { useState, useEffect } from 'react';
import Input from './Input';
import Button from './Button';
import { HiMail, HiLockClosed, HiUser } from 'react-icons/hi';
import styles from './UserForm.module.css';

export default function UserForm({ user, onSave, onCancel, loading }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user',
    isSubscribe: true,
  });
  const [errors, setErrors] = useState({});
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    if (user) {
      setIsEditMode(true);
      setFormData({
        name: user.name || '',
        email: user.email || '',
        password: '', // Don't show password in edit mode
        role: user.role || 'user',
        isSubscribe: user.isSubscribe !== undefined ? user.isSubscribe : true,
      });
    }
  }, [user]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData({
      ...formData,
      [name]: type === 'checkbox' ? checked : value,
    });
    // Clear error for this field
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'الاسم مطلوب';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'البريد الإلكتروني مطلوب';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'البريد الإلكتروني غير صحيح';
    }

    if (!isEditMode && !formData.password.trim()) {
      newErrors.password = 'كلمة المرور مطلوبة';
    } else if (!isEditMode && formData.password.length < 6) {
      newErrors.password = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      onSave(formData);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <Input
        label="الاسم"
        type="text"
        name="name"
        placeholder="أدخل الاسم"
        value={formData.name}
        onChange={handleChange}
        icon={HiUser}
        error={errors.name}
        required
      />

      <Input
        label="البريد الإلكتروني"
        type="email"
        name="email"
        placeholder="example@email.com"
        value={formData.email}
        onChange={handleChange}
        icon={HiMail}
        error={errors.email}
        required
        disabled={isEditMode} // Email can't be changed
      />

      {!isEditMode && (
        <Input
          label="كلمة المرور"
          type="password"
          name="password"
          placeholder="أدخل كلمة المرور"
          value={formData.password}
          onChange={handleChange}
          icon={HiLockClosed}
          error={errors.password}
          required
        />
      )}

      <div className={styles.formGroup}>
        <label className={styles.label}>الدور</label>
        <select
          name="role"
          value={formData.role}
          onChange={handleChange}
          className={styles.select}
        >
          <option value="user">مستخدم</option>
          <option value="admin">مدير</option>
        </select>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.checkboxLabel}>
          <input
            type="checkbox"
            name="isSubscribe"
            checked={formData.isSubscribe}
            onChange={handleChange}
            className={styles.checkbox}
          />
          <span>الحساب مفعل</span>
        </label>
      </div>

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
          disabled={loading}
        >
          {isEditMode ? 'حفظ التغييرات' : 'إنشاء حساب'}
        </Button>
      </div>
    </form>
  );
}

