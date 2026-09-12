import { Router } from 'express';
import {
  updateProfile, listAddresses, addAddress, deleteAddress,
} from '../controllers/user.controller.js';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { addressSchema } from '../validators/auth.validators.js';
import { z } from 'zod';
import { db } from '../config/db.js';
import { env } from '../config/env.js';
import { isMongoConnected } from '../config/mongo.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { ok, fail } from '../utils/response.js';

const router = Router();
router.use(authMiddleware);

const profileSchema = z.object({
  name: z.string().min(2).max(80).optional(),
  email: z.string().email().optional(),
  mobile: z.string().regex(/^[6-9]\d{9}$/).optional(),
});

router.put('/profile', validate(profileSchema), updateProfile);
router.get('/addresses', listAddresses);
router.post('/addresses', validate(addressSchema), addAddress);
router.delete('/addresses/:id', deleteAddress);

// Change password — works for admin and normal users
const changePwdSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});
router.post('/change-password', validate(changePwdSchema), async (req, res) => {
  const { currentPassword, newPassword } = req.validated;
  function useMongo() { return !!env.mongoUri && isMongoConnected(); }
  try {
    if (useMongo()) {
      const { User } = await import('../models/index.js');
      const user = await User.findById(req.user.id);
      if (!user) return fail(res, 'User not found', 404);
      const ok = await comparePassword(currentPassword, user.password_hash);
      if (!ok) return fail(res, 'Current password is incorrect', 401);
      user.password_hash = await hashPassword(newPassword);
      await user.save();
      return ok(res, null, 'Password updated');
    }
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!row) return fail(res, 'User not found', 404);
    const ok = await comparePassword(currentPassword, row.password_hash);
    if (!ok) return fail(res, 'Current password is incorrect', 401);
    const hash = await hashPassword(newPassword);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, req.user.id);
    return ok(res, null, 'Password updated');
  } catch (e) { return fail(res, e.message, 400); }
});

export default router;
