import { Router } from 'express';
import {
  listServices, createService, updateService, deleteService, providerBookings, updateBookingStatus,
} from '../controllers/partner.controller.js';
import { validate } from '../middleware/validate.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { serviceSchema, serviceUpdateSchema, bookingStatusSchema } from '../validators/partner.validators.js';

const router = Router();
router.use(authMiddleware, requireRole('SERVICE_PROVIDER'));

router.get('/services', listServices);
router.post('/services', validate(serviceSchema), createService);
router.put('/services/:id', validate(serviceUpdateSchema), updateService);
router.delete('/services/:id', deleteService);
router.get('/bookings', providerBookings);
router.put('/bookings/:id/status', validate(bookingStatusSchema), updateBookingStatus);

export default router;
