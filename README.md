# Tienda base

Base reutilizable para armar tiendas online a medida de cada negocio. Cada cliente
tiene su propia copia (su repositorio, su proyecto de Supabase y su sitio en Netlify);
las mejoras que se hacen acá se llevan a cada copia con Git.

Para armar una tienda nueva: **[NUEVO-CLIENTE.md](NUEVO-CLIENTE.md)**.

## Qué trae

- **Tienda**: catálogo con categorías y subcategorías, buscador, filtros y orden,
  ofertas, stock por opción, guía de talles, compartir producto, carrito y pedido
  por WhatsApp.
- **Pagos**: Mercado Pago (pagar ahora o link con el monto cargado), transferencia
  con alias y efectivo al recibir. Descuentos por medio de pago que se cambian
  desde el panel.
- **Panel de administración** (`Pages/admin.html`, sin enlaces públicos):
  productos, fotos, stock, categorías, banners, ajustes, ventas (pago y entrega por
  separado) y cuentas del negocio.
- **Google y seguridad**: sitemap, robots, dirección oficial, vista previa al
  compartir, ficha de la tienda, cabeceras de seguridad de Netlify y política de
  contenido en cada página.

## Qué es de la base y qué es de cada cliente

| Base (igual para todos, recibe mejoras) | De cada cliente (se completa una vez) |
|---|---|
| `scripts/` salvo los dos de configuración | `scripts/tienda-config.js` y `scripts/supabase-config.js` |
| `styles/styles.css`, `styles/admin.css` | `styles/tema.css` (colores y tipografías) |
| `Pages/admin.html`, `Pages/pago.html` | Textos de las páginas públicas (`index.html`, `Pages/*.html`) |
| `supabase/` (base de datos y funciones) | `img/` (logo, banners, fotos) |
| `_headers`, `configurar-tienda.py` | `sitemap.xml`, `robots.txt`, `cliente.json` |

Al mejorar la base conviene tocar lo de la izquierda: así las copias de los
clientes reciben el cambio sin conflictos. Si un cambio necesita tocar las páginas
públicas, anotarlo en el mensaje del commit para aplicarlo a mano en cada cliente.

## Base de datos

- Tienda nueva: ejecutar `supabase/schema.sql` completo, que ya incluye todo.
- Tienda que ya existía: ejecutar solo las migraciones nuevas (`supabase/migracion-*.sql`)
  que no tenga, en orden.

## Llevar una mejora de la base a un cliente

En la copia del cliente (se configura una sola vez, ver NUEVO-CLIENTE.md):

```
git pull base main
```

Si Git avisa de conflictos en archivos del cliente (textos, configuración, tema),
quedarse con la versión del cliente.
