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

Con Supabase activo, los precios se cambian en el panel. Los productos escritos en index.html y Pages/productos.html quedan como respaldo si Supabase no responde.
