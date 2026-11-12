import { transaction } from '../db.js';
import {
  adjustLocationStock,
  countTransfers,
  findTransferDetail,
  findTransferForUpdate,
  findTransferItems,
  findTransfers,
  incrementProductVersions,
  insertTransfer,
  insertTransferItem,
  insertTransferStockMovement,
  lockTransferResources,
  updateTransferState,
} from '../repositories/transfers.repository.js';
import { httpError } from '../validation.js';

function assertResourcesAreAvailable(resources, expectedItems, checkActive = true) {
  const { refs, products, variants, places } = resources;
  if (refs.length !== expectedItems)
    throw httpError(400, 'Una variante no existe');
  if (checkActive && (products.some((product) => !product.activo) || variants.some((variant) => !variant.activo)))
    throw httpError(409, 'Solo se pueden despachar productos y variantes activos');
  if (places.length !== 2 || places.some((location) => !location.activo))
    throw httpError(409, 'El origen y el destino deben estar activos');
}

async function requireTransferDetail(id, db) {
  const transfer = await findTransferDetail(id, db);
  if (!transfer) throw httpError(404, 'Transferencia no encontrada');
  return transfer;
}

export async function listTransfers(query) {
  const total = await countTransfers(query);
  const paginas = Math.max(1, Math.ceil(total / 20));
  const pagina = Math.min(query.pagina, paginas);
  const items = await findTransfers(query, (pagina - 1) * 20);
  return { items, total, pagina, paginas };
}

export async function getTransfer(id) {
  return requireTransferDetail(id);
}

export async function createTransfer(data, userId) {
  return transaction(async (db) => {
    const resources = await lockTransferResources(db, data.items, [
      data.origen_id,
      data.destino_id,
    ]);
    assertResourcesAreAvailable(resources, data.items.length);
    for (const item of data.items)
      if (
        (resources.stock.find(
          (entry) =>
            entry.variante_id === item.variante_id && entry.ubicacion_id === data.origen_id,
        )?.cantidad || 0) < item.cantidad
      )
        throw httpError(409, 'Stock insuficiente en el origen. Actualizá las cantidades.');

    const transferId = await insertTransfer(db, { ...data, userId });
    for (const item of [...data.items].sort((a, b) => a.variante_id - b.variante_id))
      await insertTransferItem(db, transferId, item);
    return requireTransferDetail(transferId, db);
  });
}

export async function executeTransferAction(id, action, userId) {
  return transaction(async (db) => {
    const transfer = await findTransferForUpdate(db, id);
    if (!transfer) throw httpError(404, 'Transferencia no encontrada');

    if (action === 'cancelar') {
      if (transfer.estado !== 'borrador')
        throw httpError(
          409,
          'Solo se puede cancelar un borrador. Para devolver mercadería despachada, recibila y creá una transferencia de regreso.',
        );
      await updateTransferState(db, id, action);
      return requireTransferDetail(id, db);
    }

    if (transfer.estado !== (action === 'despachar' ? 'borrador' : 'en_transito'))
      throw httpError(409, 'La transferencia ya cambió de estado. Actualizá el listado.');

    const items = await findTransferItems(db, id);
    if (!items.length) throw httpError(409, 'La transferencia no tiene productos');

    // Receiving must remain possible if a product or variant was deactivated after dispatch.
    const resources = await lockTransferResources(db, items, [
      transfer.origen_id,
      transfer.destino_id,
    ]);
    assertResourcesAreAvailable(resources, items.length, action === 'despachar');
    const locationId = action === 'despachar' ? transfer.origen_id : transfer.destino_id;

    for (const item of items) {
      const previous = resources.stock.find(
        (entry) =>
          entry.variante_id === item.variante_id && entry.ubicacion_id === locationId,
      );
      if (action === 'despachar' && (!previous || previous.cantidad < item.cantidad))
        throw httpError(
          409,
          'Stock insuficiente para una variante. No se despachó ninguna unidad.',
        );

      const difference = action === 'despachar' ? -item.cantidad : item.cantidad;
      await adjustLocationStock(db, item.variante_id, locationId, previous, difference);
      await insertTransferStockMovement(db, {
        variantId: item.variante_id,
        locationId,
        difference,
        userId,
        transferId: id,
        action,
      });
    }

    await incrementProductVersions(db, resources.productIds);
    await updateTransferState(db, id, action);
    return requireTransferDetail(id, db);
  });
}
