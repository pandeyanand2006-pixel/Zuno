import { Router } from 'express';
import * as orderCtrl from '../controllers/order.controller.js';
import * as paymentCtrl from '../controllers/payment.controller.js';
import { authMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';

const orderRouter = Router();
orderRouter.use(authMiddleware);
orderRouter.post('/', validate(z.object({ module: z.enum(['shop','grocery','food']).default('shop'), addressId: z.number().int().positive(), couponCode: z.string().optional() })), orderCtrl.createOrder);
orderRouter.get('/', orderCtrl.listOrders);
orderRouter.get('/:id', orderCtrl.getOrder);
orderRouter.post('/:id/cancel', orderCtrl.cancelOrder);
orderRouter.post('/custom', validate(z.object({ module: z.enum(['shop','grocery','food']), addressId: z.number().int().positive(), couponCode: z.string().optional(), items: z.array(z.object({ type: z.enum(['product','menu']), id: z.number().int().positive(), quantity: z.number().int().min(1).max(20) })).min(1) })), orderCtrl.createCustomOrder);

const paymentRouter = Router();
paymentRouter.use(authMiddleware);
paymentRouter.post('/create', validate(z.object({ orderId: z.number().int().positive() })), paymentCtrl.createPayment);
paymentRouter.post('/verify', validate(z.object({ orderId: z.number().int().positive(), razorpayOrderId: z.string().min(1), razorpayPaymentId: z.string().min(1), razorpaySignature: z.string().min(1) })), paymentCtrl.verifyPayment);
paymentRouter.post('/refund', validate(z.object({ paymentId: z.number().int().positive(), amount: z.number().int().positive(), orderId: z.number().int().positive() })), paymentCtrl.refund);

export { orderRouter, paymentRouter };
