import { Router } from 'express';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware.js';
import {
  validateTransferAction,
  validateTransferDraft,
  validateTransferId,
  validateTransferListQuery,
} from '../middlewares/transfers.middleware.js';
import {
  createTransfer,
  executeTransferAction,
  getTransfer,
  listTransfers,
} from '../services/transfers.service.js';

export const transfersRouter = Router();

transfersRouter.use(authenticate, requireAdmin);

transfersRouter.get('/transferencias', validateTransferListQuery, async (req, res) => {
  res.json(await listTransfers(req.transferListQuery));
});

transfersRouter.get('/transferencias/:id', validateTransferId, async (req, res) => {
  res.json(await getTransfer(req.transferId));
});

transfersRouter.post('/transferencias', validateTransferDraft, async (req, res) => {
  const result = await createTransfer(req.transferDraft, req.user.id);
  res.status(201).json(result);
});

transfersRouter.post('/transferencias/:id/:accion', validateTransferAction, async (req, res) => {
  res.json(
    await executeTransferAction(req.transferId, req.transferAction, req.user.id),
  );
});
