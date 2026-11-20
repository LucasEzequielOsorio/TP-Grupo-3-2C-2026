import { gallerySchema, photosSchema, productSchema } from '../validation.js';

export function validateProductBody(req, res, next) {
  try {
    const data = productSchema.parse(req.body);
    const images = req.body.imagenes === undefined ? undefined : gallerySchema.parse(req.body.imagenes);
    const photos = req.body.fotos === undefined ? undefined : photosSchema.parse(req.body.fotos);
    req.productInput = { data, images, photos };
    next();
  } catch (error) {
    next(error);
  }
}
