import { app } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';

await pool.execute('SELECT 1');
const server = app.listen(config.port, config.host, () =>
  console.log(`API disponible en http://${config.host}:${config.port}/api`),
);
const close = () =>
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
process.on('SIGINT', close);
process.on('SIGTERM', close);
