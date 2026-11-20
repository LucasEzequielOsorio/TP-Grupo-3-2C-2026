import { pool, transaction } from '../db.js';
import { getProduct } from './products.service.js';
import {
  deleteCartItem,
  findActiveVariant,
  findCartItem,
  getCartRowsByUser,
  lockCartOwner,
  upsertCartItem,
} from '../repositories/cart.repository.js';
import { httpError } from '../validation.js';

export function normalizeCartRows(rows) {
  const items = rows.map((row) => ({
    ...row,
    stock: row.activo ? Number(row.stock) : 0,
    activo: Boolean(row.activo),
    subtotal: (Math.round(row.precio * 100) * row.cantidad) / 100,
  }));

  return {
    items,
    total: items.reduce((sum, item) => sum + Math.round(item.subtotal * 100), 0) / 100,
    unidades: items.reduce((sum, item) => sum + item.cantidad, 0),
  };
}

export async function getCart(userId, db = pool) {
  const rows = await getCartRowsByUser(userId, db);
  return normalizeCartRows(rows);
}

export async function saveCartItem({ userId, variantId, cantidad, add }) {
  return transaction(async (db) => {
    await lockCartOwner(db, userId);

    const variant = await findActiveVariant(db, variantId);
    if (!variant) throw httpError(404, 'La combinación elegida ya no está disponible');

    const product = await getProduct(variant.producto_id, false, db);
    const variantData = product.variantes.find((item) => item.id === variantId);
    const stock = variantData.existencias.reduce((sum, entry) => sum + entry.cantidad, 0);
    const existing = await findCartItem(db, userId, variantId);
    const next = cantidad + (add ? existing?.cantidad || 0 : 0);

    if (next > stock || next > 999)
      throw httpError(409, `No hay stock suficiente. Disponible: ${stock} unidades`);

    await upsertCartItem(db, userId, variantId, next);
    return getCart(userId, db);
  });
}

export async function removeCartItem({ userId, variantId }) {
  return transaction(async (db) => {
    await lockCartOwner(db, userId);
    await deleteCartItem(db, userId, variantId);
    return getCart(userId, db);
  });
}
