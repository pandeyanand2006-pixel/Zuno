import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { listReviews, addReview, deleteReview } from '../controllers/review.controller.js';

const router = Router();

// Public — list reviews + live rating for a product
router.get('/products/:productId/reviews', listReviews);
// Also support /:id alias
router.get('/:productId/reviews', listReviews);

// Auth — add/update rating
router.post('/products/:productId/reviews', authMiddleware, addReview);
router.post('/:productId/reviews', authMiddleware, addReview);

// Auth — delete own review
router.delete('/products/:productId/reviews/:reviewId', authMiddleware, deleteReview);
router.delete('/:productId/reviews/:reviewId', authMiddleware, deleteReview);

export default router;
