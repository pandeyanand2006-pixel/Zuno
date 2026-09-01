import { productService } from '../services/product.service.js';
import { ok, notFound } from '../utils/response.js';

export function listProducts(req, res) {
  const q = req.query;
  const result = productService.list({
    module: q.module || 'shop',
    category: q.category,
    search: q.search,
    page: q.page || 1,
    limit: q.limit || 24,
    sort: q.sort || 'popular',
    minPrice: q.minPrice,
    maxPrice: q.maxPrice,
    brand: q.brand,
  });
  return ok(res, result);
}

export function getProduct(req, res) {
  const product = productService.getBySlug(req.params.slug);
  if (!product) return notFound(res, 'Product not found');
  return ok(res, { product });
}

export function searchSuggestions(req, res) {
  return ok(res, { suggestions: productService.searchSuggestions(req.query.q, Number(req.query.limit) || 8) });
}
