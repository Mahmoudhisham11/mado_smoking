'use client';

import { useEffect, useState } from 'react';
import AuthGuard from '../../components/auth/AuthGuard';
import MainLayout from '../../components/layout/MainLayout';
import PageHeader from '../../components/layout/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import UserForm from '../../components/ui/UserForm';
import Table from '../../components/ui/Table';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { getUserFromLocalStorage } from '../../lib/auth';
import { createUserByOwner, deleteUserByOwner } from '../../lib/firebase/auth';
import { getUsersByOwner, updateUserRole, updateUserData } from '../../lib/firebase/firestore';
import { HiUser, HiMail, HiShieldCheck, HiUserAdd, HiPencil, HiTrash } from 'react-icons/hi';
import styles from './page.module.css';

export default function SettingsPage() {
    const { user, userData } = useAuth();
    const { showSuccess, showError, showWarning } = useToast();
    const [localUserData, setLocalUserData] = useState(null);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showUserForm, setShowUserForm] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formLoading, setFormLoading] = useState(false);
    const [error, setError] = useState('');
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [userToDelete, setUserToDelete] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);
    const [deleteError, setDeleteError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const data = getUserFromLocalStorage();
        setLocalUserData(data);

        // Load users if owner
        if (data?.role === 'owner') {
            loadUsers();
        } else {
            setLoading(false);
        }
    }, [userData]);

    const loadUsers = async () => {
        try {
            const ownerId = localUserData?.uid || user?.uid;
            if (ownerId) {
                const usersList = await getUsersByOwner(ownerId);
                setUsers(usersList);
            }
        } catch (error) {
            console.error('Error loading users:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddUser = () => {
        setEditingUser(null);
        setShowUserForm(true);
        setError('');
    };

    const handleEditUser = (userToEdit) => {
        setEditingUser(userToEdit);
        setShowUserForm(true);
        setError('');
    };

    const handleSaveUser = async (formData) => {
        setFormLoading(true);
        setError('');

        try {
            const ownerId = localUserData?.uid || user?.uid;

            if (editingUser) {
                // Update existing user
                const updateData = {
                    name: formData.name,
                    role: formData.role,
                    isSubscribe: formData.isSubscribe,
                };

                const result = await updateUserData(editingUser.uid, updateData);
                setFormLoading(false); // Remove loading immediately after operation

                if (result.success) {
                    // Also update role if changed
                    if (formData.role !== editingUser.role) {
                        await updateUserRole(editingUser.uid, formData.role);
                    }

                    setShowUserForm(false);
                    setEditingUser(null);
                    await loadUsers(); // Reload users list
                } else {
                    setError(result.error || 'فشل في تحديث المستخدم');
                }
            } else {
                // Create new user
                const result = await createUserByOwner(
                    ownerId,
                    formData.name,
                    formData.email,
                    formData.password,
                    formData.role,
                    formData.isSubscribe
                );
                setFormLoading(false); // Remove loading immediately after operation

                if (result.success) {
                    setShowUserForm(false);
                    await loadUsers(); // Reload users list

                    // If owner was logged out, show message
                    if (result.requiresReauth) {
                        showSuccess('تم إنشاء المستخدم بنجاح. يرجى تسجيل الدخول مرة أخرى.');
                        // Redirect to login after a short delay
                        setTimeout(() => {
                            window.location.href = '/login';
                        }, 2000);
                    } else {
                        showSuccess('تم إنشاء المستخدم بنجاح');
                    }
                } else {
                    setError(result.error || 'فشل في إنشاء المستخدم');
                }
            }
        } catch (err) {
            setFormLoading(false);
            setError('حدث خطأ. يرجى المحاولة مرة أخرى.');
            console.error('Error saving user:', err);
        }
    };

    const handleChangeRole = async (userId, newRole) => {
        try {
            const result = await updateUserRole(userId, newRole);
            if (result.success) {
                await loadUsers(); // Reload users list
            } else {
                showError('فشل في تحديث الدور: ' + (result.error || 'خطأ غير معروف'));
            }
        } catch (error) {
            console.error('Error changing role:', error);
            showError('حدث خطأ أثناء تحديث الدور');
        }
    };

    const handleCancelForm = () => {
        setShowUserForm(false);
        setEditingUser(null);
        setError('');
    };

    const handleDeleteClick = (userToDelete) => {
        setUserToDelete(userToDelete);
        setDeleteError('');
        setShowDeleteModal(true);
    };

    const handleDeleteConfirm = async () => {
        if (!userToDelete) return;

        setDeleteLoading(true);
        setDeleteError('');

        try {
            const result = await deleteUserByOwner(userToDelete.uid);
            setDeleteLoading(false); // Remove loading immediately after operation

            if (result.success) {
                setShowDeleteModal(false);
                setUserToDelete(null);
                await loadUsers(); // Reload users list

                // Show warning if there's one (e.g., if Auth deletion failed but Firestore succeeded)
                if (result.warning) {
                    setTimeout(() => {
                        showWarning(result.warning);
                    }, 100);
                } else {
                    showSuccess('تم حذف المستخدم بنجاح');
                }
            } else {
                setDeleteError(result.error || 'فشل في حذف المستخدم');
            }
        } catch (err) {
            setDeleteLoading(false);
            setDeleteError('حدث خطأ. يرجى المحاولة مرة أخرى.');
            console.error('Error deleting user:', err);
        }
    };

    const handleDeleteCancel = () => {
        setShowDeleteModal(false);
        setUserToDelete(null);
        setDeleteError('');
    };

    const userRole = localUserData?.role || userData?.role || 'user';
    const isOwner = userRole === 'owner';
    const userName = localUserData?.name || user?.displayName || 'مستخدم';
    const userEmail = localUserData?.email || user?.email || '';

    // Filter users based on search query
    const filteredUsers = users.filter((u) => {
        const searchLower = searchQuery.toLowerCase();
        return (
            (u.name || '').toLowerCase().includes(searchLower) ||
            (u.email || '').toLowerCase().includes(searchLower)
        );
    });

    // Prepare table data
    const tableColumns = [
        { key: 'name', label: 'الاسم' },
        { key: 'email', label: 'البريد الإلكتروني' },
        { key: 'role', label: 'الدور' },
        { key: 'status', label: 'الحالة' },
    ];

    const tableData = filteredUsers.map((u) => ({
        id: u.uid,
        name: u.name || 'بدون اسم',
        email: u.email || 'بدون بريد',
        role: u.role || 'user',
        status: u.isSubscribe ? 'مفعل' : 'غير مفعل',
        originalUser: u, // Keep reference to original user object
    }));

    const handleTableAction = (action, row) => {
        if (action === 'تعديل') {
            handleEditUser(row.originalUser);
        } else if (action === 'حذف') {
            handleDeleteClick(row.originalUser);
        }
    };

    return (
        <AuthGuard>
            <MainLayout>

                <div className={styles.container}>
                    <PageHeader
                        title="الإعدادات"
                        action={isOwner ? "addUser" : null}
                        actionLabel={isOwner ? "+ إضافة مستخدم جديد" : null}
                        onAction={isOwner ? handleAddUser : null}
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        showSearch={isOwner && users.length > 0}
                    />
                    {/* Account Information */}
                    <Card className={styles.card}>
                        <div className={styles.sectionHeader}>
                            <HiUser className={styles.sectionIcon} />
                            <h2 className={styles.sectionTitle}>معلومات الحساب</h2>
                        </div>

                        <div className={styles.infoGrid}>
                            <div className={styles.infoItem}>
                                <div className={styles.infoLabel}>
                                    <HiUser className={styles.infoIcon} />
                                    <span>الاسم</span>
                                </div>
                                <div className={styles.infoValue}>{userName}</div>
                            </div>

                            <div className={styles.infoItem}>
                                <div className={styles.infoLabel}>
                                    <HiMail className={styles.infoIcon} />
                                    <span>البريد الإلكتروني</span>
                                </div>
                                <div className={styles.infoValue}>{userEmail}</div>
                            </div>

                            <div className={styles.infoItem}>
                                <div className={styles.infoLabel}>
                                    <HiShieldCheck className={styles.infoIcon} />
                                    <span>الدور</span>
                                </div>
                                <div className={styles.infoValue}>
                                    {userRole === 'owner' ? 'مالك' :
                                        userRole === 'admin' ? 'مدير' : 'مستخدم'}
                                </div>
                            </div>
                        </div>
                    </Card>

                    {/* User Management (Owner Only) */}
                    {isOwner && (
                        <Card className={styles.card}>
                            <div className={styles.sectionHeader}>
                                <HiUserAdd className={styles.sectionIcon} />
                                <h2 className={styles.sectionTitle}>إدارة المستخدمين</h2>
                            </div>

                            {loading ? (
                                <div className={styles.loading}>جاري التحميل...</div>
                            ) : (
                                <div className={styles.usersList}>
                                    {users.length === 0 ? (
                                        <div className={styles.emptyState}>
                                            <p>لا يوجد مستخدمين تابعين</p>
                                        </div>
                                    ) : (
                                        <>
                                            {/* Role selector for each user - we'll handle this differently */}
                                            {filteredUsers.map((u) => (
                                                <div key={u.uid} className={styles.userRow}>
                                                    <div className={styles.userInfo}>
                                                        <div className={styles.userName}>{u.name || 'بدون اسم'}</div>
                                                        <div className={styles.userEmail}>{u.email || 'بدون بريد'}</div>
                                                    </div>
                                                    <div className={styles.userControls}>
                                                        <select
                                                            value={u.role || 'user'}
                                                            onChange={(e) => handleChangeRole(u.uid, e.target.value)}
                                                            className={styles.roleSelect}
                                                        >
                                                            <option value="user">مستخدم</option>
                                                            <option value="admin">مدير</option>
                                                        </select>
                                                        <span className={u.isSubscribe ? styles.active : styles.inactive}>
                                                            {u.isSubscribe ? 'مفعل' : 'غير مفعل'}
                                                        </span>
                                                        <div className={styles.actions}>
                                                            <button
                                                                className={styles.editButton}
                                                                onClick={() => handleEditUser(u)}
                                                                title="تعديل"
                                                            >
                                                                <HiPencil />
                                                            </button>
                                                            <button
                                                                className={styles.deleteButton}
                                                                onClick={() => handleDeleteClick(u)}
                                                                title="حذف"
                                                            >
                                                                <HiTrash />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </>
                                    )}
                                </div>
                            )}
                        </Card>
                    )}
                </div>

                {/* User Form Modal */}
                <Modal
                    isOpen={showUserForm}
                    onClose={handleCancelForm}
                    title={editingUser ? 'تعديل مستخدم' : 'إضافة مستخدم جديد'}
                    footer={null}
                >
                    {error && (
                        <div className={styles.errorMessage}>
                            {error}
                        </div>
                    )}
                    <UserForm
                        user={editingUser}
                        onSave={handleSaveUser}
                        onCancel={handleCancelForm}
                        loading={formLoading}
                    />
                </Modal>

                {/* Delete Confirmation Modal */}
                <Modal
                    isOpen={showDeleteModal}
                    onClose={handleDeleteCancel}
                    title="تأكيد الحذف"
                    footer={
                        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                            <Button
                                variant="secondary"
                                onClick={handleDeleteCancel}
                                disabled={deleteLoading}
                            >
                                إلغاء
                            </Button>
                            <Button
                                variant="danger"
                                onClick={handleDeleteConfirm}
                                disabled={deleteLoading}
                            >
                                {deleteLoading ? 'جاري الحذف...' : 'حذف'}
                            </Button>
                        </div>
                    }
                >
                    <div>
                        <p>هل أنت متأكد أنك تريد حذف المستخدم <strong>{userToDelete?.name || userToDelete?.email}</strong>؟</p>
                        <p style={{ color: '#ef4444', marginTop: '10px' }}>لا يمكن التراجع عن هذا الإجراء.</p>
                        {deleteError && (
                            <div className={styles.errorMessage} style={{ marginTop: '10px' }}>
                                {deleteError}
                            </div>
                        )}
                    </div>
                </Modal>
            </MainLayout>
        </AuthGuard>
    );
}

