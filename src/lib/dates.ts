/**
 * Date helpers — all board dates are plain YYYY-MM-DD strings in the
 * user's LOCAL timezone. Never use toISOString() for day keys: it returns
 * the UTC date, which is off by one for users west of UTC in the evening.
 */

export const toDateStr = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export const todayStr = (): string => toDateStr(new Date());

export const offsetDateStr = (dateStr: string, days: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return toDateStr(date);
};