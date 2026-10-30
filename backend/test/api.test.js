import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { app } from '../src/app.js';
import { pool } from '../src/db.js';
import sharp from 'sharp';
import { unlink } from 'node:fs/promises';

// Prueba de integración local: solo crea y limpia sus propios registros TEST-UUID.
test('API: autorización, alta, edición, concurrencia y rollback', async () => {
  const prefix = `TEST-${randomUUID()}`;
  const emails = [
    `${prefix}-admin@example.invalid`,
    `${prefix}-cliente@example.invalid`,
    `${prefix}-registro@example.invalid`,
  ];
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  const uploadedFilenames = [];
  const catalogFixtures = [];
  let testLocation;
  async function request(path, { token, method = 'GET', body } = {}) {
    const response = await fetch(base + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: response.status, body: await response.json() };
  }
  try {
    const password = 'TestPassword2026!';
    const hash = await bcrypt.hash(password, 4);
    for (const [index, rol] of ['admin', 'cliente'].entries())
      await pool.execute(
        'INSERT INTO usuarios (email, password_hash, nombre, apellido, direccion, rol) VALUES (?, ?, ?, ?, ?, ?)',
        [emails[index], hash, 'Test', 'Temporal', 'Dirección de prueba', rol],
      );
    assert.equal((await request('/admin/productos')).status, 401);
    assert.equal(
      (
        await request('/auth/login', {
          method: 'POST',
          body: { email: emails[0], password: 'incorrecta' },
        })
      ).status,
      401,
    );
    const login = await request('/auth/login', {
      method: 'POST',
      body: { email: emails[0], password },
    });
    assert.equal(login.status, 200);
    const token = login.body.token;
    async function upload(body, uploadToken = token, type = 'image/png') {
      return fetch(base + '/admin/imagenes', {
        method: 'POST',
        headers: {
          'Content-Type': type,
          ...(uploadToken ? { Authorization: `Bearer ${uploadToken}` } : {}),
        },
        body,
      });
    }
    const png = await sharp({ create: { width: 3, height: 3, channels: 3, background: '#284d3e' } })
      .png()
      .toBuffer();
    assert.equal((await upload(png, '')).status, 401);
    assert.equal((await upload(Buffer.from('archivo falso'))).status, 400);
    assert.equal((await upload(Buffer.alloc(5 * 1024 * 1024 + 1))).status, 413);
    assert.equal((await upload(Buffer.from('<svg></svg>'), token, 'image/svg+xml')).status, 400);
    const uploaded = await upload(png);
    assert.equal(uploaded.status, 201);
    const imageUrl = (await uploaded.json()).imagen_url;
    assert.match(imageUrl, /^\/api\/imagenes\/[a-f0-9-]{36}\.webp$/);
    uploadedFilenames.push(imageUrl.split('/').at(-1));
    const secondUpload = await upload(png);
    const imageUrl2 = (await secondUpload.json()).imagen_url;
    uploadedFilenames.push(imageUrl2.split('/').at(-1));
    const served = await fetch(base.replace(/\/api$/, '') + imageUrl);
    assert.equal(served.status, 200);
    assert.match(served.headers.get('content-type'), /image\/webp/);
    assert.equal((await sharp(Buffer.from(await served.arrayBuffer())).metadata()).width, 3);
    const client = await request('/auth/login', {
      method: 'POST',
      body: { email: emails[1], password },
    });
    assert.equal((await request('/admin/productos', { token: client.body.token })).status, 403);
    for (const path of ['/admin/stock-alertas', '/admin/movimientos']) {
      assert.equal((await request(path)).status, 401);
      assert.equal((await request(path, { token: client.body.token })).status, 403);
    }
    for (const type of ['categorias', 'talles', 'colores']) {
      const body = {
        nombre: `QA-${prefix.slice(-10)}`,
        ...(type === 'talles' ? { orden: 99 } : {}),
        ...(type === 'colores' ? { hexadecimal: '#123456' } : {}),
      };
      assert.equal(
        (
          await request(`/admin/catalogos/${type}`, {
            method: 'POST',
            token: client.body.token,
            body,
          })
        ).status,
        403,
      );
      const created = await request(`/admin/catalogos/${type}`, { method: 'POST', token, body });
      assert.equal(created.status, 201);
      catalogFixtures.push({ type, id: created.body.id });
      assert.equal(
        (await request(`/admin/catalogos/${type}`, { method: 'POST', token, body })).status,
        409,
      );
      assert.equal(
        (
          await request(`/admin/catalogos/${type}/${created.body.id}`, {
            method: 'PUT',
            token,
            body: { ...body, nombre: `QB-${prefix.slice(-10)}` },
          })
        ).status,
        200,
      );
    }
    assert.equal(
      (
        await request('/admin/catalogos/usuarios', {
          method: 'POST',
          token,
          body: { nombre: 'No permitido' },
        })
      ).status,
      404,
    );
    assert.equal(
      (
        await request('/admin/catalogos/colores', {
          method: 'POST',
          token,
          body: { nombre: 'Inválido', hexadecimal: 'rojo' },
        })
      ).status,
      400,
    );
    const [location] = await pool.execute(
      "INSERT INTO ubicaciones (nombre,tipo,direccion) VALUES (?, 'deposito', 'Test temporal')",
      [prefix],
    );
    testLocation = location.insertId;
    const registered = {
      email: emails[2],
      password,
      nombre: 'Test',
      apellido: 'Registro',
      direccion: 'Temporal',
      rol: 'admin',
    };
    const signup = await request('/auth/registro', { method: 'POST', body: registered });
    assert.equal(signup.status, 201);
    assert.equal(signup.body.usuario.rol, 'cliente');
    assert.equal(
      (await request('/auth/registro', { method: 'POST', body: registered })).status,
      409,
    );
    assert.equal(
      (
        await request('/auth/registro', {
          method: 'POST',
          body: { ...registered, password: 'simple' },
        })
      ).status,
      400,
    );

    const catalogs = (await request('/admin/catalogos', { token })).body;
    const product = {
      nombre: prefix,
      descripcion: 'Prenda temporal de integración',
      categoria_id: catalogs.categorias[0].id,
      precio: 19999.9,
      imagen_url: imageUrl,
      imagenes: [imageUrl, imageUrl2],
      activo: true,
      variantes: [
        {
          talle_id: catalogs.talles[0].id,
          color_id: catalogs.colores[0].id,
          sku: `${prefix}-A`,
          activo: true,
          stock_minimo: 5,
          existencias: [{ ubicacion_id: catalogs.ubicaciones[0].id, cantidad: 5 }],
        },
      ],
    };
    assert.equal(
      (
        await request('/admin/productos', {
          token,
          method: 'POST',
          body: { ...product, precio: -1 },
        })
      ).status,
      400,
    );
    const negative = structuredClone(product);
    negative.variantes[0].existencias[0].cantidad = -1;
    assert.equal(
      (await request('/admin/productos', { token, method: 'POST', body: negative })).status,
      400,
    );
    const create = await request('/admin/productos', { token, method: 'POST', body: product });
    assert.equal(create.status, 201);
    assert.equal(create.body.imagen_url, imageUrl);
    assert.equal(create.body.stock, 5);
    assert.deepEqual(create.body.imagenes, [imageUrl, imageUrl2]);
    assert.deepEqual((await request(`/productos/${create.body.id}`)).body.imagenes, [
      imageUrl,
      imageUrl2,
    ]);
    const initialAlerts = await request('/admin/stock-alertas', { token });
    assert.equal(initialAlerts.status, 200);
    assert.ok(
      initialAlerts.body.some(
        (a) => a.variante_id === create.body.variantes[0].id && a.cantidad === 5,
      ),
    );
    const missingStock = await request(`/admin/stock-alertas?ubicacion_id=${testLocation}`, {
      token,
    });
    assert.ok(
      missingStock.body.some(
        (a) => a.variante_id === create.body.variantes[0].id && a.cantidad === 0,
      ),
    );
    assert.equal(
      (
        await request('/admin/productos', {
          token,
          method: 'POST',
          body: { ...product, imagenes: Array(9).fill(imageUrl) },
        })
      ).status,
      400,
    );
    const id = create.body.id;
    const update = structuredClone(create.body);
    update.precio = 24000;
    update.imagenes = [imageUrl2, imageUrl];
    update.variantes[0].existencias[0].cantidad = 8;
    const saved = await request(`/admin/productos/${id}`, { token, method: 'PUT', body: update });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.stock, 8);
    assert.equal(saved.body.precio, 24000);
    assert.equal(saved.body.imagen_url, imageUrl2);
    assert.deepEqual(saved.body.imagenes, [imageUrl2, imageUrl]);
    const updatedAlerts = (
      await request(`/admin/stock-alertas?ubicacion_id=${catalogs.ubicaciones[0].id}`, { token })
    ).body;
    assert.equal(
      updatedAlerts.some((a) => a.variante_id === saved.body.variantes[0].id),
      false,
    );
    const history = await request(`/admin/movimientos?producto_id=${id}&motivo=ajuste`, { token });
    assert.equal(history.status, 200);
    assert.equal(history.body.total, 1);
    assert.equal(history.body.items[0].cantidad, 3);
    assert.equal(history.body.items[0].usuario, 'Test Temporal');
    assert.equal((await request('/admin/movimientos?pagina=0', { token })).status, 400);
    // Fuerza una segunda página con datos exclusivos de esta prueba.
    for (let index = 0; index < 31; index++)
      await pool.execute(
        "INSERT INTO movimientos_stock (variante_id,ubicacion_id,cantidad,motivo,usuario_id,observacion) SELECT ?,?,1,'ajuste',id,'Paginación de prueba' FROM usuarios WHERE email=?",
        [saved.body.variantes[0].id, catalogs.ubicaciones[0].id, emails[0]],
      );
    await pool.execute(
      'UPDATE existencias SET cantidad=cantidad+31 WHERE variante_id=? AND ubicacion_id=?',
      [saved.body.variantes[0].id, catalogs.ubicaciones[0].id],
    );
    const pageOne = (await request(`/admin/movimientos?producto_id=${id}&pagina=1`, { token }))
      .body;
    const pageTwo = (await request(`/admin/movimientos?producto_id=${id}&pagina=2`, { token }))
      .body;
    assert.equal(pageOne.items.length, 30);
    assert.equal(pageTwo.items.length, 3);
    assert.equal(pageTwo.paginas, 2);
    assert.equal(
      pageTwo.items.some((item) => pageOne.items.some((first) => first.id === item.id)),
      false,
    );
    assert.equal(
      (await request(`/admin/productos/${id}`, { token, method: 'PUT', body: update })).status,
      409,
    );
    const [movements] = await pool.execute(
      'SELECT cantidad, motivo FROM movimientos_stock WHERE variante_id = ? ORDER BY id',
      [saved.body.variantes[0].id],
    );
    assert.deepEqual(
      movements.map((m) => [m.cantidad, m.motivo]),
      [
        [5, 'inicial'],
        [3, 'ajuste'],
        ...Array.from({ length: 31 }, () => [1, 'ajuste']),
      ],
    );
    // La duplicación de SKU falla después de insertar el producto: debe revertirlo entero.
    const duplicate = await request('/admin/productos', {
      token,
      method: 'POST',
      body: { ...product, nombre: `${prefix}-rollback` },
    });
    assert.equal(duplicate.status, 409);
    const [rolledBack] = await pool.execute('SELECT id FROM productos WHERE nombre = ?', [
      `${prefix}-rollback`,
    ]);
    assert.equal(rolledBack.length, 0);
    saved.body.activo = false;
    saved.body.imagenes = [];
    assert.equal(
      (await request(`/admin/productos/${id}`, { token, method: 'PUT', body: saved.body })).status,
      200,
    );
    assert.equal((await request(`/productos/${id}`)).status, 404);
    assert.deepEqual((await request(`/admin/productos/${id}`, { token })).body.imagenes, []);
    assert.equal(
      (await request('/admin/stock-alertas', { token })).body.some((a) => a.producto_id === id),
      false,
    );
    assert.equal(
      (await request('/productos')).body.some((p) => p.id === id),
      false,
    );
    console.log(
      'Verificados: permisos, registro, catálogos, alertas por ubicación, mínimos, historial paginado, galería/portada, edición obsoleta y rollback.',
    );
  } finally {
    for (const filename of uploadedFilenames)
      await unlink(new URL(`../uploads/${filename}`, import.meta.url));
    // Se borran exclusivamente las filas temporales generadas por este test.
    const [products] = await pool.execute('SELECT id FROM productos WHERE nombre LIKE ?', [
      `${prefix}%`,
    ]);
    for (const p of products) {
      await pool.execute(
        'DELETE m FROM movimientos_stock m JOIN variantes_producto v ON v.id = m.variante_id WHERE v.producto_id = ?',
        [p.id],
      );
      await pool.execute(
        'DELETE e FROM existencias e JOIN variantes_producto v ON v.id = e.variante_id WHERE v.producto_id = ?',
        [p.id],
      );
      await pool.execute('DELETE FROM variantes_producto WHERE producto_id = ?', [p.id]);
      await pool.execute('DELETE FROM producto_imagenes WHERE producto_id = ?', [p.id]);
      await pool.execute('DELETE FROM productos WHERE id = ?', [p.id]);
    }
    for (const email of emails) await pool.execute('DELETE FROM usuarios WHERE email = ?', [email]);
    for (const item of catalogFixtures)
      await pool.execute(`DELETE FROM ${item.type} WHERE id=?`, [item.id]);
    if (testLocation) await pool.execute('DELETE FROM ubicaciones WHERE id=?', [testLocation]);
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
});
