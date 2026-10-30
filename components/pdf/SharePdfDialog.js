'use client';

import { useState } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { HiDownload } from 'react-icons/hi';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { downloadBlob } from '../../lib/pdf/renderPdf';
import { sharePdfOnWhatsApp, toWhatsAppNumber } from '../../lib/pdf/share';

// بعد تجهيز الـ PDF: زرار إرسال واتساب (ضغطة جديدة من المستخدم عشان قائمة المشاركة تشتغل على الموبايل)
export default function SharePdfDialog({ pdf, onClose }) {
  const [status, setStatus] = useState('');
  if (!pdf) return null;
  const sizeKb = Math.max(1, Math.round(pdf.blob.size / 1024));
  const hasPhone = Boolean(toWhatsAppNumber(pdf.phone));

  const handleShare = async () => {
    const result = await sharePdfOnWhatsApp(pdf);
    if (result === 'downloaded') {
      setStatus('تم تحميل الملف وفتح واتساب. أرفق الملف في المحادثة.');
    } else if (result === 'shared') {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={!!pdf}
      onClose={onClose}
      title="الملف جاهز"
      size="small"
      footer={
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={() => downloadBlob(pdf.blob, pdf.filename)}>
            <HiDownload size={16} style={{ marginLeft: '4px' }} /> تحميل PDF
          </Button>
          <Button variant="primary" onClick={handleShare} style={{ background: '#25D366', borderColor: '#25D366' }}>
            <FaWhatsapp size={18} style={{ marginLeft: '6px' }} /> إرسال على واتساب
          </Button>
        </div>
      }
    >
      <div style={{ textAlign: 'center', lineHeight: 1.9 }}>
        <div style={{ fontWeight: 700 }}>{pdf.filename}</div>
        <div style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
          {sizeKb} KB{pdf.recipient ? ` • إلى: ${pdf.recipient}` : ''}
        </div>
        {!hasPhone && (
          <div style={{ color: '#b45309', fontSize: '13px', marginTop: '8px' }}>
            لا يوجد رقم هاتف مسجل، هتختار جهة الاتصال من واتساب.
          </div>
        )}
        {status && <div style={{ color: 'var(--primary-color)', fontSize: '13px', marginTop: '8px' }}>{status}</div>}
      </div>
    </Modal>
  );
}
