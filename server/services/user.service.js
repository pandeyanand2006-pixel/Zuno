import { db } from '../config/db.js';

export const userService = {
  updateProfile(userId, { name, email, mobile }) {
    const existing = db
      .prepare('SELECT id FROM users WHERE (email = ? OR mobile = ?) AND id != ?')
      .get(email || 'x', mobile || 'x', userId);
    if (existing) throw new Error('CONFLICT');

    const current = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    db.prepare('UPDATE users SET name = ?, email = ?, mobile = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(name || current.name, email || current.email, mobile || current.mobile, userId);

    return db.prepare('SELECT id, name, email, mobile, role_id, status FROM users WHERE id = ?').get(userId);
  },

  listAddresses(userId) {
    return db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC').all(userId);
  },

  addAddress(userId, data) {
    if (data.is_default) {
      db.prepare('UPDATE addresses SET is_default = 0 WHERE user_id = ?').run(userId);
    }
    const info = db
      .prepare(
        `INSERT INTO addresses (user_id, label, line1, line2, city, state, pincode, latitude, longitude, is_default)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        userId,
        data.label || null,
        data.line1,
        data.line2 || null,
        data.city,
        data.state || null,
        data.pincode,
        data.latitude ?? null,
        data.longitude ?? null,
        data.is_default ? 1 : 0
      );
    return db.prepare('SELECT * FROM addresses WHERE id = ?').get(info.lastInsertRowid);
  },

  deleteAddress(userId, id) {
    const info = db.prepare('DELETE FROM addresses WHERE id = ? AND user_id = ?').run(id, userId);
    return info.changes > 0;
  },
};
