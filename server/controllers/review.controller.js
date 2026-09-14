import { ok, fail } from '../utils/response.js';
import { reviewService } from '../services/review.service.js';

export async function listReviews(req, res) {
  const productId = req.params.productId || req.params.id;
  const page = Number(req.query.page) || 1;
  const limit = Math.min(50, Number(req.query.limit) || 20);
  try {
    const data = await reviewService.listForProduct(productId, { page, limit });
    return ok(res, data);
  } catch (e) {
    return fail(res, e.message, 400);
  }
}

export async function addReview(req, res) {
  const productId = req.params.productId || req.params.id;
  const { rating, title, body } = req.body || {};
  if (rating === undefined || rating === null) return fail(res, 'rating required (1-5)', 400);
  const r = Number(rating);
  if (!Number.isFinite(r) || r < 1 || r > 5) return fail(res, 'rating must be 1-5', 400);
  try {
    const result = await reviewService.addReview({ productId, userId: req.user.id, rating: r, title, body });
    return ok(res, result, 'Rating saved — live');
  } catch (e) {
    const msg = e.message || 'Could not save rating';
    if (msg.includes('not found')) return fail(res, msg, 404);
    return fail(res, msg, 400);
  }
}

export async function deleteReview(req, res) {
  const productId = req.params.productId || req.params.id;
  const { reviewId } = req.params;
  try {
    const stats = await reviewService.deleteReview({ productId, userId: req.user.id, reviewId });
    return ok(res, stats, 'Deleted');
  } catch (e) {
    return fail(res, e.message, 400);
  }
}
