import { z } from 'zod';

const paise = z.number().int().min(0, 'Price cannot be negative');

export const sellerProductSchema = z.object({
  name: z.string().min(2, 'Name is too short').max(120),
  description: z.string().max(2000).optional(),
  price: paise,
  mrp: paise.optional(),
  stock: z.number().int().min(0).default(0),
  categoryId: z.number().int().positive(),
  brandId: z.number().int().positive().optional(),
  specs: z.record(z.string()).optional(),
});

export const sellerProductUpdateSchema = sellerProductSchema.partial();

export const menuItemSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional(),
  price: paise,
  category: z.string().max(60).optional(),
  available: z.boolean().optional(),
});

export const menuItemUpdateSchema = menuItemSchema.partial();

export const serviceSchema = z.object({
  name: z.string().min(2).max(120),
  description: z.string().max(1000).optional(),
  price: paise,
  category: z.string().max(60).optional(),
  duration_minutes: z.number().int().min(5).max(600).default(60),
  active: z.boolean().optional(),
});

export const serviceUpdateSchema = serviceSchema.partial();

export const bookingStatusSchema = z.object({
  status: z.enum(['CONFIRMED', 'COMPLETED', 'CANCELLED', 'IN_PROGRESS']),
});
