# Tienda nueva para un cliente

Lleva más o menos una tarde: la mitad es técnica (cuentas y configuración) y la
otra mitad es contenido (colores, textos y fotos del negocio).

Antes de empezar, pedile al cliente: nombre del negocio, logo, colores, WhatsApp,
Instagram, alias y titular de la cuenta para transferencias, horario de atención,
ciudad, formas de entrega, qué opciones tienen sus productos (talles, colores,
tamaños, aromas…), los textos de "Nosotros" y fotos para los banners.

## 1. Repositorio

1. En GitHub, abrir el repositorio `tienda-base` y tocar **Use this template → Create a new repository**.
   Nombre: el del cliente (por ejemplo `velas-luz`). Conviene **Private**.
2. Clonarlo en la computadora:
   ```
   git clone https://github.com/Ayustizz/velas-luz.git
   cd velas-luz
   ```
3. Conectarlo con la base, para recibir mejoras en el futuro (una sola vez):
   ```
   git remote add base https://github.com/Ayustizz/tienda-base.git
   git fetch base
   git merge base/main --allow-unrelated-histories -s ours -m "Conecta con la base"
   ```

## 2. Supabase (base de datos y panel)

1. En supabase.com, **New project** con el nombre del cliente (región: São Paulo).
2. **SQL Editor → New query**: pegar todo `supabase/schema.sql` y tocar **Run**.
3. **Authentication → Sign In / Providers**: desactivar **Allow new users to sign up**.
4. **Authentication → Users → Add user**: el email del cliente y una contraseña larga.
5. En **SQL Editor**, darle permiso de administrador (cambiando el email):
   ```sql
   insert into public.admins (user_id) select id from auth.users where email = 'cliente@ejemplo.com';
   ```
6. **Project Settings → API**: copiar la **Project URL** y la clave **publishable** (o anon).
   Nunca usar la clave `service_role` / `secret`.

## 3. Netlify (publicación)

1. En app.netlify.com, **Add new site → Import an existing project → GitHub** y elegir el repositorio.
   No hace falta configurar nada de compilación.
2. **Site configuration → Change site name**: por ejemplo `velas-luz` → `https://velas-luz.netlify.app`.
   (Si el cliente tiene dominio propio, se conecta en **Domain management**.)

## 4. Datos del negocio

1. Copiar `cliente.ejemplo.json` como `cliente.json` y completarlo:
   - `id`: corto, en minúsculas y sin espacios (`velas-luz`).
   - `sitio`: la dirección de Netlify del paso 3.
   - `supabase_url` y `supabase_clave_publica`: los del paso 2.
   - `whatsapp`: solo números, 549 + código de área + número.
   - `mapa_embed`: en Google Maps, buscar el local → **Compartir → Insertar un mapa** → copiar
     solo lo que está entre comillas en `src="..."`. Si no tiene local, dejarlo vacío.
2. Correr:
   ```
   python configurar-tienda.py
   ```
   Escribe esos datos en todas las páginas. Al final muestra lo que falta hacer a mano.

## 5. A medida del rubro

- **Colores y tipografías**: `styles/tema.css`. Con cambiar el color principal y el de
  acento ya cambia toda la tienda y el panel.
- **Opciones de los productos**: `variantes` en `scripts/tienda-config.js`.
  - Ropa: talles y colores.
  - Velas: `talle` con `opciones: []` y `color` con `nombre: "Aroma"`.
  - Dietética: `talle` con `nombre: "Presentación"` y `opciones: ["250 g", "500 g", "1 kg"]`.
- **Formas de entrega**: `entregas` en el mismo archivo (retiro, envío, punto de encuentro…).
- **Guía de talles**: `guiaDeTalles` (solo si vende ropa; con `filas: []` no aparece).
- **Imágenes**: reemplazar `img/favicon.svg` (logo cuadrado), `img/nosotros.jpg` y los banners
  de `img/banners/` (1600 × 700). Los banners también se pueden subir después desde el panel.
- **Textos**: `Pages/nosotros.html`, las preguntas frecuentes de `Pages/contacto.html`,
  la sección "Comprar es fácil" de `index.html` y las condiciones de `Pages/cambios.html`.

Para probar en la computadora, abrir `index.html` con la extensión **Live Server** de VS Code.

## 6. Publicar

```
git add .
git commit -m "Tienda de Velas Luz"
git push
```

Netlify publica solo en uno o dos minutos.

## 7. Google

1. En search.google.com/search-console: **Agregar propiedad → Prefijo de URL** con la dirección de la tienda.
2. Verificar con **Archivo HTML**: descargarlo, ponerlo en la carpeta principal del proyecto, subirlo (`git push`) y tocar **Verificar**.
3. **Sitemaps**: enviar `sitemap.xml`.

## 8. Mercado Pago (opcional, con la cuenta del cliente)

1. En mercadopago.com.ar/developers (con la cuenta del cliente): **Tus integraciones → Crear aplicación**,
   tipo "Pagos online" con Checkout Pro. Copiar el **Access Token** de producción (`APP_USR-…`).
2. En Supabase, **Edge Functions**: crear `crear-pago` y `webhook-mercadopago` pegando el código de
   `supabase/functions/`. En las dos, desactivar **Verify JWT**.
3. En **Edge Functions → Secrets**: `MP_ACCESS_TOKEN` (el token), `SITE_URL` (la dirección de la tienda,
   sin barra al final) y `TIENDA_NOMBRE` (el nombre del negocio).
4. En la aplicación de Mercado Pago, **Webhooks**: URL
   `https://ID-DEL-PROYECTO.supabase.co/functions/v1/webhook-mercadopago`, evento **Pagos**.
   Copiar la clave secreta y guardarla en Supabase como `MP_WEBHOOK_SECRET`.
5. En `scripts/supabase-config.js`, poner `mercadoPago: true`, subir los cambios y hacer una compra de prueba.

## 9. Entrega

- Pasarle al cliente la dirección del panel (`/pages/admin`), su email y la contraseña.
- Mostrarle cómo cargar productos, stock, categorías, banners y descuentos (pestaña Ajustes),
  y cómo marcar los pedidos como pagados o entregados.
- Hacer juntos una compra de prueba con cada medio de pago y después borrarla desde Ventas.
