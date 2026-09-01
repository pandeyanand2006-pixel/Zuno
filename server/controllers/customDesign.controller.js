import { db } from '../config/db.js';
import { ok, fail, notFound } from '../utils/response.js';

export function listDesigns(req, res) {
  const rows = db.prepare('SELECT * FROM custom_designs WHERE user_id = ? ORDER BY updated_at DESC').all(req.user.id);
  const items = rows.map((r) => ({ ...r, designData: JSON.parse(r.design_data), previewImage: r.preview_image }));
  return ok(res, { items });
}

export function getDesign(req, res) {
  const row = db.prepare('SELECT * FROM custom_designs WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return notFound(res, 'Design not found');
  return ok(res, { design: { ...row, designData: JSON.parse(row.design_data) } });
}

export function createDesign(req, res) {
  const { name, productId, color, size, fit, designData, previewImage } = req.validated;
  const info = db.prepare('INSERT INTO custom_designs (user_id, name, product_id, color, size, fit, design_data, preview_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(req.user.id, name, productId || null, color || 'white', size || 'M', fit || 'regular', JSON.stringify(designData), previewImage || null);
  const row = db.prepare('SELECT * FROM custom_designs WHERE id = ?').get(info.lastInsertRowid);
  return ok(res, { design: { ...row, designData: JSON.parse(row.design_data) } }, 'Design saved', 201);
}

export function updateDesign(req, res) {
  const existing = db.prepare('SELECT * FROM custom_designs WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!existing) return notFound(res, 'Design not found');
  const { name, color, size, fit, designData, previewImage } = req.validated;
  db.prepare('UPDATE custom_designs SET name = COALESCE(?, name), color = COALESCE(?, color), size = COALESCE(?, size), fit = COALESCE(?, fit), design_data = COALESCE(?, design_data), preview_image = COALESCE(?, preview_image), updated_at = datetime(\'now\') WHERE id = ?')
    .run(name || null, color || null, size || null, fit || null, designData ? JSON.stringify(designData) : null, previewImage || null, req.params.id);
  const row = db.prepare('SELECT * FROM custom_designs WHERE id = ?').get(req.params.id);
  return ok(res, { design: { ...row, designData: JSON.parse(row.design_data) } });
}

export function deleteDesign(req, res) {
  const row = db.prepare('SELECT * FROM custom_designs WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return notFound(res, 'Design not found');
  db.prepare('DELETE FROM custom_designs WHERE id = ?').run(req.params.id);
  return ok(res, null, 'Design deleted');
}
