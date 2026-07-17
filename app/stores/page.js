"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "../../components/auth/AuthGuard";
import MainLayout from "../../components/layout/MainLayout";
import PageHeader from "../../components/layout/PageHeader";
import Card from "../../components/ui/Card";
import Modal from "../../components/ui/Modal";
import Button from "../../components/ui/Button";
import {
  subscribeToStores,
  addStore,
  updateStore,
  deleteStore,
  subscribeToAllStoreProducts,
  subscribeToStoreTransfers,
  addStoreTransfer,
  deleteStoreTransfer,
} from "../../lib/firebase/firestore";
import { getUserFromLocalStorage } from "../../lib/auth";
import {
  HiOfficeBuilding,
  HiPencil,
  HiTrash,
  HiDocumentReport,
  HiSwitchHorizontal,
  HiX,
  HiPlus,
  HiArrowUp,
  HiArrowDown,
  HiArrowLeft,
} from "react-icons/hi";
import styles from "./page.module.css";

export default function StoresPage() {
  const router = useRouter();
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [formData, setFormData] = useState({ name: "" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [storeToDelete, setStoreToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  // Transfer modal
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferFrom, setTransferFrom] = useState("");
  const [transferTo, setTransferTo] = useState("");
  const [storeProducts, setStoreProducts] = useState([]);
  const [transferLines, setTransferLines] = useState([
    { productId: "", productName: "", productSearchText: "", quantity: "" },
  ]);
  const [transferError, setTransferError] = useState("");
  const [transferring, setTransferring] = useState(false);

  // Transfer reports
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [transfers, setTransfers] = useState([]);
  const [deletingTransferId, setDeletingTransferId] = useState(null);
  const [editingTransferId, setEditingTransferId] = useState(null);
  const [isDeleteTransferModalOpen, setIsDeleteTransferModalOpen] = useState(false);
  const [transferToDelete, setTransferToDelete] = useState(null);
  const [deletingTransferLoading, setDeletingTransferLoading] = useState(false);
  const transferringRef = useRef(false);

  const userData = getUserFromLocalStorage();
  const userRole = userData?.role || "user";
  const isOwner = userRole === "owner";

  useEffect(() => {
    const unsubscribe = subscribeToStores((data) => {
      setStores(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const unsub = subscribeToAllStoreProducts((data) => {
      setStoreProducts(data);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = subscribeToStoreTransfers((data) => {
      const seen = new Set();
      const deduped = data.filter((t) => {
        if (seen.has(t.id)) return false;
        seen.add(t.id);
        return true;
      });
      setTransfers(deduped);
    });
    return () => unsub();
  }, []);

  const filteredStores = stores.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (s.name || "").toLowerCase().includes(q);
  });

  const formatDate = (date) => {
    if (!date) return "";
    const d = date instanceof Date ? date : new Date(date);
    return (
      d.toLocaleDateString("ar-EG") +
      " " +
      d.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })
    );
  };

  const getProductsInStore = (storeId) => {
    return storeProducts.filter(
      (sp) => sp.storeId === storeId && (Number(sp.totalQuantity) || 0) > 0,
    );
  };

  // Store CRUD
  const openAddModal = () => {
    if (!isOwner) return;
    setEditingStore(null);
    setFormData({ name: "" });
    setFormError("");
    setIsFormModalOpen(true);
  };

  const openEditModal = (store) => {
    if (!isOwner) return;
    setEditingStore(store);
    setFormData({ name: store.name || "" });
    setFormError("");
    setIsFormModalOpen(true);
  };

  const closeFormModal = () => {
    setIsFormModalOpen(false);
    setEditingStore(null);
    setFormError("");
  };

  const handleInputChange = (e) => {
    setFormData({ name: e.target.value });
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setFormError("يرجى إدخال اسم المخزن");
      return;
    }
    setSaving(true);
    setFormError("");
    try {
      if (editingStore) {
        const result = await updateStore(editingStore.id, formData);
        if (!result.success) {
          setFormError(result.error || "فشل في تعديل المخزن");
          setSaving(false);
          return;
        }
      } else {
        const result = await addStore(formData);
        if (!result.success) {
          setFormError(result.error || "فشل في إضافة المخزن");
          setSaving(false);
          return;
        }
      }
      closeFormModal();
    } catch (err) {
      setFormError("حدث خطأ. يرجى المحاولة مرة أخرى.");
    } finally {
      setSaving(false);
    }
  };

  const openDeleteModal = (store) => {
    if (!isOwner) return;
    setStoreToDelete(store);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!storeToDelete) return;
    setDeleteLoading(true);
    try {
      const result = await deleteStore(storeToDelete.id);
      if (!result.success) {
        setDeleteLoading(false);
        return;
      }
      setIsDeleteModalOpen(false);
      setStoreToDelete(null);
    } catch (err) {
      console.error("Error deleting store:", err);
    } finally {
      setDeleteLoading(false);
    }
  };

  const goToStoreReports = (storeId) => {
    router.push(`/stores/${storeId}`);
  };

  // Transfer
  const openTransferModal = () => {
    if (stores.length < 2) return;
    setEditingTransferId(null);
    setTransferFrom(stores[0].id);
    setTransferTo(stores[1].id);
    setTransferLines([{ productId: "", productName: "", productSearchText: "", quantity: "" }]);
    setTransferError("");
    setIsTransferModalOpen(true);
  };

  const closeTransferModal = () => {
    setIsTransferModalOpen(false);
    setTransferError("");
    setEditingTransferId(null);
  };

  const addTransferLine = () => {
    setTransferLines((prev) => [
      ...prev,
      { productId: "", productName: "", productSearchText: "", quantity: "" },
    ]);
  };

  const removeTransferLine = (index) => {
    setTransferLines((prev) => prev.filter((_, i) => i !== index));
  };

  const updateTransferLine = (index, field, value) => {
    setTransferLines((prev) => {
      const updated = [...prev];
      if (field === "productSearchText") {
        const productsInStore = getProductsInStore(transferFrom);
        const matched = productsInStore.find((sp) => sp.productName === value);
        updated[index] = {
          ...updated[index],
          productSearchText: value,
          productId: matched ? matched.productId : "",
          productName: matched ? matched.productName : "",
          quantity: "",
        };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  const handleTransfer = async () => {
    if (transferringRef.current) return;
    if (!transferFrom || !transferTo) {
      setTransferError("يرجى اختيار المخازن");
      return;
    }
    if (transferFrom === transferTo) {
      setTransferError("لا يمكن التحويل لنفس المخزن");
      return;
    }
    for (let i = 0; i < transferLines.length; i++) {
      const line = transferLines[i];
      if (!line.productId) {
        setTransferError(`الصنف رقم ${i + 1} لم يتم اختياره`);
        return;
      }
      if (!line.quantity || Number(line.quantity) <= 0) {
        setTransferError(`الكمية للصنف رقم ${i + 1} غير صحيحة`);
        return;
      }
    }

    transferringRef.current = true;
    setTransferring(true);
    setTransferError("");

    const fromStore = stores.find((s) => s.id === transferFrom);
    const toStore = stores.find((s) => s.id === transferTo);
    const products = transferLines.map((line) => ({
      productId: line.productId,
      productName: line.productName,
      quantity: Number(line.quantity),
    }));

    // If editing, delete the old transfer first (reverts its inventory)
    if (editingTransferId) {
      const delResult = await deleteStoreTransfer(editingTransferId);
      if (!delResult.success) {
        transferringRef.current = false;
        setTransferError(delResult.error || "فشل في حذف التحويلة القديمة");
        setTransferring(false);
        return;
      }
    }

    const result = await addStoreTransfer({
      fromStoreId: transferFrom,
      fromStoreName: fromStore?.name || "",
      toStoreId: transferTo,
      toStoreName: toStore?.name || "",
      products,
    });

    if (!result.success) {
      transferringRef.current = false;
      setTransferError(result.error || "فشل في التحويل");
      setTransferring(false);
      return;
    }

    setTransferring(false);
    transferringRef.current = false;
    closeTransferModal();
  };

  // Transfer reports
  const openTransferReport = () => {
    setIsReportOpen(true);
  };

  const openEditTransfer = (transfer) => {
    if (!isOwner || !transfer) return;
    setEditingTransferId(transfer.id);
    setTransferFrom(transfer.fromStoreId);
    setTransferTo(transfer.toStoreId);
    setTransferLines(
      transfer.products.map((p) => ({
        productId: p.productId,
        productName: p.productName,
        productSearchText: p.productName,
        quantity: String(p.quantity),
      })),
    );
    setTransferError("");
    setIsTransferModalOpen(true);
  };

  const confirmDeleteTransfer = (transferId) => {
    if (!isOwner) return;
    setTransferToDelete(transferId);
    setIsDeleteTransferModalOpen(true);
  };

  const handleDeleteTransferConfirm = async () => {
    if (!transferToDelete) return;
    setDeletingTransferLoading(true);
    setDeletingTransferId(transferToDelete);
    try {
      await deleteStoreTransfer(transferToDelete);
    } catch (err) {
      console.error("Error deleting transfer:", err);
    } finally {
      setDeletingTransferId(null);
      setDeletingTransferLoading(false);
      setIsDeleteTransferModalOpen(false);
      setTransferToDelete(null);
    }
  };

  return (
    <AuthGuard>
      <MainLayout>
        <div className={styles.container}>
          <PageHeader
            title="المخازن"
            action={isOwner ? "addStore" : null}
            actionLabel={isOwner ? "+ إضافة مخزن" : null}
            onAction={isOwner ? openAddModal : null}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            showSearch={stores.length > 0}
            customActions={
              <div className={styles.headerCustomActions}>
                {stores.length >= 2 && (
                  <button
                    className={styles.transferBtn}
                    onClick={openTransferModal}
                  >
                    <HiSwitchHorizontal size={16} />
                    تحويل
                  </button>
                )}
                <button
                  className={styles.reportBtn}
                  onClick={openTransferReport}
                >
                  <HiDocumentReport size={16} />
                  تقارير التحويلات
                </button>
              </div>
            }
          />

          {loading ? (
            <div className={styles.loading}>جاري التحميل...</div>
          ) : stores.length === 0 ? (
            <Card>
              <div className={styles.emptyState}>
                <p>
                  {isOwner
                    ? "لا توجد مخازن. أضف مخزن جديد باستخدام الزر أعلاه."
                    : "لا توجد مخازن متاحة."}
                </p>
              </div>
            </Card>
          ) : filteredStores.length === 0 ? (
            <Card>
              <div className={styles.emptyState}>
                <p>لا توجد نتائج للبحث.</p>
              </div>
            </Card>
          ) : (
            filteredStores.map((store) => (
              <div key={store.id} className={styles.storeCard}>
                <div className={styles.storeInfo}>
                  <div className={styles.storeName}>
                    <HiOfficeBuilding
                      style={{
                        marginLeft: "8px",
                        verticalAlign: "middle",
                        color: "var(--primary-color)",
                      }}
                    />
                    {store.name}
                  </div>
                  <div className={styles.storeActions}>
                    <button
                      className={styles.reportButton}
                      onClick={() => goToStoreReports(store.id)}
                    >
                      <HiDocumentReport size={16} />
                      تقارير المخزن
                    </button>
                    {isOwner && (
                      <>
                        <button
                          className={styles.editButton}
                          onClick={() => openEditModal(store)}
                          title="تعديل"
                        >
                          <HiPencil />
                        </button>
                        <button
                          className={styles.deleteButton}
                          onClick={() => openDeleteModal(store)}
                          title="حذف"
                        >
                          <HiTrash />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Add/Edit Store Modal */}
        <Modal
          isOpen={isFormModalOpen}
          onClose={closeFormModal}
          title={editingStore ? "تعديل مخزن" : "إضافة مخزن جديد"}
          footer={
            <div className={styles.formActions}>
              <Button
                variant="secondary"
                onClick={closeFormModal}
                disabled={saving}
              >
                إلغاء
              </Button>
              <Button variant="primary" onClick={handleSave} loading={saving}>
                {editingStore ? "حفظ التعديلات" : "إضافة"}
              </Button>
            </div>
          }
        >
          {formError && <div className={styles.errorMessage}>{formError}</div>}
          <div className={styles.form}>
            <div>
              <label className={styles.formLabel}>اسم المخزن</label>
              <input
                type="text"
                placeholder="أدخل اسم المخزن"
                value={formData.name}
                onChange={handleInputChange}
                className={styles.formInput}
              />
            </div>
          </div>
        </Modal>

        {/* Delete Store Modal */}
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setStoreToDelete(null);
          }}
          title="تأكيد الحذف"
          footer={
            <div className={styles.formActions}>
              <Button
                variant="secondary"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setStoreToDelete(null);
                }}
                disabled={deleteLoading}
              >
                إلغاء
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteConfirm}
                loading={deleteLoading}
              >
                حذف
              </Button>
            </div>
          }
        >
          <p>
            هل أنت متأكد أنك تريد حذف المخزن{" "}
            <strong>{storeToDelete?.name}</strong>؟
          </p>
          <p style={{ color: "#ef4444", marginTop: "10px" }}>
            لا يمكن التراجع عن هذا الإجراء.
          </p>
        </Modal>

        {/* Transfer Modal */}
        <Modal
          isOpen={isTransferModalOpen}
          onClose={closeTransferModal}
          title={editingTransferId ? "تعديل التحويلة" : "تحويل منتجات بين المخازن"}
          size="large"
          footer={
            <div className={styles.formActions}>
              <Button
                variant="secondary"
                onClick={closeTransferModal}
                disabled={transferring}
              >
                إلغاء
              </Button>
              <Button
                variant="primary"
                onClick={handleTransfer}
                loading={transferring}
              >
                {editingTransferId ? "حفظ التعديلات" : "تحويل"}
              </Button>
            </div>
          }
        >
          {transferError && (
            <div className={styles.errorMessage}>{transferError}</div>
          )}
          <div className={styles.form}>
            <div className={styles.transferStoreRow}>
              <div>
                <label className={styles.formLabel}>من مخزن</label>
                <select
                  className={styles.formSelect}
                  value={transferFrom}
                  onChange={(e) => {
                    setTransferFrom(e.target.value);
                    setTransferLines([
                      { productId: "", productName: "", productSearchText: "", quantity: "" },
                    ]);
                  }}
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className={styles.transferArrowCol}>
                <HiArrowLeft className={styles.transferArrow} />
              </div>
              <div>
                <label className={styles.formLabel}>إلى مخزن</label>
                <select
                  className={styles.formSelect}
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                >
                  {stores.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {transferLines.map((line, index) => (
              <div key={index} className={styles.transferLine}>
                <div style={{ flex: 1 }}>
                  <label className={styles.formLabel}>الصنف</label>
                  <input
                    type="text"
                    className={styles.formInput}
                    placeholder="ابحث عن صنف..."
                    value={line.productSearchText || ""}
                    onChange={(e) =>
                      updateTransferLine(index, "productSearchText", e.target.value)
                    }
                    list={`transfer-products-${index}`}
                  />
                  <datalist id={`transfer-products-${index}`}>
                    {getProductsInStore(transferFrom).map((sp) => (
                      <option key={sp.id} value={sp.productName}>
                        {sp.productName} (المتوفر: {sp.totalQuantity})
                      </option>
                    ))}
                  </datalist>
                </div>
                <div style={{ width: "120px" }}>
                  <label className={styles.formLabel}>الكمية</label>
                  <input
                    type="number"
                    className={styles.formInput}
                    placeholder="0"
                    value={line.quantity}
                    onChange={(e) =>
                      updateTransferLine(index, "quantity", e.target.value)
                    }
                  />
                </div>
                <button
                  className={styles.removeBtn}
                  onClick={() => removeTransferLine(index)}
                  title="حذف"
                  disabled={transferLines.length === 1}
                >
                  <HiX size={18} />
                </button>
              </div>
            ))}
            <button className={styles.addLineBtn} onClick={addTransferLine}>
              <HiPlus size={16} />
              إضافة صنف آخر
            </button>
          </div>
        </Modal>

        {/* Transfer Reports Modal */}
        <Modal
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          title="تقارير التحويلات"
          size="large"
          footer={null}
        >
          {transfers.length === 0 ? (
            <div className={styles.emptyState}>
              <p>لا توجد تحويلات.</p>
            </div>
          ) : (
            transfers.map((t) => (
              <div key={t.id} className={styles.transferReportCard}>
                <div className={styles.transferReportHeader}>
                  <div className={styles.transferReportStores}>
                    <HiArrowUp style={{ color: "#ef4444" }} /> {t.fromStoreName}
                    <HiArrowDown
                      style={{
                        color: "#10b981",
                        marginRight: "12px",
                        marginLeft: "4px",
                      }}
                    />{" "}
                    {t.toStoreName}
                  </div>
                  <div className={styles.transferReportMeta}>
                    <span>{formatDate(t.createdAt)}</span>
                    <span style={{ marginRight: "12px" }}>
                      بواسطة: {t.userName}
                    </span>
                  </div>
                </div>
                <div className={styles.transferReportProducts}>
                  {t.products?.map((p, idx) => (
                    <span key={idx} className={styles.transferReportProduct}>
                      {p.productName} × {p.quantity}
                    </span>
                  ))}
                </div>
                {isOwner && (
                  <div className={styles.transferActions}>
                    <button
                      className={styles.editTransferBtn}
                      onClick={() => openEditTransfer(t)}
                      title="تعديل التحويلة"
                    >
                      <HiPencil size={14} />
                      تعديل
                    </button>
                    <button
                      className={styles.deleteTransferBtn}
                      onClick={() => confirmDeleteTransfer(t.id)}
                      disabled={deletingTransferId === t.id}
                      title="حذف التحويلة"
                    >
                      <HiTrash size={14} />
                      حذف
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </Modal>

        {/* Delete Transfer Confirmation Modal */}
        <Modal
          isOpen={isDeleteTransferModalOpen}
          onClose={() => {
            setIsDeleteTransferModalOpen(false);
            setTransferToDelete(null);
          }}
          title="تأكيد حذف التحويلة"
          footer={
            <div className={styles.formActions}>
              <Button
                variant="secondary"
                onClick={() => {
                  setIsDeleteTransferModalOpen(false);
                  setTransferToDelete(null);
                }}
                disabled={deletingTransferLoading}
              >
                إلغاء
              </Button>
              <Button
                variant="danger"
                onClick={handleDeleteTransferConfirm}
                loading={deletingTransferLoading}
              >
                حذف
              </Button>
            </div>
          }
        >
          <p>هل أنت متأكد أنك تريد حذف هذه التحويلة؟</p>
          <p style={{ color: "#ef4444", marginTop: "10px" }}>
            سيتم إرجاع المنتجات للمخازن كما كانت قبل التحويل.
          </p>
        </Modal>
      </MainLayout>
    </AuthGuard>
  );
}
