'use client';

import { downloadBlob } from './renderPdf';

// رقم واتساب دولي من رقم مصري أو دولي مكتوب بأي شكل
export const toWhatsAppNumber = (phone) => {
  let digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.startsWith('0') && digits.length === 11) digits = `2${digits}`; // 01xxxxxxxxx → 201xxxxxxxxx
  return digits;
};

// إرسال ملف PDF على واتساب.
// واتساب مابيسمحش لموقع يرفق ملف في محادثة من خلال رابط، فبنستخدم قائمة المشاركة بتاعة الجهاز
// (بتظهر فيها واتساب على الموبايل والكمبيوتر). لو الجهاز مابيدعمش مشاركة الملفات:
// بننزّل الملف ونفتح محادثة العميل على واتساب عشان المستخدم يرفقه.
export const sharePdfOnWhatsApp = async ({ blob, filename, phone, message }) => {
  const file = new File([blob], filename, { type: 'application/pdf' });
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename, text: message });
      return 'shared';
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
      // أي خطأ تاني: نكمل بالطريقة البديلة
    }
  }
  downloadBlob(blob, filename);
  const number = toWhatsAppNumber(phone);
  const url = `https://wa.me/${number}?text=${encodeURIComponent(message || '')}`;
  window.open(url, '_blank', 'noopener');
  return 'downloaded';
};
