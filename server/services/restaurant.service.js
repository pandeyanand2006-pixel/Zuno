import { db } from '../config/db.js';
import { ok } from '../utils/response.js';

export const restaurantService = {
  list({ city, cuisine, search, page = 1, limit = 20 } = {}) {
    const clauses = ['active = 1'];
    const params = [];
    if (city) { clauses.push('city = ?'); params.push(city); }
    if (cuisine) { clauses.push('cuisine LIKE ?'); params.push(`%${cuisine}%`); }
    if (search) { clauses.push('name LIKE ?'); params.push(`%${search}%`); }
    const where = clauses.join(' AND ');
    const total = db.prepare(`SELECT COUNT(*) c FROM restaurants WHERE ${where}`).get(...params).c;
    const rows = db.prepare(`SELECT * FROM restaurants WHERE ${where} ORDER BY rating DESC LIMIT ? OFFSET ?`).all(...params, Number(limit), (Number(page)-1)*Number(limit));
    return { items: rows, total, page: Number(page), limit: Number(limit) };
  },
  get(slug) {
    const r = db.prepare('SELECT * FROM restaurants WHERE slug = ? AND active = 1').get(slug);
    if (!r) return null;
    r.menu = db.prepare('SELECT * FROM menu_items WHERE restaurant_id = ? ORDER BY category, name').all(r.id);
    return r;
  },
};

export function list(req, res) {
  return ok(res, restaurantService.list({ city: req.query.city, cuisine: req.query.cuisine, search: req.query.search, page: req.query.page, limit: req.query.limit }));
}
export function get(req, res) {
  const r = restaurantService.get(req.params.slug);
  if (!r) return ok(res, { error: 'not found' }, 'Not found', 404);
  return ok(res, { restaurant: r });
}
