-- =====================================
-- TIENDA - COSTOS Y CUENTAS DEL NEGOCIO
-- Ejecutar una sola vez en el SQL Editor de Supabase,
-- después de migracion-talles-y-colores.sql.
-- No borra productos ni ventas.
-- =====================================


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

-- Costo de cada producto al momento de la venta
alter table public.order_items
    add column unit_cost integer;

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
