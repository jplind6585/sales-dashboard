// Normalizer per value_type. Produces a canonical string used ONLY for conflict detection (does two
// claims mean the same thing?). Bad normalization silently corrupts the fact graph, so keep each
// function small, pure, and obvious. One function per value_type; unknown types fall back to string.

function normNumber(v) {
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/[^0-9.eE-]/g, ''));
  if (!Number.isFinite(n)) return '';
  // canonical form; round to ~4 significant figures so 10000 and ~10,000 match without over-merging
  const mag = Math.abs(n);
  if (mag === 0) return '0';
  const digits = Math.max(0, 4 - Math.floor(Math.log10(mag)) - 1);
  return Number(n.toFixed(Math.min(digits, 6))).toString();
}
function normString(v) { return String(v == null ? '' : v).trim().toLowerCase().replace(/\s+/g, ' '); }
function normEnum(v) { return normString(v).replace(/[\s-]+/g, '_'); }
function normArray(v, itemFn) {
  const arr = Array.isArray(v) ? v : String(v == null ? '' : v).split(/[,|]/);
  return arr.map(itemFn).filter(Boolean).sort().join('|');
}
function normBool(v) {
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  return ['true', 'yes', '1'].includes(normString(v)) ? 'true' : 'false';
}
function normDate(v) { const d = /^(\d{4}-\d{2}-\d{2})/.exec(String(v)); return d ? d[1] : normString(v); }

const NORMALIZERS = {
  number: normNumber,
  currency: normNumber,
  string: normString,
  enum: normEnum,
  boolean: normBool,
  date: normDate,
  daterange: (v) => (typeof v === 'object' && v ? `${normDate(v.start)}/${normDate(v.end)}` : normString(v)),
  enum_array: (v) => normArray(v, normEnum),
  string_array: (v) => normArray(v, normString),
  // long-form text is not normalized for conflict detection (should be multi_value_allowed)
  text: () => '',
};

export function normalize(valueType, value) {
  const fn = NORMALIZERS[valueType] || normString;
  try { return fn(value); } catch { return ''; }
}
