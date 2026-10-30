// تنزيل بيانات كملف على جهاز المستخدم
export const downloadJson = (data, filename) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const backupFilename = () => `mado-backup-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
