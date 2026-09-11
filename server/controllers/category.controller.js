import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { isMongoConnected } from '../config/mongo.js';
function useMongo(){ return !!env.mongoUri && isMongoConnected(); }

export const categoryService = {
  async list({ module } = {}) {
    if (useMongo()) {
      const { Category } = await import('../models/index.js');
      const filter = { active: true };
      if (module) filter.module = module;
      return await Category.find(filter).sort({ position: 1, name: 1 }).lean();
    }
    const rows = module
      ? db.prepare('SELECT * FROM categories WHERE active = 1 AND module = ? ORDER BY position ASC, name ASC').all(module)
      : db.prepare('SELECT * FROM categories WHERE active = 1 ORDER BY module, position ASC, name ASC').all();
    return rows;
  },
  async tree(module) {
    const rows = await this.list({ module });
    const map = new Map();
    rows.forEach((c) => {
      const id = String(c._id || c.id);
      map.set(id, { ...c, id, _id: c._id || c.id, children: [] });
    });
    const roots = [];
    map.forEach((node) => {
      const pid = node.parent_id ? String(node.parent_id) : null;
      if (pid && map.has(pid)) map.get(pid).children.push(node);
      else roots.push(node);
    });
    return roots;
  },
};

export async function listCategories(req, res) {
  const tree = await categoryService.tree(req.query.module);
  return res.status(200).json({ success: true, data: { categories: tree }, message: 'OK' });
}
