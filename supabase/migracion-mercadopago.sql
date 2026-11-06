-- =====================================
-- TIENDA - PAGO DIRECTO CON MERCADO PAGO
-- Ejecutar una sola vez en el SQL Editor de Supabase,
-- después de migracion-seguridad.sql.
-- No borra productos ni ventas.
-- =====================================

alter table public.orders
    add column mp_init_point text,
    add column mp_payment_id text,
    add column mp_status text;
