import { z } from 'zod';
import { parseId } from '../validation.js';

const idSchema = z.number().int().positive().max(4294967295);
const transferDraftSchema = z
  .object({
    origen_id: idSchema,
    destino_id: idSchema,
    items: z
      .array(z.object({ variante_id: idSchema, cantidad: z.number().int().min(1).max(1000000) }))
      .min(1)
      .max(100),
  })
  .refine((draft) => draft.origen_id !== draft.destino_id, 'El origen y el destino deben ser distintos')
  .refine(
    (draft) => new Set(draft.items.map((item) => item.variante_id)).size === draft.items.length,
    'No repitas variantes',
  );
const transferListQuerySchema = z.object({
  pagina: z.coerce.number().int().min(1).max(100000).default(1),
  estado: z.enum(['borrador', 'en_transito', 'recibida', 'cancelada']).optional(),
});
const transferActionSchema = z.enum(['despachar', 'recibir', 'cancelar']);

export function validateTransferDraft(req, res, next) {
  try {
    req.transferDraft = transferDraftSchema.parse(req.body);
    next();
  } catch (error) {
    next(error);
  }
}

export function validateTransferListQuery(req, res, next) {
  try {
    req.transferListQuery = transferListQuerySchema.parse(req.query);
    next();
  } catch (error) {
    next(error);
  }
}

export function validateTransferId(req, res, next) {
  try {
    req.transferId = parseId(req.params.id);
    next();
  } catch (error) {
    next(error);
  }
}

export function validateTransferAction(req, res, next) {
  try {
    req.transferId = parseId(req.params.id);
    req.transferAction = transferActionSchema.parse(req.params.accion);
    next();
  } catch (error) {
    next(error);
  }
}
