import { fail, serverError } from '../utils/response.js';
import { logger } from '../utils/logger.js';

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err && err.type === 'entity.parse.failed') {
    return fail(res, 'Malformed request body', 400);
  }

  logger.error(`Unhandled error on ${req.method} ${req.originalUrl}`, err);
  return serverError(res);
}

export function notFoundHandler(req, res) {
  return fail(res, `Route not found: ${req.method} ${req.originalUrl}`, 404, 'ROUTE_NOT_FOUND');
}
