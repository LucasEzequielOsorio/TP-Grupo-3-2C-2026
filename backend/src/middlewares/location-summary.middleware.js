import { z } from 'zod';
import { parseId } from '../validation.js';

const summaryQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  buscar: z.string().trim().max(100).default(''),
  estado: z.enum(['todos', 'con_stock', 'bajo', 'agotado', 'inactivos']).default('todos'),
});

export function validateLocationSummaryRequest(req, res, next) {
  try {
    req.locationId = parseId(req.params.id);
    req.locationSummaryQuery = summaryQuerySchema.parse(req.query);
    next();
  } catch (error) {
    next(error);
  }
}
