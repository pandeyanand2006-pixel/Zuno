import { db } from '../config/db.js';

export const categoryService = {
  list({ module } = {}) {
    const rows = module
      ? db.prepare('SELECT * FROM categories WHERE active = 1 AND module = ? ORDER BY position ASC, name ASC').all(module)
      : db.prepare('SELECT * FROM categories WHERE active = 1 ORDER BY module, position ASC, name ASC').all();
    return rows;
  },
  tree(module) {
    const rows = this.list({ module });
    const map = new Map();
    rows.forEach((c) => map.set(c.id, { ...c, children: [] }));
    const roots = [];
    map.forEach((node) => {
      if (node.parent_id && map.has(node.parent_id)) map.get(node.parent_id).children.push(node);
      else roots.push(node);
    });
    return roots;
  },
};

export function listCategories(req, res) {
  const tree = categoryService.tree(req.query.module);
  return res.status(200).json({ success: true, data: { categories: tree }, message: 'OK' });
}
