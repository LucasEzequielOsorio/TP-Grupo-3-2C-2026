# TPGrupo32C2026

## Base de datos MySQL local

El esquema, los datos de ejemplo y los pasos de instalación están en [backend/README.md](backend/README.md).
Incluye productos con talles y colores, stock por ubicación y estructura para futuras transferencias.

## Vista básica de tienda

Desde **Ver tienda** en administración se abre `/tienda/productos`. Incluye portada, tarjetas con fotos y precios reales, categorías, búsqueda, filtro de disponibilidad y orden por precio o nombre. El detalle muestra descripción, galería y selección de talle/color con existencias de la variante en ubicaciones activas. Incluye estados de carga, errores y resultados vacíos. Conserva el acceso con sesión del proyecto.

La tienda permite explorar el catálogo público y agregar prendas al carrito luego de iniciar sesión, seleccionando talle, color y cantidad. El carrito se guarda en MySQL por usuario. Al crear el pedido se reservan prendas por 30 minutos y se vacía el carrito; el stock físico se descuenta cuando el backend verifica un pago aprobado de Mercado Pago. En “Mis pedidos” se puede iniciar el pago, actualizar su estado o cancelar una reserva pendiente. Los productos y variantes inactivos no se publican. La integración de Mercado Pago está preparada solo para cuentas de prueba y requiere configurar credenciales y URLs HTTPS públicas.

### Acceso público y roles

La raíz `/` abre la tienda. El catálogo `/tienda/productos` y los detalles `/tienda/producto/:id` son públicos; no requieren cuenta. El encabezado del visitante ofrece **Iniciar sesión** y **Crear cuenta**. Login y registro también permiten volver a explorar sin autenticarse.

Hay dos roles: `cliente` (todas las cuentas creadas por registro público) y `admin` (creado por el procedimiento privado documentado en el backend). Un cliente autenticado vuelve a la tienda y no ve enlaces de administración; el administrador accede al panel. Angular verifica el rol real contra `/api/auth/me` para abrir las rutas administrativas y el backend verifica sesión y rol en cada operación protegida. Modificar el rol en localStorage no concede acceso.

Las rutas privadas, como el carrito y perfil, requieren sesión. Si se pide login para una ruta privada, se conserva un destino interno para regresar tras autenticarse. El registro público nunca permite elegir o asignarse el rol admin. El carrito usa precios actuales del servidor y controla disponibilidad al agregar o modificar; no reserva ni descuenta stock.

Clientes y administradores acceden a **Mi cuenta** en `/perfil/mi-cuenta`: datos reales, edición de nombre, apellido, email, dirección y contraseña. Cambiar email o contraseña requiere la contraseña actual y renueva la sesión, invalidando las anteriores. El email sigue siendo único y las contraseñas mantienen validación de complejidad. Las rutas de perfil anteriores redirigen a esta pantalla. Para bases existentes ejecutar `node backend/scripts/migrate.js` antes de iniciar el backend actualizado.

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.6.

## Recuperar contraseña

En el login, **Olvidé mi contraseña** abre `/bienvenido/recuperar`. El enlace enviado por correo vence a los 15 minutos y se usa una sola vez. Al restablecer, se cierran las sesiones anteriores y se vuelve al login. Funciona para clientes y administradores.

Para probar localmente, iniciar `docker compose up -d mysql mailpit`, instalar dependencias con `npm --prefix backend ci`, aplicar `node backend/scripts/migrate.js` y ejecutar backend y Angular. Los correos se capturan en [Mailpit local](http://127.0.0.1:8025), sin enviarlos a casillas reales. El enlace usa por defecto `http://127.0.0.1:4200`; abrir la tienda con ese mismo origen.

Para enviar correos reales, configurar `APP_URL`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD` y `MAIL_FROM` en `.env` siguiendo [backend/README.md](backend/README.md). Los secretos no se guardan en Git.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.

## Pagos con Mercado Pago

El pedido reserva stock durante 30 minutos. Mis pedidos permite pagar con Checkout Pro, actualizar el estado o cancelar una reserva. El backend confirma la venta únicamente con un pago aprobado obtenido de la API y registra la baja física una sola vez. Las unidades reservadas no se pueden vender, trasladar ni descontar por ajuste. Pagos tardíos o duplicados se muestran al administrador en /admin/pagos.

Antes de probar con Mercado Pago, completar las variables MP_* del .env, aplicar node backend/scripts/migrate.js y ejecutar npm --prefix backend run payments:verify. Se necesita un vendedor y comprador de prueba y una URL HTTPS pública para el webhook. La integración no está habilitada para cobros reales. Ver [configuración y pruebas](backend/README.md#mercado-pago-checkout-pro-y-reservas).
