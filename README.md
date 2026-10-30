# TPGrupo32C2026

## Base de datos MySQL local

El esquema, los datos de ejemplo y los pasos de instalación están en [backend/README.md](backend/README.md).
Incluye productos con talles y colores, stock por ubicación y estructura para futuras transferencias.

## Vista básica de tienda

Desde **Ver tienda** en administración se abre `/tienda/productos`. Incluye portada, tarjetas con fotos y precios reales, categorías, búsqueda, filtro de disponibilidad y orden por precio o nombre. El detalle muestra descripción, galería y selección de talle/color con existencias de la variante en ubicaciones activas. Incluye estados de carga, errores y resultados vacíos. Conserva el acceso con sesión del proyecto.

Esta vista permite explorar el catálogo. La compra online y el carrito real siguen pendientes de integración; no se muestran confirmaciones de compras simuladas. Los servicios y la ruta de carrito anteriores se conservan para el trabajo del grupo. Los productos inactivos y las variantes inactivas no se publican, según la API existente.

### Acceso público y roles

La raíz `/` abre la tienda. El catálogo `/tienda/productos` y los detalles `/tienda/producto/:id` son públicos; no requieren cuenta. El encabezado del visitante ofrece **Iniciar sesión** y **Crear cuenta**. Login y registro también permiten volver a explorar sin autenticarse.

Hay dos roles: `cliente` (todas las cuentas creadas por registro público) y `admin` (creado por el procedimiento privado documentado en el backend). Un cliente autenticado vuelve a la tienda y no ve enlaces de administración; el administrador accede al panel. Angular verifica el rol real contra `/api/auth/me` para abrir las rutas administrativas y el backend verifica sesión y rol en cada operación protegida. Modificar el rol en localStorage no concede acceso.

Las rutas privadas existentes, como el carrito y perfil, mantienen su requisito de sesión. Si se pide login para una ruta privada, se conserva un destino interno para regresar tras autenticarse. El registro público nunca permite elegir o asignarse el rol admin. La compra y el carrito reales siguen siendo una integración pendiente del equipo.

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 22.1.6.

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
