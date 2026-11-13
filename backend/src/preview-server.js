// Sirve únicamente el build público de Angular; nunca archivos del repositorio.
process.env.SERVE_FRONTEND = 'true';
await import('./server.js');
