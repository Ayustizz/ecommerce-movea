-- =====================================
-- TIENDA - BASE DE DATOS
-- Ejecutar completo una sola vez en el SQL Editor de Supabase, solo en una base nueva.
-- =====================================


-- ADMINISTRADORES

create table public.admins (
    user_id uuid primary key references auth.users (id) on delete cascade
);

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.admins where user_id = auth.uid()
    );
$$;


-- PRODUCTOS

create table public.products (
    id text primary key,
    name text not null check (char_length(name) between 2 and 80),
    description text not null default '' check (char_length(description) <= 500),
    category text not null check (category in ('buzos', 'joggers', 'tops', 'shorts')),
    price integer not null default 0 check (price >= 0),
    sizes text[] not null default '{}',
    colors text[] not null default '{}',
    image_url text not null default '',
    active boolean not null default true,
    featured boolean not null default false,
    sort_order integer not null default 100,
    created_at timestamptz not null default now()
);


-- VENTAS

create table public.orders (
    id uuid primary key default gen_random_uuid(),
    code text not null unique,
    customer_name text not null,
    customer_phone text not null default '',
    details text not null,
    payment_method text not null check (payment_method in ('mercado-pago', 'transferencia', 'entrega')),
    subtotal integer not null default 0,
    discount integer not null default 0,
    total integer not null default 0,
    has_pending_prices boolean not null default false,
    client_hash text not null default '',
    mp_init_point text,
    mp_payment_id text,
    mp_status text,
    status text not null default 'pendiente' check (status in ('pendiente', 'pagado', 'entregado', 'cancelado')),
    created_at timestamptz not null default now()
);

create table public.order_items (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders (id) on delete cascade,
    product_id text references public.products (id) on delete set null,
    name text not null,
    size text not null default '',
    color text not null default '',
    unit_price integer not null,
    unit_cost integer,
    quantity integer not null check (quantity between 1 and 99)
);

create index order_items_order_id_idx on public.order_items (order_id);
create index orders_created_at_idx on public.orders (created_at desc);
create index orders_client_hash_idx on public.orders (client_hash, created_at desc);


-- PERMISOS

alter table public.admins enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

revoke all on public.admins, public.products, public.orders, public.order_items from anon, authenticated;

grant select on public.admins to authenticated;
grant select on public.products to anon, authenticated;
grant insert, update, delete on public.products to authenticated;
grant select, update on public.orders to authenticated;
grant select on public.order_items to authenticated;

create policy "cada admin ve su fila" on public.admins
    for select to authenticated
    using (user_id = auth.uid());

create policy "todos ven productos activos" on public.products
    for select to anon, authenticated
    using (active or public.is_admin());

create policy "admin crea productos" on public.products
    for insert to authenticated
    with check (public.is_admin());

create policy "admin edita productos" on public.products
    for update to authenticated
    using (public.is_admin())
    with check (public.is_admin());

create policy "admin borra productos" on public.products
    for delete to authenticated
    using (public.is_admin());

create policy "admin ve ventas" on public.orders
    for select to authenticated
    using (public.is_admin());

create policy "admin edita ventas" on public.orders
    for update to authenticated
    using (public.is_admin())
    with check (public.is_admin());

create policy "admin ve detalle de ventas" on public.order_items
    for select to authenticated
    using (public.is_admin());


-- COSTOS Y GASTOS
-- Van aparte de products porque esa tabla es pública.

create table public.product_costs (
    product_id text primary key references public.products (id) on delete cascade,
    cost integer not null check (cost >= 0)
);

create table public.expenses (
    id uuid primary key default gen_random_uuid(),
    spent_on date not null default current_date,
    concept text not null check (char_length(concept) between 2 and 120),
    category text not null check (category in ('envios', 'publicidad', 'packaging', 'comisiones', 'otros')),
    amount integer not null check (amount > 0),
    created_at timestamptz not null default now()
);

create index expenses_spent_on_idx on public.expenses (spent_on desc);

alter table public.product_costs enable row level security;
alter table public.expenses enable row level security;

revoke all on public.product_costs, public.expenses from anon, authenticated;

grant select, insert, update, delete on public.product_costs, public.expenses to authenticated;

create policy "admin maneja costos" on public.product_costs
    for all to authenticated
    using (public.is_admin())
    with check (public.is_admin());

create policy "admin maneja gastos" on public.expenses
    for all to authenticated
    using (public.is_admin())
    with check (public.is_admin());


-- CREAR PEDIDO DESDE LA TIENDA
-- Es la única forma de escribir ventas sin ser admin.
-- Los precios salen de la base, nunca del navegador del cliente.

create or replace function public.create_order(
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

    if p_items is null
        or jsonb_typeof(p_items) <> 'array'
        or jsonb_array_length(p_items) not between 1 and 50 then
        raise exception 'Productos inválidos';
    end if;

    insert into public.orders (code, customer_name, customer_phone, details, payment_method, client_hash)
    values (p_code, trim(p_customer_name), trim(p_customer_phone), trim(p_details), p_payment_method, v_client)
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

        insert into public.order_items (order_id, product_id, name, size, color, unit_price, unit_cost, quantity)
        values (
            v_order_id, v_product.id, v_product.name, v_size, v_color, v_product.price,
            (select cost from public.product_costs where product_id = v_product.id),
            v_quantity
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

revoke all on function public.create_order(text, text, text, text, text, jsonb) from public;
grant execute on function public.create_order(text, text, text, text, text, jsonb) to anon, authenticated;


-- FOTOS DE PRODUCTOS

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
    'product-images',
    'product-images',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
);

create policy "admin ve archivos de fotos" on storage.objects
    for select to authenticated
    using (bucket_id = 'product-images' and public.is_admin());

create policy "admin sube fotos" on storage.objects
    for insert to authenticated
    with check (bucket_id = 'product-images' and public.is_admin());

create policy "admin borra fotos" on storage.objects
    for delete to authenticated
    using (bucket_id = 'product-images' and public.is_admin());


-- PRODUCTOS
-- La tienda empieza vacía: los productos se cargan desde el panel.

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


-- CATEGORÍAS Y SUBCATEGORÍAS

create table public.categories (
    slug text primary key check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 80),
    name text not null check (char_length(name) between 2 and 60),
    parent_slug text references public.categories (slug) on delete cascade,
    sort_order integer not null default 100,
    created_at timestamptz not null default now(),
    check (parent_slug is distinct from slug)
);

alter table public.categories enable row level security;

revoke all on public.categories from anon, authenticated;

grant select on public.categories to anon, authenticated;
grant insert, update, delete on public.categories to authenticated;

create policy "todos ven categorias" on public.categories
    for select to anon, authenticated
    using (true);

create policy "admin crea categorias" on public.categories
    for insert to authenticated
    with check (public.is_admin());

create policy "admin edita categorias" on public.categories
    for update to authenticated
    using (public.is_admin())
    with check (public.is_admin());

create policy "admin borra categorias" on public.categories
    for delete to authenticated
    using (public.is_admin());

-- Las categorías las crea cada tienda desde el panel (pestaña Categorías).


-- PRODUCTOS
-- Una categoría con productos no se puede borrar.

alter table public.products
    drop constraint products_category_check,
    alter column category drop not null;


alter table public.products
    add constraint products_category_fkey
        foreign key (category) references public.categories (slug)
        on update cascade on delete restrict;


-- PAGO Y ENTREGA
-- status pasa a ser solo el pago: pendiente, pagado o cancelado.
-- La entrega se marca aparte, así un pedido puede estar pagado y sin entregar
-- o entregado y todavía sin cobrar.

alter table public.orders
    add column delivered boolean not null default false;

update public.orders
set status = 'pagado', delivered = true
where status = 'entregado';

alter table public.orders
    drop constraint orders_status_check,
    add constraint orders_status_check
        check (status in ('pendiente', 'pagado', 'cancelado'));


-- ELIMINAR PEDIDOS

grant delete on public.orders to authenticated;

create policy "admin borra ventas" on public.orders
    for delete to authenticated
    using (public.is_admin());

-- Un pedido que no estaba cancelado todavía tiene el stock tomado: se devuelve.

create function public.return_deleted_order_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_item public.order_items%rowtype;
begin
    if old.status = 'cancelado' then
        return old;
    end if;

    for v_item in
        select * from public.order_items
        where order_id = old.id and stock_reserved
    loop
        update public.product_stock
        set quantity = quantity + v_item.quantity
        where product_id = v_item.product_id
            and size = v_item.size
            and color = v_item.color;
    end loop;

    return old;
end;
$$;

revoke all on function public.return_deleted_order_stock() from public, anon, authenticated;

create trigger orders_return_stock_on_delete
    before delete on public.orders
    for each row
    execute function public.return_deleted_order_stock();


-- CREAR PEDIDO DESDE LA TIENDA
-- Es la misma función de migracion-tienda.sql; solo cambia el descuento.

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

    -- Mismos porcentajes que PAYMENT_CONFIG.discounts en scripts/carrito.js
    if p_payment_method in ('mercado-pago', 'transferencia') then
        v_discount := round(v_subtotal * 10 / 100.0);
    end if;

    update public.orders
    set subtotal = v_subtotal,
        discount = v_discount,
        total = v_subtotal - v_discount,
        has_pending_prices = v_pending
    where id = v_order_id;
end;
$$;


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
