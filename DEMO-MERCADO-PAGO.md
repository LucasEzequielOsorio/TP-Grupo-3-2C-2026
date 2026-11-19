# Demostración de Mercado Pago

La demo utiliza cuentas y medios de pago de prueba. Ejecutar los comandos desde la raíz del proyecto en PowerShell. Mantener la computadora encendida, con Internet y sin suspensión durante la presentación.

## 1. Iniciar la base de datos

Abrir Docker Desktop y esperar a que esté listo. Luego:

```powershell
docker compose up -d mysql
docker compose ps
node backend/scripts/migrate.js
```

Esperar que MySQL aparezca saludable antes de ejecutar las migraciones. Mantener el `.env` local con las credenciales de esta base. No borrar el volumen de Docker: contiene usuarios, productos, pedidos y stock.

## 2. Compilar e iniciar la tienda y la API

```powershell
npm run build
npm --prefix backend run preview
```

Dejar esta terminal abierta. `preview` sirve Angular y la API en `http://127.0.0.1:3000`, y arranca los procesos que verifican pagos, notificaciones y vencimientos. No iniciar otro backend en el mismo puerto. Para este modo de demo no hace falta `ng serve` ni el puerto 4200.

Si `npm` no está disponible en esta computadora, actualmente se puede usar el CLI que ya descargamos:

```powershell
node C:/Users/diaz-/AppData/Local/Temp/codex-tienda-npm/package/bin/npm-cli.js run build
node backend/src/preview-server.js
```

La ubicación del CLI es temporal; comprobarla antes de la presentación o tener Node/npm instalados correctamente.

## 3. Iniciar el túnel HTTPS

En otra terminal:

```powershell
& .\.angular\cache\cloudflared.exe tunnel --no-autoupdate --protocol http2 --url http://127.0.0.1:3000
```

Dejar esta terminal abierta y copiar el origen `https://…trycloudflare.com` que informa. El binario fue descargado de la distribución oficial de Cloudflare; si se limpia `.angular/cache`, habrá que volver a descargarlo o utilizar una instalación oficial de `cloudflared`.

**El dominio cambia al reiniciar el túnel.** No reutilizar el de una demo anterior ni cerrar el túnel durante la compra.

## 4. Configurar el dominio y las notificaciones

En el `.env` de la raíz, reemplazar `DOMINIO-ACTUAL` por el que informa el túnel:

```dotenv
MP_BACK_URL=https://DOMINIO-ACTUAL.trycloudflare.com
APP_URL=https://DOMINIO-ACTUAL.trycloudflare.com
MP_NOTIFICATION_URL=https://DOMINIO-ACTUAL.trycloudflare.com/api/pagos/mercadopago/webhook
```

Conservar también `MP_ACCESS_TOKEN`, `MP_COLLECTOR_ID` y `MP_WEBHOOK_SECRET` configurados para la aplicación y el vendedor de prueba. No mostrar el archivo `.env` en la presentación ni subirlo al repositorio.

En Mercado Pago Developers → aplicación → Webhooks, actualizar la URL con el mismo valor de `MP_NOTIFICATION_URL` y mantener el evento **Pagos** habilitado en el entorno de prueba utilizado. Si se regenera la clave de firma, actualizar `MP_WEBHOOK_SECRET`.

Después de guardar el `.env`, detener únicamente el servidor con Ctrl+C y volver a ejecutar `npm --prefix backend run preview` (o `node backend/src/preview-server.js`). Mantener el túnel funcionando para conservar su dominio.

```powershell
npm --prefix backend run payments:verify
```

Alternativa sin npm: `node backend/scripts/verify-mercadopago.js`.

La verificación debe indicar que la credencial del vendedor de prueba es correcta. Esto comprueba la configuración y la cuenta, pero no reemplaza la compra de prueba ni comprueba por sí solo que la URL esté registrada correctamente en el panel.

## 5. Recorrido para presentar

1. Abrir **el dominio HTTPS actual**, ruta `/tienda/productos`, en una ventana de incógnito. Usar ese mismo origen durante todo el recorrido para conservar la sesión al volver de Mercado Pago.
2. Iniciar sesión en la tienda con un cliente. La cuenta de la tienda y la cuenta compradora de Mercado Pago son distintas.
3. Elegir un producto con stock disponible, talle y color. Mostrar el carrito y crear el pedido.
4. El pedido reserva stock durante **30 minutos**; todavía no descuenta stock físico. Completar el pago dentro de ese plazo.
5. Pulsar **Pagar con Mercado Pago** e ingresar con el **comprador de prueba**, distinto del vendedor. Tener listos sus datos y los medios de pago de prueba antes de comenzar. No usar una cuenta personal ni tarjetas reales.
6. Volver a la tienda. Si todavía figura pendiente, pulsar **Actualizar estado del pago** y esperar la consulta al proveedor.
7. Mostrar el pedido confirmado/aprobado y verificar en administración el descuento de la variante y su movimiento de venta. Al actualizar otra vez, el stock no debe volver a descontarse.

El backend verifica el pago con la API: los parámetros de la URL de retorno no confirman una compra. Un webhook firmado permite recibir el aviso aunque el comprador no vuelva a la página; el servidor también concilia pagos periódicamente.

## Problemas habituales

| Síntoma | Revisar |
| --- | --- |
| El enlace público no abre | Internet, servidor en 3000 y terminal del túnel activa. Usar el dominio actual. |
| Vuelve a un dominio viejo | Actualizar `MP_BACK_URL`, reiniciar backend y crear un pedido nuevo: las preferencias anteriores conservan las URLs con las que se crearon. |
| Pago no disponible / HTTP 503 | Variables MP completas, verificador correcto y backend reiniciado después de editar `.env`. |
| Error al iniciar sesión en Mercado Pago | Incógnito, comprador de prueba distinto del vendedor y cuentas del mismo país. Volver a entrar desde Pagar, sin reutilizar la pestaña de error. |
| Pago pendiente después de volver | Actualizar estado; revisar conectividad con Mercado Pago, URL registrada y clave de firma del webhook. No volver a pagar una operación que ya fue aprobada. |
| Pedido vencido o cancelado | Crear un pedido nuevo si no se pagó. Si ya se pagó, revisar el caso en `/admin/pagos`; no repetir el pago. |
| Pago en revisión | La aprobación puede haber llegado después de liberar la reserva, o existir una operación duplicada/adversa. No se confirma ni repone stock automáticamente; revisar la operación antes de entregar. |

El pedido **#37** quedó como caso histórico en revisión porque su reserva ya estaba liberada al conciliar el pago. No usarlo para demostrar una nueva compra.

## Antes de empezar la exposición

- Docker/MySQL saludables y productos con imágenes y stock disponibles.
- Build actualizado, servidor preview y túnel activos en dos terminales.
- Dominio del túnel actualizado en `.env` y en Webhooks; servidor reiniciado después de editar.
- Verificador correcto, credenciales del comprador preparadas y ventana de incógnito lista.
- Hacer una compra de ensayo con tiempo; reservar un producto para la demo y evitar reutilizar pedidos vencidos.

Al terminar, detener preview y el túnel con Ctrl+C. Docker puede seguir abierto; detener MySQL impide usar la tienda. Mailpit/SMTP no son necesarios para el pago; sí lo son si también se presenta el recupero de contraseña.
