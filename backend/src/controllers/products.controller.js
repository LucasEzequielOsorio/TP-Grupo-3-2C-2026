import { Router } from 'express';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware.js';
import { validateProductBody } from '../middlewares/products.middleware.js';
import {
  getProduct,
  getProductCatalogs,
  listProducts,
  saveProduct,
} from '../services/products.service.js';
import { parseId } from '../validation.js';

export const productsRouter = Router();
export const adminRouter = Router();

adminRouter.use(authenticate, requireAdmin);

productsRouter.get('/', async (req, res) => {
  res.json(await listProducts());
});

productsRouter.get('/:id', async (req, res) => {
  res.json(await getProduct(parseId(req.params.id)));
});

adminRouter.get('/catalogos', async (req, res) => {
  res.json(await getProductCatalogs());
});

adminRouter.get('/productos', async (req, res) => {
  res.json(await listProducts(true));
});

adminRouter.get('/productos/:id', async (req, res) => {
  res.json(await getProduct(parseId(req.params.id), true));
});

adminRouter.post('/productos', validateProductBody, async (req, res) => {
  res.status(201).json(await saveProduct(null, req.productInput, req.user.id));
});

adminRouter.put('/productos/:id', validateProductBody, async (req, res) => {
  res.json(
    await saveProduct(parseId(req.params.id), req.productInput, req.user.id),
  );
});
