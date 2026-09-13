import { db } from '../../config/db.js';
import { env } from '../../config/env.js';
import { isMongoConnected } from '../../config/mongo.js';
import { logger } from '../../utils/logger.js';
import { printroveClient } from './client.js';
import { getOrderPrintroveItems } from './mapping.js';

function useMongo() { return !!env.mongoUri && isMongoConnected(); }

function getPrintroveOrderFields(order, address, user, printroveItems) {
  const name = (user.name || '').trim() || 'Customer';
  const [firstName, ...rest] = name.split(' ');
  const lastName = rest.join(' ') || firstName;

  // Address mapping — Indian fields
  const pincode = String(address.pincode || address.pincode_code || '').trim();
  const city = String(address.city || '').trim();
  const state = String(address.state || '').trim();
  const country = 'India';
  const phone = String(user.mobile || address.phone || '').replace(/\D/g, '').slice(-10);
  const email = String(user.email || 'customer@zuno.app').trim();

  // Printrove expects address1/2/3 — split house_no + line1 etc
  const house = address.house_no || '';
  const line1 = address.line1 || '';
  const line2 = address.line2 || address.area || address.landmark || '';
  const address1 = [house, line1].filter(Boolean).join(', ').slice(0, 200) || line1.slice(0, 200);
  const address2 = line2.slice(0, 200);
  const address3 = (address.landmark || '').slice(0, 200);

  const retailPrice = Math.round((order.total || 0) / 100); // paise to rupees? Printrove may expect paisa? Assuming rupees
  // Build order_products array
  const order_products = printroveItems.map(({ zunoItem, mapping }) => {
    // Quantity
    const quantity = zunoItem.quantity || 1;
    const base = {
      quantity,
      // Printrove variant/product logic: prefer variant_id, fallback product_id
      // is_plain: if customization_data null → plain product (no print)
    };
    if (mapping.variantId) base.variant_id = mapping.variantId;
    if (mapping.productId) base.product_id = mapping.productId;
    if (mapping.sku) base.sku = mapping.sku;
    // is_plain flag per variant
    const isCustom = !!zunoItem.customization_data;
    base.is_plain = isCustom ? false : true;
    // Some Printrove APIs require sku instead of product_id/variant_id
    if (!base.product_id && !base.variant_id && !base.sku) {
      base.product_id = mapping.productId || mapping.sku;
    }
    return base;
  });

  const codFlag = String(order.payment_method).toLowerCase() === 'cod' ? 1 : 0;
  // Reference number must be unique — use Zuno order_number
  const payload = {
    reference_number: order.order_number,
    retail_price: retailPrice,
    cod: codFlag,
    customer: {
      first_name: firstName.slice(0, 50),
      last_name: lastName.slice(0, 50),
      email: email.slice(0, 100),
      phone: phone.slice(0, 15) || '9999999999',
    },
    shipping_address: {
      address1: address1 || 'Address1',
      address2: address2 || '',
      address3: address3 || '',
      city: city || 'City',
      state: state || 'State',
      country: 'India',
      pincode: pincode || '110001',
    },
    order_products,
    is_cod: codFlag,
  };

  // If Printrove uses flat fields instead of nested
  const flatPayload = {
    reference_number: payload.reference_number,
    cod: codFlag,
    customer_name: `${payload.customer.first_name} ${payload.customer.last_name}`.trim().slice(0, 100),
    customer_email: payload.customer.email,
    customer_phone: payload.customer.phone,
    address1: payload.shipping_address.address1,
    address2: payload.shipping_address.address2,
    address3: payload.shipping_address.address3,
    city: payload.shipping_address.city,
    state: payload.shipping_address.state,
    country: payload.shipping_address.country,
    pincode: payload.shipping_address.pincode,
    order_products: payload.order_products,
    retail_price: payload.retail_price,
  };

  return { nested: payload, flat: flatPayload };
}

async function getZunoOrderWithRelations(orderId) {
  if (useMongo()) {
    const { Order, OrderItem, Address, User } = await import('../../models/index.js');
    const order = await Order.findById(orderId).lean();
    if (!order) throw new Error('NOT_FOUND');
    const items = await OrderItem.find({ order_id: order._id }).lean();
    // normalize to have product_id, quantity, customization_data, variant_data
    const normItems = items.map(it => ({
      product_id: String(it.product_id),
      name: it.name,
      quantity: it.quantity,
      price: it.price,
      customization_data: it.customization_data,
      variant_data: it.variant_data,
      variant: it.variant_data ? JSON.parse(it.variant_data) : null,
    }));
    const address = order.address_id ? await Address.findById(order.address_id).lean() : null;
    const user = await User.findById(order.user_id).lean();
    // Attach printrove fields for duplicate check
    const printroveInfo = {
      printroveOrderId: order.printroveOrderId || null,
      printroveReference: order.printroveReference || null,
      printroveStatus: order.printroveStatus || null,
    };
    return { order: { ...order, id: String(order._id), order_number: order.order_number, total: order.total, payment_method: order.payment_method }, items: normItems, address, user, printroveInfo, rawOrder: order };
  } else {
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!order) throw new Error('NOT_FOUND');
    const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(orderId).map(it => ({
      product_id: it.product_id,
      name: it.name,
      quantity: it.quantity,
      price: it.price,
      customization_data: it.customization_data,
      variant_data: it.variant_data,
      variant: it.variant_data ? JSON.parse(it.variant_data) : null,
    }));
    const address = db.prepare('SELECT * FROM addresses WHERE id = ?').get(order.address_id);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(order.user_id);
    const printroveInfo = {
      printroveOrderId: order.printrove_order_id,
      printroveReference: order.printrove_reference,
      printroveStatus: order.printrove_status,
    };
    return { order, items, address, user, printroveInfo, rawOrder: order };
  }
}

function updateOrderPrintroveSuccess(orderId, printroveResponse, reference) {
  const nowIso = new Date().toISOString();
  const now = new Date();
  // Normalize Printrove response fields
  const pid = printroveResponse?.id || printroveResponse?.order_id || printroveResponse?.orderId || printroveResponse?.data?.id || String(printroveResponse?.order_id || printroveResponse?.id || reference);
  const status = printroveResponse?.status || printroveResponse?.order_status || printroveResponse?.fulfillment_status || 'submitted';
  const tracking = printroveResponse?.tracking_number || printroveResponse?.tracking || printroveResponse?.awb || null;
  const courier = printroveResponse?.courier || printroveResponse?.courier_name || null;

  if (useMongo()) {
    return (async () => {
      const { Order } = await import('../../models/index.js');
      await Order.updateOne({ _id: orderId }, {
        printroveOrderId: String(pid),
        printroveReference: reference,
        printroveStatus: String(status),
        printroveTrackingNumber: tracking ? String(tracking) : null,
        printroveCourier: courier ? String(courier) : null,
        printroveCreatedAt: now,
        printroveLastSyncedAt: now,
        printroveError: null,
      });
    })();
  } else {
    db.prepare(`
      UPDATE orders SET
        printrove_order_id = ?,
        printrove_reference = ?,
        printrove_status = ?,
        printrove_tracking_number = ?,
        printrove_courier = ?,
        printrove_created_at = ?,
        printrove_last_synced_at = ?,
        printrove_error = NULL
      WHERE id = ?
    `).run(String(pid), reference, String(status), tracking ? String(tracking) : null, courier ? String(courier) : null, nowIso, nowIso, orderId);
    return Promise.resolve();
  }
}

function updateOrderPrintroveError(orderId, errorMsg) {
  const nowIso = new Date().toISOString();
  const now = new Date();
  const safeMsg = String(errorMsg).slice(0, 1000);
  if (useMongo()) {
    return (async () => {
      const { Order } = await import('../../models/index.js');
      await Order.updateOne({ _id: orderId }, {
        printroveStatus: 'failed',
        printroveError: safeMsg,
        printroveLastSyncedAt: now,
      });
    })();
  } else {
    db.prepare(`UPDATE orders SET printrove_status = 'failed', printrove_error = ?, printrove_last_synced_at = ? WHERE id = ?`).run(safeMsg, nowIso, orderId);
    return Promise.resolve();
  }
}

export async function createPrintroveOrder(zunoOrderId) {
  const { order, items, address, user, printroveInfo } = await getZunoOrderWithRelations(zunoOrderId);

  // Duplicate check 1: already has printrove_order_id
  if (printroveInfo.printroveOrderId) {
    logger.info(`[PRINTROVE] Order ${order.order_number} already has Printrove order ${printroveInfo.printroveOrderId} — skipping duplicate`);
    return { duplicate: true, printroveOrderId: printroveInfo.printroveOrderId, message: 'Already fulfilled via Printrove' };
  }

  // Resolve which items are printrove-enabled
  const mappingResult = await getOrderPrintroveItems(zunoOrderId, items);
  if (mappingResult?.invalid) {
    const msg = mappingResult.error;
    logger.warn(`[PRINTROVE] Mapping invalid for order ${order.order_number}: ${msg}`);
    await updateOrderPrintroveError(order.id || zunoOrderId, `Mapping invalid: ${msg}`);
    throw new Error(`PRINTROVE_MAPPING_INVALID: ${msg}`);
  }

  const printroveItems = mappingResult;
  if (!printroveItems || printroveItems.length === 0) {
    logger.info(`[PRINTROVE] Order ${order.order_number} has no Printrove-enabled products — skipping`);
    return { skipped: true, message: 'No Printrove-enabled products' };
  }

  // Handle mixed carts: if only subset is printrove-enabled, we still send only that subset
  // If mixed, log warning but proceed with subset
  if (printroveItems.length !== items.length) {
    logger.warn(`[PRINTROVE] Mixed order ${order.order_number}: ${printroveItems.length}/${items.length} items are Printrove-enabled — sending only Printrove subset`);
  }

  if (!address) {
    await updateOrderPrintroveError(order.id || zunoOrderId, 'Missing shipping address');
    throw new Error('ADDRESS_REQUIRED');
  }

  // Duplicate check 2: query Printrove by reference before create (handles timeout/webhook retry)
  try {
    const existing = await printroveClient.getOrderByReference(order.order_number);
    if (existing) {
      const existingId = existing.id || existing.order_id || existing._id;
      logger.info(`[PRINTROVE] Found existing Printrove order for reference ${order.order_number}: ${existingId} — saving and skipping create`);
      await updateOrderPrintroveSuccess(order.id || zunoOrderId, existing, order.order_number);
      return { duplicate: true, printroveOrderId: String(existingId), existing: true };
    }
  } catch (e) {
    logger.warn(`[PRINTROVE] Duplicate check query failed for ${order.order_number}: ${e.message} — proceeding to create`);
  }

  // Serviceability check (optional but recommended)
  try {
    const pincode = String(address.pincode || '').trim();
    if (pincode) {
      const svc = await printroveClient.checkServiceability({ pincode, weight: 400, cod: order.payment_method === 'cod', country: 'India' });
      const serviceable = svc?.serviceable ?? svc?.is_serviceable ?? svc?.available ?? svc?.data?.serviceable ?? true;
      if (serviceable === false) {
        const reason = svc?.message || svc?.reason || 'Pincode not serviceable';
        logger.warn(`[PRINTROVE] Serviceability failed for ${order.order_number} pincode ${pincode}: ${reason}`);
        await updateOrderPrintroveError(order.id || zunoOrderId, `Serviceability failed: ${reason}`);
        throw new Error(`PRINTROVE_NOT_SERVICEABLE: ${reason}`);
      }
    }
  } catch (e) {
    if (String(e.message).startsWith('PRINTROVE_NOT_SERVICEABLE')) throw e;
    logger.warn(`[PRINTROVE] Serviceability check error for ${order.order_number}: ${e.message} — proceeding anyway`);
  }

  // Build payload — try nested first, fallback to flat if Printrove rejects
  const { nested, flat } = getPrintroveOrderFields(order, address, user, printroveItems);
  logger.info(`[PRINTROVE] Creating order for Zuno ${order.order_number} with ${printroveItems.length} Printrove items`);

  let printroveOrder = null;
  let lastError = null;

  // Attempt 1: nested payload
  try {
    printroveOrder = await printroveClient.createOrder(nested);
  } catch (e) {
    lastError = e;
    logger.warn(`[PRINTROVE] Nested payload failed for ${order.order_number}: ${e.message} — trying flat payload`);
    try {
      printroveOrder = await printroveClient.createOrder(flat);
      lastError = null;
    } catch (e2) {
      lastError = e2;
    }
  }

  if (lastError) {
    const msg = lastError.message || 'Printrove order creation failed';
    logger.error(`[PRINTROVE] Create failed for ${order.order_number}: ${msg}`);
    await updateOrderPrintroveError(order.id || zunoOrderId, msg);
    throw new Error(`PRINTROVE_CREATE_FAILED: ${msg}`);
  }

  logger.info(`[PRINTROVE] Order created for ${order.order_number}: ${JSON.stringify(printroveOrder).slice(0, 500)}`);
  await updateOrderPrintroveSuccess(order.id || zunoOrderId, printroveOrder, order.order_number);
  return { success: true, printroveOrder, reference: order.order_number };
}

// Fire-and-forget enqueue — called from orderService.markPaid / createFromCart
export function enqueuePrintroveOrder(zunoOrderId) {
  // Return promise but caller should not block payment flow
  return createPrintroveOrder(zunoOrderId).catch((e) => {
    // Errors already stored in orders.printrove_error; just log
    if (!String(e.message).startsWith('PRINTROVE_MAPPING_INVALID') && !String(e.message).startsWith('PRINTROVE_NOT_SERVICEABLE')) {
      logger.error(`[PRINTROVE] Enqueue failed for ${zunoOrderId}: ${e.message}`);
    }
    // Don't throw — Zuno order already confirmed
  });
}

export async function retryPrintroveOrder(zunoOrderId) {
  const { printroveInfo } = await getZunoOrderWithRelations(zunoOrderId);
  if (printroveInfo.printroveOrderId) {
    throw new Error('Already has Printrove order — use sync instead');
  }
  return createPrintroveOrder(zunoOrderId);
}
