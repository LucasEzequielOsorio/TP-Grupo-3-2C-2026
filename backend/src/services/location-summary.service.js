import { transaction } from '../db.js';
import {
  countLocationInventory,
  findLocationById,
  findLocationInventory,
  findLocationStockStats,
  findLocationTransitTotals,
} from '../repositories/location-summary.repository.js';
import { httpError } from '../validation.js';

export async function getLocationSummary(id, query) {
  return transaction(async (db) => {
    const location = await findLocationById(db, id);
    if (!location) throw httpError(404, 'Ubicación no encontrada');

    const locationActive = Boolean(location.activo);
    const [stats, total] = await Promise.all([
      findLocationStockStats(db, id, locationActive),
      countLocationInventory(db, { ...query, locationId: id }, locationActive),
    ]);
    const paginas = Math.max(1, Math.ceil(total / 30));
    const pagina = Math.min(query.pagina, paginas);
    const [items, transit] = await Promise.all([
      findLocationInventory(db, { ...query, locationId: id }, locationActive, (pagina - 1) * 30),
      findLocationTransitTotals(db, id),
    ]);

    return {
      ubicacion: { ...location, activo: locationActive },
      resumen: Object.fromEntries(
        Object.entries({ ...stats, ...transit }).map(([key, value]) => [key, Number(value)]),
      ),
      items: items.map((item) => ({
        ...item,
        producto_activo: Boolean(item.producto_activo),
        variante_activa: Boolean(item.variante_activa),
      })),
      total,
      pagina,
      paginas,
    };
  });
}
