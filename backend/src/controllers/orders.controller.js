import { Router } from 'express';
import {
  authenticateOrderUser,
  validateOrderBody,
  validateOrderId,
} from '../middlewares/orders.middleware.js';
import {
  createOrder,
  getDeliveryAddress,
  getOrder,
  listOrders,
} from '../services/orders.service.js';

export const ordersRouter = Router();

ordersRouter.use(authenticateOrderUser);

ordersRouter.get('/entrega', async (req, res) => {
  res.json({ direccion: await getDeliveryAddress(req.user.id) });
});

ordersRouter.get('/', async (req, res) => {
  res.json(await listOrders(req.user.id));
});

ordersRouter.get('/:id', validateOrderId, async (req, res) => {
  res.json(await getOrder(req.user.id, req.orderId));
});

ordersRouter.post('/', validateOrderBody, async (req, res) => {
  const result = await createOrder(req.user.id, req.orderData);
  res.status(201).json(result);
});
