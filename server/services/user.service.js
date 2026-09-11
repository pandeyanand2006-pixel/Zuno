import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { isMongoConnected } from '../config/mongo.js';
function useMongo() { return !!env.mongoUri && isMongoConnected(); }

export const userService = {
  async updateProfile(userId, { name, email, mobile }) {
    if (useMongo()) {
      const { User } = await import('../models/index.js');
      if (email || mobile) {
        const conflict = await User.findOne({ $or: [{ email: email || '__none' }, { mobile: mobile || '__none' }], _id: { $ne: userId } });
        if (conflict) throw new Error('CONFLICT');
      }
      const user = await User.findById(userId);
      if (!user) throw new Error('NOT_FOUND');
      if (name) user.name = name;
      if (email) user.email = email;
      if (mobile) user.mobile = mobile;
      await user.save();
      return user;
    }
    const existing = db
      .prepare('SELECT id FROM users WHERE (email = ? OR mobile = ?) AND id != ?')
      .get(email || 'x', mobile || 'x', userId);
    if (existing) throw new Error('CONFLICT');

    const current = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    db.prepare('UPDATE users SET name = ?, email = ?, mobile = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(name || current.name, email || current.email, mobile || current.mobile, userId);

    return db.prepare('SELECT id, name, email, mobile, role_id, status FROM users WHERE id = ?').get(userId);
  },

  async listAddresses(userId) {
    if (useMongo()) {
      const { Address } = await import('../models/index.js');
      return await Address.find({ user_id: userId }).sort({ is_default: -1, _id: -1 }).lean();
    }
    return db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC').all(userId);
  },

  async addAddress(userId, data) {
    if (useMongo()) {
      const { Address } = await import('../models/index.js');
      if (data.is_default) await Address.updateMany({ user_id: userId }, { is_default: false });
      const addr = await Address.create({
        user_id: userId,
        label: data.label || null,
        line1: data.line1,
        line2: data.line2 || null,
        city: data.city,
        state: data.state || null,
        pincode: data.pincode,
        latitude: data.latitude ?? null,
        longitude: data.longitude ?? null,
        is_default: !!data.is_default,
      });
      return addr.toObject();
    }
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

  async deleteAddress(userId, id) {
    if (useMongo()) {
      const { Address } = await import('../models/index.js');
      const res = await Address.deleteOne({ _id: id, user_id: userId });
      return res.deletedCount > 0;
    }
    const info = db.prepare('DELETE FROM addresses WHERE id = ? AND user_id = ?').run(id, userId);
    return info.changes > 0;
  },
};
