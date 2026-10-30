import express, { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { authenticate, requireAdmin } from './auth.js';
import { httpError } from './validation.js';

export const imagesDirectory = fileURLToPath(new URL('../uploads/', import.meta.url));
export const imageRouter = Router();
imageRouter.post(
  '/imagenes',
  authenticate,
  requireAdmin,
  express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' }),
  async (req, res) => {
    if (!Buffer.isBuffer(req.body) || !req.body.length)
      throw httpError(400, 'Elegí una imagen JPG, PNG o WebP');
    let output;
    try {
      const options = { limitInputPixels: 24000000, animated: false };
      const metadata = await sharp(req.body, options).metadata();
      if (!['jpeg', 'png', 'webp'].includes(metadata.format))
        throw new Error('Formato no admitido');
      output = await sharp(req.body, options)
        .rotate()
        .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      throw httpError(
        400,
        'El archivo no es una imagen válida. Usá JPG, PNG o WebP de hasta 24 megapíxeles.',
      );
    }
    await mkdir(imagesDirectory, { recursive: true });
    const filename = `${randomUUID()}.webp`;
    await writeFile(new URL(`../uploads/${filename}`, import.meta.url), output, { flag: 'wx' });
    res.status(201).json({ imagen_url: `/api/imagenes/${filename}` });
  },
);
