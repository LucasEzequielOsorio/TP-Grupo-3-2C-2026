import { Router } from 'express';
import { authenticate } from '../middlewares/auth.middleware.js';
import { validateCartQuantity } from '../middlewares/cart.middleware.js';
import { getCart, removeCartItem, saveCartItem } from '../services/cart.service.js';
import { parseId } from '../validation.js';

export const cartRouter = Router();

cartRouter.use(authenticate);

cartRouter.get('/', async (req, res) => {
  const result = await getCart(req.user.id);
  res.json(result);
});

cartRouter.post('/items/:id', validateCartQuantity, async (req, res) => {
  const result = await saveCartItem({
    userId: req.user.id,
    variantId: parseId(req.params.id),
    cantidad: req.body.cantidad,
    add: true,
  });

  res.json(result);
});

cartRouter.put('/items/:id', validateCartQuantity, async (req, res) => {
  const result = await saveCartItem({
    userId: req.user.id,
    variantId: parseId(req.params.id),
    cantidad: req.body.cantidad,
    add: false,
  });

  res.json(result);
});

cartRouter.delete('/items/:id', async (req, res) => {
  const result = await removeCartItem({
    userId: req.user.id,
    variantId: parseId(req.params.id),
  });

  res.json(result);
});
