import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { app } from '../src/app.js';
import { pool } from '../src/db.js';

test('Depósitos y transferencias: concurrencia, estados, trazabilidad y rollback', async () => {
  const prefix = `TRTEST-${randomUUID()}`;
  const email = `${prefix}@example.invalid`;
  const locations = [];
  const products = [];
  const transfers = [];
  let userId;
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/admin`;
  let token;
  async function call(path, method = 'GET', body, authorization = token) {
    const r = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: r.status, body: await r.json() };
  }
  async function draft(origen_id, destino_id, items) {
    const r = await call('/transferencias', 'POST', { origen_id, destino_id, items });
    assert.equal(r.status, 201, JSON.stringify(r.body));
    transfers.push(r.body.id);
    return r.body;
  }
  async function stock(variant, location) {
    const [rows] = await pool.execute(
      'SELECT cantidad FROM existencias WHERE variante_id=? AND ubicacion_id=?',
      [variant, location],
    );
    return rows[0]?.cantidad || 0;
  }
  try {
    const password = 'TransferTest2026!';
    const [user] = await pool.execute(
      "INSERT INTO usuarios (email,password_hash,nombre,apellido,direccion,rol) VALUES (?,?,?,?,?,'admin')",
      [email, await bcrypt.hash(password, 4), 'Test', 'Transferencias', 'Temporal'],
    );
    userId = user.insertId;
    const login = await fetch(base.replace('/admin', '/auth/login'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    token = (await login.json()).token;
    assert.equal((await call('/ubicaciones', 'GET', undefined, '')).status, 401);
    for (const name of ['Origen', 'Destino', 'Vacío']) {
      const result = await call('/ubicaciones', 'POST', {
        nombre: `${prefix}-${name}`,
        tipo: 'deposito',
        direccion: 'Dirección temporal de prueba',
        activo: true,
      });
      assert.equal(result.status, 201);
      locations.push(result.body.id);
    }
    const [origin, destination, empty] = locations;
    assert.equal(
      (
        await call('/ubicaciones', 'POST', {
          nombre: `${prefix}-Origen`,
          tipo: 'tienda',
          direccion: 'Temporal',
          activo: true,
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await call('/ubicaciones', 'POST', {
          nombre: '',
          tipo: 'deposito',
          direccion: 'Temporal',
          activo: true,
        })
      ).status,
      400,
    );
    const catalogs = (await call('/catalogos')).body;
    const created = await call('/productos', 'POST', {
      nombre: prefix,
      descripcion: 'Producto temporal de transferencias',
      categoria_id: catalogs.categorias[0].id,
      precio: 100,
      activo: true,
      imagen_url: '',
      variantes: [
        {
          talle_id: catalogs.talles[0].id,
          color_id: catalogs.colores[0].id,
          sku: `${prefix}-A`,
          activo: true,
          existencias: [{ ubicacion_id: origin, cantidad: 7 }],
        },
        {
          talle_id: catalogs.talles[1].id,
          color_id: catalogs.colores[0].id,
          sku: `${prefix}-B`,
          activo: true,
          existencias: [{ ubicacion_id: origin, cantidad: 2 }],
        },
      ],
    });
    assert.equal(created.status, 201);
    products.push(created.body.id);
    const [a, b] = created.body.variantes.map((v) => v.id);
    const productId = created.body.id;
    assert.equal((await call('/ubicaciones')).body.find((u) => u.id === origin).unidades, 9);
    assert.equal((await call(`/ubicaciones/${origin}/stock`)).body.length, 2);
    assert.equal(
      (
        await call('/transferencias', 'POST', {
          origen_id: origin,
          destino_id: origin,
          items: [{ variante_id: a, cantidad: 1 }],
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call('/transferencias', 'POST', {
          origen_id: origin,
          destino_id: destination,
          items: [],
        })
      ).status,
      400,
    );
    assert.equal(
      (
        await call('/transferencias', 'POST', {
          origen_id: origin,
          destino_id: destination,
          items: [{ variante_id: a, cantidad: 8 }],
        })
      ).status,
      409,
    );
    const main = await draft(origin, destination, [
      { variante_id: a, cantidad: 3 },
      { variante_id: b, cantidad: 1 },
    ]);
    assert.equal(await stock(a, origin), 7);
    assert.equal(await stock(a, destination), 0);
    assert.equal((await call(`/transferencias/${main.id}/recibir`, 'POST', {})).status, 409);
    const dispatches = await Promise.all([
      call(`/transferencias/${main.id}/despachar`, 'POST', {}),
      call(`/transferencias/${main.id}/despachar`, 'POST', {}),
    ]);
    assert.deepEqual(dispatches.map((r) => r.status).sort(), [200, 409]);
    assert.equal(await stock(a, origin), 4);
    assert.equal(await stock(b, origin), 1);
    assert.equal(await stock(a, destination), 0);
    assert.equal((await call(`/transferencias/${main.id}/cancelar`, 'POST', {})).status, 409);
    assert.equal(
      (await call(`/productos/${productId}`, 'PUT', created.body)).status,
      409,
      'El despacho invalida ediciones viejas de stock',
    );
    const receptions = await Promise.all([
      call(`/transferencias/${main.id}/recibir`, 'POST', {}),
      call(`/transferencias/${main.id}/recibir`, 'POST', {}),
    ]);
    assert.deepEqual(receptions.map((r) => r.status).sort(), [200, 409]);
    assert.equal(await stock(a, destination), 3);
    assert.equal(await stock(b, destination), 1);
    const [audit] = await pool.execute(
      'SELECT variante_id,SUM(cantidad) AS balance,COUNT(*) AS total FROM movimientos_stock WHERE transferencia_id=? GROUP BY variante_id',
      [main.id],
    );
    assert.ok(audit.every((row) => Number(row.balance) === 0 && row.total === 2));
    const competing1 = await draft(origin, destination, [{ variante_id: a, cantidad: 3 }]);
    const competing2 = await draft(origin, destination, [{ variante_id: a, cantidad: 3 }]);
    const race = await Promise.all([
      call(`/transferencias/${competing1.id}/despachar`, 'POST', {}),
      call(`/transferencias/${competing2.id}/despachar`, 'POST', {}),
    ]);
    assert.deepEqual(race.map((r) => r.status).sort(), [200, 409]);
    assert.equal(await stock(a, origin), 1);
    const winner = race.find((r) => r.status === 200).body;
    const loser = winner.id === competing1.id ? competing2 : competing1;
    assert.equal((await call(`/transferencias/${winner.id}/recibir`, 'POST', {})).status, 200);
    assert.equal((await call(`/transferencias/${loser.id}/cancelar`, 'POST', {})).status, 200);
    const partial = await draft(origin, destination, [
      { variante_id: a, cantidad: 1 },
      { variante_id: b, cantidad: 1 },
    ]);
    const beforeAdjustment = (await call(`/productos/${productId}`)).body;
    beforeAdjustment.variantes
      .find((v) => v.id === b)
      .existencias.find((e) => e.ubicacion_id === origin).cantidad = 0;
    assert.equal((await call(`/productos/${productId}`, 'PUT', beforeAdjustment)).status, 200);
    assert.equal((await call(`/transferencias/${partial.id}/despachar`, 'POST', {})).status, 409);
    assert.equal(
      await stock(a, origin),
      1,
      'Debe revertir el descuento del primer ítem si falla el segundo',
    );
    assert.equal((await call(`/transferencias/${partial.id}`)).body.estado, 'borrador');
    const [failedAudit] = await pool.execute(
      'SELECT id FROM movimientos_stock WHERE transferencia_id=?',
      [partial.id],
    );
    assert.equal(failedAudit.length, 0);
    await call(`/transferencias/${partial.id}/cancelar`, 'POST', {});
    const pending = await draft(origin, empty, [{ variante_id: a, cantidad: 1 }]);
    const locationBody = {
      nombre: `${prefix}-Vacío`,
      tipo: 'deposito',
      direccion: 'Temporal',
      activo: false,
    };
    assert.equal((await call(`/ubicaciones/${empty}`, 'PUT', locationBody)).status, 409);
    await call(`/transferencias/${pending.id}/cancelar`, 'POST', {});
    assert.equal((await call(`/ubicaciones/${empty}`, 'PUT', locationBody)).status, 200);
    assert.equal(
      (
        await call('/transferencias', 'POST', {
          origen_id: origin,
          destino_id: empty,
          items: [{ variante_id: a, cantidad: 1 }],
        })
      ).status,
      409,
    );
    assert.equal(
      (
        await call(`/ubicaciones/${destination}`, 'PUT', {
          ...locationBody,
          nombre: `${prefix}-Destino`,
        })
      ).status,
      409,
      'No desactivar con existencias',
    );
    await call(`/ubicaciones/${empty}`, 'PUT', { ...locationBody, activo: true });
    const final = await draft(origin, empty, [{ variante_id: a, cantidad: 1 }]);
    await call(`/transferencias/${final.id}/despachar`, 'POST', {});
    const inactive = (await call(`/productos/${productId}`)).body;
    inactive.activo = false;
    assert.equal((await call(`/productos/${productId}`, 'PUT', inactive)).status, 200);
    assert.equal(
      (await call(`/transferencias/${final.id}/recibir`, 'POST', {})).status,
      200,
      'Permitir recibir productos desactivados después del despacho',
    );
    assert.equal(await stock(a, empty), 1);
    assert.equal(await stock(a, origin), 0);
    assert.equal(await stock(a, destination), 6);
    const list = await call('/transferencias?estado=recibida');
    assert.equal(list.status, 200);
    assert.ok(list.body.items.some((t) => t.id === final.id));
    console.log(
      'Verificados: ubicaciones, altas, stock en tránsito, doble confirmación, despachos simultáneos, stock insuficiente, rollback, versiones y recepción de inactivos.',
    );
  } finally {
    for (const id of transfers) {
      await pool.execute('DELETE FROM movimientos_stock WHERE transferencia_id=?', [id]);
      await pool.execute('DELETE FROM transferencia_items WHERE transferencia_id=?', [id]);
      await pool.execute('DELETE FROM transferencias WHERE id=?', [id]);
    }
    for (const id of products) {
      await pool.execute(
        'DELETE m FROM movimientos_stock m JOIN variantes_producto v ON v.id=m.variante_id WHERE v.producto_id=?',
        [id],
      );
      await pool.execute(
        'DELETE e FROM existencias e JOIN variantes_producto v ON v.id=e.variante_id WHERE v.producto_id=?',
        [id],
      );
      await pool.execute('DELETE FROM variantes_producto WHERE producto_id=?', [id]);
      await pool.execute('DELETE FROM producto_imagenes WHERE producto_id=?', [id]);
      await pool.execute('DELETE FROM productos WHERE id=?', [id]);
    }
    for (const id of locations) await pool.execute('DELETE FROM ubicaciones WHERE id=?', [id]);
    if (userId) await pool.execute('DELETE FROM usuarios WHERE id=?', [userId]);
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
