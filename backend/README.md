# Base de datos local

## API Node y panel administrador

Requiere Node 24, npm y MySQL iniciado. Los comandos siguientes se ejecutan desde la raíz:

```powershell
npm --prefix backend ci
npm --prefix backend run db:migrate
npm --prefix backend run admin:create
npm --prefix backend run dev
```

Antes de iniciar, completar `JWT_SECRET` en `.env` con un valor aleatorio de al menos 32 caracteres. Para generarlo: `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`. Configurar también `ADMIN_EMAIL` y `ADMIN_PASSWORD` para crear la cuenta local (mínimo 8 caracteres, mayúscula, minúscula y número). `admin:create` se ejecuta una sola vez y rechaza un email existente sin cambiar sus datos. Nunca guardar `.env` en Git.

`db:migrate` agrega de forma idempotente la columna de versión a las bases creadas antes de la API. Las bases nuevas ya la incluyen. No vuelve a cargar el seed.

En otra terminal: `npm ci` y `npm start`. Abrir `http://127.0.0.1:4200/bienvenido/login`. El administrador se dirige al panel `/admin/productos`; los clientes, a la tienda. Angular redirige `/api` al puerto 3000 mediante `proxy.conf.json`; reiniciar `ng serve` si cambia ese archivo. No hace falta habilitar CORS. La API escucha solo en localhost.

En esta máquina MySQL se publica en **3307**, porque otra base ocupa 3306. La API lee el puerto real de `.env`.

### Endpoints

### Imágenes desde la computadora

El formulario permite elegir JPG, PNG o WebP de hasta 5 MB. La vista previa es local; al guardar se envía el archivo a `POST /api/admin/imagenes` (requiere administrador), usando el tipo de imagen como Content-Type y el archivo como cuerpo binario. El servidor valida y decodifica el contenido, aplica la orientación y lo convierte a WebP de hasta 1600 × 1600 píxeles, sin ampliar imágenes pequeñas ni conservar metadatos. Se rechazan entradas de más de 24 megapíxeles.

Los archivos se guardan en `backend/uploads/` con nombres aleatorios y se sirven mediante `/api/imagenes/<uuid>.webp`. La base conserva esa ruta en `imagen_url`; no hace falta cambiar el esquema. Angular utiliza el mismo proxy `/api` para mostrarlas. La carpeta está excluida de Git: debe conservarse y respaldarse junto con MySQL. Al compartir el proyecto, los archivos subidos no viajan con la rama.

Cambiar o quitar una imagen actualiza el producto al guardar. No borra archivos antiguos ni subidas cuyo producto no llegó a guardarse; la limpieza de archivos sin referencias queda para una tarea posterior. Se siguen mostrando las URLs externas guardadas anteriormente, pero el formulario ahora usa archivos locales.

| Método | Ruta | Acceso |
|---|---|---|
| GET | /api/health | Público |
| POST | /api/auth/registro | Público, siempre crea cliente |
| POST | /api/auth/login | Público |
| GET | /api/auth/me | Sesión válida |
| GET | /api/productos | Productos activos |
| GET | /api/productos/:id | Producto activo y variantes activas |
| GET | /api/admin/catalogos | Admin |
| GET | /api/admin/productos | Admin, incluye inactivos |
| GET | /api/admin/productos/:id | Admin |
| POST | /api/admin/productos | Admin |
| PUT | /api/admin/productos/:id | Admin; requiere versión vigente |

Las rutas protegidas usan `Authorization: Bearer <token>`. El token vence a las 8 horas y el backend consulta el usuario y su rol real en cada petición. La contraseña se guarda con bcrypt. Las rutas de autenticación limitan intentos. Las respuestas de error usan `{ mensaje, errores? }` sin exponer SQL ni credenciales.

Un producto enviado al API incluye `nombre`, `descripcion`, `categoria_id`, `precio`, `imagen_url`, `activo` y `variantes`. Cada variante incluye `talle_id`, `color_id`, `sku`, `activo` y `existencias: [{ ubicacion_id, cantidad }]`. Al editar se conservan `id` y `version` del producto y los `id` de las variantes existentes. No se puede cambiar el talle/color de una variante histórica ni omitirla para borrarla; se desactiva. Las existencias omitidas se conservan. Cada ajuste se registra junto al stock dentro de la misma transacción.

### Verificación

`npm --prefix backend test` prueba el API con la MySQL local: credenciales, permisos 401/403, rol del registro, email único, rechazo de datos inválidos, alta, ajuste con movimientos, rechazo de ediciones obsoletas, rollback ante SKU duplicado y ocultamiento de inactivos. Crea registros TEST-UUID y limpia solo esos registros al terminar. No ejecutar contra una base de producción. `npm run build` verifica Angular.

El panel incluye alta y edición, búsqueda, filtro por estado, resumen de existencias, imagen opcional y cantidades por ubicación. Los catálogos se consultan desde MySQL; su mantenimiento y las pantallas de transferencias quedan para otra etapa. Perfil, carrito y checkout conservan las implementaciones previas del grupo y todavía necesitan integración real. El stock mostrado es físico de ubicaciones activas; no implementa reservas de compra.

Desde la raíz del repositorio, con Docker Desktop iniciado:

```powershell
Copy-Item .env.example .env
docker compose up -d mysql
docker compose ps
```

Copiar `.env` solamente si no existe. Las credenciales de ejemplo son para desarrollo local; pueden cambiarse antes del primer inicio. El puerto se publica solamente en localhost. Si 3306 está ocupado, cambiar MYSQL_PORT en `.env`.

Los archivos `sql/001-schema.sql` y `sql/002-seed.sql` se ejecutan automáticamente al inicializar un volumen vacío. Reiniciar el contenedor no vuelve a ejecutar estos scripts ni borra datos. Para cambios posteriores del esquema se deben agregar migraciones; editar un script inicial no modifica una base ya creada.

Conexión desde Workbench u otro cliente:

- Host: `127.0.0.1`
- Puerto: el valor de MYSQL_PORT (3306 por defecto)
- Base, usuario y contraseña: valores de `.env`

Para abrir la consola sin escribir la contraseña en el comando:

```powershell
docker compose exec mysql mysql -u tienda_app -p tienda_ropa
```

Si cambiaron el usuario o la base, ajustar esos argumentos. Para detener conservando datos: `docker compose stop`. No eliminar el volumen si se quieren conservar los productos cargados.

## Modelo y alcance

`productos` contiene la información comercial y el precio en pesos argentinos. `variantes_producto` identifica cada combinación de talle y color con un SKU único. Todas las variantes de un producto comparten el precio en esta primera versión.

`existencias` guarda el stock de una variante en una ubicación. El stock de un producto se calcula sumando sus variantes y las ubicaciones habilitadas para la operación. No se duplica en productos. Una tienda futura se agrega a `ubicaciones`, sin duplicar el catálogo.

Se incluyen usuarios y pedidos para integrar el trabajo del equipo. El email es único sin distinguir mayúsculas y la contraseña se guarda como hash generado por el backend. No se crea una cuenta administradora de ejemplo. El alta pública deberá asignar siempre el rol cliente, sin aceptar un rol enviado por el navegador.

Los pedidos conservan precio unitario y dirección de entrega. El carrito y la autenticación todavía no están implementados por estos scripts.

## Reglas que deberá implementar el backend

- Crear producto, variantes, existencias iniciales y movimientos dentro de una misma transacción.
- Toda modificación de existencias debe registrar un movimiento en la misma transacción. La tabla de movimientos es un historial; insertar un movimiento por sí solo no cambia existencias.
- Usar consultas parametrizadas y bloquear las existencias afectadas con `SELECT ... FOR UPDATE` para evitar ventas o transferencias simultáneas sobre el mismo stock. Mantener un orden consistente de bloqueo.
- Al despachar una transferencia, descontar origen y registrar movimientos negativos. Al recibir, sumar destino y registrar movimientos positivos. Crear la fila de existencias del destino si no existe.
- Permitir borrador → en_transito → recibida. Cancelar directamente solo un borrador; una devolución de mercadería despachada requiere una operación explícita con sus movimientos. Evitar procesar dos veces un despacho o recepción comprobando el estado bajo bloqueo.
- Rechazar transferencias vacías y referencias a productos, variantes o ubicaciones inactivos. Las restricciones SQL no sustituyen estas reglas.
- Usar bajas lógicas para conservar referencias históricas. El backend debe verificar el rol administrador para toda escritura administrativa.

## Datos de ejemplo y consulta

Tres productos, ocho variantes, un depósito y 52 unidades totales. Una variante tiene stock cero para probar agotados. No se cargan transferencias ficticias ni usuarios con contraseñas compartidas.

```sql
SELECT p.nombre, v.sku, t.nombre AS talle, c.nombre AS color,
       u.nombre AS ubicacion, e.cantidad, p.precio
FROM productos p
JOIN variantes_producto v ON v.producto_id = p.id
JOIN talles t ON t.id = v.talle_id
JOIN colores c ON c.id = v.color_id
JOIN existencias e ON e.variante_id = v.id
JOIN ubicaciones u ON u.id = e.ubicacion_id
ORDER BY p.id, v.id;
```

Para una instalación MySQL 8.4 sin Docker, crear una base UTF-8 y ejecutar primero `001-schema.sql` y después `002-seed.sql` sobre esa base. No ejecutar el seed sobre datos existentes.
