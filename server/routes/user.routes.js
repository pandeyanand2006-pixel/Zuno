import { Router } from 'express';
import {
  updateProfile, listAddresses, addAddress, deleteAddress,
} from '../controllers/user.controller.js';
import { validate } from '../middleware/validate.js';
import { authMiddleware } from '../middleware/auth.js';
import { addressSchema } from '../validators/auth.validators.js';
import { z } from 'zod';

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

export default router;
