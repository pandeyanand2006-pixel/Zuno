import { z } from 'zod';

const elementSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['text', 'image']),
  x: z.number(),
  y: z.number(),
  scale: z.number().min(0.1).max(5).optional(),
  rotation: z.number().min(-360).max(360).optional(),
  // text
  value: z.string().optional(),
  fontFamily: z.string().optional(),
  fontSize: z.number().min(8).max(200).optional(),
  color: z.string().optional(),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  // image
  url: z.string().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
});

const sideSchema = z.object({
  elements: z.array(elementSchema).max(20),
});

export const customDesignSchema = z.object({
  name: z.string().min(1).max(80),
  productId: z.number().int().positive().optional(),
  color: z.string().min(1).max(30),
  size: z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']),
  fit: z.enum(['regular', 'oversized', 'relaxed']).optional(),
  designData: z.object({
    front: sideSchema,
    back: sideSchema,
  }),
  previewImage: z.string().max(500000).optional(),
});

export const customDesignUpdateSchema = z.object({
  name: z.string().min(1).max(80).optional(),
  color: z.string().min(1).max(30).optional(),
  size: z.enum(['XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL']).optional(),
  fit: z.enum(['regular', 'oversized', 'relaxed']).optional(),
  designData: z.object({
    front: sideSchema,
    back: sideSchema,
  }).optional(),
  previewImage: z.string().max(500000).optional(),
});
