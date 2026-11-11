import express, { Router } from 'express';
import { authenticate, requireAdmin } from '../middlewares/auth.middleware.js';
import { processAndSaveImage } from '../services/images.service.js';
import { imagesDirectory } from '../repositories/images.repository.js';

export const imageRouter = Router();
export { imagesDirectory };

imageRouter.post(
  '/imagenes',
  authenticate,
  requireAdmin,
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' }),
  async (req, res) => {
    const image = await processAndSaveImage(req.body);
    res.status(201).json(image);
  },
);
