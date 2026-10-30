import { Router } from 'express';
import { pool, transaction } from './db.js';
import { authenticate, requireAdmin } from './auth.js';
import { httpError, parseId, productSchema, gallerySchema, photosSchema } from './validation.js';

export const productsRouter = Router();
export const adminRouter = Router();
adminRouter.use(authenticate, requireAdmin);

const listQuery = `SELECT p.*, c.nombre AS clasificacion,
  COALESCE((SELECT SUM(e.cantidad) FROM variantes_producto v
    JOIN existencias e ON e.variante_id = v.id
    JOIN ubicaciones u ON u.id = e.ubicacion_id
    WHERE v.producto_id = p.id AND v.activo = 1 AND u.activo = 1), 0) AS stock,
  (SELECT COUNT(*) FROM variantes_producto v WHERE v.producto_id = p.id) AS cantidad_variantes
  FROM productos p JOIN categorias c ON c.id = p.categoria_id`;
function normalize(p) {
  return {
    ...p,
    imagen_url: p.imagen_url || '',
    activo: Boolean(p.activo),
    stock: Number(p.stock),
    cantidad_variantes: Number(p.cantidad_variantes),
  };
}
export async function getProduct(id, admin = false, db = pool) {
  const [rows] = await db.execute(
    `${listQuery} WHERE p.id = ? ${admin ? '' : 'AND p.activo = 1'}`,
    [id],
  );
  if (!rows.length) throw httpError(404, 'Producto no encontrado');
  const [images] = await db.execute(
    'SELECT url,color_id FROM producto_imagenes WHERE producto_id = ? ORDER BY orden',
    [id],
  );
  const [variants] = await db.execute(
    `SELECT v.*, t.nombre AS talle, c.nombre AS color, c.hexadecimal
    FROM variantes_producto v JOIN talles t ON t.id = v.talle_id JOIN colores c ON c.id = v.color_id
    WHERE v.producto_id = ? ${admin ? '' : 'AND v.activo = 1'} ORDER BY v.id`,
    [id],
  );
  const [stock] = await db.execute(
    `SELECT e.* FROM existencias e
    JOIN variantes_producto v ON v.id = e.variante_id JOIN ubicaciones u ON u.id = e.ubicacion_id
    WHERE v.producto_id = ? ${admin ? '' : 'AND u.activo = 1 AND v.activo = 1'} ORDER BY e.ubicacion_id`,
    [id],
  );
  return {
    ...normalize(rows[0]),
    imagenes: images.map((i) => i.url),
    fotos: images,
    variantes: variants.map((v) => ({
      ...v,
      activo: Boolean(v.activo),
      existencias: stock
        .filter((e) => e.variante_id === v.id)
        .map((e) => ({ ubicacion_id: e.ubicacion_id, cantidad: e.cantidad })),
    })),
  };
}
productsRouter.get('/', async (req, res) => {
  const [rows] = await pool.execute(`${listQuery} WHERE p.activo = 1 ORDER BY p.id DESC`);
  res.json(rows.map(normalize));
});
productsRouter.get('/:id', async (req, res) => res.json(await getProduct(parseId(req.params.id))));
adminRouter.get('/catalogos', async (req, res) => {
  const [categorias] = await pool.execute('SELECT * FROM categorias ORDER BY nombre');
  const [talles] = await pool.execute('SELECT * FROM talles ORDER BY orden, id');
  const [colores] = await pool.execute('SELECT * FROM colores ORDER BY nombre');
  const [ubicaciones] = await pool.execute(
    'SELECT * FROM ubicaciones WHERE activo = 1 ORDER BY id',
  );
  res.json({ categorias, talles, colores, ubicaciones });
});
adminRouter.get('/productos', async (req, res) => {
  const [rows] = await pool.execute(`${listQuery} ORDER BY p.id DESC`);
  res.json(rows.map(normalize));
});
adminRouter.get('/productos/:id', async (req, res) =>
  res.json(await getProduct(parseId(req.params.id), true)),
);

async function validateReferences(db, data) {
  const [categories] = await db.execute('SELECT id FROM categorias WHERE id = ?', [
    data.categoria_id,
  ]);
  if (!categories.length) throw httpError(400, 'La categoría no existe');
  const [sizes] = await db.execute('SELECT id FROM talles');
  const [colors] = await db.execute('SELECT id FROM colores');
  const [locations] = await db.execute(
    'SELECT id FROM ubicaciones WHERE activo = 1 ORDER BY id FOR SHARE',
  );
  for (const v of data.variantes) {
    if (!sizes.some((t) => t.id === v.talle_id) || !colors.some((c) => c.id === v.color_id))
      throw httpError(400, 'Talle o color inválido');
    for (const e of v.existencias)
      if (!locations.some((u) => u.id === e.ubicacion_id))
        throw httpError(400, 'Ubicación inválida o inactiva');
  }
}

export async function saveProduct(id, input, userId) {
  const isNew = !id;
  const data = productSchema.parse(input);
  const images = input.imagenes === undefined ? undefined : gallerySchema.parse(input.imagenes);
  const photos = input.fotos === undefined ? undefined : photosSchema.parse(input.fotos);
  if (
    photos?.some(
      (f) => f.color_id !== null && !data.variantes.some((v) => v.color_id === f.color_id),
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
      const [rows] = await db.execute('SELECT version FROM productos WHERE id = ? FOR UPDATE', [
        id,
      ]);
      if (!rows.length) throw httpError(404, 'Producto no encontrado');
      if (rows[0].version !== data.version)
        throw httpError(409, 'El producto fue modificado. Recargá antes de guardar.');
    } else if (data.variantes.some((v) => v.id))
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
    if (id) {
      await db.execute(
        'UPDATE productos SET nombre=?, descripcion=?, categoria_id=?, precio=?, imagen_url=?, activo=?, version=version+1 WHERE id=?',
        [...fields, id],
      );
    } else {
      const [created] = await db.execute(
        'INSERT INTO productos (nombre, descripcion, categoria_id, precio, imagen_url, activo) VALUES (?, ?, ?, ?, ?, ?)',
        fields,
      );
      id = created.insertId;
    }
    const [existing] = await db.execute(
      'SELECT * FROM variantes_producto WHERE producto_id = ? ORDER BY id FOR UPDATE',
      [id],
    );
    // No borrar ni omitir variantes históricas. Se desactivan explícitamente.
    if (existing.some((v) => !data.variantes.some((sent) => sent.id === v.id)))
      throw httpError(400, 'Conservá las variantes existentes; podés desactivarlas');
    for (const v of data.variantes.filter((v) => v.id)) {
      const original = existing.find((e) => e.id === v.id);
      if (!original) throw httpError(400, 'La variante no pertenece al producto');
      if (original.talle_id !== v.talle_id || original.color_id !== v.color_id)
        throw httpError(
          400,
          'No se puede cambiar talle/color de una variante histórica. Creá otra variante.',
        );
    }
    // Primero existentes, luego nuevas, manteniendo orden estable de bloqueo.
    const variants = [...data.variantes].sort(
      (a, b) => (a.id || Number.MAX_SAFE_INTEGER) - (b.id || Number.MAX_SAFE_INTEGER),
    );
    for (const v of variants) {
      let variantId = v.id;
      if (variantId)
        await db.execute(
          'UPDATE variantes_producto SET sku=?, activo=?, stock_minimo=? WHERE id=?',
          [v.sku, v.activo, v.stock_minimo, variantId],
        );
      else {
        const [created] = await db.execute(
          'INSERT INTO variantes_producto (producto_id, talle_id, color_id, sku, activo, stock_minimo) VALUES (?, ?, ?, ?, ?, ?)',
          [id, v.talle_id, v.color_id, v.sku, v.activo, v.stock_minimo],
        );
        variantId = created.insertId;
      }
      const [current] = await db.execute(
        'SELECT * FROM existencias WHERE variante_id = ? ORDER BY ubicacion_id FOR UPDATE',
        [variantId],
      );
      for (const e of [...v.existencias].sort((a, b) => a.ubicacion_id - b.ubicacion_id)) {
        const previous = current.find((c) => c.ubicacion_id === e.ubicacion_id);
        const difference = e.cantidad - (previous?.cantidad || 0);
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
          await db.execute(
            'INSERT INTO existencias (variante_id, ubicacion_id, cantidad) VALUES (?, ?, ?)',
            [variantId, e.ubicacion_id, e.cantidad],
          );
        else if (difference)
          await db.execute(
            'UPDATE existencias SET cantidad=? WHERE variante_id=? AND ubicacion_id=?',
            [e.cantidad, variantId, e.ubicacion_id],
          );
        if (difference)
          await db.execute(
            'INSERT INTO movimientos_stock (variante_id, ubicacion_id, cantidad, motivo, usuario_id, observacion, causa_ajuste) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              variantId,
              e.ubicacion_id,
              difference,
              isNew ? 'inicial' : 'ajuste',
              userId,
              isNew ? 'Existencias iniciales del producto' : data.ajuste_stock.observacion || null,
              isNew ? 'carga_inicial' : data.ajuste_stock.motivo,
            ],
          );
      }
    }
    const [previousPhotos] = await db.execute(
      'SELECT url,color_id FROM producto_imagenes WHERE producto_id=? ORDER BY orden',
      [id],
    );
    const gallery =
      photos ??
      (images === undefined && data.imagen_url === (previousPhotos[0]?.url || '')
        ? previousPhotos
        : (images ?? (data.imagen_url ? [data.imagen_url] : [])).map((url) => ({
            url,
            color_id: previousPhotos.find((f) => f.url === url)?.color_id ?? null,
          })));
    for (const photo of gallery)
      if (photo.color_id !== null && !data.variantes.some((v) => v.color_id === photo.color_id))
        throw httpError(
          400,
          'Una foto pertenece a un color que el producto ya no tiene. Asignala a otro color o marcala como general.',
        );
    await db.execute('DELETE FROM producto_imagenes WHERE producto_id = ?', [id]);
    for (const [order, photo] of gallery.entries())
      await db.execute(
        'INSERT INTO producto_imagenes (producto_id, url, orden,color_id) VALUES (?, ?, ?, ?)',
        [id, photo.url, order, photo.color_id],
      );
    return getProduct(id, true, db);
  });
}
adminRouter.post('/productos', async (req, res) =>
  res.status(201).json(await saveProduct(null, req.body, req.user.id)),
);
adminRouter.put('/productos/:id', async (req, res) =>
  res.json(await saveProduct(parseId(req.params.id), req.body, req.user.id)),
);
