-- =====================================
-- TIENDA - STOCK, OFERTAS, BANNERS Y ENTREGA
-- Ejecutar una sola vez en el SQL Editor de Supabase,
-- después de migracion-seguridad.sql.
-- No borra productos ni ventas.
-- =====================================


-- PRODUCTOS

alter table public.products
    add column track_stock boolean not null default false,
    add column on_offer boolean not null default false,
    add column compare_price integer check (compare_price >= 0);


-- STOCK POR TALLE Y COLOR

create table public.product_stock (
    product_id text not null references public.products (id) on delete cascade,
    size text not null default '',
    color text not null default '',
    quantity integer not null default 0 check (quantity >= 0),
    primary key (product_id, size, color)
);

alter table public.product_stock enable row level security;

revoke all on public.product_stock from anon, authenticated;

grant select on public.product_stock to anon, authenticated;
grant insert, update, delete on public.product_stock to authenticated;

create policy "todos ven el stock" on public.product_stock
    for select to anon, authenticated
    using (true);

create policy "admin crea stock" on public.product_stock
    for insert to authenticated
    with check (public.is_admin());

create policy "admin edita stock" on public.product_stock
    for update to authenticated
    using (public.is_admin())
    with check (public.is_admin());

create policy "admin borra stock" on public.product_stock
    for delete to authenticated
    using (public.is_admin());


-- BANNERS

create table public.banners (
    id uuid primary key default gen_random_uuid(),
    image_url text not null,
    alt text not null check (char_length(alt) between 2 and 160),
    active boolean not null default true,
    sort_order integer not null default 100,
    created_at timestamptz not null default now()
);

alter table public.banners enable row level security;

revoke all on public.banners from anon, authenticated;

grant select on public.banners to anon, authenticated;
grant insert, update, delete on public.banners to authenticated;

create policy "todos ven banners activos" on public.banners
    for select to anon, authenticated
    using (active or public.is_admin());

create policy "admin crea banners" on public.banners
    for insert to authenticated
    with check (public.is_admin());

create policy "admin edita banners" on public.banners
    for update to authenticated
    using (public.is_admin())
    with check (public.is_admin());

create policy "admin borra banners" on public.banners
    for delete to authenticated
    using (public.is_admin());

insert into public.banners (image_url, alt, sort_order) values
    ('img/banners/Banner_inicio.jpg', 'la tienda', 1),
    ('img/banners/banner_descuento.jpg', 'Hasta 25% off en productos seleccionados', 2),
    ('img/banners/banner_ofertas.jpg', '20% off, 12 cuotas y envíos en 24 horas', 3);


-- ENTREGA Y RESERVA DE STOCK EN LOS PEDIDOS

alter table public.orders
    add column delivery_method text not null default ''
        check (delivery_method in ('', 'encuentro', 'uber')),
    add column delivery_zone text not null default '';

alter table public.order_items
    add column stock_reserved boolean not null default false;


-- CREAR PEDIDO DESDE LA TIENDA

drop function public.create_order(text, text, text, text, text, jsonb);

create function public.create_order(
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

    if p_delivery_method not in ('encuentro', 'uber') then
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

revoke all on function public.create_order(text, text, text, text, text, text, text, jsonb) from public;
grant execute on function public.create_order(text, text, text, text, text, text, text, jsonb) to anon, authenticated;


-- DEVOLVER EL STOCK AL CANCELAR

create function public.sync_order_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_item public.order_items%rowtype;
begin
    if new.status = old.status
        or (new.status <> 'cancelado' and old.status <> 'cancelado') then
        return new;
    end if;

    for v_item in
        select * from public.order_items
        where order_id = new.id and stock_reserved
    loop
        if new.status = 'cancelado' then

            update public.product_stock
            set quantity = quantity + v_item.quantity
            where product_id = v_item.product_id
                and size = v_item.size
                and color = v_item.color;

        else

            -- Reactivar un pedido vuelve a tomar el stock
            update public.product_stock
            set quantity = quantity - v_item.quantity
            where product_id = v_item.product_id
                and size = v_item.size
                and color = v_item.color
                and quantity >= v_item.quantity;

            if not found then
                raise exception 'Sin stock para reactivar el pedido: %', v_item.name;
            end if;

        end if;
    end loop;

    return new;
end;
$$;

revoke all on function public.sync_order_stock() from public, anon, authenticated;

create trigger orders_sync_stock
    after update of status on public.orders
    for each row
    execute function public.sync_order_stock();
