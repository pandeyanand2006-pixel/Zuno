import { productService } from '../services/product.service.js';
import { ok, notFound } from '../utils/response.js';

export async function listProducts(req, res) {
  const q = req.query;
  const result = await productService.list({
    module: q.module || 'shop',
    category: q.category,
    search: q.search,
    page: q.page || 1,
    limit: q.limit || 24,
    sort: q.sort || 'popular',
    minPrice: q.minPrice,
    maxPrice: q.maxPrice,
    brand: q.brand,
    color: q.color,
    size: q.size,
    fit: q.fit,
    collection: q.collection,
    featured: q.featured,
    newArrival: q.newArrival,
  });
  return ok(res, result);
}

export async function getProduct(req, res) {
  const product = await productService.getBySlug(req.params.slug);
  if (!product) return notFound(res, 'Product not found');
  return ok(res, { product });
}

export async function searchSuggestions(req, res) {
  return ok(res, { suggestions: await productService.searchSuggestions(req.query.q, Number(req.query.limit) || 8) });
}
