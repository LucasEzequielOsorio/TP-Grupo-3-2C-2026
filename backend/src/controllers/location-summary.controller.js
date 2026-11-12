import { Router } from 'express';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware.js';
import { validateLocationSummaryRequest } from '../middlewares/location-summary.middleware.js';
import { getLocationSummary } from '../services/location-summary.service.js';

export const summaryRouter = Router();

summaryRouter.use(authenticate, requireAdmin);

summaryRouter.get(
  '/ubicaciones/:id/resumen',
  validateLocationSummaryRequest,
  async (req, res) => {
    const result = await getLocationSummary(req.locationId, req.locationSummaryQuery);
    res.json(result);
  },
);
