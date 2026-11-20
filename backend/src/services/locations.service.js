import { transaction } from '../db.js';
import {
  findActiveLocation,
  findLocationStock,
  findLocations,
  hasPendingLocationTransfers,
  insertLocation,
  lockLocation,
  sumLocationStock,
  updateLocation,
} from '../repositories/locations.repository.js';
import { httpError } from '../validation.js';

async function handleDuplicateLocation(operation) {
  try {
    return await operation();
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY')
      throw httpError(409, 'Ya existe una ubicación con ese nombre');
    throw error;
  }
}

export async function listLocations() {
  const rows = await findLocations();
  return rows.map((location) => ({
    ...location,
    activo: Boolean(location.activo),
    unidades: Number(location.unidades),
  }));
}

export async function createLocation(data) {
  const id = await handleDuplicateLocation(() => insertLocation(data));
  return { id, ...data, unidades: 0 };
}

export async function editLocation(id, data) {
  return handleDuplicateLocation(() =>
    transaction(async (db) => {
      const location = await lockLocation(db, id);
      if (!location) throw httpError(404, 'Ubicación no encontrada');
      if (!data.activo) {
        const stock = await sumLocationStock(db, id);
        const pending = await hasPendingLocationTransfers(db, id);
        if (stock > 0 || pending)
          throw httpError(
            409,
            'No se puede desactivar una ubicación con stock o transferencias pendientes',
          );
      }
      await updateLocation(db, id, data);
      return { id, ...data };
    }),
  );
}

export async function getLocationStock(id) {
  const location = await findActiveLocation(id);
  if (!location) throw httpError(404, 'Ubicación no encontrada o inactiva');
  return findLocationStock(id);
}
