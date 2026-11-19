import sharp from 'sharp';
import { saveImageFile } from '../repositories/images.repository.js';
import { httpError } from '../validation.js';

export async function processAndSaveImage(input) {
  if (!Buffer.isBuffer(input) || !input.length)
    throw httpError(400, 'Elegí una imagen JPG, PNG o WebP');

  let output;
  try {
    const options = { limitInputPixels: 24000000, animated: false };
    const metadata = await sharp(input, options).metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format))
      throw new Error('Formato no admitido');
    output = await sharp(input, options)
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

  const filename = await saveImageFile(output);
  return { imagen_url: `/api/imagenes/${filename}` };
}
