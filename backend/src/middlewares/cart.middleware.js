import { z } from 'zod';

export const cartQuantitySchema = z.object({
  cantidad: z.number().int().min(1).max(999),
});

export function validateCartQuantity(req, res, next) {
  try {
    req.body = cartQuantitySchema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
}
