import { pool, transaction } from '../db.js';
import {
  createProduct,
  createProductVariant,
  createStock,
  createStockMovement,
  findCatalogs,
  findProductDetails,
  findProductPhotos,
  findProductReferences,
  findProducts,
  findProductVariantsForUpdate,
  findProductVersionForUpdate,
  findVariantStockForUpdate,
  replaceProductPhotos,
  updateProduct,
  updateProductVariant,
  updateStock,
} from '../repositories/products.repository.js';
import { httpError } from '../validation.js';

function normalize(product, admin = false) {
  return {
    ...product,
    imagen_url: product.imagen_url || '',
    activo: Boolean(product.activo),
    stock: Number(admin ? product.stock : product.stock_disponible),
    cantidad_variantes: Number(product.cantidad_variantes),
  };
}

export async function listProducts(admin = false, db = pool) {
  return (await findProducts({ admin, db })).map((p) =>normalize(p, admin));
}

export async function getProduct(id, admin = false, db = pool) {
  const result = await findProductDetails(id, admin, db);
  if (!result) throw httpError(404, 'Producto no encontrado');

  const { product, images, variants, stock } = result;
  return {
    ...normalize(product, admin),
    imagenes: images.map((image) => image.url),
    fotos: images,
    variantes: variants.map((variant) => ({
      ...variant,
      activo: Boolean(variant.activo),
      existencias: stock
        .filter((entry) => entry.variante_id === variant.id)
        .map((entry) => ({ ubicacion_id: entry.ubicacion_id, cantidad: entry.cantidad, reservada: entry.reservada })),
    })),
  };
}

export async function getProductCatalogs() {
  return findCatalogs();
}

async function validateReferences(db, data) {
  const { categories, sizes, colors, locations } = await findProductReferences(
    db,
    data.categoria_id,
  );
  if (!categories.length) throw httpError(400, 'La categoría no existe');
  for (const variant of data.variantes) {
    if (
      !sizes.some((size) => size.id === variant.talle_id) ||
      !colors.some((color) => color.id === variant.color_id)
    )
      throw httpError(400, 'Talle o color inválido');
    for (const entry of variant.existencias)
      if (!locations.some((location) => location.id === entry.ubicacion_id))
        throw httpError(400, 'Ubicación inválida o inactiva');
  }
}

export async function saveProduct(id, { data, images, photos }, userId) {
  const isNew = !id;
  if (
    photos?.some(
      (photo) =>
        photo.color_id !== null && !data.variantes.some((variant) => variant.color_id === photo.color_id),
    )
  )
    throw httpError(
      400,
      'Cada foto debe usar un color de las variantes del producto, o ser general.',
    );
  if (images) data.imagen_url = images[0] || '';
  if (photos) data.imagen_url = photos[0]?.url || '';

  return transaction(async (db) => {
    if (id) {
      const current = await findProductVersionForUpdate(db, id);
      if (!current) throw httpError(404, 'Producto no encontrado');
      if (current.version !== data.version)
        throw httpError(409, 'El producto fue modificado. Recargá antes de guardar.');
    } else if (data.variantes.some((variant) => variant.id))
      throw httpError(400, 'Un producto nuevo no puede incluir variantes existentes');

    await validateReferences(db, data);
    const fields = [
      data.nombre,
      data.descripcion,
      data.categoria_id,
      data.precio,
      data.imagen_url || null,
      data.activo,
    ];

    if (id) await updateProduct(db, fields, id);
    else id = await createProduct(db, fields);

    const existing = await findProductVariantsForUpdate(db, id);
    if (existing.some((variant) => !data.variantes.some((sent) => sent.id === variant.id)))
      throw httpError(400, 'Conservá las variantes existentes; podés desactivarlas');

    for (const variant of data.variantes.filter((item) => item.id)) {
      const original = existing.find((item) => item.id === variant.id);
      if (!original) throw httpError(400, 'La variante no pertenece al producto');
      if (original.talle_id !== variant.talle_id || original.color_id !== variant.color_id)
        throw httpError(
          400,
          'No se puede cambiar talle/color de una variante histórica. Creá otra variante.',
        );
    }

    const variants = [...data.variantes].sort(
      (a, b) => (a.id || Number.MAX_SAFE_INTEGER) - (b.id || Number.MAX_SAFE_INTEGER),
    );
    for (const variant of variants) {
      let variantId = variant.id;
      if (variantId)
        await updateProductVariant(db, {
          sku: variant.sku,
          activo: variant.activo,
          stock_minimo: variant.stock_minimo,
          id: variantId,
        });
      else
        variantId = await createProductVariant(db, {
          productId: id,
          talle_id: variant.talle_id,
          color_id: variant.color_id,
          sku: variant.sku,
          activo: variant.activo,
          stock_minimo: variant.stock_minimo,
        });

      const currentStock = await findVariantStockForUpdate(db, variantId);
      for (const entry of [...variant.existencias].sort(
        (a, b) => a.ubicacion_id - b.ubicacion_id,
      )) {
        const previous = currentStock.find((item) => item.ubicacion_id === entry.ubicacion_id);
        if (entry.cantidad < (previous?.reservada || 0))
          throw httpError(
            409,
            'No podés reducir el stock por debajo de las unidades reservadas para pagos.',
          );
        const difference = entry.cantidad - (previous?.cantidad || 0);
        if (difference && !isNew) {
          const adjustment = data.ajuste_stock;
          if (!adjustment) throw httpError(400, 'Elegí un motivo para modificar las existencias.');
          if (adjustment.motivo === 'otro' && !adjustment.observacion)
            throw httpError(400, 'Agregá una observación para el motivo Otro.');
          if (adjustment.motivo === 'mercaderia_danada' && difference > 0)
            throw httpError(
              400,
              'La mercadería dañada solo permite descontar unidades. Para aumentos usá ingreso o conteo físico.',
            );
          if (
            ['ingreso_mercaderia', 'devolucion_cliente'].includes(adjustment.motivo) &&
            difference < 0
          )
            throw httpError(
              400,
              'Los ingresos y devoluciones solo permiten sumar unidades. Para bajas usá daño o conteo físico.',
            );
        }

        if (!previous)
          await createStock(db, {
            variantId,
            locationId: entry.ubicacion_id,
            cantidad: entry.cantidad,
          });
        else if (difference)
          await updateStock(db, {
            variantId,
            locationId: entry.ubicacion_id,
            cantidad: entry.cantidad,
          });

        if (difference)
          await createStockMovement(db, {
            variantId,
            locationId: entry.ubicacion_id,
            difference,
            reason: isNew ? 'inicial' : 'ajuste',
            userId,
            observation: isNew
              ? 'Existencias iniciales del producto'
              : data.ajuste_stock.observacion || null,
            adjustmentCause: isNew ? 'carga_inicial' : data.ajuste_stock.motivo,
          });
      }
    }

    const previousPhotos = await findProductPhotos(db, id);
    const gallery =
      photos ??
      (images === undefined && data.imagen_url === (previousPhotos[0]?.url || '')
        ? previousPhotos
        : (images ?? (data.imagen_url ? [data.imagen_url] : [])).map((url) => ({
            url,
            color_id: previousPhotos.find((photo) => photo.url === url)?.color_id ?? null,
          })));
    for (const photo of gallery)
      if (
        photo.color_id !== null &&
        !data.variantes.some((variant) => variant.color_id === photo.color_id)
      )
        throw httpError(
          400,
          'Una foto pertenece a un color que el producto ya no tiene. Asignala a otro color o marcala como general.',
        );

    await replaceProductPhotos(db, id, gallery);
    return getProduct(id, true, db);
  });
}
