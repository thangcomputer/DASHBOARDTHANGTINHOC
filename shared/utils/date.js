/**
 * Pure date utility functions.
 */
const date = {
  formatISO: (val) => {
    if (!val) return '';
    const d = new Date(val);
    return isNaN(d.getTime()) ? '' : d.toISOString();
  },

  startOfDay: (val = new Date()) => {
    const d = new Date(val);
    d.setHours(0, 0, 0, 0);
    return d;
  },

  endOfDay: (val = new Date()) => {
    const d = new Date(val);
    d.setHours(23, 59, 59, 999);
    return d;
  },

  addDays: (val, days) => {
    const d = new Date(val);
    d.setDate(d.getDate() + days);
    return d;
  },

  isSameDay: (d1, d2) => {
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  },
};

module.exports = date;
