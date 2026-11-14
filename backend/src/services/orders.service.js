import { pool, transaction } from '../db.js';
import {
  clearOrderCart,
  createOrderRecord,
  createOrderItem,
  findActiveLocations,
  findCartItemsForOrder,
  findConfirmedOrder,
  findDeliveryAddress,
  findOrderByUser,
  findOrderItems,
  findOrdersByUser,
  findProductsForUpdate,
  findStockForUpdate,
  findVariantsForUpdate,
  findPendingOrdersByUser,
  incrementOrderProductVersions,
  insertOrderConfirmation,
  insertOrderItemDetails,
  lockOrderUser,
  updateReservedStock,
  insertReservedStockMovement
} from '../repositories/orders.repository.js';
import { httpError } from '../validation.js';

export async function getOrderDetail(userId, orderId, db = pool) {
  const order = await findOrderByUser(orderId, userId, db);
  if (!order) throw httpError(404, 'Pedido no encontrado');

  const items = await findOrderItems(db, orderId);
  return {
    ...order,
    items: items.map((item) => ({
      ...item,
      subtotal: (Math.round(item.precio_unitario * 100) * item.cantidad) / 100,
    })),
    total:
      items.reduce(
        (sum, item) => sum + Math.round(item.precio_unitario * 100) * item.cantidad,
        0,
      ) / 100,
  };
}

export async function getDeliveryAddress(userId) {
  return findDeliveryAddress(userId);
}

export async function listOrders(userId) {
  return findOrdersByUser(userId);
}

export async function getOrder(userId, orderId) {
  return getOrderDetail(userId, orderId);
}

export async function createOrder(userId, data) {
  return transaction(async (db) => {
    const address = await lockOrderUser(db, userId);

    const confirmed = await findConfirmedOrder(db, userId, data.clave);
    if (confirmed) return getOrderDetail(userId, confirmed.pedido_id, db);

    const [pending] = await findPendingOrdersByUser(userId, db);
    if(pending.total >= 3) throw httpError(409, 'Tenés 3 pedidos pendientes. Esperá a que se procesen antes de crear otro');

    const cart = await findCartItemsForOrder(db, userId);
    if (!cart.length) throw httpError(409, 'El carrito está vacío');
    if (cart.length > 100) throw httpError(400, 'El pedido admite hasta 100 combinaciones');

    const productIds = [...new Set(cart.map((item) => item.producto_id))].sort((a, b) => a - b);
    const variantIds = cart.map((item) => item.variante_id);
    const products = await findProductsForUpdate(db, productIds);
    const variants = await findVariantsForUpdate(db, variantIds);
    const locations = await findActiveLocations(db);
    if (!locations.length) throw httpError(409, 'No hay ubicaciones disponibles');

    const locationIds = locations.map((location) => location.id);
    const stock = await findStockForUpdate(db, variantIds, locationIds);

    if (
      data.items.length !== cart.length ||
      new Set(data.items.map((item) => item.variante_id)).size !== cart.length
    )
      throw httpError(409, 'Cambió el carrito. Actualizalo y revisá el pedido antes de confirmar');

    for (const item of cart) {
      const product = products.find((entry) => entry.id === item.producto_id);
      const variant = variants.find((entry) => entry.id === item.variante_id);
      const expected = data.items.find((entry) => entry.variante_id === item.variante_id);
      if (!expected || expected.cantidad !== item.cantidad || expected.precio !== product.precio)
        throw httpError(
          409,
          'Cambió el precio o el carrito. Actualizalo y revisá el total antes de confirmar',
        );
      if (
        !product.activo ||
        !variant.activo ||
        stock
          .filter((entry) => entry.variante_id === variant.id)
          .reduce((sum, entry) => sum + entry.cantidad, 0) < item.cantidad
      )
        throw httpError(
          409,
          'No hay stock suficiente para ' + product.nombre + '. Actualizá el carrito',
        );
    }

    const totalCents = cart.reduce(
      (sum, i) =>
        sum + Math.round(products.find((p) => p.id === i.producto_id).precio * 100) * i.cantidad,
      0,
    );
    if (totalCents > 9999999999)
      throw httpError(400, 'El total del pedido supera el importe máximo permitido.');

    const orderId = await createOrderRecord(db, userId, address);

    for (const item of cart) {
      const product = products.find((entry) => entry.id === item.producto_id);
      const variant = variants.find((entry) => entry.id === item.variante_id);
      const itemId = await createOrderItem(db, orderId, variant.id, item.cantidad, product.precio);
      await insertOrderItemDetails(db, itemId, product.nombre, variant.talle, variant.color);

      let remaining = item.cantidad;
      for (const entry of stock.filter((stockItem) => stockItem.variante_id === variant.id)) {
        const quantity = Math.min(remaining, entry.cantidad - entry.reservada);
        if (!quantity) continue;
        await updateReservedStock(db, variant.id, entry.ubicacion_id, quantity);
        await insertReservedStockMovement(db, variant.id, entry.ubicacion_id, quantity, orderId);
        remaining -= quantity;
        if (!remaining) break;
      }
    }

    await incrementOrderProductVersions(db, productIds);
    await insertOrderConfirmation(db, userId, data.clave, orderId);
    await clearOrderCart(db, userId);
    return getOrderDetail(userId, orderId, db);
  });
}
