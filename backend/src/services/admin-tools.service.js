import {
  countStockMovements,
  findStockAlerts,
  findStockMovements,
  insertCatalogEntry,
  updateCatalogEntry,
} from '../repositories/admin-tools.repository.js';
import { httpError } from '../validation.js';

async function handleCatalogConflict(operation) {
  try {
    return await operation();
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY')
      throw httpError(409, 'Ya existe un registro con ese nombre');
    throw error;
  }
}

export async function createCatalogEntry(type, data) {
  const id = await handleCatalogConflict(() => insertCatalogEntry(type, data));
  return { id, ...data };
}

export async function editCatalogEntry(type, id, data) {
  const updated = await handleCatalogConflict(() => updateCatalogEntry(type, id, data));
  if (!updated) throw httpError(404, 'Registro no encontrado');
  return { id, ...data };
}

export async function getStockAlerts(locationId) {
  return findStockAlerts(locationId);
}

export async function getStockHistory(query) {
  const total = await countStockMovements(query);
  const paginas = Math.max(1, Math.ceil(total / 30));
  const pagina = Math.min(query.pagina, paginas);
  const items = await findStockMovements(query, (pagina - 1) * 30);
  return { items, total, pagina, paginas };
}
