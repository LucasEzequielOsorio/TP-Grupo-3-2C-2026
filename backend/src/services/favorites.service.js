import { transaction } from '../db.js';
import {
  addFavorite,
  findActiveFavoriteProduct,
  hasFavorite,
  lockFavoriteOwner,
  removeFavorite,
} from '../repositories/favorites.repository.js';
import { httpError } from '../validation.js';

export async function toggleFavorite(userId, productId) {
  return transaction(async (db) => {
    await lockFavoriteOwner(db, userId);

    if (!(await findActiveFavoriteProduct(db, productId)))
      throw httpError(404, 'El producto no está disponible');

    const alreadyFavorite = await hasFavorite(db, userId, productId);
    if (alreadyFavorite) await removeFavorite(db, userId, productId);
    else await addFavorite(db, userId, productId);

    return { productoId: productId, esFavorito: !alreadyFavorite };
  });
}
