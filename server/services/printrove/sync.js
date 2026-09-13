import { db } from '../../config/db.js';
import { env } from '../../config/env.js';
import { isMongoConnected } from '../../config/mongo.js';
import { logger } from '../../utils/logger.js';
import { printroveClient } from './client.js';

function useMongo() { return !!env.mongoUri && isMongoConnected(); }

export async function syncOrder(zunoOrderId) {
  let order;
  if (useMongo()) {
    const { Order } = await import('../../models/index.js');
    order = await Order.findById(zunoOrderId).lean();
    if (!order) throw new Error('NOT_FOUND');
    if (!order.printroveOrderId && !order.printroveReference) throw new Error('NO_PRINTROVE_ORDER');
  } else {
    order = db.prepare('SELECT * FROM orders WHERE id = ?').get(zunoOrderId);
    if (!order) throw new Error('NOT_FOUND');
    if (!order.printrove_order_id && !order.printrove_reference) throw new Error('NO_PRINTROVE_ORDER');
  }

  const printroveId = order.printroveOrderId || order.printrove_order_id;
  const reference = order.printroveReference || order.printrove_reference || order.order_number;

  let remote = null;
  try {
    if (printroveId) remote = await printroveClient.getOrder(printroveId);
    else remote = await printroveClient.getOrderByReference(reference);
  } catch (e) {
    logger.warn(`[PRINTROVE] Sync fetch failed for ${reference}: ${e.message}`);
    throw new Error(`PRINTROVE_SYNC_FAILED: ${e.message}`);
  }

  if (!remote) throw new Error('PRINTROVE_SYNC_NO_DATA');

  // Normalize fields
  const status = remote.status || remote.order_status || remote.fulfillment_status || remote.printrove_status || 'unknown';
  const tracking = remote.tracking_number || remote.tracking || remote.awb || remote.tracking_no || null;
  const courier = remote.courier || remote.courier_name || remote.shipping_courier || null;
  const nowIso = new Date().toISOString();
  const now = new Date();

  if (useMongo()) {
    const { Order } = await import('../../models/index.js');
    await Order.updateOne({ _id: zunoOrderId }, {
      printroveStatus: String(status),
      printroveTrackingNumber: tracking ? String(tracking) : null,
      printroveCourier: courier ? String(courier) : null,
      printroveLastSyncedAt: now,
    });
  } else {
    db.prepare(`UPDATE orders SET printrove_status = ?, printrove_tracking_number = ?, printrove_courier = ?, printrove_last_synced_at = ? WHERE id = ?`)
      .run(String(status), tracking ? String(tracking) : null, courier ? String(courier) : null, nowIso, zunoOrderId);
  }

  logger.info(`[PRINTROVE] Synced ${reference}: status=${status} tracking=${tracking || 'none'}`);

  return {
    success: true,
    status: String(status),
    trackingNumber: tracking ? String(tracking) : null,
    courier: courier ? String(courier) : null,
    raw: remote,
    message: `Fulfillment status: ${status}${tracking ? ' | Tracking: ' + tracking : ''}`,
  };
}

export async function syncAllPending({ limit = 20 } = {}) {
  let orders = [];
  if (useMongo()) {
    const { Order } = await import('../../models/index.js');
    orders = await Order.find({ printroveOrderId: { $ne: null }, printroveStatus: { $nin: ['delivered', 'cancelled', 'failed'] } }).sort({ printroveLastSyncedAt: 1 }).limit(limit).lean();
  } else {
    orders = db.prepare(`SELECT id FROM orders WHERE printrove_order_id IS NOT NULL AND printrove_status NOT IN ('delivered','cancelled','failed') ORDER BY COALESCE(printrove_last_synced_at,'1970-01-01') ASC LIMIT ?`).all(limit);
  }

  const results = [];
  for (const o of orders) {
    const id = o._id || o.id;
    try {
      const r = await syncOrder(String(id));
      results.push({ id: String(id), ...r });
    } catch (e) {
      results.push({ id: String(id), error: e.message });
    }
  }
  return results;
}
