import { z } from 'zod';
import { httpError, parseId } from '../validation.js';

const catalogSchemas = {
  categorias: z.object({ nombre: z.string().trim().min(1).max(80) }),
  talles: z.object({
    nombre: z.string().trim().min(1).max(20),
    orden: z.number().int().min(0).max(65535),
  }),
  colores: z.object({
    nombre: z.string().trim().min(1).max(50),
    hexadecimal: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullable(),
  }),
};

const historyQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  producto_id: z.coerce.number().int().positive().optional(),
  ubicacion_id: z.coerce.number().int().positive().optional(),
  motivo: z.enum(['inicial', 'ajuste', 'venta', 'devolucion', 'transferencia']).optional(),
  buscar: z.string().trim().max(100).default(''),
});

function forwardValidation(req, next, validate) {
  try {
    validate();
    next();
  } catch (error) {
    next(error);
  }
}

function catalogSchema(type) {
  if (!Object.hasOwn(catalogSchemas, type)) throw httpError(404, 'Catálogo no encontrado');
  return catalogSchemas[type];
}

export function validateCatalogBody(req, res, next) {
  forwardValidation(req, next, () => {
    req.catalogType = req.params.tipo;
    req.catalogData = catalogSchema(req.catalogType).parse(req.body);
    if (req.params.id !== undefined) req.catalogId = parseId(req.params.id);
  });
}

export function validateStockAlertQuery(req, res, next) {
  forwardValidation(req, next, () => {
    req.stockAlertLocationId =
      req.query.ubicacion_id === undefined ? null : parseId(req.query.ubicacion_id);
  });
}

export function validateStockHistoryQuery(req, res, next) {
  forwardValidation(req, next, () => {
    req.stockHistoryQuery = historyQuerySchema.parse(req.query);
  });
}
