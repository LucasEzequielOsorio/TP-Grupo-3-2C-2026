import { Router } from 'express';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware.js';
import {
  validateLocationBody,
  validateLocationId,
} from '../middlewares/locations.middleware.js';
import {
  createLocation,
  editLocation,
  getLocationStock,
  listLocations,
} from '../services/locations.service.js';

export const locationsRouter = Router();

locationsRouter.use(authenticate, requireAdmin);

locationsRouter.get('/ubicaciones', async (req, res) => {
  res.json(await listLocations());
});

locationsRouter.post('/ubicaciones', validateLocationBody, async (req, res) => {
  res.status(201).json(await createLocation(req.locationData));
});

locationsRouter.put('/ubicaciones/:id', validateLocationBody, async (req, res) => {
  res.json(await editLocation(req.locationId, req.locationData));
});

locationsRouter.get('/ubicaciones/:id/stock', validateLocationId, async (req, res) => {
  res.json(await getLocationStock(req.locationId));
});
