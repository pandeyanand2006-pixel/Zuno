import { Router } from 'express';
import * as orderCtrl from '../controllers/order.controller.js';
import * as paymentCtrl from '../controllers/payment.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import { orderService } from '../services/order.service.js';
import { ok } from '../utils/response.js';

const idSchema = z.union([z.number().int().positive(), z.string().min(1)]);
const orderRouter = Router();
orderRouter.use(authMiddleware);
orderRouter.get('/:id/history', async (req, res) => {
  const history = await orderService.getHistory(req.params.id);
  return ok(res, { history });
});
orderRouter.post('/', validate(z.object({ module: z.enum(['shop','grocery','food']).default('shop'), addressId: idSchema, couponCode: z.string().optional(), customerNotes: z.string().max(500).optional(), paymentMethod: z.enum(['cod','online']).default('online') })), orderCtrl.createOrder);
orderRouter.get('/', orderCtrl.listOrders);
orderRouter.get('/:id', orderCtrl.getOrder);
orderRouter.post('/:id/cancel', orderCtrl.cancelOrder);
orderRouter.post('/custom', validate(z.object({ module: z.enum(['shop','grocery','food']), addressId: idSchema, couponCode: z.string().optional(), items: z.array(z.object({ type: z.enum(['product','menu']), id: idSchema, quantity: z.number().int().min(1).max(20) })).min(1) })), orderCtrl.createCustomOrder);

const paymentRouter = Router();
paymentRouter.use(authMiddleware);
paymentRouter.post('/create', validate(z.object({ orderId: idSchema })), paymentCtrl.createPayment);
paymentRouter.post('/verify', validate(z.object({ orderId: idSchema, razorpayOrderId: z.string().min(1), razorpayPaymentId: z.string().min(1), razorpaySignature: z.string().min(1) })), paymentCtrl.verifyPayment);
paymentRouter.post('/refund', validate(z.object({ paymentId: idSchema, amount: z.number().int().positive(), orderId: idSchema })), paymentCtrl.refund);

export { orderRouter, paymentRouter };
