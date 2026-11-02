-- =====================================
-- MOVEA - TALLES, COLORES Y TELÉFONO
-- Ejecutar una sola vez en el SQL Editor de Supabase,
-- solo si ya se había ejecutado schema.sql antes de este cambio.
-- No borra productos ni ventas.
-- =====================================

alter table public.products
    add column sizes text[] not null default '{}',
    add column colors text[] not null default '{}';

alter table public.orders
    add column customer_phone text not null default '';

alter table public.order_items
    add column size text not null default '',
    add column color text not null default '';


-- PRODUCTOS ACTUALES

update public.products set sizes = '{S,M,L,XL}' where id in (
    'buzo-blanco', 'buzo-marron', 'joggin-negro', 'top-marron',
    'short-rojo', 'short-negro-azul', 'short-azul-marron'
);

update public.products set colors = '{Blanco}' where id = 'buzo-blanco';
update public.products set colors = '{Marrón}' where id = 'buzo-marron';
update public.products set colors = '{Negro}' where id = 'joggin-negro';
update public.products set colors = '{Marrón}' where id = 'top-marron';
update public.products set colors = '{Rojo}' where id = 'short-rojo';
update public.products set colors = '{"Negro y azul"}' where id = 'short-negro-azul';
update public.products set colors = '{"Azul claro y marrón"}' where id = 'short-azul-marron';


-- CREAR PEDIDO DESDE LA TIENDA

drop function public.create_order(text, text, text, text, jsonb);

create function public.create_order(
    p_code text,
    p_customer_name text,
    p_customer_phone text,
    p_details text,
    p_payment_method text,
    p_items jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
    v_order_id uuid;
    v_item jsonb;
    v_product public.products%rowtype;
    v_quantity integer;
    v_size text;
    v_color text;
    v_subtotal integer := 0;
    v_discount integer := 0;
    v_pending boolean := false;
begin
    if p_code !~ '^[A-Z0-9]{8}$' then
        raise exception 'Código de pedido inválido';
    end if;

    if char_length(trim(p_customer_name)) not between 2 and 80 then
        raise exception 'Nombre inválido';
    end if;

    if trim(p_customer_phone) !~ '^[0-9+() -]{8,20}$' then
        raise exception 'Teléfono inválido';
    end if;

    if char_length(trim(p_details)) > 1000 then
        raise exception 'Detalles inválidos';
    end if;

    if p_payment_method not in ('mercado-pago', 'transferencia', 'entrega') then
        raise exception 'Método de pago inválido';
    end if;

    if jsonb_typeof(p_items) <> 'array'
        or jsonb_array_length(p_items) not between 1 and 50 then
        raise exception 'Productos inválidos';
    end if;

    insert into public.orders (code, customer_name, customer_phone, details, payment_method)
    values (p_code, trim(p_customer_name), trim(p_customer_phone), trim(p_details), p_payment_method)
    on conflict (code) do nothing
    returning id into v_order_id;

    if v_order_id is null then
        return;
    end if;

    for v_item in select * from jsonb_array_elements(p_items) loop
        v_quantity := (v_item ->> 'quantity')::integer;
        v_size := coalesce(v_item ->> 'size', '');
        v_color := coalesce(v_item ->> 'color', '');

        if v_quantity not between 1 and 99 then
            raise exception 'Cantidad inválida';
        end if;

        select * into v_product
        from public.products
        where id = v_item ->> 'id' and active;

        if not found then
            raise exception 'Producto no disponible';
        end if;

        if (cardinality(v_product.sizes) = 0 and v_size <> '')
            or (cardinality(v_product.sizes) > 0 and not v_size = any (v_product.sizes)) then
            raise exception 'Talle no disponible';
        end if;

        if (cardinality(v_product.colors) = 0 and v_color <> '')
            or (cardinality(v_product.colors) > 0 and not v_color = any (v_product.colors)) then
            raise exception 'Color no disponible';
        end if;

        insert into public.order_items (order_id, product_id, name, size, color, unit_price, quantity)
        values (v_order_id, v_product.id, v_product.name, v_size, v_color, v_product.price, v_quantity);

        v_subtotal := v_subtotal + v_product.price * v_quantity;
        v_pending := v_pending or v_product.price = 0;
    end loop;

    -- Mismo 15% que PAYMENT_CONFIG.discount en scripts/carrito.js
    if p_payment_method in ('mercado-pago', 'transferencia') then
        v_discount := round(v_subtotal * 15 / 100.0);
    end if;

    update public.orders
    set subtotal = v_subtotal,
        discount = v_discount,
        total = v_subtotal - v_discount,
        has_pending_prices = v_pending
    where id = v_order_id;
end;
$$;

revoke all on function public.create_order(text, text, text, text, text, jsonb) from public;
grant execute on function public.create_order(text, text, text, text, text, jsonb) to anon, authenticated;
