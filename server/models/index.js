import mongoose from 'mongoose';

// Roles
const roleSchema = new mongoose.Schema({ name: { type: String, unique: true }, description: String }, { collection: 'roles', timestamps: false });
roleSchema.index({ name: 1 });
export const Role = mongoose.models.Role || mongoose.model('Role', roleSchema);

// Users
const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, sparse: true, unique: true },
  mobile: { type: String, sparse: true, unique: true },
  password_hash: String,
  role_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Role' },
  role_name: { type: String, default: 'USER' },
  status: { type: String, default: 'active' },
  email_verified: { type: Boolean, default: false },
  mobile_verified: { type: Boolean, default: false },
  resetPasswordToken: { type: String, default: null },
  resetPasswordExpires: { type: Date, default: null },
}, { collection: 'users', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
userSchema.index({ email: 1 });
userSchema.index({ mobile: 1 });
export const User = mongoose.models.User || mongoose.model('User', userSchema);

// Addresses
const addressSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  label: String,
  line1: String,
  line2: String,
  house_no: String,
  landmark: String,
  area: String,
  city: String,
  state: String,
  pincode: String,
  latitude: Number,
  longitude: Number,
  is_default: { type: Boolean, default: false },
}, { collection: 'addresses', timestamps: { createdAt: 'created_at', updatedAt: false } });
addressSchema.index({ user_id: 1 });
export const Address = mongoose.models.Address || mongoose.model('Address', addressSchema);

// Categories
const categorySchema = new mongoose.Schema({
  name: String,
  slug: { type: String, unique: true },
  parent_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  module: { type: String, default: 'shop' },
  icon: String,
  image_url: String,
  position: Number,
  active: { type: Boolean, default: true },
}, { collection: 'categories', timestamps: false });
categorySchema.index({ module: 1 });
export const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);

// Brands
const brandSchema = new mongoose.Schema({
  name: String,
  slug: { type: String, unique: true },
  logo_url: String,
  active: { type: Boolean, default: true },
}, { collection: 'brands', timestamps: false });
export const Brand = mongoose.models.Brand || mongoose.model('Brand', brandSchema);

// Products
const productSchema = new mongoose.Schema({
  seller_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller' },
  category_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' },
  brand_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand' },
  name: String,
  slug: { type: String, unique: true },
  description: String,
  price: Number,
  mrp: Number,
  stock: Number,
  rating: Number,
  rating_count: Number,
  images: [String],
  specs: mongoose.Schema.Types.Mixed,
  module: { type: String, default: 'shop' },
  active: { type: Boolean, default: true },
  colors: [String],
  sizes: [String],
  fit: String,
  fabric: String,
  collection: String,
  customizable: Boolean,
  featured: Boolean,
  new_arrival: Boolean,
  care_instructions: String,
  video_url: String,
}, { collection: 'products', timestamps: { createdAt: 'created_at', updatedAt: false } });
productSchema.index({ category_id: 1 });
productSchema.index({ module: 1 });
productSchema.index({ name: 'text' });
export const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

// Product Variants — kept as separate collection for parity, but also embeddable
const variantSchema = new mongoose.Schema({
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  sku: { type: String, unique: true, sparse: true },
  color: String,
  size: String,
  stock: Number,
  price: Number,
  images: [String],
}, { collection: 'product_variants', timestamps: false });
variantSchema.index({ product_id: 1 });
export const ProductVariant = mongoose.models.ProductVariant || mongoose.model('ProductVariant', variantSchema);

// Carts
const cartSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  module: { type: String, default: 'shop' },
}, { collection: 'carts', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
cartSchema.index({ user_id: 1, module: 1 }, { unique: true });
export const Cart = mongoose.models.Cart || mongoose.model('Cart', cartSchema);

// Cart Items
const cartItemSchema = new mongoose.Schema({
  cart_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Cart' },
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  quantity: Number,
  customization_data: String, // JSON string
  variant_data: String, // JSON string
  custom_price: Number,
}, { collection: 'cart_items', timestamps: false });
cartItemSchema.index({ cart_id: 1 });
export const CartItem = mongoose.models.CartItem || mongoose.model('CartItem', cartItemSchema);

// Wishlists
const wishlistSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
}, { collection: 'wishlists', timestamps: { createdAt: 'created_at', updatedAt: false } });
wishlistSchema.index({ user_id: 1, product_id: 1 }, { unique: true });
export const Wishlist = mongoose.models.Wishlist || mongoose.model('Wishlist', wishlistSchema);

// Orders
const orderSchema = new mongoose.Schema({
  order_number: { type: String, unique: true },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  module: { type: String, default: 'shop' },
  status: String,
  subtotal: Number,
  discount: Number,
  delivery_fee: Number,
  service_fee: Number,
  tax: Number,
  total: Number,
  address_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Address' },
  coupon_code: String,
  payment_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
  payment_method: { type: String, enum: ['cod','online'], default: 'online' },
  payment_status: { type: String, default: 'pending' },
  restaurant_id: { type: mongoose.Schema.Types.ObjectId },
  customer_notes: String,
  admin_notes: String,
}, { collection: 'orders', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
orderSchema.index({ user_id: 1 });
orderSchema.index({ status: 1 });
export const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

// Order Items
const orderItemSchema = new mongoose.Schema({
  order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  name: String,
  price: Number,
  quantity: Number,
  customization_data: String,
  variant_data: String,
  custom_price: Number,
}, { collection: 'order_items', timestamps: false });
orderItemSchema.index({ order_id: 1 });
export const OrderItem = mongoose.models.OrderItem || mongoose.model('OrderItem', orderItemSchema);

// Payments
const paymentSchema = new mongoose.Schema({
  order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  razorpay_order_id: String,
  razorpay_payment_id: String,
  amount: Number,
  currency: { type: String, default: 'INR' },
  status: String,
  method: String,
  verified: Boolean,
}, { collection: 'payments', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
paymentSchema.index({ order_id: 1 });
export const Payment = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);

// Coupons
const couponSchema = new mongoose.Schema({
  code: { type: String, unique: true },
  type: String,
  value: Number,
  min_order: Number,
  max_discount: Number,
  module: String,
  expires_at: Date,
  active: Boolean,
  usage_limit: Number,
  used_count: { type: Number, default: 0 },
}, { collection: 'coupons', timestamps: false });
couponSchema.index({ code: 1 });
export const Coupon = mongoose.models.Coupon || mongoose.model('Coupon', couponSchema);

// Custom Designs
const customDesignSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  name: String,
  product_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
  color: String,
  size: String,
  fit: String,
  design_data: String,
  preview_image: String,
}, { collection: 'custom_designs', timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });
customDesignSchema.index({ user_id: 1 });
export const CustomDesign = mongoose.models.CustomDesign || mongoose.model('CustomDesign', customDesignSchema);

// Order Status History
const statusHistorySchema = new mongoose.Schema({
  order_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Order' },
  from_status: String,
  to_status: String,
  changed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  note: String,
}, { collection: 'order_status_history', timestamps: { createdAt: 'created_at', updatedAt: false } });
statusHistorySchema.index({ order_id: 1 });
export const OrderStatusHistory = mongoose.models.OrderStatusHistory || mongoose.model('OrderStatusHistory', statusHistorySchema);

// OTP Codes
const otpSchema = new mongoose.Schema({
  mobile: String,
  email: String,
  code: String,
  purpose: { type: String, default: 'login' },
  expires_at: Date,
}, { collection: 'otp_codes', timestamps: { createdAt: 'created_at', updatedAt: false } });
otpSchema.index({ mobile: 1, purpose: 1 });
export const OtpCode = mongoose.models.OtpCode || mongoose.model('OtpCode', otpSchema);

// Notifications
const notificationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: String,
  title: String,
  body: String,
  read: { type: Boolean, default: false },
}, { collection: 'notifications', timestamps: { createdAt: 'created_at', updatedAt: false } });
export const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

// Reviews
const reviewSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  module: String,
  target_id: mongoose.Schema.Types.ObjectId,
  rating: Number,
  title: String,
  body: String,
  verified: Boolean,
}, { collection: 'reviews', timestamps: { createdAt: 'created_at', updatedAt: false } });
export const Review = mongoose.models.Review || mongoose.model('Review', reviewSchema);

// Sellers (for completeness)
const sellerSchema = new mongoose.Schema({
  name: String,
  slug: { type: String, unique: true },
  owner_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: String,
}, { collection: 'sellers', timestamps: { createdAt: 'created_at', updatedAt: false } });
export const Seller = mongoose.models.Seller || mongoose.model('Seller', sellerSchema);
