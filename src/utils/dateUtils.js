// src/utils/dateUtils.js

/**
 * Formats any date string, ISO string, or Date object to DD/MM/YYYY format.
 */
export const toDDMMYYYY = (dateStr) => {
  if (!dateStr) return '';
  const str = String(dateStr).trim();
  
  // If already DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    return str;
  }
  // If DD-MM-YYYY
  if (/^\d{2}-\d{2}-\d{4}$/.test(str)) {
    return str.replace(/-/g, '/');
  }
  // If YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    const [yyyy, mm, dd] = str.split('T')[0].split('-');
    return `${dd}/${mm}/${yyyy}`;
  }
  try {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    }
  } catch (e) {}
  return str;
};

/**
 * Formats DD/MM/YYYY to YYYY-MM-DD for native HTML date pickers.
 */
export const toYYYYMMDD = (ddmmyyyy) => {
  if (!ddmmyyyy) return '';
  const str = String(ddmmyyyy).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  const parts = str.split(/[\/\-]/);
  if (parts.length === 3) {
    const [dd, mm, yyyy] = parts;
    if (yyyy && yyyy.length === 4) {
      return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
  }
  return str;
};

/**
 * Returns today's date formatted as DD/MM/YYYY
 */
export const getTodayDDMMYYYY = () => {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};
