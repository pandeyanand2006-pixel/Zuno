export function generateOrderNumber(prefix = 'ZN') {
  const now = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${prefix}-${now}${rand}`;
}

export function generateId(length = 12) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export function slugify(text) {
  return String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function toPaise(rupees) {
  return Math.round(Number(rupees) * 100);
}

export function formatINR(amountInPaise) {
  const rupees = Number(amountInPaise) / 100;
  return '₹' + rupees.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}
