import express from 'express';
import helmet from 'helmet';
import { ZodError } from 'zod';
import { authRouter } from './controllers/auth.controller.js';
import { productsRouter, adminRouter } from './products.js';
import { pool } from './db.js';
import { imageRouter, imagesDirectory } from './images.js';
import { toolsRouter } from './admin-tools.js';
import { transfersRouter } from './transfers.js';
import { summaryRouter } from './location-summary.js';
import { cartRouter } from './controllers/cart.controller.js';
import { ordersRouter } from './orders.js';

export const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(express.json({ limit: '256kb' }));
app.get('/api/health', async (req, res) => {
  await pool.execute('SELECT 1');
  res.json({ estado: 'ok' });
});
app.use('/api/auth', authRouter);
app.use('/api/productos', productsRouter);
app.use('/api/carrito', cartRouter);
app.use('/api/pedidos', ordersRouter);
app.use(
  '/api/imagenes',
  express.static(imagesDirectory, {
    dotfiles: 'deny',
    index: false,
    maxAge: '1y',
    immutable: true,
  }),
);
app.use('/api/admin', imageRouter);
app.use('/api/admin', toolsRouter);
app.use('/api/admin', transfersRouter);
app.use('/api/admin', summaryRouter);
app.use('/api/admin', adminRouter);
app.use((req, res) => res.status(404).json({ mensaje: 'Ruta no encontrada' }));
app.use((error, req, res, next) => {
  if (error instanceof ZodError)
    return res.status(400).json({
      mensaje: 'Revisá los datos ingresados',
      errores: error.issues.map((e) => ({ campo: e.path.join('.'), mensaje: e.message })),
    });
  if (error.code === 'ER_DUP_ENTRY')
    return res.status(409).json({
      mensaje: req.path.includes('/auth/')
        ? 'El email ya está registrado'
        : 'El SKU o la combinación de talle y color ya existe',
    });
  if (error.type === 'entity.parse.failed')
    return res.status(400).json({ mensaje: 'JSON inválido' });
  if (error.type === 'entity.too.large')
    return res.status(413).json({ mensaje: 'Solicitud demasiado grande' });
  const status = error.status || 500;
  if (status >= 500) console.error('Error API:', error.code || error.message);
  res
    .status(status)
    .json({ mensaje: status >= 500 ? 'No se pudo completar la operación' : error.message });
});
