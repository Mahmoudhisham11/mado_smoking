'use client';

import { useState } from 'react';
import { renderToPdfBlob, downloadBlob } from '../../lib/pdf/renderPdf';

// تجهيز PDF من مستند React: mode = 'share' يفتح نافذة الإرسال، 'download' ينزّل الملف مباشرة
export default function usePdfShare() {
  const [generating, setGenerating] = useState(null);
  const [pdf, setPdf] = useState(null);
  const [error, setError] = useState('');

  const generate = async (key, element, meta, mode = 'share') => {
    setGenerating(key);
    setError('');
    try {
      // element ممكن يكون دالة async بتجيب البيانات الأول (والزرار بيبان بيحمّل من أول لحظة)
      const resolved = typeof element === 'function' ? await element() : element;
      const blob = await renderToPdfBlob(resolved);
      // البيانات الوصفية بتتقري بعد تجهيز المستند (الرسالة ممكن تعتمد على بيانات اتجابت فيه)
      const { filename, phone = '', message = '', recipient = '' } = meta;
      if (mode === 'download') downloadBlob(blob, filename);
      else setPdf({ blob, filename, phone, message, recipient });
    } catch (err) {
      console.error('PDF generation failed:', err);
      setError('تعذر إنشاء ملف PDF. حاول مرة أخرى.');
    } finally {
      setGenerating(null);
    }
  };

  return { generating, pdf, error, generate, close: () => setPdf(null), clearError: () => setError('') };
}
