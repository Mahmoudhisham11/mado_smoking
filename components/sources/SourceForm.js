'use client';

import { useState, useEffect } from 'react';
import Input from '../ui/Input';
import Button from '../ui/Button';
import styles from './SourceForm.module.css';

export default function SourceForm({ 
  source = null, // For editing existing source
  users = [], // List of users to choose from
  onSave, 
  onCancel, 
  loading 
}) {
  const [formData, setFormData] = useState({
    sourceName: '',
    userIds: null, // null = owner only, [] = all users, [userId1, userId2] = specific users
    visibilityOption: 'owner', // 'owner', 'all', 'specific'
  });
  const [errors, setErrors] = useState({});
  const [selectedUserIds, setSelectedUserIds] = useState([]);

  useEffect(() => {
    if (source) {
      // Editing existing source
      const userIds = source.userIds;
      let visibilityOption = 'owner';
      if (Array.isArray(userIds) && userIds.length === 0) {
        visibilityOption = 'all';
      } else if (Array.isArray(userIds) && userIds.length > 0) {
        visibilityOption = 'specific';
        setSelectedUserIds(userIds);
      }
      
      setFormData({
        sourceName: source.sourceName || '',
        userIds: userIds,
        visibilityOption: visibilityOption,
      });
    } else {
      // New source
      setFormData({
        sourceName: '',
        userIds: null,
        visibilityOption: 'owner',
      });
      setSelectedUserIds([]);
    }
  }, [source]);

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

  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Validation
    const newErrors = {};
    if (!formData.sourceName.trim()) {
      newErrors.sourceName = 'اسم المصدر مطلوب';
    }
    
    if (formData.visibilityOption === 'specific' && selectedUserIds.length === 0) {
      newErrors.userIds = 'يجب اختيار مستخدم واحد على الأقل';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    // Prepare data
    let userIds = null;
    if (formData.visibilityOption === 'all') {
      userIds = [];
    } else if (formData.visibilityOption === 'specific') {
      userIds = selectedUserIds;
    }
    
    onSave({
      sourceName: formData.sourceName.trim(),
      userIds: userIds,
    });
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <Input
        label="اسم المصدر"
        type="text"
        name="sourceName"
        placeholder="أدخل اسم المصدر"
        value={formData.sourceName}
        onChange={handleChange}
        error={errors.sourceName}
        required
      />

      <div className={styles.field}>
        <label className={styles.label}>الظهور للمستخدمين</label>
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
          {source ? 'حفظ التغييرات' : 'إضافة مصدر'}
        </Button>
      </div>
    </form>
  );
}

