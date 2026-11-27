const base = new Date();
function plus(days: number) {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
export const DATE_TODAY = plus(0);
export const DATE_PLUS_7 = plus(7);
export const DATE_PLUS_14 = plus(14);
export const DATE_PLUS_30 = plus(30);
export const DATE_PLUS_90 = plus(90);
export const CURRENT_MONTH = base.toISOString().slice(0, 7);
export const CURRENT_YEAR = base.getFullYear();
export const YEAR_START = `${base.getFullYear()}-01-01`;
