// Datos del proyecto de Supabase (Project Settings > API).
// Esta clave es pública a propósito: lo que protege los datos
// son los permisos de supabase/schema.sql.
// Nunca pongas acá la clave "service_role" o "secret".
// Mientras estén vacíos, la tienda usa los productos del HTML.

window.TIENDA_SUPABASE = {
    url: "https://TU-PROYECTO.supabase.co",
    anonKey: "TU-CLAVE-PUBLICA",

    // Activar cuando las funciones de Mercado Pago estén instaladas.
    mercadoPago: false
};
