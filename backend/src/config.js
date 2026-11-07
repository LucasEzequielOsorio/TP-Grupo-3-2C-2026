import { loadEnvFile } from 'node:process';
import { fileURLToPath } from 'node:url';

try {
  loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)));
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}

export const config = {
  host: '127.0.0.1',
  port: Number(process.env.API_PORT || 3000),
  jwtSecret: process.env.JWT_SECRET,
};
if (!config.jwtSecret || config.jwtSecret.length < 32) {
  throw new Error('Definir JWT_SECRET con al menos 32 caracteres en .env');
}
