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

Cada foto puede asociarse a un color del producto desde el selector **Color de la foto**, o conservarse como **General · todos los colores**. La tienda prioriza las fotos del color elegido y agrega después las generales; nunca usa fotos exclusivas de otro color como reemplazo. Si no hay fotos propias ni generales, muestra la imagen de referencia vacía. El talle no duplica fotografías.

Para instalaciones existentes ejecutar `npm --prefix backend run db:migrate`: agrega `producto_imagenes.color_id` con referencia a `colores`; las imágenes previas conservan `NULL` (generales). La API incorpora `fotos: [{ url, color_id: number | null }]` en el detalle y acepta ese formato en alta/edición. Solo admite colores presentes en las variantes del producto. Mantiene `imagenes` como arreglo de URLs para clientes anteriores; reordenar esas URLs conserva sus asociaciones existentes. Si se envían ambos formatos, `fotos` es el que determina la galería y la portada.

El formulario permite elegir JPG, PNG o WebP de hasta 5 MB. La vista previa es local; al guardar se envía el archivo a `POST /api/admin/imagenes` (requiere administrador), usando el tipo de imagen como Content-Type y el archivo como cuerpo binario. El servidor valida y decodifica el contenido, aplica la orientación y lo convierte a WebP de hasta 1600 × 1600 píxeles, sin ampliar imágenes pequeñas ni conservar metadatos. Se rechazan entradas de más de 24 megapíxeles.

Los archivos se guardan en `backend/uploads/` con nombres aleatorios y se sirven mediante `/api/imagenes/<uuid>.webp`. La base conserva las fotos en `producto_imagenes`; `productos.imagen_url` refleja la primera como portada para mantener compatibilidad. Angular utiliza el mismo proxy `/api` para mostrarlas. La carpeta está excluida de Git: debe conservarse y respaldarse junto con MySQL. Al compartir el proyecto, los archivos subidos no viajan con la rama.

Cambiar o quitar una imagen actualiza el producto al guardar. No borra archivos antiguos ni subidas cuyo producto no llegó a guardarse; la limpieza de archivos sin referencias queda para una tarea posterior. Se siguen mostrando las URLs externas guardadas anteriormente, pero el formulario ahora usa archivos locales.

| Método | Ruta | Acceso |
|---|---|---|
| GET | /api/health | Público |
| POST | /api/auth/registro | Público, siempre crea cliente |
| POST | /api/auth/login | Público |
| POST | /api/auth/recuperar | Público, respuesta neutra y límite de solicitudes |
| POST | /api/auth/verificar-recuperacion | Comprueba vigencia del token sin consumirlo |
| POST | /api/auth/restablecer | Público, requiere enlace válido de un solo uso |
| GET | /api/auth/me | Sesión válida |
| GET | /api/auth/cuenta | Datos personales propios, cliente o admin |
| PUT | /api/auth/cuenta | Edición de la cuenta autenticada |
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

El panel incluye alta y edición, búsqueda, filtro por estado, resumen de existencias y cantidades por ubicación. El carrito, los pedidos, Mi cuenta y las reservas están integrados con MySQL. Checkout Pro está preparado para pruebas, pendiente de credenciales y HTTPS. Administración conserva stock físico y la tienda muestra disponibilidad descontando reservas.

## Depósitos, tiendas y transferencias

### Motivos de ajustes y resumen por ubicación

Ejecutar `npm --prefix backend run db:migrate` antes de iniciar esta versión en una instalación existente. Agrega `movimientos_stock.causa_ajuste` sin reescribir el historial anterior. Las bases nuevas ya incluyen el campo en `001-schema.sql`.

Al modificar cantidades de un producto existente, el cuerpo debe incluir `ajuste_stock: { motivo, observacion }`. Los motivos admitidos son `conteo_fisico`, `mercaderia_danada`, `ingreso_mercaderia`, `devolucion_cliente` y `otro`. La observación tiene hasta 255 caracteres y es obligatoria para `otro`. El motivo aplica a todas las diferencias de esa operación; queda guardado por separado del tipo general `ajuste` y de la observación libre en cada movimiento.

Daño solo permite descontar; ingreso y devolución solo sumar. Conteo físico y Otro permiten corregir en ambos sentidos. Si cambia más de una variante y alguna no respeta el motivo, se revierte toda la transacción. Editar nombre, precio, imagen, mínimos o visibilidad sin cambiar cantidades no requiere motivo ni genera movimientos. Las existencias iniciales de un producto nuevo se registran como `carga_inicial`. Agregar stock a una variante o ubicación de un producto ya existente sí requiere motivo. Los traslados entre ubicaciones deben usar Transferencias.

El formulario muestra el antes/después y solicita el motivo solo cuando hay cambios de cantidad. El historial muestra la causa y la observación; los registros viejos conservan sus textos originales, sin atribuirles causas ficticias.

Desde el nombre de una ubicación se abre `/admin/ubicaciones/:id`: inventario completo, prendas y variantes con stock, unidades físicas, alertas y unidades entrando/saliendo en tránsito. Los totales físicos incluyen productos y variantes inactivos; las alertas solo consideran prendas y variantes activas de una ubicación activa. Las unidades en tránsito se muestran aparte. La tabla incluye el catálogo sin existencias como stock cero y permite buscar por nombre, SKU, talle o color y filtrar con stock, bajo, agotado o inactivo.

API de solo lectura: `GET /api/admin/ubicaciones/:id/resumen?pagina=1&buscar=…&estado=todos`. Admite estados `todos`, `con_stock`, `bajo`, `agotado`, `inactivos`; devuelve ubicación, indicadores y una página de 30 variantes. Los indicadores siempre corresponden al depósito completo, no a la búsqueda. Ubicación, totales y filas se consultan desde una misma instantánea de datos. El enlace de movimientos aplica el filtro de ubicación automáticamente.

Desde `/admin/ubicaciones` un administrador puede crear y editar depósitos o tiendas, indicar su dirección y activarlos/desactivarlos. No se borran ubicaciones históricas. Una ubicación nueva comienza sin existencias; no se inventan unidades al crearla. Aparece automáticamente en el formulario de productos, los filtros y los destinos de transferencias.

No se permite desactivar una ubicación con unidades físicas (incluso de variantes inactivas) ni con transferencias en borrador o en tránsito. Para cerrarla, primero completar o cancelar los traslados pendientes y retirar su stock. Las ubicaciones inactivas se conservan en el historial pero no se ofrecen como origen/destino.

Desde `/admin/transferencias` se eligen origen, destino y variantes con stock disponible. El administrador puede buscar por producto, SKU, talle o color e indicar cantidades enteras positivas. El circuito es:

1. **Crear borrador:** valida los datos y las existencias actuales; no reserva ni modifica stock. No se admite repetir variantes, usar el mismo origen/destino ni enviar un borrador vacío.
2. **Despachar:** vuelve a verificar todas las existencias, descuenta del origen y registra movimientos negativos. Queda en tránsito y todavía no suma al destino.
3. **Recibir:** suma al destino (crea la fila de existencias si hace falta), registra los movimientos positivos y marca la transferencia recibida. La recepción se confirma para todos los ítems juntos; no hay recepciones parciales.
4. **Cancelar:** solo para borradores y sin modificar stock. Una transferencia despachada se debe recibir; si hay que devolverla se crea otra en sentido contrario.

Cada operación usa una transacción y bloquea los recursos en un orden estable. Dos despachos simultáneos no pueden gastar las mismas unidades; confirmar dos veces no duplica descuentos ni ingresos (la segunda petición responde 409). Si falla un ítem, se revierte toda la operación. Despacho y recepción incrementan la versión de cada producto afectado, para rechazar formularios viejos que intentarían sobrescribir el nuevo stock.

Si una prenda se desactiva después del despacho, se permite recibirla para que la mercadería no quede varada. El usuario que confirma cada paso se conserva en sus movimientos. Las unidades en tránsito no se incluyen en el stock disponible de la tienda. Las reservas de pedidos se excluyen de las cantidades que se pueden despachar.

API (solo administrador):

| Método | Ruta | Función |
|---|---|---|
| GET / POST | /api/admin/ubicaciones | Listar / crear ubicaciones |
| PUT | /api/admin/ubicaciones/:id | Editar nombre, tipo, dirección y estado |
| GET | /api/admin/ubicaciones/:id/stock | Variantes activas disponibles en el origen |
| GET / POST | /api/admin/transferencias | Listar con filtro de estado y página / crear borrador |
| GET | /api/admin/transferencias/:id | Detalle, variantes, fechas y estado |
| POST | /api/admin/transferencias/:id/despachar | Descontar origen y pasar a tránsito |
| POST | /api/admin/transferencias/:id/recibir | Sumar destino y completar |
| POST | /api/admin/transferencias/:id/cancelar | Cancelar un borrador |

Ubicación: `{ nombre, tipo: 'deposito' | 'tienda', direccion, activo }`. Borrador: `{ origen_id, destino_id, items: [{ variante_id, cantidad }] }`. El listado acepta `estado` y `pagina` y devuelve 20 filas por página. Las tablas ya existían; esta funcionalidad no requiere una migración adicional.

`npm --prefix backend test` incluye pruebas de transferencias con datos temporales: estados, saldos, doble confirmación, despachos simultáneos, rollback por falta de stock en un ítem, cambios de versión y restricciones al cerrar depósitos. Limpia exclusivamente sus usuarios, ubicaciones, productos y transferencias de prueba.

## Mejoras de administración

Ejecutar `npm --prefix backend run db:migrate` sobre instalaciones existentes antes de iniciar la nueva API. Es idempotente, agrega `variantes_producto.stock_minimo` (3 por defecto), crea `producto_imagenes` y conserva las fotos anteriores. Las instalaciones nuevas ejecutan los scripts SQL por orden mediante Docker. No se borran datos ni se requiere reiniciar el volumen.

- `/admin/alertas`: variantes activas de productos activos cuyo stock por ubicación activa es menor o igual a su mínimo. Una combinación sin fila de existencias se considera cero. El mínimo se edita en cada variante y se aplica a todas sus ubicaciones; un mínimo cero sigue avisando agotados.
- `/admin/movimientos`: historial con filtros por producto/SKU, ubicación y motivo, y paginación de 30 registros. Muestra fecha local, unidades con signo y responsable. Los movimientos iniciales sin usuario se atribuyen a Sistema. Desde la edición se puede abrir el historial filtrado por producto. Se consulta el historial, no se permite reescribirlo.
- `/admin/catalogos`: alta y edición de categorías, talles (incluye orden) y colores (muestra hexadecimal). Se valida unicidad de nombres en MySQL; no se borran registros referenciados. Renombrar actualiza su presentación en el catálogo y el historial.
- Galería: hasta 8 fotos por producto, selección múltiple, eliminación y elección de portada. El detalle público permite cambiar de foto. El cuerpo de alta/edición puede incluir `imagenes: [url1, url2]`; la primera determina `imagen_url`. Un arreglo vacío quita todas las fotos. Las fotos se guardan dentro de la misma transacción del producto. Se conservan los archivos locales antiguos para evitar romper referencias.
- Formularios: aviso ante navegación con cambios sin guardar y protección al cerrar o recargar la pestaña. Volver a los valores originales elimina el aviso; guardar correctamente también. Mientras hay un guardado en curso no se abandona el formulario mediante navegación Angular.

API adicional (requiere administrador): `GET /api/admin/stock-alertas?ubicacion_id=…`, `GET /api/admin/movimientos?pagina=1&buscar=…&motivo=ajuste&producto_id=…&ubicacion_id=…`, `POST /api/admin/catalogos/:tipo` y `PUT /api/admin/catalogos/:tipo/:id`. Los tipos admitidos son `categorias`, `talles` y `colores`. Los filtros no especificados se omiten. Los mínimos son enteros no negativos. Los registros de prueba se limpian, incluidas sus galerías y catálogos temporales.

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

Los pedidos confirmados conservan precio unitario, dirección de entrega y una copia del nombre, talle y color. La autenticación, el carrito y la confirmación están implementados en la API.

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

Para una instalación MySQL 8.4 sin Docker, crear una base UTF-8 y ejecutar los scripts SQL numerados del 001 al 007 en orden sobre esa base. No ejecutar el seed sobre datos existentes.

## Carrito y detalle del pedido

En bases existentes ejecutar `node backend/scripts/migrate.js` desde la raíz. La migración agrega `carrito_items` sin borrar datos.

- `GET /api/carrito`: items y total calculados con precios actuales, fotos por color y disponibilidad de ubicaciones activas.
- `POST /api/carrito/items/:varianteId` con `{ "cantidad": 2 }`: acumula unidades de esa variante.
- `PUT /api/carrito/items/:varianteId` con `{ "cantidad": 1 }`: reemplaza la cantidad.
- `DELETE /api/carrito/items/:varianteId`: elimina esa combinación.

Todas las rutas requieren Bearer token y obtienen el usuario de la sesión. Cantidad entera entre 1 y 999, sin superar disponibilidad. Los cambios del mismo carrito se serializan bajo bloqueo de usuario. Agregar al carrito no reserva ni descuenta stock; precios y disponibilidad se actualizan al consultarlo. Las prendas desactivadas permanecen visibles en el carrito como no disponibles para poder eliminarlas.

Pruebas: `node --test backend/test/cart.test.js` (MySQL local iniciado y migraciones aplicadas).

## Confirmación e historial de pedidos

Ejecutar `node backend/scripts/migrate.js` desde la raíz para agregar las tablas auxiliares de `005-pedidos.sql` en bases existentes.

- `GET /api/pedidos/entrega`: dirección de la cuenta autenticada para revisión previa.
- `POST /api/pedidos`: `{ clave: UUID, items: [{ variante_id, cantidad, precio }] }`. El precio enviado solo comprueba que el usuario revisó el valor actual; se cobra el precio obtenido de productos. Máximo 100 combinaciones.
- `GET /api/pedidos`: últimos 100 pedidos propios, del más reciente al más antiguo.
- `GET /api/pedidos/:id`: detalle propio con precios y datos históricos; un pedido ajeno responde 404.

Crear un pedido bloquea usuario, productos, variantes, ubicaciones y existencias en orden estable. Valida carrito, precios, estado activo y disponibilidad; guarda pedido e ítems, reserva stock, incrementa versiones y vacía el carrito dentro de una transacción. Todavía no registra una venta ni descuenta stock físico. La baja y los movimientos se realizan al verificar un pago aprobado. Si cambia un precio o falta stock, responde 409 sin confirmar parcialmente. Reintentar la misma clave devuelve el mismo pedido, incluso si se perdió la primera respuesta.

Abastecimiento básico: reserva en ubicaciones activas por orden de id y puede repartir una prenda entre varias ubicaciones. Las unidades en tránsito no se venden. La dirección es la registrada al crear el pedido. Mercado Pago se integra en modo de pruebas; no se implementan gestión de envíos ni devoluciones de dinero automáticas.

Pruebas: `node --test backend/test/orders.test.js`, con datos temporales propios y limpieza al finalizar.

## Mi cuenta

Disponible para clientes y administradores en /perfil/mi-cuenta. GET /api/auth/cuenta devuelve nombre, apellido, email, dirección y rol; nunca hashes ni contraseñas. PUT /api/auth/cuenta acepta email, nombre, apellido, direccion y, opcionalmente, password_actual y password_nueva. No acepta cambiar id, rol ni estado activo.

Cambiar email o contraseña requiere verificar password_actual. El email permanece único; la nueva contraseña usa las mismas reglas del registro y bcrypt. Los cambios se realizan juntos en una transacción: si el email está ocupado o falla la validación, no se modifica ningún dato. Se limita la cantidad de intentos de edición.

Ejecutar node backend/scripts/migrate.js en bases existentes para agregar usuarios.auth_version. Al cambiar email o contraseña se incrementa esta versión, se emite un nuevo token para la sesión actual y los tokens anteriores dejan de ser válidos. La API verifica la versión contra MySQL en cada solicitud autenticada. Editar nombre o dirección no invalida otras sesiones.

Las modificaciones de dirección se aplican a los pedidos futuros. Los pedidos confirmados conservan su dirección y datos históricos. La pantalla avisa antes de descartar cambios y permite mostrar u ocultar cada campo de contraseña.

Pruebas: node --test backend/test/account.test.js (cuentas temporales de ambos roles).

## Recuperación de contraseña

Preparación desde la raíz:

1. Instalar dependencias: npm --prefix backend ci.
2. Iniciar servicios locales: docker compose up -d mysql mailpit.
3. Aplicar la migración idempotente: node backend/scripts/migrate.js.
4. Iniciar API y Angular. El worker de correos se inicia junto con backend/src/server.js.
5. En el login seleccionar “Olvidé mi contraseña”, ingresar el email y abrir el correo en http://127.0.0.1:8025. Mailpit captura el SMTP en 127.0.0.1:1025 y no entrega correos a Internet. No requiere credenciales reales.

Configuración documentada en .env.example: APP_URL es el origen fijo de la tienda, sin rutas ni query; nunca se obtiene del encabezado Host de una solicitud. El valor local es http://127.0.0.1:4200. Los enlaces usan ese origen incluso si el visitante entró por localhost. Para producción definir NODE_ENV=production, APP_URL HTTPS, SMTP_HOST remoto, SMTP_PORT (587 con STARTTLS requerido o 465 con TLS), SMTP_USER, SMTP_PASSWORD y MAIL_FROM autorizado por el proveedor. No se desactiva la verificación de certificados. La aplicación rechaza la configuración local si NODE_ENV es production. Mailpit es exclusivamente para pruebas locales y sus puertos se publican solo en loopback. En varias instancias, compartir también el almacenamiento de los límites por IP; el limitador actual corresponde a una API local.

POST /api/auth/recuperar recibe {email} y devuelve 202 con el mismo mensaje para cuentas existentes, inexistentes, desactivadas o limitadas por cuenta. No devuelve tokens ni espera al SMTP. Límite por IP: 5 solicitudes cada 15 minutos. Por cuenta: máximo 3 por hora y una por minuto, sin revelar estos contadores al visitante. Se conserva el acceso normal a la cuenta mientras se solicita la recuperación.

POST /api/auth/restablecer recibe {token,password}. El token aleatorio tiene 256 bits y vence 15 minutos después de su emisión. MySQL conserva solo SHA-256 del token, junto con email y versión de autenticación. Un nuevo correo de recuperación invalida el enlace anterior al emitirse. Cambiar email o contraseña invalida los enlaces pendientes por versión. El enlace usa un fragmento URL; Angular lo retira de la barra al cargar y lo conserva solo en memoria. Recargar esa pantalla requiere volver a abrir el enlace del correo. La página aplica no-referrer y las respuestas de recuperación no-store.

Al abrir la pantalla, POST /api/auth/verificar-recuperacion con {token} comprueba existencia, vencimiento, estado activo y coincidencia de email y versión. Hasta recibir la respuesta se ocultan los campos. Un enlace consumido o vencido muestra el aviso y la opción de solicitar otro. La comprobación tiene límite de 40 intentos por IP cada 15 minutos y no modifica el token. El enlace se consume únicamente al guardar correctamente la nueva contraseña; abrirlo o previsualizarlo en el correo no lo inutiliza. El guardado repite todas las comprobaciones bajo bloqueo para evitar carreras entre pestañas.

Al guardar, se comprueba que el usuario siga activo, que email y versión coincidan y que el token no haya vencido. Se bloquean usuario y token, se guarda bcrypt con costo 12, se incrementa auth_version, se elimina el token y se encola el aviso por correo en una misma transacción. Dos consumos simultáneos no pueden cambiar dos veces la contraseña. Se aplica la complejidad del registro y un máximo de 72 bytes. No hay inicio de sesión automático; el usuario debe ingresar otra vez.

La tabla correos_cuenta es una cola durable sin tokens en claro. El worker la consulta cada 3 segundos, reclama trabajos con SKIP LOCKED y libera los bloqueos antes de conectarse al SMTP. Reintenta hasta tres veces, con un minuto de espera, y recupera trabajos abandonados después de cinco minutos. Las solicitudes antiguas de recuperación (más de 15 minutos sin procesarse) se descartan. El envío es al menos una vez: un reinicio después de entregar podría repetir un email; solo el último enlace emitido sirve. Los trabajos agotados quedan como fallido; revisar estado e intentos, corregir SMTP y solicitar un enlace nuevo. Cada hora se limpian tokens vencidos y hasta 1000 trabajos de más de siete días. No se registran tokens, contraseñas, destinatarios ni errores completos del SMTP en consola.

Pruebas: con MySQL iniciado y migrado, detener el backend que ejecuta el worker antes de correr npm --prefix backend test, para que no compita con la cola de los casos de integración. recovery.test.js crea y limpia su propia cuenta, verifica respuesta neutra, límites, hash, expiración, uso único concurrente, revocación de sesiones y reintentos fallidos. Angular prueba validación, repetición, bloqueo de doble envío y eliminación del token de la URL.

Referencias: [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html), [Nodemailer SMTP](https://nodemailer.com/smtp), [Mailpit Docker](https://mailpit.axllent.org/docs/install/docker/).

## Mercado Pago Checkout Pro y reservas

La integración usa Preferences API de Checkout Pro con redirección alojada en Mercado Pago. La aplicación no recibe datos de tarjetas. Está limitada al vendedor de prueba: comprueba la cuenta asociada al token. Si el pago devuelve live_mode=true, vuelve a consultar /users/me y exige que el vendedor coincida con MP_COLLECTOR_ID y tenga la etiqueta test_user antes de conciliarlo. El flujo de Checkout Pro con cuentas test puede devolver ese indicador; no basta para clasificar la cuenta. No inferir el entorno únicamente por el prefijo APP_USR del token; las cuentas de prueba también pueden usar ese prefijo.

Este flujo con cuentas de vendedor y comprador de prueba redirige al `init_point` de la preferencia, no al `sandbox_init_point`. Los enlaces sandbox guardados anteriormente se recuperan consultando la misma preferencia al volver a pulsar Pagar; no se duplica el checkout. Probar en una ventana de incógnito con el comprador de prueba para evitar mezclar sesiones del vendedor o de una cuenta personal.

### Configuración antes de probar

1. Ejecutar node backend/scripts/migrate.js. Agrega existencias.reservada, los estados de pago, la fecha de reserva, el identificador de pago aceptado y las tablas de 007-pagos.sql. Conserva los pedidos anteriores como sin_pago; no vuelve a descontar su stock.
2. Completar en .env MP_ACCESS_TOKEN (del vendedor de prueba), MP_WEBHOOK_SECRET (firma configurada en Webhooks), MP_COLLECTOR_ID (id del vendedor), MP_NOTIFICATION_URL y MP_BACK_URL. Las últimas dos deben ser HTTPS públicas; MP_NOTIFICATION_URL termina en /api/pagos/mercadopago/webhook y MP_BACK_URL es el origen del frontend sin rutas.
3. Ejecutar npm --prefix backend run payments:verify para comprobar credencial de prueba e ID. No imprime tokens ni hace cobros.
4. En el panel de Mercado Pago habilitar notificaciones de tipo payment para la aplicación y el entorno de prueba. Usar la misma URL y clave de firma del .env.
5. Reiniciar el backend después de cambiar .env. Abrir la tienda con el mismo origen HTTPS configurado como MP_BACK_URL para conservar el acceso al volver del checkout. Un túnel debe dirigir las rutas de Angular y /api al proyecto; localhost no recibe webhooks externos. No se publica un túnel automáticamente.
6. Iniciar sesión en Mercado Pago con un comprador de prueba distinto del vendedor, del mismo país. Usar los medios de prueba oficiales. Verificar en la base y en Mis pedidos que el pago pasó a aprobado y el movimiento se registró una sola vez.

Sin estas variables, iniciar el pago responde 503. El resto de la tienda sigue disponible; no se generan URLs ni aprobaciones simuladas en el entorno normal. Los casos simulados existen únicamente en las pruebas.

### Prueba local mediante HTTPS

Compilar Angular con `npm run build` y, con el puerto 3000 libre, ejecutar `npm --prefix backend run preview`. Este modo sirve el build de Angular y `/api` desde el mismo origen; no publica archivos del repositorio. Luego ejecutar `cloudflared tunnel --no-autoupdate --protocol http2 --url http://127.0.0.1:3000` con el binario oficial de Cloudflare.

Usar el origen HTTPS generado como `MP_BACK_URL` y `APP_URL`; para `MP_NOTIFICATION_URL`, agregar `/api/pagos/mercadopago/webhook`. Registrar esa misma URL en Webhooks de Mercado Pago, seleccionar Pagos en modo de prueba y guardar su clave de firma en `MP_WEBHOOK_SECRET`. Reiniciar preview después de modificar `.env` y verificar la configuración con `npm --prefix backend run payments:verify`.

El enlace temporal es público y funciona mientras sigan ejecutándose el túnel y el servidor. Al reiniciar el túnel cambia el dominio: actualizar las variables, el panel de Mercado Pago y reiniciar el servidor. Abrir la tienda desde ese HTTPS al probar el checkout.

### Stock y estados

Agregar al carrito no reserva. Crear el pedido reserva por 30 minutos y lo deja pendiente. Hay hasta tres pedidos pendientes con reserva vigente por usuario. Los importes se obtienen de los precios guardados por el servidor, con hasta 100 combinaciones y un total máximo de 99.999.999,99 ARS.

Stock físico es existencias.cantidad; stock disponible es cantidad-reservada. El catálogo, detalle, carrito y selección de transferencias muestran disponibilidad. Administración conserva cantidades físicas e indica las reservadas al editar. La restricción MySQL garantiza 0 <= reservada <= cantidad. Ajustes y despachos rechazan gastar unidades reservadas. Reservar, liberar y consumir incrementa la versión del producto para proteger formularios abiertos.

Un pago aprobado se consulta en la API de Mercado Pago y se valida contra referencia externa, importe exacto, ARS, vendedor y modo de prueba. Dentro de una transacción se consumen las reservas, se descuentan cantidades físicas, se registran movimientos de venta y el pedido pasa a confirmado/aprobado. Notificaciones repetidas no descuentan otra vez. El retorno del navegador y sus parámetros status/payment_id nunca prueban que se pagó.

Un pago rechazado conserva la reserva hasta su vencimiento para permitir otro intento en el mismo checkout. Cancelar un pedido pendiente libera la reserva después de conciliar sus pagos. Al vencer, el worker consulta primero a Mercado Pago; si no puede consultarlo mantiene la reserva y reintenta. El checkout tiene la misma fecha de vencimiento. Un pago aprobado tardíamente, duplicado, reembolsado o con contracargo queda en revisión; no consume nuevamente mercadería liberada ni repone stock automáticamente. El administrador lo ve en /admin/pagos y debe revisar la operación en Mercado Pago antes de entregar o gestionar una devolución de dinero.

Los pedidos históricos sin_pago no se convierten en pagos pendientes ni se cobran mediante este flujo.

### Seguridad y recuperación de errores

La referencia externa es un UUID único por pedido. La creación del checkout se reclama en una transacción y el acceso HTTP al proveedor sucede fuera de los bloqueos de MySQL. Se conserva una sola preferencia por pedido. Un timeout ambiguo no dispara otra creación a ciegas: se busca la preferencia por referencia y se recupera. Errores definitivos de validación o autenticación permiten corregir y reintentar.

El webhook valida HMAC-SHA256 de id, x-request-id y ts contra MP_WEBHOOK_SECRET, compara en tiempo constante y admite timestamps de hasta 15 minutos de diferencia. data.id de query y body deben coincidir. La notificación encola el id y devuelve 200; el worker obtiene el estado real desde la API. No se confía en el estado del body. La cola persiste, reintenta hasta 10 veces y recupera trabajos abandonados. Si entra otro evento durante su procesamiento, su versión evita perderlo. La firma y los importes se prueban sin hacer pagos reales.

Cada 10 segundos se procesan eventos y vencimientos. También se concilian hasta 10 checkouts recientes por pasada, revisando cada uno como máximo una vez por minuto durante siete días, para recuperar notificaciones perdidas. Los pedidos pueden sincronizarse manualmente desde Mis pedidos en cualquier momento. No se guardan tarjetas ni el JSON completo del pago y no se registran credenciales.

Rutas autenticadas:
- POST /api/pedidos/:id/pagar: crea o recupera el checkout propio.
- POST /api/pedidos/:id/sincronizar: consulta pagos reales del pedido propio.
- POST /api/pedidos/:id/cancelar: cancela un pendiente y libera stock si corresponde.
- GET /api/admin/pagos-revision: administrador, hasta 100 casos que requieren revisión.
- POST /api/pagos/mercadopago/webhook: público, exige firma válida; nunca una sesión de usuario.

Pruebas: detener el backend que ejecuta los workers y ejecutar npm --prefix backend test. Las suites comparten una base local y se ejecutan en serie para no interferir con limpiezas de fixtures; dentro de ellas se prueban solicitudes concurrentes. payments.test.js usa un proveedor inyectado y verifica reservas, protección de ajustes y traslados, doble clic, firma, importes y vendedor incorrectos, modo real rechazado, aprobación única, cancelación, vencimiento, timeout y pago tardío. La compra real de prueba en Mercado Pago queda como verificación pendiente hasta configurar credenciales y HTTPS.

Documentación oficial: [Preferencias](https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-pro-preferences/create-preference/post), [Notificaciones](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro-preferences/payment-notifications), [Compras de prueba](https://www.mercadopago.com.ar/developers/en/docs/checkout-pro-preferences/integration-test/test-purchases).
