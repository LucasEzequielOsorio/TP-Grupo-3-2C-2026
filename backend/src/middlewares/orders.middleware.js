import { z } from 'zod';
import { authenticate } from './auth.middleware.js';
import { parseId } from '../validation.js';

const orderSchema = z.object({
  clave: z.uuid(),
  items: z
    .array(
      z.object({
        variante_id: z.number().int().positive(),
        cantidad: z.number().int().min(1).max(999),
        precio: z.number().positive(),
      }),
    )
    .min(1)
    .max(100),
});

export { authenticate as authenticateOrderUser };

export function validateOrderId(req, res, next) {
  try {
    req.orderId = parseId(req.params.id);
    next();
  } catch (error) {
    next(error);
  }
}

export function validateOrderBody(req, res, next) {
  try {
    req.orderData = orderSchema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
}
