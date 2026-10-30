'use client';

// تحويل مستند React لـ PDF بمقاس A4.
// المستند بيترندر في المتصفح (فالعربي والخطوط بتظهر صح)، وبعدين بيتصور ويتقسم صفحات
// عند حدود الصفوف (العناصر اللي عليها data-pdf-row) عشان مفيش صف يتقطع في النص.

import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';

export const PDF_PAGE_WIDTH_PX = 794; // عرض A4 على 96dpi

let fontCssPromise = null;

const waitForImages = (root) =>
  Promise.all(
    [...root.querySelectorAll('img')].map((img) =>
      img.complete ? Promise.resolve() : new Promise((resolve) => { img.onload = resolve; img.onerror = resolve; })
    )
  );

export const renderToPdfBlob = async (element) => {
  const [{ toCanvas, getFontEmbedCSS }, { jsPDF }] = await Promise.all([import('html-to-image'), import('jspdf')]);

  const host = document.createElement('div');
  host.style.cssText = `position:fixed;top:0;left:-20000px;width:${PDF_PAGE_WIDTH_PX}px;z-index:-1;pointer-events:none;`;
  document.body.appendChild(host);
  const root = createRoot(host);
  try {
    flushSync(() => root.render(element));
    await document.fonts.ready;
    await waitForImages(host);
    const node = host.firstElementChild;

    const scale = 2;
    if (!fontCssPromise) fontCssPromise = getFontEmbedCSS(node).catch(() => '');
    const fontEmbedCSS = await fontCssPromise;
    const canvas = await toCanvas(node, { pixelRatio: scale, backgroundColor: '#ffffff', fontEmbedCSS, cacheBust: false });

    // أماكن القطع المسموحة (نهاية كل صف/قسم) بوحدة بكسلات الصورة
    const top = node.getBoundingClientRect().top;
    const breaks = [...node.querySelectorAll('[data-pdf-row]')]
      .map((el) => Math.round((el.getBoundingClientRect().bottom - top) * scale))
      .sort((a, b) => a - b);

    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait', compress: true });
    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const pxPerPt = canvas.width / pageW;
    const pagePx = Math.floor(pageH * pxPerPt);

    let y = 0;
    let first = true;
    while (y < canvas.height - 2) {
      let end = Math.min(y + pagePx, canvas.height);
      if (end < canvas.height) {
        const candidates = breaks.filter((b) => b > y + pagePx * 0.4 && b <= end);
        if (candidates.length) end = candidates[candidates.length - 1];
      }
      const slice = document.createElement('canvas');
      slice.width = canvas.width;
      slice.height = end - y;
      const ctx = slice.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, slice.width, slice.height);
      ctx.drawImage(canvas, 0, y, canvas.width, end - y, 0, 0, canvas.width, end - y);
      if (!first) pdf.addPage();
      pdf.addImage(slice.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, pageW, (end - y) / pxPerPt);
      first = false;
      y = end;
    }
    return pdf.output('blob');
  } finally {
    root.unmount();
    host.remove();
  }
};

export const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
