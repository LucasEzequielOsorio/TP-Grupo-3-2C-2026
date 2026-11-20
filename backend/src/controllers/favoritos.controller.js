import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import {
  agregarFavorito,
  obtenerFavoritos,
  quitarFavorito,
} from '../services/favoritos.service.js';
import { parseId } from '../validation.js';

export const favoritosRouter = Router();

favoritosRouter.use(authenticate);

favoritosRouter.get('/', async (req, res) => {
  res.json(await obtenerFavoritos(req.user.id));
});

favoritosRouter.post('/:productoId', async (req, res) => {
  const resultado = await agregarFavorito(req.user.id, parseId(req.params.productoId));
  res.status(resultado.creado ? 201 : 200).json(resultado);
});

favoritosRouter.delete('/:productoId', async (req, res) => {
  res.json(await quitarFavorito(req.user.id, parseId(req.params.productoId)));
});
