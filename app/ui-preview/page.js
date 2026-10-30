'use client';

// صفحة مؤقتة لاختبار الـ bottom sheet والهيكل على الموبايل — هتتحذف بعد المراجعة
import { useState } from 'react';
import MainLayout from '../../components/layout/MainLayout';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';

const lines = Array.from({ length: 4 }, (_, i) => i);

export default function UiPreview() {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  return (
    <MainLayout>
      <h1 className="t-title">اختبار النوافذ</h1>
      <Button id="open-sheet" onClick={() => setOpen(true)}>إضافة فاتورة</Button>
      {Array.from({ length: 30 }, (_, i) => (
        <div key={i} className="m-card">كارت رقم {i + 1}</div>
      ))}
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title="إضافة فاتورة جديدة"
        size="large"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button id="save-btn" variant="primary" onClick={() => setConfirm(true)}>حفظ الفاتورة</Button>
          </>
        }
      >
        {lines.map((i) => (
          <div key={i} className="m-line">
            <div className="m-field"><label>المخزن</label><select className="m-select"><option>اختر مخزن</option></select></div>
            <div className="m-field"><label>الصنف</label><input className="m-input" placeholder="ابحث عن صنف" /></div>
            <div className="m-field"><label>سعر البيع</label><input className="m-input m-input--num" placeholder="0" /></div>
            <div className="m-field"><label>الكمية</label><input className="m-input m-input--num" placeholder="0" /></div>
          </div>
        ))}
        <div className="m-field"><label>المدفوع</label><input className="m-input m-input--num" placeholder="المبلغ المدفوع" /></div>
        <div id="sheet-end">آخر عنصر في النافذة</div>
      </Modal>
      <Modal
        isOpen={confirm}
        onClose={() => setConfirm(false)}
        title="تأكيد"
        size="small"
        footer={<Button id="confirm-ok" onClick={() => setConfirm(false)}>تمام</Button>}
      >
        نافذة فوق نافذة
      </Modal>
    </MainLayout>
  );
}
