Proyecto MOVEA-SHOP

En el proyecto lo que estoy buscando es hacer una tienda online para una tienda de ropa deportiva destinada a chicas.

Hasta ahora hice la primera estructura con html con las etiquetas basicas como: <header>, <main>,<footer>,<h1>,<h2> tambien use: <section>, <article>, <figure>, etc

y el primer diseño con css, en donde use principalmente class para definir a que queria referirime a la hora de modificar.

Después agregué un carrito (scripts/carrito.js) que guarda los productos en el navegador y envía el pedido por WhatsApp, con pago por Mercado Pago, transferencia o efectivo.

Panel de administración (Pages/admin.html): login, productos, fotos y ventas, guardados en Supabase. No hay enlaces públicos al panel.

Para activarlo:

1. Crear un proyecto gratis en supabase.com.
2. En SQL Editor, ejecutar completo supabase/schema.sql.
3. En Authentication > Sign In / Providers, desactivar "Allow new users to sign up".
4. En Authentication > Users, crear el usuario administrador con una contraseña larga.
5. En SQL Editor, darle permisos: insert into public.admins (user_id) select id from auth.users where email = 'EMAIL_DEL_ADMIN';
6. Copiar la URL del proyecto y la clave pública (anon o publishable) en scripts/supabase-config.js.

Si la base ya existía, ejecutar una sola vez y en orden las migraciones que falten: supabase/migracion-talles-y-colores.sql, supabase/migracion-cuentas.sql, supabase/migracion-seguridad.sql, supabase/migracion-mercadopago.sql, supabase/migracion-tienda.sql, supabase/migracion-categorias.sql, supabase/migracion-ventas.sql, supabase/migracion-descuentos.sql y supabase/migracion-ajustes.sql. En una base nueva alcanza con schema.sql.

Seguridad: cada página tiene una política de contenido (Content-Security-Policy) que nombra el proyecto de Supabase. Si cambia el proyecto, hay que actualizar esa dirección en las diez páginas. Si se actualiza Bootstrap, Font Awesome o Supabase, hay que recalcular los valores integrity.

Stock: el pedido descuenta las unidades al crearse y cancelar lo devuelve.

Publicación: la tienda está en Netlify, en https://moveafit.netlify.app. El archivo _headers agrega las cabeceras de seguridad. Para Google están robots.txt, sitemap.xml, la dirección oficial (canonical) y la vista previa al compartir (og:) en cada página pública, y la ficha de la tienda en index.html. Si cambia la dirección (por ejemplo, con dominio propio), reemplazar https://moveafit.netlify.app en todo el proyecto y actualizar el secreto SITE_URL de Supabase.

Datos de la tienda: nombre, WhatsApp, Instagram, horario, alias y titular de la transferencia, opciones de los productos (talles y colores, o las del rubro), formas de entrega y guía de talles se cambian en un solo lugar, scripts/tienda-config.js. Todas las páginas los toman de ahí.

Colores y tipografías: en styles/tema.css. El resto de los estilos usa esas variables.

Descuentos: se cambian en el panel, pestaña Ajustes (tabla "ajustes" de Supabase, que también usa la base para calcular el total de cada pedido). Los de tienda-config.js solo se usan si el panel no responde.

Formas de pago: Mercado Pago (pagar ahora), link de pago de Mercado Pago (para pagar después o compartirlo), transferencia con alias y efectivo al recibir. En los dos de Mercado Pago el monto del pedido ya viene cargado y el pago se marca solo en el panel. En la transferencia se muestran el alias para copiar y el titular. Mientras Mercado Pago no esté activado, la opción de link no aparece y "Mercado Pago" avisa que el link se manda por WhatsApp.

Activar Mercado Pago (una sola vez). El token de Mercado Pago nunca va en el código.

1. En mercadopago.com.ar/developers, entrar a "Tus integraciones" y crear una aplicación de tipo "Pagos online" con Checkout Pro.
2. En la aplicación, "Credenciales de producción": copiar el Access Token (empieza con APP_USR-).
3. En Supabase, Edge Functions: crear la función crear-pago pegando el código de supabase/functions/crear-pago/index.ts, y la función webhook-mercadopago con supabase/functions/webhook-mercadopago/index.ts. En las dos, desactivar "Verify JWT".
4. En Supabase, Edge Functions > Secrets: agregar MP_ACCESS_TOKEN con el token del paso 2, SITE_URL con la dirección pública de la tienda (https://moveafit.netlify.app, sin barra al final) y TIENDA_NOMBRE con el nombre del negocio (aparece en el pago y en el resumen de la tarjeta).
5. En la aplicación de Mercado Pago, "Webhooks": poner la URL https://ID-DEL-PROYECTO.supabase.co/functions/v1/webhook-mercadopago, marcar el evento "Pagos" y guardar. Copiar la "clave secreta" que aparece y agregarla en Supabase como secreto MP_WEBHOOK_SECRET.
6. En scripts/supabase-config.js, cambiar mercadoPago: false por mercadoPago: true y publicar la tienda.
7. Probar con una compra chica real y verificar que en el panel, Ventas, el pedido pase solo a "Pagado".

Para probar sin cobrar se pueden usar primero las credenciales de prueba de Mercado Pago (paso 2) con un usuario comprador de prueba, y después cambiar MP_ACCESS_TOKEN por el de producción.

Cuentas del panel: los costos y gastos son privados. Las ganancias se calculan con pedidos pagados (estén entregados o no), usando el costo que tenía cada producto al venderse.

Con Supabase activo, los precios se cambian en el panel. Los productos escritos en index.html y Pages/productos.html quedan como respaldo si Supabase no responde.

Categorías: se crean y eliminan en la pestaña Categorías del panel, con subcategorías opcionales (por ejemplo Push up dentro de Shorts). Una categoría con productos no se puede eliminar: primero hay que cambiarles la categoría.
