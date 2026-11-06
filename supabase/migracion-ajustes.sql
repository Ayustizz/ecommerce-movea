-- =====================================
-- TIENDA - AJUSTES DEL NEGOCIO
-- Ejecutar una sola vez en el SQL Editor de Supabase,
-- después de migracion-descuentos.sql.
-- - Los descuentos por medio de pago pasan a cargarse en el panel (pestaña Ajustes).
-- - Las formas de entrega dejan de estar fijas: las define scripts/tienda-config.js.
-- No cambia los pedidos ya hechos.
-- =====================================


-- AJUSTES (una sola fila)

create table public.ajustes (
    id integer primary key default 1 check (id = 1),
    descuento_mercado_pago integer not null default 10 check (descuento_mercado_pago between 0 and 50),
    descuento_transferencia integer not null default 10 check (descuento_transferencia between 0 and 50)
);

alter table public.ajustes enable row level security;

revoke all on public.ajustes from anon, authenticated;

grant select on public.ajustes to anon, authenticated;
grant update on public.ajustes to authenticated;

create policy "todos ven los ajustes" on public.ajustes
    for select to anon, authenticated
    using (true);

create policy "admin edita los ajustes" on public.ajustes
    for update to authenticated
    using (public.is_admin())
    with check (public.is_admin());

insert into public.ajustes (id, descuento_mercado_pago, descuento_transferencia)
values (1, 10, 10);


-- FORMAS DE ENTREGA

alter table public.orders
    drop constraint orders_delivery_method_check,
    add constraint orders_delivery_method_check
        check (delivery_method = '' or delivery_method ~ '^[a-z0-9-]{2,40}$');


-- CREAR PEDIDO DESDE LA TIENDA
-- Misma función de migracion-descuentos.sql; cambian el descuento y la entrega.

create or replace function public.create_order(
    p_code text,
    p_customer_name text,
    p_customer_phone text,
    p_details text,
    p_payment_method text,
    p_delivery_method text,
    p_delivery_zone text,
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
    v_percent integer;
    v_pending boolean := false;
    v_units integer := 0;
    v_reserved boolean;
    v_headers json := nullif(current_setting('request.headers', true), '')::json;
    v_client text;
begin
    -- Límites contra pedidos falsos en masa
    v_client := md5(coalesce(
        v_headers ->> 'cf-connecting-ip',
        split_part(v_headers ->> 'x-forwarded-for', ',', 1),
        ''
    ));

    if (select count(*) from public.orders
        where created_at > now() - interval '1 hour') >= 120 then
        raise exception 'Demasiados pedidos';
    end if;

    if (select count(*) from public.orders
        where client_hash = v_client
        and created_at > now() - interval '10 minutes') >= 10 then
        raise exception 'Demasiados pedidos';
    end if;

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

    -- Las formas de entrega las define cada tienda (scripts/tienda-config.js)
    if p_delivery_method !~ '^[a-z0-9-]{2,40}$' then
        raise exception 'Forma de entrega inválida';
    end if;

    if char_length(trim(p_delivery_zone)) not between 2 and 200 then
        raise exception 'Zona de entrega inválida';
    end if;

    if p_items is null
        or jsonb_typeof(p_items) <> 'array'
        or jsonb_array_length(p_items) not between 1 and 50 then
        raise exception 'Productos inválidos';
    end if;

    insert into public.orders (code, customer_name, customer_phone, details, payment_method, delivery_method, delivery_zone, client_hash)
    values (p_code, trim(p_customer_name), trim(p_customer_phone), trim(p_details), p_payment_method, p_delivery_method, trim(p_delivery_zone), v_client)
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

        v_units := v_units + v_quantity;

        -- Sin este tope, pocos pedidos falsos dejarían la tienda sin stock
        if v_units > 20 then
            raise exception 'Máximo 20 unidades por pedido. Para más, escribinos por WhatsApp.';
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

        -- Se descuenta en un solo paso: dos compras no pueden llevarse la última unidad
        v_reserved := false;

        if v_product.track_stock then

            update public.product_stock
            set quantity = quantity - v_quantity
            where product_id = v_product.id
                and size = v_size
                and color = v_color
                and quantity >= v_quantity;

            if not found then
                raise exception 'Sin stock: % %', v_product.name,
                    nullif(concat_ws(' ', nullif(v_size, ''), nullif(v_color, '')), '');
            end if;

            v_reserved := true;

        end if;

        insert into public.order_items (order_id, product_id, name, size, color, unit_price, unit_cost, quantity, stock_reserved)
        values (
            v_order_id, v_product.id, v_product.name, v_size, v_color, v_product.price,
            (select cost from public.product_costs where product_id = v_product.id),
            v_quantity,
            v_reserved
        );

        v_subtotal := v_subtotal + v_product.price * v_quantity;
        v_pending := v_pending or v_product.price = 0;
    end loop;

    -- Los porcentajes se cargan en el panel (pestaña Ajustes)
    select case p_payment_method
            when 'mercado-pago' then descuento_mercado_pago
            when 'transferencia' then descuento_transferencia
            else 0
        end
    into v_percent
    from public.ajustes
    where id = 1;

    v_discount := round(v_subtotal * coalesce(v_percent, 0) / 100.0);

    update public.orders
    set subtotal = v_subtotal,
        discount = v_discount,
        total = v_subtotal - v_discount,
        has_pending_prices = v_pending
    where id = v_order_id;
end;
$$;
