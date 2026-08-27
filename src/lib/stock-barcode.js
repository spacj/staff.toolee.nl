/**
 * Barcode matching helpers shared by the real Stock page and the homepage demo,
 * so a scanned code is resolved identically in both places.
 *
 * Stock items may carry three optional fields:
 *   - barcode      the unit / each barcode
 *   - boxBarcode   the barcode printed on a case / box
 *   - unitsPerBox  how many units a box contains
 */

const norm = (v) => String(v ?? '').trim();

/**
 * Resolve a scanned code against a list of stock items.
 * Lookup order: unit `barcode` → `boxBarcode` → legacy `sku`.
 *
 * @param {Array} items
 * @param {string} code
 * @returns {{ item: object, kind: 'unit'|'box' } | null}
 */
export function findByBarcode(items, code) {
  const c = norm(code);
  if (!c || !Array.isArray(items)) return null;

  const byUnit = items.find((i) => norm(i.barcode) === c);
  if (byUnit) return { item: byUnit, kind: 'unit' };

  const byBox = items.find((i) => norm(i.boxBarcode) === c);
  if (byBox) return { item: byBox, kind: 'box' };

  const bySku = items.find((i) => norm(i.sku) === c);
  if (bySku) return { item: bySku, kind: 'unit' };

  return null;
}

/** Units a box scan adds for an item (defaults to 1 if unitsPerBox missing). */
export function boxUnits(item) {
  const n = Number(item?.unitsPerBox);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
