import { Router } from 'express';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware.js';
import {
  validateCatalogBody,
  validateStockAlertQuery,
  validateStockHistoryQuery,
} from '../middlewares/admin-tools.middleware.js';
import {
  createCatalogEntry,
  editCatalogEntry,
  getStockAlerts,
  getStockHistory,
} from '../services/admin-tools.service.js';

export const toolsRouter = Router();

toolsRouter.use(authenticate, requireAdmin);

toolsRouter.post('/catalogos/:tipo', validateCatalogBody, async (req, res) => {
  res.status(201).json(await createCatalogEntry(req.catalogType, req.catalogData));
});

toolsRouter.put('/catalogos/:tipo/:id', validateCatalogBody, async (req, res) => {
  res.json(
    await editCatalogEntry(req.catalogType, req.catalogId, req.catalogData),
  );
});

toolsRouter.get('/stock-alertas', validateStockAlertQuery, async (req, res) => {
  res.json(await getStockAlerts(req.stockAlertLocationId));
});

toolsRouter.get('/movimientos', validateStockHistoryQuery, async (req, res) => {
  res.json(await getStockHistory(req.stockHistoryQuery));
});
