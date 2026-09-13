import { db } from '../../config/db.js';
import { env } from '../../config/env.js';
import { isMongoConnected } from '../../config/mongo.js';

function useMongo() { return !!env.mongoUri && isMongoConnected(); }

// Resolve printrove mapping for a Zuno product/variant
export async function resolveProductMapping(productId, variantData = null) {
  if (useMongo()) {
    const { Product, ProductVariant } = await import('../../models/index.js');
    const product = await Product.findById(productId).lean();
    if (!product) return null;
    if (!product.printroveEnabled) return null;

    let variantId = product.printroveVariantId || null;
    let productIdMapped = product.printroveProductId || null;

    // If variant-level mapping exists, prefer it
    if (variantData && (variantData.sku || variantData.color)) {
      const sku = variantData.sku;
      let variant = null;
      if (sku) variant = await ProductVariant.findOne({ sku }).lean();
      if (!variant && variantData.color && variantData.size) {
        variant = await ProductVariant.findOne({ product_id: productId, color: variantData.color, size: variantData.size }).lean();
      }
      if (variant && variant.printroveVariantId) variantId = variant.printroveVariantId;
      if (variant && variant.printroveSku) {
        // variant sku fallback
      }
    }

    if (!productIdMapped && !variantId && !product.printroveSku) return { invalid: true, reason: 'Printrove mapping missing for product ' + productId };
    return {
      enabled: true,
      productId: productIdMapped,
      variantId,
      sku: product.printroveSku || null,
      isPlain: product.customizable ? false : true, // if not customizable, treat as plain? doc may need is_plain flag
    };
  } else {
    const product = db.prepare('SELECT printrove_enabled, printrove_product_id, printrove_variant_id, printrove_sku, customizable FROM products WHERE id = ?').get(productId);
    if (!product || !product.printrove_enabled) return null;
    let variantId = product.printrove_variant_id;
    let productIdMapped = product.printrove_product_id;

    if (variantData && variantData.sku) {
      const variant = db.prepare('SELECT printrove_variant_id FROM product_variants WHERE sku = ?').get(variantData.sku);
      if (variant && variant.printrove_variant_id) variantId = variant.printrove_variant_id;
    } else if (variantData && variantData.color && variantData.size) {
      const variant = db.prepare('SELECT printrove_variant_id FROM product_variants WHERE product_id = ? AND color = ? AND size = ?').get(productId, variantData.color, variantData.size);
      if (variant && variant.printrove_variant_id) variantId = variant.printrove_variant_id;
    }

    if (!productIdMapped && !variantId && !product.printrove_sku) {
      return { invalid: true, reason: 'Printrove mapping missing for product ' + productId };
    }

    return {
      enabled: true,
      productId: productIdMapped,
      variantId,
      sku: product.printrove_sku || null,
      isPlain: product.customizable ? 0 : 1,
    };
  }
}

export async function getOrderPrintroveItems(orderId, items) {
  const results = [];
  for (const it of items) {
    // items from order_items: has product_id, variant_data JSON, customization_data
    const variantData = it.variant_data ? JSON.parse(it.variant_data) : (it.variant || null);
    const mapping = await resolveProductMapping(it.product_id, variantData);
    if (!mapping) continue; // not printrove enabled, skip
    if (mapping.invalid) return { error: mapping.reason, invalid: true };
    results.push({
      zunoItem: it,
      mapping,
    });
  }
  return results;
}
