import { z } from 'zod';
import { parseId } from '../validation.js';

const locationSchema = z.object({
  nombre: z.string().trim().min(1).max(100),
  tipo: z.enum(['deposito', 'tienda']),
  direccion: z.string().trim().min(1).max(255),
  activo: z.boolean(),
});

export function validateLocationBody(req, res, next) {
  try {
    if (req.params.id !== undefined) req.locationId = parseId(req.params.id);
    req.locationData = locationSchema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
}

export function validateLocationId(req, res, next) {
  try {
    req.locationId = parseId(req.params.id);
    next();
  } catch (error) {
    next(error);
  }
}
