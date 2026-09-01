import { Router } from 'express';
import { list, get } from '../services/restaurant.service.js';

const router = Router();
router.get('/', list);
router.get('/:slug', get);
export default router;
