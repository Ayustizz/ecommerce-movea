-- =====================================
-- MOVEA - BASE DE DATOS
-- Ejecutar completo una sola vez en el SQL Editor de Supabase.
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
    details text not null,
    payment_method text not null check (payment_method in ('mercado-pago', 'transferencia', 'entrega')),
    subtotal integer not null default 0,
    discount integer not null default 0,
    total integer not null default 0,
    has_pending_prices boolean not null default false,
    status text not null default 'pendiente' check (status in ('pendiente', 'pagado', 'entregado', 'cancelado')),
    created_at timestamptz not null default now()
);

create table public.order_items (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references public.orders (id) on delete cascade,
    product_id text references public.products (id) on delete set null,
    name text not null,
    unit_price integer not null,
    quantity integer not null check (quantity between 1 and 99)
);

create index order_items_order_id_idx on public.order_items (order_id);
create index orders_created_at_idx on public.orders (created_at desc);


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


-- CREAR PEDIDO DESDE LA TIENDA
-- Es la única forma de escribir ventas sin ser admin.
-- Los precios salen de la base, nunca del navegador del cliente.

create function public.create_order(
    p_code text,
    p_customer_name text,
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

    if char_length(trim(p_details)) not between 1 and 1000 then
        raise exception 'Detalles inválidos';
    end if;

    if p_payment_method not in ('mercado-pago', 'transferencia', 'entrega') then
        raise exception 'Método de pago inválido';
    end if;

    if jsonb_typeof(p_items) <> 'array'
        or jsonb_array_length(p_items) not between 1 and 50 then
        raise exception 'Productos inválidos';
    end if;

    insert into public.orders (code, customer_name, details, payment_method)
    values (p_code, trim(p_customer_name), trim(p_details), p_payment_method)
    on conflict (code) do nothing
    returning id into v_order_id;

    if v_order_id is null then
        return;
    end if;

    for v_item in select * from jsonb_array_elements(p_items) loop
        v_quantity := (v_item ->> 'quantity')::integer;

        if v_quantity not between 1 and 99 then
            raise exception 'Cantidad inválida';
        end if;

        select * into v_product
        from public.products
        where id = v_item ->> 'id' and active;

        if not found then
            raise exception 'Producto no disponible';
        end if;

        insert into public.order_items (order_id, product_id, name, unit_price, quantity)
        values (v_order_id, v_product.id, v_product.name, v_product.price, v_quantity);

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

revoke all on function public.create_order(text, text, text, text, jsonb) from public;
grant execute on function public.create_order(text, text, text, text, jsonb) to anon, authenticated;


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


-- PRODUCTOS ACTUALES

insert into public.products (id, name, description, category, price, image_url, featured, sort_order) values
    ('buzo-blanco', 'Buzo blanco', 'Buzo deportivo femenino, cómodo y versátil para acompañarte antes y después del entrenamiento.', 'buzos', 20000, 'img/Img_portadas/Buzo-blanco.png', true, 1),
    ('buzo-marron', 'Buzo marrón', 'Buzo deportivo femenino, cómodo y versátil para acompañarte antes y después del entrenamiento.', 'buzos', 20000, 'img/Img_portadas/Buzo-marron.png', true, 2),
    ('joggin-negro', 'Jogging negro', 'Jogging deportivo femenino, cómodo y flexible, diseñado para acompañarte en tus entrenamientos.', 'joggers', 17000, 'img/Img_portadas/joggin-negro.png', true, 3),
    ('top-marron', 'Top marrón', 'Top deportivo cómodo y ligero, ideal para entrenamientos y actividades de alto movimiento.', 'tops', 30000, 'img/Img_portadas/top-marron.png', true, 4),
    ('short-rojo', 'Short rojo', 'Short deportivo liviano y cómodo para moverte con libertad durante tus entrenamientos.', 'shorts', 50000, 'img/Img_portadas/Shorts_rojo.jpeg', true, 5),
    ('short-negro-azul', 'Short negro y azul', 'Short deportivo versátil, pensado para acompañarte en tus actividades y entrenamientos.', 'shorts', 20000, 'img/Img_portadas/Shorts_negro_y_azul.jpeg', true, 6),
    ('short-azul-marron', 'Short azul claro y marrón', 'Short deportivo cómodo y práctico, con una combinación de colores ideal para tus días activos.', 'shorts', 30000, 'img/Img_portadas/Shorts_azulclaro_y_marron.jpeg', true, 7);
