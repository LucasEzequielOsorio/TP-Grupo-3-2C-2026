import { Router } from 'express';
import { listFavoriteIds } from '../repositories/favorites.repository.js';
import { toggleFavorite } from '../services/favorites.service.js';
import { parseId } from '../validation.js';
import { authenticate } from '../middlewares/auth.middleware.js';

export const favoritosRouter = Router();

favoritosRouter.use(authenticate);

favoritosRouter.get('/ids', async (req, res) => {
  res.json({ ids: await listFavoriteIds(req.user.id) });
});

favoritosRouter.post('/toggle/:productoId', async (req, res) => {
  res.json(await toggleFavorite(req.user.id, parseId(req.params.productoId)));
});
