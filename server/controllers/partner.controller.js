import { partnerService } from '../services/partner.service.js';
import { ok, fail, notFound, forbidden } from '../utils/response.js';
import { logger } from '../utils/logger.js';

function handle(res, fn) {
  return async (req, res2) => {
    try { return ok(res2, await fn(req)); }
    catch (err) {
      if (err.message === 'PARTNER_NOT_LINKED') return forbidden(res2, 'Your account is not linked to a partner profile. Contact admin to enable seller/restaurant/provider access.');
      if (err.message === 'NOT_FOUND') return notFound(res2, 'Not found');
      if (err.message === 'BAD_CATEGORY') return fail(res2, 'Invalid category for this module', 400, 'BAD_CATEGORY');
      logger.error('partner', err);
      return fail(res2, 'Request failed', 400);
    }
  };
}

// SELLER
export const listSellerProducts = handle(null, (req) => partnerService.listSellerProducts(req.user.id));
export const createSellerProduct = handle(null, (req) => partnerService.createSellerProduct(req.user.id, req.validated));
export const updateSellerProduct = handle(null, (req) => partnerService.updateSellerProduct(req.user.id, Number(req.params.id), req.validated));
export const deactivateSellerProduct = handle(null, (req) => partnerService.deactivateSellerProduct(req.user.id, Number(req.params.id)));
export const sellerOrders = handle(null, (req) => partnerService.sellerOrders(req.user.id));
export const sellerAnalytics = handle(null, (req) => partnerService.sellerAnalytics(req.user.id));

// RESTAURANT
export const listMenu = handle(null, (req) => partnerService.listMenu(req.user.id));
export const createMenuItem = handle(null, (req) => partnerService.createMenuItem(req.user.id, req.validated));
export const updateMenuItem = handle(null, (req) => partnerService.updateMenuItem(req.user.id, Number(req.params.id), req.validated));
export const deleteMenuItem = handle(null, (req) => partnerService.deleteMenuItem(req.user.id, Number(req.params.id)));
export const restaurantOrders = handle(null, (req) => partnerService.restaurantOrders(req.user.id));

// PROVIDER
export const listServices = handle(null, (req) => partnerService.listServices(req.user.id));
export const createService = handle(null, (req) => partnerService.createService(req.user.id, req.validated));
export const updateService = handle(null, (req) => partnerService.updateService(req.user.id, Number(req.params.id), req.validated));
export const deleteService = handle(null, (req) => partnerService.deleteService(req.user.id, Number(req.params.id)));
export const providerBookings = handle(null, (req) => partnerService.providerBookings(req.user.id));
export const updateBookingStatus = handle(null, (req) => partnerService.updateBookingStatus(req.user.id, Number(req.params.id), req.validated.status));
