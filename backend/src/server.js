import { app } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';
import { startAccountMailWorker } from './recovery.js';
import { paymentService } from './payments.js';

await pool.execute('SELECT 1');
const server = app.listen(config.port, config.host);
await new Promise((resolve, reject) => {
  server.once('listening', resolve);
  server.once('error', reject);
});
console.log(`API disponible en http://${config.host}:${config.port}/api`);
console.log(
  `SMTP activo: ${process.env.SMTP_HOST || '127.0.0.1'}:${process.env.SMTP_PORT || '1025'}`,
);
const stopMailWorker = startAccountMailWorker();
const stopPaymentWorker = paymentService.startWorker();
const close = () =>
  server.close(async () => {
    await stopMailWorker();
    await stopPaymentWorker();
    await pool.end();
    process.exit(0);
  });
process.on('SIGINT', close);
process.on('SIGTERM', close);
