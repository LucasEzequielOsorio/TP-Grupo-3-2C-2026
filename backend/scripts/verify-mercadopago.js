import '../src/config.js';
const names = ['MP_ACCESS_TOKEN', 'MP_WEBHOOK_SECRET', 'MP_NOTIFICATION_URL', 'MP_BACK_URL'];
const missing = names.filter((name) => !process.env[name]);
if (missing.length) {
  console.error('Completar en .env: ' + missing.join(', '));
  process.exitCode = 1;
} else {
  try {
    const r = await fetch('https://api.mercadopago.com/users/me', {
      headers: { Authorization: 'Bearer ' + process.env.MP_ACCESS_TOKEN },
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) throw new Error('Mercado Pago rechazó la credencial de acceso.');
    const me = await r.json();
    if (!me.tags?.includes('test_user'))
      throw new Error(
        'La credencial debe pertenecer a un vendedor de prueba; no se habilitan cobros reales.',
      );
    console.log('Credencial de vendedor de prueba correcta. MP_COLLECTOR_ID=' + String(me.id));
    if (process.env.MP_COLLECTOR_ID !== String(me.id))
      throw new Error('Completar MP_COLLECTOR_ID en .env con el ID indicado arriba.');
    for (const name of ['MP_NOTIFICATION_URL', 'MP_BACK_URL']) {
      const u = new URL(process.env[name]);
      if (
        u.protocol !== 'https:' ||
        ['127.0.0.1', 'localhost'].includes(u.hostname) ||
        u.username ||
        u.password
      )
        throw new Error(name + ' debe ser una URL HTTPS pública.');
    }
    console.log(
      'Configuración de pagos preparada. Falta verificar una compra de prueba y la notificación firmada desde Mercado Pago.',
    );
  } catch (e) {
    console.error(
      e.message === 'fetch failed' ? 'No se pudo conectar con Mercado Pago.' : e.message,
    );
    process.exitCode = 1;
  }
}
