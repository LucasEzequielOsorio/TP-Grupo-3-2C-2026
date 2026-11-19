import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { app } from '../src/app.js';
import { pool } from '../src/db.js';

test('Catálogo: filtros SQL, seis por página, orden estable y límites', async () => {
  const tag = 'CAT-' + randomUUID(),
    ids = [];
  let category, variant, location;
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/productos`;
  const get = async (params) => {
    const r = await fetch(base + '?' + new URLSearchParams(params));
    return { status: r.status, body: await r.json() };
  };
  try {
    const [c] = await pool.execute('INSERT INTO categorias(nombre) VALUES (?)', [tag]);
    category = c.insertId;
    for (let i = 0; i < 8; i++) {
      const [p] = await pool.execute(
        'INSERT INTO productos(categoria_id,nombre,descripcion,precio,activo) VALUES (?,?,?,?,?)',
        [category, tag + '-' + i, 'Prenda de prueba', 10 + i, i === 7 ? 0 : 1],
      );
      ids.push(p.insertId);
    }
    const [[t]] = await pool.execute('SELECT id FROM talles LIMIT 1');
    const [[color]] = await pool.execute('SELECT id FROM colores LIMIT 1');
    const [u] = await pool.execute(
      "INSERT INTO ubicaciones(nombre,tipo,direccion) VALUES (?,?,'Temporal')",
      [tag, 'deposito'],
    );
    location = u.insertId;
    const [v] = await pool.execute(
      'INSERT INTO variantes_producto(producto_id,talle_id,color_id,sku) VALUES (?,?,?,?)',
      [ids[0], t.id, color.id, tag],
    );
    variant = v.insertId;
    await pool.execute(
      'INSERT INTO existencias(variante_id,ubicacion_id,cantidad,reservada) VALUES (?,?,2,2)',
      [variant, location],
    );
    const first = await get({ buscar: tag });
    assert.equal(first.status, 200);
    assert.equal(first.body.total, 7);
    assert.deepEqual(
      first.body.items.map((p) => p.id),
      ids.slice(0, 6),
    );
    assert.equal(first.body.paginas, 2);
    assert.equal(first.body.por_pagina, 6);
    assert.ok(first.body.categorias.includes(tag));
    const second = await get({ buscar: tag, pagina: 2 });
    assert.deepEqual(
      second.body.items.map((p) => p.id),
      [ids[6]],
    );
    assert.equal((await get({ buscar: tag, pagina: 999 })).body.pagina, 2);
    assert.equal((await get({ categoria: tag, orden: 'mayor' })).body.items[0].id, ids[6]);
    assert.equal((await get({ buscar: tag + '-1', categoria: tag })).body.total, 1);
    assert.equal(
      (await get({ buscar: tag, solo_stock: 'true' })).body.total,
      0,
      'Reservado no es disponible',
    );
    await pool.execute('UPDATE existencias SET reservada=1 WHERE variante_id=?', [variant]);
    assert.deepEqual(
      (await get({ buscar: tag, solo_stock: 'true' })).body.items.map((p) => p.id),
      [ids[0]],
    );
    assert.equal((await get({ buscar: tag + "' OR 1=1 --" })).body.total, 0);
    assert.equal((await get({ pagina: 0 })).status, 400);
    assert.equal((await get({ orden: 'precio;DELETE' })).status, 400);
    const empty = (await get({ buscar: tag + '-inexistente' })).body;
    assert.equal(empty.total, 0);
    assert.equal(empty.pagina, 1);
    assert.equal(empty.paginas, 1);
  } finally {
    if (variant) {
      await pool.execute('DELETE FROM existencias WHERE variante_id=?', [variant]);
      await pool.execute('DELETE FROM variantes_producto WHERE id=?', [variant]);
    }
    for (const id of ids) await pool.execute('DELETE FROM productos WHERE id=?', [id]);
    if (category) await pool.execute('DELETE FROM categorias WHERE id=?', [category]);
    if (location) await pool.execute('DELETE FROM ubicaciones WHERE id=?', [location]);
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
