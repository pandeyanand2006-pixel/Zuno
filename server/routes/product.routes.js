import { Router } from 'express';
import { listProducts, getProduct, searchSuggestions } from '../controllers/product.controller.js';

const router = Router();
router.get('/', listProducts);
router.get('/suggestions', searchSuggestions);
router.get('/:slug', getProduct);

export default router;
